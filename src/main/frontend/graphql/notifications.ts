import { gql } from '@apollo/client';

// GraphQL Query: Получить количество непрочитанных уведомлений
export const GET_UNREAD_COUNT = gql`
  query GetUnreadNotificationsCount {
    unreadNotificationsCount
  }
`;

// GraphQL Query: Получить все уведомления
export const GET_USER_NOTIFICATIONS = gql`
  query GetUserNotifications {
    getUserNotifications {
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

// GraphQL Query: Получить только непрочитанные
export const GET_UNREAD_NOTIFICATIONS = gql`
  query GetUnreadNotifications {
    getUnreadNotifications {
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

// GraphQL Mutation: Отметить одно как прочитанное
export const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($notificationId: Long!) {
    markNotificationAsRead(notificationId: $notificationId) {
      id
      isRead
      readAt
    }
  }
`;

// GraphQL Mutation: Отметить все как прочитанные
export const MARK_ALL_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead
  }
`;

// GraphQL Mutation: Удалить одно уведомление
export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($notificationId: Long!) {
    deleteNotification(notificationId: $notificationId)
  }
`;

// GraphQL Mutation: Удалить все уведомления
export const DELETE_ALL_NOTIFICATIONS = gql`
  mutation DeleteAllNotifications {
    deleteAllNotifications
  }
`;

// GraphQL Subscription: Подписаться на новые уведомления
export const NOTIFICATION_CREATED = gql`
  subscription OnNotificationCreated($userId: Long!) {
    notificationCreated(userId: $userId) {
      id
      type
      title
      message
      taskId
      projectId
      isRead
      createdAt
    }
  }
`;
