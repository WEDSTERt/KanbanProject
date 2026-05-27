import React, { createContext, useState, useCallback, useEffect } from 'react';
import WebSocketService from '../services/WebSocketService';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [notificationCounter, setNotificationCounter] = useState(0);

    const addNotification = useCallback((notification) => {
        const id = `${Date.now()}-${notificationCounter}`;
        setNotificationCounter(prev => prev + 1);
        const completeNotification = {
            id,
            timestamp: new Date(),
            ...notification,
        };

        setNotifications(prev => [completeNotification, ...prev].slice(0, 50));

        const timeout = notification.type === 'error' ? 7000 : 5000;
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, timeout);

        return id;
    }, [notificationCounter]);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    // WebSocket слушатель для in-app уведомлений
    useEffect(() => {
        const handleWebSocketNotification = (notification) => {
            addNotification({
                type: 'info',
                title: notification.title,
                message: notification.message,
            });
        };

        WebSocketService.subscribe(handleWebSocketNotification);

        return () => {
            WebSocketService.unsubscribe(handleWebSocketNotification);
        };
    }, [addNotification]);

    const value = {
        notifications,
        addNotification,
        removeNotification,
        clearAll,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = React.useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within NotificationProvider');
    }
    return context;
};
