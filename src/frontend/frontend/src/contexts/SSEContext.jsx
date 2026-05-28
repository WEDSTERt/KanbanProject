import React, { createContext, useContext, useEffect, useRef, useMemo } from 'react';
import SSEService from '../services/SSEService';

const SSEContext = createContext(null);

// ✅ Глобальный singleton SSEService
let globalSSEService = null;
let currentUserId = null;

export const SSEProvider = ({ children, userId }) => {
    const sseServiceRef = useRef(null);
    const [serviceReady, setServiceReady] = React.useState(false);

    useEffect(() => {
        if (!userId) {
            console.log('⚠️ SSEProvider: No userId provided');
            return;
        }

        console.log('🌍 SSEProvider: Initializing for userId:', userId);

        // ✅ КРИТИЧНО: Если userId изменился - пересоздаем сервис
        if (currentUserId && currentUserId !== userId) {
            console.log(`🔄 SSEProvider: userId changed from ${currentUserId} to ${userId}, recreating SSEService`);
            if (globalSSEService) {
                globalSSEService.disconnectAll();
            }
            globalSSEService = null;
            sseServiceRef.current = null;
        }

        // ✅ КРИТИЧНО: Проверяем что soединение живо (не закрыто после перезагрузки)
        if (globalSSEService && currentUserId === userId) {
            const status = globalSSEService.getConnectionStatus();
            if (status.isConnected && status.channels.length > 0) {
                console.log('🌍 SSEProvider: Reusing existing SSEService for user:', userId);
                sseServiceRef.current = globalSSEService;
                setServiceReady(true);
                return;
            } else {
                // Соединение мертво - создаем новое
                console.log('🔄 SSEProvider: Old SSE connection is dead, recreating...');
                globalSSEService.disconnectAll();
                globalSSEService = null;
                sseServiceRef.current = null;
            }
        }

        // ✅ Создаем НОВЫЙ глобальный SSE сервис
        if (!sseServiceRef.current) {
            console.log('✨ SSEProvider: Creating new SSEService for user:', userId);
            
            const newService = new SSEService(userId);
            sseServiceRef.current = newService;
            globalSSEService = newService;
            currentUserId = userId;
            
            // ✅ Инициализируем глобальное соединение
            newService.connect()
                .then(() => {
                    console.log('✅ SSEProvider: Global SSE connection established');
                    setServiceReady(true);
                })
                .catch(err => {
                    console.error('❌ SSEProvider: Failed to initialize SSE:', err);
                    setServiceReady(true); // Все равно продолжаем, компоненты сами переподключатся
                });
        }

        // ✅ Cleanup: НЕ закрываем соединение при размонтировании Provider
        return () => {
            // SSE жив для всего приложения
        };
    }, [userId]);

    // ✅ Мемоизируем value
    const value = useMemo(() => {
        const service = sseServiceRef.current || globalSSEService;
        return {
            sseService: service,
            subscribe: (eventName, callback) => {
                if (service) {
                    return service.subscribe(eventName, callback);
                }
                console.warn('⚠️ SSEProvider.subscribe: service is null');
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
    
    if (!context) {
        console.warn('⚠️ useSSE called outside SSEProvider');
        return {
            sseService: null,
            subscribe: () => () => {}
        };
    }
    
    return context;
};
