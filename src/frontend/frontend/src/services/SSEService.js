/**
 * SSEService.js - Управление Server-Sent Events подключениями
 * 
 * ИСПРАВЛЕНИЯ для проблемы "SSE не работает после перезагрузки":
 * 1. Проверка живого соединения перед переиспользованием
 * 2. Автоматическое переподключение при разрыве
 * 3. Правильная очистка мертвых соединений
 */

class SSEService {
  constructor(userId) {
    this.userId = userId;
    this.baseUrl = '/api/sse';
    this.token = localStorage.getItem('jwtToken');

    // Хранилище обработчиков: eventName -> [callbacks]
    this.handlers = {};
    this.subscribers = this.handlers;

    // Хранилище EventSource объектов
    this.connections = {};
    this.eventSources = this.connections;

    // Попытки переподключения
    this.reconnectAttempts = {};
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;

    // Дебаунс таймеры
    this.refetchTimers = {};
    this.refetchDebounceMs = 100;

    console.log('📡 SSEService initialized for user:', userId);
  }

  /**
   * Проверить живо ли соединение
   */
  _isConnectionAlive(channelName) {
    const es = this.connections[channelName];
    if (!es) return false;
    
    // EventSource.readyState:
    // 0 = CONNECTING
    // 1 = OPEN
    // 2 = CLOSED
    return es.readyState === 0 || es.readyState === 1;
  }

  /**
   * Подключиться к глобальному каналу
   */
  async subscribeToGlobal() {
    return this._subscribe('global', `${this.baseUrl}/subscribe/${this.userId}`);
  }

  /**
   * Основной метод подписки
   */
  async connect() {
    return this.subscribeToGlobal();
  }

  /**
   * Подписаться на события проекта
   */
  async subscribeToProject(projectId) {
    return this._subscribe(`project-${projectId}`, `${this.baseUrl}/subscribe-project/${projectId}`);
  }

  /**
   * Подписаться на события подгруппы
   */
  async subscribeToSubgroup(subgroupId) {
    return this._subscribe(`subgroup-${subgroupId}`, `${this.baseUrl}/subscribe-subgroup/${subgroupId}`);
  }

