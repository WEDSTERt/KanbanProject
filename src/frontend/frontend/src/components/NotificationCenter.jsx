import React from 'react';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/notifications.css';

const NotificationCenter = () => {
    const { notifications, removeNotification } = useNotification();

    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return 'fa-check-circle';
            case 'error':
                return 'fa-exclamation-circle';
            case 'warning':
                return 'fa-exclamation-triangle';
            case 'info':
                return 'fa-info-circle';
            default:
                return 'fa-bell';
        }
    };

    const getTypeClass = (type) => {
        return `notification-${type}`;
    };

    return (
        <div className="notification-container">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`notification ${getTypeClass(notification.type)}`}
                    role="alert"
                >
                    <div className="notification-content">
                        <i className={`fas ${getIcon(notification.type)} notification-icon`}></i>
                        <div className="notification-text">
                            {notification.title && (
                                <div className="notification-title">{notification.title}</div>
                            )}
                            {notification.message && (
                                <div className="notification-message">{notification.message}</div>
                            )}
                        </div>
                    </div>
                    <button
                        className="notification-close"
                        onClick={() => removeNotification(notification.id)}
                        aria-label="Close notification"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            ))}
        </div>
    );
};

export default NotificationCenter;
