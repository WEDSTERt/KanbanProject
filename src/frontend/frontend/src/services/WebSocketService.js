/**
 * WebSocket Service - простая реализация без внешних зависимостей
 * Использует встроенный WebSocket браузера
 */
class WebSocketService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.listeners = [];
        this.userId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
    }

    /**
     * Подключиться к WebSocket
     */
    connect(userId, onMessageCallback) {
        if (this.isConnected) {
            console.log('✅ Already connected to WebSocket');
            return;
        }

        this.userId = userId;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws-notifications`;

        console.log('📡 Connecting to WebSocket:', wsUrl);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;

                // Отправляем userId при подключении
                this.send({
                    type: 'SUBSCRIBE',
                    userId: userId
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const notification = JSON.parse(event.data);
                    console.log('📬 Notification received:', notification);

                    if (onMessageCallback) {
                        onMessageCallback(notification);
                    }

                    this.notifyListeners(notification);
                } catch (error) {
                    console.error('Error parsing notification:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };

            this.ws.onclose = () => {
                console.log('📡 WebSocket disconnected');
                this.isConnected = false;

                // Автоматическое переподключение
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    setTimeout(() => {
                        this.connect(userId, onMessageCallback);
                    }, this.reconnectDelay);
                }
            };
        } catch (error) {
            console.error('❌ WebSocket connection error:', error);
            this.isConnected = false;
        }
    }

    /**
     * Отправить сообщение
     */
    send(message) {
        if (this.ws && this.isConnected) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
            }
        }
    }

    /**
     * Отписаться и отключиться
     */
    disconnect() {
        if (this.ws) {
            console.log('🔌 Disconnecting WebSocket');
            this.isConnected = false;
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Подписаться на события уведомлений
     */
    subscribe(callback) {
        this.listeners.push(callback);
    }

    /**
     * Отписаться от событий
     */
    unsubscribe(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    /**
     * Уведомить всех слушателей
     */
    notifyListeners(notification) {
        this.listeners.forEach(callback => {
            try {
                callback(notification);
            } catch (error) {
                console.error('Error in notification listener:', error);
            }
        });
    }

    /**
     * Проверить статус подключения
     */
    isConnectedToWebSocket() {
        return this.isConnected;
    }

    /**
     * Получить статус подключения
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            userId: this.userId,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

export default new WebSocketService();
