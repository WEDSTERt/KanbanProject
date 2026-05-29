import { gql } from '@apollo/client';

// ===== NOTIFICATION QUERIES =====
export const GET_NOTIFICATIONS = gql`
    query GetNotifications($userId: Long!) {
        notifications(userId: $userId) {
            id
            type
            title
            message
            taskId
            projectId
            isRead
            createdAt
            readAt
        }
    }
`;

export const GET_UNREAD_NOTIFICATIONS = gql`
    query GetUnreadNotifications($userId: Long!) {
        unreadNotifications(userId: $userId) {
            id
            type
            title
            message
            taskId
            projectId
            isRead
            createdAt
            readAt
        }
    }
`;

export const GET_UNREAD_COUNT = gql`
    query GetUnreadCount($userId: Long!) {
        unreadCount(userId: $userId)
    }
`;

// ===== NOTIFICATION MUTATIONS =====
export const MARK_NOTIFICATION_AS_READ = gql`
    mutation MarkNotificationAsRead($userId: Long!, $notificationId: Long!) {
        markNotificationAsRead(userId: $userId, notificationId: $notificationId) {
            id
            isRead
            readAt
        }
    }
`;

export const MARK_ALL_AS_READ = gql`
    mutation MarkAllAsRead($userId: Long!) {
        markAllAsRead(userId: $userId)
    }
`;

export const DELETE_NOTIFICATION = gql`
    mutation DeleteNotification($userId: Long!, $notificationId: Long!) {
        deleteNotification(userId: $userId, notificationId: $notificationId)
    }
`;

export const DELETE_ALL_NOTIFICATIONS = gql`
    mutation DeleteAllNotifications($userId: Long!) {
        deleteAllNotifications(userId: $userId)
    }
`;
