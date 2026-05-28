import React, { createContext, useContext, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import SSEService from '../services/SSEService';

const SSEContext = createContext(null);

// ✅ Глобальный singleton SSEService
let globalSSEService = null;
let currentUserId = null;
let lastConnectionAttempt = 0;

export const SSEProvider = ({ children }) => {
    const sseServiceRef = useRef(null);
    const [serviceReady, setServiceReady] = React.useState(false);
    const initializingRef = useRef(false);
    
    // ✅ Получаем userId из AuthContext ВНУТРИбеш Provider'а
    const { user } = useAuth();
    const userId = user?.id;

    useEffect(() => {
        if (!userId) {
            console.log('⏳ SSEProvider: Waiting for userId...');
            return;
        }

        // ✅ ЗАЩИТА: Предотвращаем одновременную инициализацию
        if (initializingRef.current) {
            console.log('⏳ SSEProvider: Initialization already in progress, skipping...');
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
            currentUserId = null;
            lastConnectionAttempt = 0;
        }

        // ✅ КРИТИЧНО: Проверяем что соединение живо (не закрыто после перезагрузки)
        // При перезагрузке браузер закрывает все EventSource соединения,
        // поэтому НУЖНО пересоздать их, даже если объект globalSSEService существует
        if (globalSSEService && currentUserId === userId) {
            const status = globalSSEService.getConnectionStatus();
            
            console.log('🔍 SSEProvider: Checking existing service status:', {
                isConnected: status.isConnected,
                channels: status.channels,
                aliveChannels: status.aliveChannels
            });

            // Все каналы должны быть живы
            if (status.isConnected && 
                status.channels && status.channels.length > 0 &&
                status.aliveChannels && status.aliveChannels.length > 0 &&
                status.aliveChannels.length === status.channels.length) {
                
                console.log('🌍 SSEProvider: Reusing existing SSEService for user:', userId, 'Alive channels:', status.aliveChannels.length);
                sseServiceRef.current = globalSSEService;
                setServiceReady(true);
                return;
            } else {
                // Хотя бы один канал мертв - создаем новое
                console.log('🔄 SSEProvider: Old SSE connection has dead channels, recreating...', {
                    expectedChannels: status.channels,
                    aliveChannels: status.aliveChannels
                });
                globalSSEService.disconnectAll();
                globalSSEService = null;
                sseServiceRef.current = null;
                lastConnectionAttempt = 0;
            }
        }

        // ✅ Создаем НОВЫЙ глобальный SSE сервис
        if (!sseServiceRef.current) {
            initializingRef.current = true;
            
            // Защита от слишком частых попыток переподключения
            const now = Date.now();
            if (lastConnectionAttempt && (now - lastConnectionAttempt) < 1000) {
                console.log('⏳ SSEProvider: Skipping connection attempt, last attempt was too recent');
                initializingRef.current = false;
                return;
            }
            lastConnectionAttempt = now;
            
            console.log('✨ SSEProvider: Creating new SSEService for user:', userId);
            
            const newService = new SSEService(userId);
            sseServiceRef.current = newService;
            globalSSEService = newService;
            currentUserId = userId;
            
            // ✅ Инициализируем глобальное соединение с retry логикой
            const initializeConnection = async (attempt = 1) => {
                try {
                    await newService.connect();
                    console.log('✅ SSEProvider: Global SSE connection established');
                    setServiceReady(true);
                    initializingRef.current = false;
                } catch (err) {
                    console.error(`❌ SSEProvider: Failed to initialize SSE (attempt ${attempt}):`, err);
                    
                    // Retry не более 3 раз
                    if (attempt < 3 && sseServiceRef.current === newService) {
                        const retryDelay = 1000 * attempt; // 1s, 2s, 3s
                        console.log(`⏳ SSEProvider: Will retry in ${retryDelay}ms...`);
                        
                        setTimeout(() => {
                            if (sseServiceRef.current === newService) {
                                console.log(`🔄 SSEProvider: Retrying connection (attempt ${attempt + 1})...`);
                                initializeConnection(attempt + 1);
                            }
                        }, retryDelay);
                    } else {
                        // Сдались, но все равно помечаем готовым
                        console.error('❌ SSEProvider: Failed to connect after retries');
                        setServiceReady(true);
                        initializingRef.current = false;
                    }
                }
            };
            
            initializeConnection();
        }

        // ✅ Cleanup: НЕ закрываем соединение при размонтировании Provider
        return () => {
            // SSE жив для всего приложения, не закрываем
        };
    }, [userId]);

    // ✅ Мемоизируем value, обновляем при смене serviceReady
    const value = useMemo(() => {
        const service = sseServiceRef.current || globalSSEService;
        return {
            sseService: service,
            isReady: serviceReady,
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
            isReady: false,
            subscribe: () => () => {}
        };
    }
    
    return context;
};
