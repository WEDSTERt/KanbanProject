import React, { useState, useEffect } from 'react';
import {Link, useNavigate} from 'react-router-dom';
import { useQuery } from '@apollo/client';
import {useAuth} from '../contexts/AuthContext';
import { GET_UNREAD_COUNT } from '../graphql/queries';
import { useNotification } from '../contexts/NotificationContext';
import NotificationPanel from './NotificationPanel';

const Layout = ({children}) => {
    const {user, logout} = useAuth();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
    const { addNotification } = useNotification();

    // Начальный запрос на количество непрочитанных уведомлений с polling
    const { data: countData, startPolling, stopPolling } = useQuery(GET_UNREAD_COUNT, {
        variables: { userId: user?.id },
        skip: !user?.id,
        pollInterval: 3000, // Polling каждые 3 секунды
    });

    // Обновляем счётчик и показываем уведомление если пришло новое
    useEffect(() => {
        if (countData?.unreadCount !== undefined) {
            const newCount = countData.unreadCount;
            
            // Если счётчик увеличился - значит пришло новое уведомление
            if (newCount > unreadCount && unreadCount > 0) {
                console.log('📬 New notification! Count increased from', unreadCount, 'to', newCount);
                addNotification({
                    type: 'info',
                    title: 'Новое уведомление',
                    message: `У вас ${newCount} непрочитанное уведомление${newCount > 1 ? 'й' : ''}`,
                    duration: 5000, // Показать на 5 секунд
                });
            }
            
            setUnreadCount(newCount);
        }
    }, [countData?.unreadCount]);

    // Возобновляем polling когда пользователь возвращается на вкладку
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('🔄 Tab is visible, resuming polling');
                startPolling(3000);
            } else {
                console.log('⏸️ Tab is hidden, stopping polling');
                stopPolling();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [startPolling, stopPolling]);

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