  /**
   * Internal subscribe method - с проверкой живого соединения
   */
  _subscribe(connectionKey, url) {
    return new Promise((resolve, reject) => {
      try {
        // ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Проверяем что соединение живо
        if (this.connections[connectionKey]) {
          if (this._isConnectionAlive(connectionKey)) {
            console.log(`📡 Already subscribed to ${connectionKey}, reusing alive connection`);
            resolve(this.connections[connectionKey]);
            return;
          } else {
            // Соединение мертво - удаляем и создаем новое
            console.log(`🔄 Connection to ${connectionKey} is dead, reconnecting...`);
            try {
              this.connections[connectionKey].close();
            } catch (e) {
              // ignore
            }
            delete this.connections[connectionKey];
            delete this.reconnectAttempts[connectionKey];
          }
        }

        console.log(`📡 Connecting to ${connectionKey}...`);
        const eventSource = new EventSource(url);
        this.connections[connectionKey] = eventSource;

        if (!this.reconnectAttempts[connectionKey]) {
          this.reconnectAttempts[connectionKey] = 0;
        }

        // Все поддерживаемые типы событий
        const eventTypes = [
          'projects-changed',
          'project-removed',
          'notification-received',
          'subgroups-changed',
          'task-created',
          'task-updated',
          'task-deleted',
          'message',
          'test'
        ];

        eventTypes.forEach(eventType => {
          eventSource.addEventListener(eventType, (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log(`📨 Event received: ${eventType} from ${connectionKey}`, data);
              this._emit(eventType, data);
            } catch (error) {
              console.error(`Error parsing SSE message for ${eventType}:`, error, event.data);
            }
          });
        });

        eventSource.addEventListener('error', (event) => {
          console.error(`❌ SSE connection error for ${connectionKey}:`, event);
          this.handleConnectionError(connectionKey);
        });

        eventSource.onopen = () => {
          console.log(`✅ SSE ${connectionKey} connection established`);
          this.reconnectAttempts[connectionKey] = 0;
        };

        resolve(eventSource);
      } catch (error) {
        console.error(`Failed to subscribe to ${connectionKey}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Emit event to all subscribers
   */
  _emit(eventName, data) {
    if (!this.handlers[eventName] || this.handlers[eventName].length === 0) {
      return;
    }

    // Копируем массив чтобы избежать проблем при удалении во время итерации
    const handlersToCall = [...this.handlers[eventName]];
    console.log(`🔔 Emitting ${eventName} to ${handlersToCall.length} subscribers`);
    
    handlersToCall.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in handler for ${eventName}:`, error);
      }
    });
  }

  /**
   * Зарегистрировать обработчик события
   */
  subscribe(eventName, callback) {
    if (!this.handlers[eventName]) {
      this.handlers[eventName] = [];
    }

    // Проверяем дубликаты
    const isDuplicate = this.handlers[eventName].some(h => h === callback);
    if (isDuplicate) {
      console.warn(`⚠️ Duplicate subscription for ${eventName} detected, skipping`);
      return () => {};
    }

    this.handlers[eventName].push(callback);
    console.log(`✅ Handler registered for ${eventName}, total: ${this.handlers[eventName].length}`);

    // Гарантируем однократный вызов unsubscribe
    let unsubscribed = false;
    return () => {
      if (unsubscribed) {
        return;
      }
      unsubscribed = true;
      
      const callbacks = this.handlers[eventName];
      if (!callbacks) return;
      
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
        console.log(`🔌 Handler unregistered for ${eventName}, remaining: ${callbacks.length}`);
      }
    };
  }

  /**
   * Оповестить подписчиков
   */
  notifySubscribers(eventName, data) {
    this._emit(eventName, data);
  }

  /**
   * Обработка ошибки с переподключением
   */
  handleConnectionError(channelName) {
    console.log(`⏱️ SSE ${channelName} connection error, attempting to reconnect...`);

    const eventSource = this.connections[channelName];
    if (eventSource) {
      try {
        eventSource.close();
      } catch (e) {
        // ignore
      }
      delete this.connections[channelName];
    }

    if (!this.reconnectAttempts[channelName]) {
      this.reconnectAttempts[channelName] = 0;
    }

    if (this.reconnectAttempts[channelName] < this.maxReconnectAttempts) {
      this.reconnectAttempts[channelName]++;
      const delay = this.reconnectDelay * this.reconnectAttempts[channelName];

      console.log(`⏳ Reconnecting attempt ${this.reconnectAttempts[channelName]}/${this.maxReconnectAttempts} in ${delay}ms...`);

      setTimeout(() => {
        try {
          if (channelName === 'global') {
            this.connect().catch(err => console.error('Reconnect failed:', err));
          } else if (channelName.startsWith('project-')) {
            const projectId = channelName.split('-')[1];
            this.subscribeToProject(projectId).catch(err => console.error('Reconnect failed:', err));
          } else if (channelName.startsWith('subgroup-')) {
            const subgroupId = channelName.split('-')[1];
            this.subscribeToSubgroup(subgroupId).catch(err => console.error('Reconnect failed:', err));
          }
        } catch (e) {
          console.error('Error during reconnect:', e);
        }
      }, delay);
    } else {
      console.error(`❌ Failed to reconnect to ${channelName} after ${this.maxReconnectAttempts} attempts`);
    }
  }

  /**
   * Закрыть конкретное соединение
   */
  disconnect(channelName) {
    const eventSource = this.connections[channelName];
    if (eventSource) {
      try {
        eventSource.close();
      } catch (e) {
        // ignore
      }
      delete this.connections[channelName];
      delete this.reconnectAttempts[channelName];
      console.log(`🔌 Disconnected from ${channelName}`);
    }
  }

  /**
   * Закрыть все соединения
   */
  disconnectAll() {
    console.log('🔌 Disconnecting all SSE connections...');
    Object.keys(this.connections).forEach(channelName => {
      try {
        this.connections[channelName].close();
        console.log(`✅ Closed ${channelName}`);
      } catch (e) {
        console.error(`Error closing ${channelName}:`, e);
      }
    });
    this.connections = {};
    this.handlers = {};
    this.reconnectAttempts = {};
  }

  /**
   * Получить статус соединения
   */
  getConnectionStatus() {
    return {
      isConnected: Object.keys(this.connections).length > 0,
      channels: Object.keys(this.connections),
      aliveChannels: Object.keys(this.connections).filter(ch => this._isConnectionAlive(ch)),
      subscribers: Object.keys(this.handlers).reduce((acc, eventName) => {
        acc[eventName] = this.handlers[eventName].length;
        return acc;
      }, {}),
    };
  }
}

export default SSEService;
