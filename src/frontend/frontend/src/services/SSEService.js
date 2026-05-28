/**
 * SSEService.js - Управление Server-Sent Events подключениями
 * 
 * Это сервис для подключения к SSE каналам и получения real-time событий
 * вместо polling.
 * 
 * События:
 * - projects-changed: Изменения в списке проектов
 * - project-removed: Пользователя удалили из проекта
 * - notification-received: Новое уведомление
 * - subgroups-changed: Изменения в списке групп проекта
 * - task-created: Новая задача
 * - task-updated: Задача обновлена
 * - task-deleted: Задача удалена
 */

class SSEService {
  constructor(userId) {
    this.userId = userId;
    
    // 🔧 PRODUCTION FIX: Use relative URLs to avoid CSP issues
    // Relative URLs are treated as 'self' in Content-Security-Policy
    // This works even if CloudPub overrides the CSP header
    this.baseUrl = '/api/sse';
    
    this.token = localStorage.getItem('jwtToken');
    
    // Хранилище обработчиков: eventName -> [callbacks]
    this.handlers = {};
    this.subscribers = this.handlers;  // Alias for compatibility
    
    // Хранилище EventSource объектов
    this.connections = {};
    this.eventSources = this.connections;  // Alias for compatibility
    
    // Попытки переподключения
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3 секунды
    
    console.log('📡 SSEService initialized for user:', userId);
    console.log('📡 Using relative URLs (CSP-compatible)');
  }

  /**
   * Подключиться к глобальному каналу (проекты, уведомления)
   */
  async subscribeToGlobal() {
    return this._subscribe('global', `${this.baseUrl}/subscribe/${this.userId}`);
  }

  /**
   * Основной метод подписки на канал
   */
  async connect() {
    return this.subscribeToGlobal();
  }

  /**
   * Подписаться на события конкретного проекта (подгруппы)
   */
  async subscribeToProject(projectId) {
    return this._subscribe(`project-${projectId}`, `${this.baseUrl}/subscribe-project/${projectId}`);
  }

  /**
   * Подписаться на события конкретной подгруппы (задачи)
   */
  async subscribeToSubgroup(subgroupId) {
    return this._subscribe(`subgroup-${subgroupId}`, `${this.baseUrl}/subscribe-subgroup/${subgroupId}`);
  }

  /**
   * Internal subscribe method
   */
  _subscribe(connectionKey, url) {
    return new Promise((resolve, reject) => {
      try {
        // Если уже подписаны, не создавать новое соединение
        if (this.connections[connectionKey]) {
          resolve(this.connections[connectionKey]);
          return;
        }

        const eventSource = new EventSource(url);
        this.connections[connectionKey] = eventSource;

        // Set up event listeners for all event types
        const eventTypes = [
          'projects-changed',
          'project-removed',
          'notification-received',
          'subgroups-changed',
          'task-created',
          'task-updated',
          'task-deleted',
          'message',  // For generic messages
          'test'      // For testing
        ];

        eventTypes.forEach(eventType => {
          // Use arrow function to preserve 'this' context
          eventSource.addEventListener(eventType, (event) => {
            try {
              // Parse the data from SSE event
              const data = JSON.parse(event.data);
              // Emit to subscribers using the event type
              this._emit(eventType, data);
            } catch (error) {
              console.error('Error parsing SSE message:', error, event.data);
            }
          });
        });

        eventSource.addEventListener('error', (event) => {
          console.error(`❌ SSE connection error for ${connectionKey}:`, event);
          this.handleConnectionError(eventSource, connectionKey);
        });

        eventSource.onopen = () => {
          console.log(`✅ SSE ${connectionKey} connection established`);
          this.reconnectAttempts = 0;
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
    if (this.handlers[eventName]) {
      this.handlers[eventName].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in handler for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Зарегистрировать обработчик события
   */
  subscribe(eventName, callback) {
    if (!this.handlers[eventName]) {
      this.handlers[eventName] = [];
    }
    this.handlers[eventName].push(callback);

    // Возвращаем функцию для отписки
    return () => {
      const callbacks = this.handlers[eventName];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Оповестить всех подписчиков о событии
   */
  notifySubscribers(eventName, data) {
    this._emit(eventName, data);
  }

  /**
   * Обработка ошибки соединения с попыткой переподключения
   */
  handleConnectionError(eventSource, channelName) {
    console.log(`⏱️ SSE ${channelName} connection timeout/error, attempting to reconnect...`);
    
    eventSource.close();
    delete this.connections[channelName];

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      
      console.log(`⏳ Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
      
      setTimeout(() => {
        if (channelName === 'global') {
          this.connect();
        } else if (channelName.startsWith('project-')) {
          const projectId = channelName.split('-')[1];
          this.subscribeToProject(projectId);
        } else if (channelName.startsWith('subgroup-')) {
          const subgroupId = channelName.split('-')[1];
          this.subscribeToSubgroup(subgroupId);
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
      eventSource.close();
      delete this.connections[channelName];
      console.log(`🔌 Disconnected from ${channelName}`);
    }
  }

  /**
   * Закрыть все соединения
   */
  disconnectAll() {
    console.log('🔌 Disconnecting all SSE connections...');
    Object.keys(this.connections).forEach(channelName => {
      this.connections[channelName].close();
      console.log(`✅ Closed ${channelName}`);
    });
    this.connections = {};
    this.handlers = {};
  }

  /**
   * Получить статус соединения
   */
  getConnectionStatus() {
    return {
      isConnected: Object.keys(this.connections).length > 0,
      channels: Object.keys(this.connections),
      subscribers: this.handlers,
    };
  }
}

export default SSEService;
