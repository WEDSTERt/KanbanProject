import { gql } from '@apollo/client';

export const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($userId: ID!, $notificationId: ID!) {
    markNotificationAsRead(userId: $userId, notificationId: $notificationId) {
      id
      isRead
      readAt
    }
  }
`;

export const MARK_ALL_AS_READ = gql`
  mutation MarkAllAsRead($userId: ID!) {
    markAllAsRead(userId: $userId)
  }
`;

export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($userId: ID!, $notificationId: ID!) {
    deleteNotification(userId: $userId, notificationId: $notificationId)
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications($userId: ID!) {
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
  query GetUnreadNotifications($userId: ID!) {
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
  query GetUnreadCount($userId: ID!) {
    unreadCount(userId: $userId)
  }
`;

export const NOTIFICATION_ADDED_SUBSCRIPTION = gql`
  subscription OnNotificationAdded($userId: ID!) {
    notificationAdded(userId: $userId) {
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

export const NOTIFICATION_UPDATED_SUBSCRIPTION = gql`
  subscription OnNotificationUpdated($userId: ID!) {
    notificationUpdated(userId: $userId) {
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
