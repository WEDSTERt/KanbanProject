import React, { createContext, useState, useCallback } from 'react';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((notification) => {
        const id = `${Date.now()}-${Math.random()}`;
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
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

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
