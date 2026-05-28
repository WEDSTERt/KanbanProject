import React, { createContext, useContext, useEffect, useRef, useMemo } from 'react';
import SSEService from '../services/SSEService';

const SSEContext = createContext(null);

// Глобальный singleton SSEService
let globalSSEService = null;

export const SSEProvider = ({ children, userId }) => {
    const sseServiceRef = useRef(globalSSEService);
    const [serviceReady, setServiceReady] = React.useState(!!globalSSEService);

    useEffect(() => {
        if (!userId) return;

        // Если глобальный сервис уже существует - переиспользуем его
        if (globalSSEService) {
            sseServiceRef.current = globalSSEService;
            console.log('🌍 Reusing existing SSEService for user:', userId);
            setServiceReady(true);
            return;
        }

        // Создаем НОВЫЙ глобальный SSE сервис (один на всё приложение)
        if (!sseServiceRef.current) {
            sseServiceRef.current = new SSEService(userId);
            globalSSEService = sseServiceRef.current;
            sseServiceRef.current.connect();
            console.log('🌍 Global SSEService created and stored as singleton for user:', userId);
            setServiceReady(true);
        }

        return () => {
            // НЕ закрываем соединение при размонтировании - оно нужно для всего приложения
            console.log('⚠️ SSEProvider unmounted, but keeping SSE connection alive (singleton)');
        };
    }, [userId]);

    // Мемоизируем value чтобы не пересоздавать объект каждый render
    const value = useMemo(() => {
        const service = globalSSEService || sseServiceRef.current;
        return {
            sseService: service,
            subscribe: (eventName, callback) => {
                if (service) {
                    return service.subscribe(eventName, callback);
                }
                return () => {};
            }
        };
    }, [serviceReady]);

    return (
        <SSEContext.Provider value={value}>
            {children}
        </SSEContext.Provider>
    );
};

export const useSSE = () => {
    const context = useContext(SSEContext);
    
    // Если контекст не инициализирован, вернуть пустой объект
    if (!context) {
        console.warn('⚠️ useSSE called outside SSEProvider');
        return {
            sseService: null,
            subscribe: () => () => {}
        };
    }
    
    // ВСЕГДА возвращаем контекст (где хранится globalSSEService)
    return context;
};
