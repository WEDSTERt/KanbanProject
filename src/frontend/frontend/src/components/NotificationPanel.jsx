import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useApolloClient } from '@apollo/client';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { GET_NOTIFICATIONS, GET_UNREAD_COUNT, MARK_NOTIFICATION_AS_READ, MARK_ALL_AS_READ, DELETE_NOTIFICATION, DELETE_ALL_NOTIFICATIONS } from '../graphql/notificationQueries';
import { useSSE } from '../contexts/SSEContext';
import ConfirmModal from './ConfirmModal';
import '../styles/notification-panel.css';

const NotificationPanel = ({ userId, onClose }) => {
    const { addNotification } = useNotification();
    const { subscribe } = useSSE();
    const client = useApolloClient();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const numericUserId = Number(userId);

    const { data: notificationsData, loading, refetch: refetchNotifications } = useQuery(GET_NOTIFICATIONS, {
        variables: { userId: numericUserId },
        skip: !userId,
        pollInterval: 0,
        onError: (err) => {
            console.error('Error loading notifications:', err);
            addNotification({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось загрузить уведомления',
            });
        },
    });

    const { data: countData, refetch: refetchCount } = useQuery(GET_UNREAD_COUNT, {
        variables: { userId: numericUserId },
        skip: !userId,
        pollInterval: 0,
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

    useEffect(() => {
        if (!userId) return;

        console.log('📬 NotificationPanel subscribing to SSE events');

        const unsubscribe = subscribe('notification-received', (data) => {
            console.log('📬 NotificationPanel received notification-received event via SSE:', data);

            setTimeout(() => {
                refetchNotifications();
                refetchCount();
            }, 100);

            addNotification({
                type: 'info',
                title: data.title || 'Новое уведомление',
                message: data.message || 'Вам пришло новое уведомление',
            });
        });

        return () => {
            console.log('📬 NotificationPanel unsubscribing from SSE events');
            unsubscribe();
        };
    }, [userId, numericUserId, refetchNotifications, refetchCount, addNotification, subscribe]);

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
            case 'task_overdue':
                return 'fa-exclamation-circle';
            case 'task_status_changed':
                return 'fa-history';
            case 'comment_added':
                return 'fa-comment';
            case 'user_added_to_project':
                return 'fa-user-plus';
            case 'user_removed_from_project':
                return 'fa-user-minus';
            case 'user_added_to_subgroup':
                return 'fa-users';
            case 'user_removed_from_subgroup':
                return 'fa-user-slash';
            case 'attachment_added':
                return 'fa-paperclip';
            case 'attachment_deleted':
                return 'fa-trash-alt';
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
            case 'task_overdue':
                return '#ef4444';
            case 'task_status_changed':
                return '#06b6d4';
            case 'user_added_to_project':
            case 'user_added_to_subgroup':
                return '#10b981';
            case 'user_removed_from_project':
            case 'user_removed_from_subgroup':
                return '#ef4444';
            case 'attachment_added':
                return '#3b82f6';
            case 'attachment_deleted':
                return '#f97316';
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

    const canNavigate = (notif) => {
        // Не показываем ссылку для удаления из проекта/группы (уже удален)
        const noLinkTypes = ['user_removed_from_project', 'user_removed_from_subgroup'];
        if (noLinkTypes.includes(notif.type)) return false;

        const taskTypes = ['task_assigned', 'task_updated', 'task_overdue', 'task_created', 'task_status_changed', 'attachment_added', 'attachment_deleted'];
        const projectTypes = ['user_added_to_project', 'user_added_to_subgroup'];
        
        return (taskTypes.includes(notif.type) && notif.taskId && notif.projectId) ||
               (projectTypes.includes(notif.type) && notif.projectId);
    };

    const handleNavigateToObject = (notif) => {
        const taskTypes = ['task_assigned', 'task_updated', 'task_overdue', 'task_created', 'task_status_changed', 'attachment_added', 'attachment_deleted'];

        if (taskTypes.includes(notif.type) && notif.taskId && notif.projectId) {
            const url = `/board?projectId=${notif.projectId}&highlightTask=${notif.taskId}`;
            navigate(url);
            onClose();
        } else if (notif.type === 'user_added_to_subgroup' && notif.projectId && notif.subgroupId) {
            const url = `/board?projectId=${notif.projectId}&subgroupId=${notif.subgroupId}`;
            navigate(url);
            onClose();
        } else if (notif.projectId) {
            const url = `/board?projectId=${notif.projectId}`;
            navigate(url);
            onClose();
        }

        if (!notif.isRead) {
            handleMarkAsRead(notif.id);
        }
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
                                    className={`notification-item ${!notif.isRead ? 'unread' : ''} ${canNavigate(notif) ? 'hoverable' : ''}`}
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
                                        {canNavigate(notif) && (
                                            <button
                                                className="action-btn navigate-btn"
                                                onClick={() => handleNavigateToObject(notif)}
                                                title="Перейти к объекту"
                                            >
                                                <i className="fas fa-arrow-right"></i>
                                            </button>
                                        )}
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
