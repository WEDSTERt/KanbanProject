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
 * - task-updated: Задача обновлена
 * - task-deleted: Задача удалена
 */

class SSEService {
  constructor(userId) {
    this.userId = userId;
    
    // 🔧 PRODUCTION FIX: Use relative URLs to avoid CSP issues
    // Relative URLs are treated as 'self' in Content-Security-Policy
    // This works even if CloudPub overrides the CSP header
    this.baseUrl = '';  // Empty string = use current origin
    
    this.token = localStorage.getItem('jwtToken');
    
    // Хранилище подписчиков: eventName -> [callbacks]
    this.subscribers = new Map();
    
    // Хранилище EventSource объектов
    this.eventSources = new Map();
    
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
  connect() {
    if (!this.token) {
      console.error('❌ No JWT token found');
      return;
    }

    // ✅ Relative URL for CSP compatibility
    const url = `/api/sse/subscribe/${this.userId}?token=${this.token}`;
    console.log('🔌 Connecting to global SSE channel:', url);

    try {
      const eventSource = new EventSource(url);
      this.eventSources.set('global', eventSource);

      eventSource.addEventListener('projects-changed', (event) => {
        console.log('📬 Projects list changed:', event.data);
        this.notifySubscribers('projects-changed', JSON.parse(event.data));
      });

      eventSource.addEventListener('project-removed', (event) => {
        console.log('📬 You were removed from project:', event.data);
        this.notifySubscribers('project-removed', JSON.parse(event.data));
      });

      eventSource.addEventListener('notification-received', (event) => {
        console.log('📬 Notification received:', event.data);
        const data = JSON.parse(event.data);
        this.notifySubscribers('notification-received', data);
      });

      eventSource.addEventListener('error', (event) => {
        console.error('❌ SSE connection error:', event);
        this.handleConnectionError(eventSource, 'global');
      });

      eventSource.onopen = () => {
        console.log('✅ SSE Global connection established');
        this.reconnectAttempts = 0;
      };

    } catch (error) {
      console.error('❌ Failed to establish SSE connection:', error);
    }
  }

  /**
   * Подписаться на события конкретного проекта (подгруппы)
   */
  subscribeToProject(projectId) {
    if (!this.token) {
      console.error('❌ No JWT token found');
      return;
    }

    // ✅ Relative URL for CSP compatibility
    const url = `/api/sse/subscribe-project/${projectId}?token=${this.token}`;
    console.log('🔌 Subscribing to project:', projectId, '→', url);

    try {
      const eventSource = new EventSource(url);
      this.eventSources.set(`project-${projectId}`, eventSource);

      eventSource.addEventListener('subgroups-changed', (event) => {
        console.log(`📬 Subgroups changed in project ${projectId}:`, event.data);
        this.notifySubscribers('subgroups-changed', JSON.parse(event.data));
      });

      eventSource.addEventListener('error', (event) => {
        console.error(`❌ SSE project-${projectId} error:`, event);
        this.handleConnectionError(eventSource, `project-${projectId}`);
      });

      eventSource.onopen = () => {
        console.log(`✅ SSE Project-${projectId} connection established`);
      };

    } catch (error) {
      console.error('❌ Failed to subscribe to project:', error);
    }
  }

  /**
   * Подписаться на события конкретной подгруппы (задачи)
   */
  subscribeToSubgroup(subgroupId) {
    if (!this.token) {
      console.error('❌ No JWT token found');
      return;
    }

    // ✅ Relative URL for CSP compatibility
    const url = `/api/sse/subscribe-subgroup/${subgroupId}?token=${this.token}`;
    console.log('🔌 Subscribing to subgroup:', subgroupId, '→', url);

    try {
      const eventSource = new EventSource(url);
      this.eventSources.set(`subgroup-${subgroupId}`, eventSource);

      eventSource.addEventListener('task-updated', (event) => {
        console.log(`📬 Task updated in subgroup ${subgroupId}:`, event.data);
        this.notifySubscribers('task-updated', JSON.parse(event.data));
      });

      eventSource.addEventListener('task-deleted', (event) => {
        console.log(`📬 Task deleted in subgroup ${subgroupId}:`, event.data);
        this.notifySubscribers('task-deleted', JSON.parse(event.data));
      });

      eventSource.addEventListener('error', (event) => {
        console.error(`❌ SSE subgroup-${subgroupId} error:`, event);
        this.handleConnectionError(eventSource, `subgroup-${subgroupId}`);
      });

      eventSource.onopen = () => {
        console.log(`✅ SSE Subgroup-${subgroupId} connection established`);
      };

    } catch (error) {
      console.error('❌ Failed to subscribe to subgroup:', error);
    }
  }

  /**
   * Зарегистрировать обработчик события
   */
  subscribe(eventName, callback) {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }
    this.subscribers.get(eventName).push(callback);

    // Возвращаем функцию для отписки
    return () => {
      const callbacks = this.subscribers.get(eventName);
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
    const callbacks = this.subscribers.get(eventName) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in subscriber for ${eventName}:`, error);
      }
    });
  }

  /**
   * Обработка ошибки соединения с попыткой переподключения
   */
  handleConnectionError(eventSource, channelName) {
    console.log(`⏱️ SSE ${channelName} connection timeout/error, attempting to reconnect...`);
    
    eventSource.close();
    this.eventSources.delete(channelName);

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
    const eventSource = this.eventSources.get(channelName);
    if (eventSource) {
      eventSource.close();
      this.eventSources.delete(channelName);
      console.log(`🔌 Disconnected from ${channelName}`);
    }
  }

  /**
   * Закрыть все соединения
   */
  disconnectAll() {
    console.log('🔌 Disconnecting all SSE connections...');
    this.eventSources.forEach((eventSource, channelName) => {
      eventSource.close();
      console.log(`✅ Closed ${channelName}`);
    });
    this.eventSources.clear();
    this.subscribers.clear();
  }

  /**
   * Получить статус соединения
   */
  getConnectionStatus() {
    return {
      isConnected: this.eventSources.size > 0,
      channels: Array.from(this.eventSources.keys()),
      subscribers: Object.fromEntries(this.subscribers),
    };
  }
}

export default SSEService;
