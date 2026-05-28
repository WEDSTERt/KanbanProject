import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useApolloClient, gql } from '@apollo/client';
import { useNotification } from '../contexts/NotificationContext';
import { GET_NOTIFICATIONS, GET_UNREAD_COUNT } from '../graphql/queries';
import ConfirmModal from './ConfirmModal';
import '../styles/notification-panel.css';

const MARK_NOTIFICATION_AS_READ = gql`
    mutation MarkAsRead($userId: Long!, $notificationId: Long!) {
        markNotificationAsRead(userId: $userId, notificationId: $notificationId) {
            id
            isRead
            readAt
        }
    }
`;

const MARK_ALL_AS_READ = gql`
    mutation MarkAllAsRead($userId: Long!) {
        markAllAsRead(userId: $userId)
    }
`;

const DELETE_NOTIFICATION = gql`
    mutation DeleteNotification($userId: Long!, $notificationId: Long!) {
        deleteNotification(userId: $userId, notificationId: $notificationId)
    }
`;

const DELETE_ALL_NOTIFICATIONS = gql`
    mutation DeleteAllNotifications($userId: Long!) {
        deleteAllNotifications(userId: $userId)
    }
`;

const NotificationPanel = ({ userId, onClose }) => {
    const { addNotification } = useNotification();
    const client = useApolloClient();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const numericUserId = Number(userId);

    // Query для уведомлений с polling
    const { data: notificationsData, loading, refetch: refetchNotifications } = useQuery(GET_NOTIFICATIONS, {
        variables: { userId: numericUserId },
        skip: !userId,
        pollInterval: 3000, // Poll every 3 seconds
        onError: (err) => {
            console.error('Error loading notifications:', err);
            addNotification({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось загрузить уведомления',
            });
        },
    });

    // Query для unread count с polling
    const { data: countData, refetch: refetchCount } = useQuery(GET_UNREAD_COUNT, {
        variables: { userId: numericUserId },
        skip: !userId,
        pollInterval: 3000, // Poll every 3 seconds
    });

    useEffect(() => {
        if (notificationsData?.notifications) {
            setNotifications(notificationsData.notifications);
        }
    }, [notificationsData]);

    useEffect(() => {
        if (countData?.unreadCount !== undefined) {
            setUnreadCount(countData.unreadCount);
        }
    }, [countData]);

    const handleMarkAsRead = async (notificationId) => {
        try {
            await client.mutate({
                mutation: MARK_NOTIFICATION_AS_READ,
                variables: { userId: numericUserId, notificationId: Number(notificationId) },
                update: (cache, { data }) => {
                    const countData = cache.readQuery({
                        query: GET_UNREAD_COUNT,
                        variables: { userId: numericUserId },
                    });
                    if (countData) {
                        cache.writeQuery({
                            query: GET_UNREAD_COUNT,
                            variables: { userId: numericUserId },
                            data: {
                                unreadCount: Math.max(0, countData.unreadCount - 1),
                            },
                        });
                    }
                },
            });
            // Refetch для синхронизации
            const result = await client.query({
                query: GET_NOTIFICATIONS,
                variables: { userId: numericUserId },
                fetchPolicy: 'network-only',
            });
            setNotifications(result.data.notifications);
        } catch (err) {
            console.error('Error marking notification as read:', err);
            addNotification({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось отметить уведомление',
            });
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await client.mutate({
                mutation: MARK_ALL_AS_READ,
                variables: { userId: numericUserId },
                update: (cache) => {
                    cache.writeQuery({
                        query: GET_UNREAD_COUNT,
                        variables: { userId: numericUserId },
                        data: {
                            unreadCount: 0,
                        },
                    });
                },
            });
            const result = await client.query({
                query: GET_NOTIFICATIONS,
                variables: { userId: numericUserId },
                fetchPolicy: 'network-only',
            });
            setNotifications(result.data.notifications);
            addNotification({
                type: 'success',
                title: 'Успешно',
                message: 'Все уведомления отмечены как прочитанные',
            });
        } catch (err) {
            console.error('Error marking all as read:', err);
            addNotification({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось обновить уведомления',
            });
        }
    };

    const handleDeleteAllNotifications = async () => {
        try {
            await client.mutate({
                mutation: DELETE_ALL_NOTIFICATIONS,
                variables: { userId: numericUserId },
                update: (cache) => {
                    cache.writeQuery({
                        query: GET_UNREAD_COUNT,
                        variables: { userId: numericUserId },
                        data: {
                            unreadCount: 0,
                        },
                    });
                },
            });
            setNotifications([]);
            setDeleteAllConfirm(false);
            addNotification({
                type: 'success',
                title: 'Успешно',
                message: 'Все уведомления удалены',
            });
        } catch (err) {
            console.error('Error deleting all notifications:', err);
            addNotification({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось удалить уведомления',
            });
        }
    };

    const handleDelete = async (notificationId) => {
        try {
            const notification = notifications.find(n => n.id === notificationId);
            const isUnread = notification && !notification.isRead;
            
            await client.mutate({
                mutation: DELETE_NOTIFICATION,
                variables: { userId: numericUserId, notificationId: Number(notificationId) },
                update: (cache) => {
                    if (isUnread) {
                        const countData = cache.readQuery({
                            query: GET_UNREAD_COUNT,
                            variables: { userId: numericUserId },
                        });
                        if (countData) {
                            cache.writeQuery({
                                query: GET_UNREAD_COUNT,
                                variables: { userId: numericUserId },
                                data: {
                                    unreadCount: Math.max(0, countData.unreadCount - 1),
                                },
                            });
                        }
                    }
                },
            });
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            addNotification({
                type: 'success',
                title: 'Успешно',
                message: 'Уведомление удалено',
            });
        } catch (err) {
            console.error('Error deleting notification:', err);
            addNotification({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось удалить уведомление',
            });
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'task_created':
                return 'fa-plus-circle';
            case 'task_updated':
                return 'fa-edit';
            case 'task_assigned':
                return 'fa-user-check';
            case 'task_completed':
                return 'fa-check-circle';
            case 'comment_added':
                return 'fa-comment';
            case 'PROJECT_MEMBER_ADDED':
                return 'fa-user-plus';
            case 'PROJECT_MEMBER_REMOVED':
                return 'fa-user-minus';
            case 'SUBGROUP_MEMBER_ADDED':
                return 'fa-users';
            case 'SUBGROUP_MEMBER_REMOVED':
                return 'fa-user-slash';
            default:
                return 'fa-bell';
        }
    };

    const getNotificationTypeColor = (type) => {
        switch (type) {
            case 'task_created':
                return '#10b981';
            case 'task_updated':
                return '#3b82f6';
            case 'task_assigned':
                return '#f59e0b';
            case 'task_completed':
                return '#8b5cf6';
            case 'PROJECT_MEMBER_ADDED':
            case 'SUBGROUP_MEMBER_ADDED':
                return '#10b981';
            case 'PROJECT_MEMBER_REMOVED':
            case 'SUBGROUP_MEMBER_REMOVED':
                return '#ef4444';
            default:
                return '#3b82f6';
        }
    };

    const formatTime = (dateString) => {
        if (!dateString) return 'недавно';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'только что';
        if (minutes < 60) return `${minutes} мин назад`;
        if (hours < 24) return `${hours} ч назад`;
        if (days < 7) return `${days} дн назад`;
        
        return date.toLocaleDateString('ru-RU');
    };

    return (
        <div className="notification-panel-overlay" onClick={onClose}>
            <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
                <div className="notification-panel-header">
                    <h2>
                        <i className="fas fa-bell"></i> Уведомления
                        {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
                    </h2>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="notification-panel-controls">
                    <div className="notification-controls-group">
                        {unreadCount > 0 && (
                            <button className="btn btn--secondary" onClick={handleMarkAllAsRead}>
                                <i className="fas fa-check-double"></i> Отметить все как прочитанные
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button className="btn btn--secondary btn--danger" onClick={() => setDeleteAllConfirm(true)}>
                                <i className="fas fa-trash-alt"></i> Удалить все
                            </button>
                        )}
                    </div>
                </div>

                <div className="notification-panel-content">
                    {loading ? (
                        <div className="loading">Загрузка уведомлений...</div>
                    ) : notifications.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-inbox"></i>
                            <p>У вас нет уведомлений</p>
                        </div>
                    ) : (
                        <div className="notification-list">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                                >
                                    <div className="notification-item-left">
                                        <div
                                            className="notification-item-icon"
                                            style={{ backgroundColor: getNotificationTypeColor(notif.type) }}
                                        >
                                            <i className={`fas ${getNotificationIcon(notif.type)}`}></i>
                                        </div>
                                    </div>

                                    <div className="notification-item-content">
                                        <div className="notification-item-title">
                                            {notif.title}
                                            {!notif.isRead && <span className="new-badge">Новое</span>}
                                        </div>
                                        <p className="notification-item-message">{notif.message}</p>
                                        <div className="notification-item-time">
                                            {formatTime(notif.createdAt)}
                                        </div>
                                    </div>

                                    <div className="notification-item-actions">
                                        {!notif.isRead && (
                                            <button
                                                className="action-btn"
                                                onClick={() => handleMarkAsRead(notif.id)}
                                                title="Отметить как прочитанное"
                                            >
                                                <i className="fas fa-check"></i>
                                            </button>
                                        )}
                                        <button
                                            className="action-btn delete-btn"
                                            onClick={() => handleDelete(notif.id)}
                                            title="Удалить"
                                        >
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <ConfirmModal
                    isOpen={deleteAllConfirm}
                    title="Удаление всех уведомлений"
                    message="Удалить все уведомления? Это действие необратимо."
                    onConfirm={handleDeleteAllNotifications}
                    onCancel={() => setDeleteAllConfirm(false)}
                />
            </div>
        </div>
    );
};

export default NotificationPanel;
