import React, { createContext, useContext, useEffect, useRef } from 'react';
import SSEService from '../services/SSEService';

const SSEContext = createContext(null);

export const SSEProvider = ({ children, userId }) => {
    const sseServiceRef = useRef(null);

    useEffect(() => {
        if (!userId) return;

        // Создаем глобальный SSE сервис (один на всё приложение)
        if (!sseServiceRef.current) {
            sseServiceRef.current = new SSEService(userId);
            sseServiceRef.current.connect();
            console.log('🌍 Global SSEService created for user:', userId);
        }

        return () => {
            // НЕ закрываем соединение при размонтировании - оно нужно для всего приложения
            console.log('⚠️ SSEProvider unmounted, but keeping SSE connection alive');
        };
    }, [userId]);

    const value = {
        sseService: sseServiceRef.current,
        subscribe: (eventName, callback) => {
            if (sseServiceRef.current) {
                return sseServiceRef.current.subscribe(eventName, callback);
            }
            return () => {};
        }
    };

    return (
        <SSEContext.Provider value={value}>
            {children}
        </SSEContext.Provider>
    );
};

export const useSSE = () => {
    const context = useContext(SSEContext);
    if (!context) {
        console.warn('⚠️ useSSE called outside SSEProvider');
        return {
            sseService: null,
            subscribe: () => () => {}
        };
    }
    return context;
};
