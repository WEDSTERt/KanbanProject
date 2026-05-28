import React, { useEffect, useState, useCallback } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { GET_UNREAD_COUNT, MARK_ALL_AS_READ } from '../graphql/notifications';
import './notificationBadge.css';

interface NotificationBadgeProps {
  userId?: number;
  onCountChange?: (count: number) => void;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ 
  userId, 
  onCountChange 
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // GraphQL query для получения начального количества
  const { data: countData, refetch: refetchCount } = useQuery(GET_UNREAD_COUNT, {
    skip: !userId,
    pollInterval: 0,
    onError: (err) => {
      console.error('❌ Error fetching unread count:', err);
      setError('Failed to load notifications');
    }
  });

  // GraphQL mutation для отметить все как прочитанные
  const [markAllAsRead, { loading: markingAll }] = useMutation(MARK_ALL_AS_READ, {
    onCompleted: () => {
      console.log('✅ All notifications marked as read');
      setUnreadCount(0);
      onCountChange?.(0);
    },
    onError: (err) => {
      console.error('❌ Error marking all as read:', err);
    }
  });

  // Обновить количество при получении данных с сервера
  useEffect(() => {
    if (countData?.unreadNotificationsCount !== undefined) {
      setUnreadCount(countData.unreadNotificationsCount);
      onCountChange?.(countData.unreadNotificationsCount);
    }
  }, [countData, onCountChange]);

  // Установить SSE соединение
  useEffect(() => {
    if (!userId) {
      console.warn('⚠️ NotificationBadge: userId not provided');
      return;
    }

    const connectToSSE = () => {
      try {
        const token = localStorage.getItem('authToken') || '';
        const sseUrl = `/api/sse/subscribe/${userId}?token=${token}`;
        
        console.log('📡 Connecting to SSE:', sseUrl);
        const eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('open', () => {
          console.log('✅ SSE Connection established');
          setIsConnected(true);
          setError(null);
        });

        // Событие: новое уведомление получено
        eventSource.addEventListener('notification-received', (event) => {
          try {
            console.log('📬 Notification received event');
            const data = JSON.parse(event.data);
            console.log('   Data:', data);
            
            // Увеличиваем счетчик
            setUnreadCount(prev => {
              const newCount = prev + 1;
              onCountChange?.(newCount);
              console.log('   New count:', newCount);
              return newCount;
            });

            // Можно добавить звуковое оповещение
            playNotificationSound();
          } catch (e) {
            console.error('❌ Error parsing notification event:', e);
          }
        });

        // Событие: количество непрочитанных изменилось
        eventSource.addEventListener('unread-count-changed', (event) => {
          try {
            console.log('📊 Unread count changed event');
            const data = JSON.parse(event.data);
            console.log('   New count:', data.unreadCount);
            
            setUnreadCount(data.unreadCount);
            onCountChange?.(data.unreadCount);
          } catch (e) {
            console.error('❌ Error parsing unread count event:', e);
          }
        });

        // Другие события (для информации)
        eventSource.addEventListener('projects-changed', () => {
          console.log('🔄 Projects changed');
        });

        eventSource.addEventListener('subgroups-changed', () => {
          console.log('🔄 Subgroups changed');
        });

        eventSource.addEventListener('task-updated', () => {
          console.log('🔄 Task updated');
        });

        eventSource.addEventListener('task-deleted', () => {
          console.log('🗑️ Task deleted');
        });

        eventSource.addEventListener('project-removed', (event) => {
          try {
            console.log('❌ Project removed');
            const data = JSON.parse(event.data);
            const projectId = data.projectId_field;
            
            // Редирект на главную
            console.log('🔄 Redirecting to home...');
            window.location.href = '/projects';
          } catch (e) {
            console.error('❌ Error handling project-removed event:', e);
          }
        });

        // Обработка ошибок
        eventSource.addEventListener('error', (event) => {
          console.error('❌ SSE Connection error:', event);
          setIsConnected(false);
          setError('Connection lost');
          eventSource.close();
          
          // Попытка переподключения через 5 секунд
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connectToSSE();
          }, 5000);
        });

        // Возвращаем функцию для закрытия соединения
        return () => {
          console.log('🔌 Closing SSE connection');
          eventSource.close();
        };
      } catch (e) {
        console.error('❌ Error connecting to SSE:', e);
        setError('Failed to connect');
      }
    };

    const cleanup = connectToSSE();
    return cleanup;
  }, [userId, onCountChange]);

  // Обработчик клика на кнопку "Mark All Read"
  const handleMarkAllAsRead = useCallback(() => {
    if (unreadCount === 0) {
      console.log('ℹ️ No unread notifications');
      return;
    }

    console.log('📮 Marking all notifications as read...');
    markAllAsRead();
  }, [unreadCount, markAllAsRead]);

  // Воспроизвести звук уведомления
  const playNotificationSound = () => {
    try {
      // Используем Web Audio API для простого звука
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.warn('⚠️ Audio notification not available');
    }
  };

  // Если userId не предоставлен, не рендерим
  if (!userId) {
    return null;
  }

  return (
    <div className="notification-badge-container">
      {/* Badge с числом */}
      <div className="notification-badge">
        {unreadCount > 0 ? (
          <>
            <span className="bell-icon">🔔</span>
            <span className={`badge-count ${isConnected ? 'pulse' : 'error'}`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </>
        ) : (
          <span className="bell-icon">🔔</span>
        )}

        {/* Dropdown меню */}
        {unreadCount > 0 && (
          <div className="notification-dropdown">
            <div className="dropdown-header">
              <span className="dropdown-title">Notifications</span>
              <button 
                className="close-btn"
                onClick={() => {
                  const dropdown = document.querySelector('.notification-dropdown');
                  if (dropdown) {
                    dropdown.style.display = 'none';
                  }
                }}
              >
                ✕
              </button>
            </div>

            <div className="dropdown-content">
              <p className="notification-count">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
              
              <button
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
              >
                {markingAll ? 'Marking...' : 'Mark All as Read'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SSE индикатор (опционально) */}
      {process.env.NODE_ENV === 'development' && (
        <div className={`sse-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢' : '🔴'}
        </div>
      )}

      {/* Сообщение об ошибке */}
      {error && (
        <div className="notification-error">
          {error}
        </div>
      )}
    </div>
  );
};

export default NotificationBadge;
