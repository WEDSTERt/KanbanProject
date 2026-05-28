import React, { useState, useEffect,useCallback } from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useSSE } from '../contexts/SSEContext';
import NotificationPanel from './NotificationPanel';
import { useQuery } from '@apollo/client';
import { GET_UNREAD_COUNT } from '../graphql/queries';

const Layout = ({children}) => {
    const {user, logout} = useAuth();
    const { subscribe, sseService, isReady } = useSSE();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { addNotification } = useNotification();
    const numericUserId = user?.id ? Number(user.id) : null;
    const { data: countData, refetch: refetchCount } = useQuery(GET_UNREAD_COUNT, {
        variables: { userId: numericUserId },
        skip: !numericUserId,
        pollInterval: 0,
    });
    useEffect(() => {
        if (countData?.unreadCount !== undefined) {
            setUnreadCount(countData.unreadCount);
        }
    }, [countData]);
    
    // 🆕 SSE подписка на новые уведомления (используем глобальный контекст)
    // ✅ ИСПРАВЛЕНИЕ: Ждем когда SSE будет готов (isReady = true)
    useEffect(() => {
        if (!user?.id || !isReady) {
            console.log('⏳ Layout: Waiting for SSE to be ready... (user:', user?.id, ', isReady:', isReady, ')');
            return;
        }

        console.log('🎯 Layout subscribing to SSE events');

        // Подписываемся на события notification-received
        const unsubscribe = subscribe('notification-received', (data) => {
            console.log('📬 Layout received notification-received event via SSE:', data);

            const newNotification = data.notification_field;
            if (newNotification) {
                // Увеличиваем счетчик
                refetchCount();

                // Показываем toast уведомление
                addNotification({
                    type: 'info',
                    title: 'Новое уведомление',
                    message: newNotification.title || 'Вам пришло новое уведомление',
                    duration: 5000,
                });

                // 🔔 Если участника добавили в проект, переподписываемся на новый проект
                if (newNotification.type === 'user_added_to_project' && newNotification.projectId) {
                    console.log('🔌 User was added to project', newNotification.projectId, ', resubscribing...');
                    if (sseService) {
                        setTimeout(() => {
                            sseService.subscribeToProject(newNotification.projectId);
                            console.log('✅ Resubscribed to project', newNotification.projectId);
                        }, 500);
                    }
                }

                // 🔔 Если участника добавили в группу, проверяем что он подписан на проект
                if (newNotification.type === 'SUBGROUP_MEMBER_ADDED' && newNotification.projectId) {
                    console.log('🔌 User was added to subgroup in project', newNotification.projectId, ', ensuring project subscription...');
                    if (sseService) {
                        setTimeout(() => {
                            sseService.subscribeToProject(newNotification.projectId);
                            console.log('✅ Ensured subscription to project', newNotification.projectId);
                        }, 500);
                    }
                }
            }
        });

        // Очищаем подписку при размонтировании
        return () => {
            console.log('🔌 Layout unsubscribing from SSE events');
            unsubscribe();
        };
    }, [user?.id, isReady, addNotification, subscribe, sseService, refetchCount]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app-root">
            <header className="app-navbar">
                <div className="app-logo">
                    <i className="fas fa-tasks"></i> Kanban Docky
                </div>
                <div className="app-nav-links">
                    <Link to="/"><i className="fas fa-folder-open"></i> Проекты</Link>
                    <button
                        className="btn btn--secondary btn--small notification-bell-btn"
                        onClick={() => setShowNotifications(true)}
                        title="Уведомления"
                    >
                        <i className="fas fa-bell"></i> Уведомления
                        {unreadCount > 0 && (
                            <span className="notification-badge">{unreadCount}</span>
                        )}
                    </button>
                    <span className="app-user-info" onClick={() => navigate('/account')} style={{cursor: 'pointer'}}>
                        <i className="fas fa-user-circle"></i> {user?.fullName}
                    </span>
                    <button className="btn btn--secondary btn--small" onClick={handleLogout}>
                        <i className="fas fa-sign-out-alt"></i> Выйти
                    </button>
                </div>
            </header>
            <main>{children}</main>
            {showNotifications && user && (
                <NotificationPanel
                    userId={user.id}
                    onClose={() => setShowNotifications(false)}
                />
            )}
        </div>
    );
};

export default Layout;
