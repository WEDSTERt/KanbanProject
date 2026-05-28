import React, { useState, useEffect } from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useSSE } from '../contexts/SSEContext';
import NotificationPanel from './NotificationPanel';

const Layout = ({children}) => {
    const {user, logout} = useAuth();
    const { subscribe } = useSSE();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { addNotification } = useNotification();

    // 🆕 SSE подписка на новые уведомления (используем глобальный контекст)
    useEffect(() => {
        if (!user?.id) return;

        console.log('🎯 Layout subscribing to SSE events');

        // Подписываемся на события notification-received
        const unsubscribe = subscribe('notification-received', (data) => {
            console.log('📬 Layout received notification-received event via SSE:', data);
            
            const newNotification = data.notification_field;
            if (newNotification) {
                // Увеличиваем счетчик
                setUnreadCount(prev => prev + 1);
                
                // Показываем toast уведомление
                addNotification({
                    type: 'info',
                    title: 'Новое уведомление',
                    message: newNotification.title || 'Вам пришло новое уведомление',
                    duration: 5000,
                });
            }
        });

        // Очищаем подписку при размонтировании
        return () => {
            console.log('🔌 Layout unsubscribing from SSE events');
            unsubscribe();
        };
    }, [user?.id, subscribe, addNotification]);

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
