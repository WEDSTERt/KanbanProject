import { gql } from '@apollo/client';

// 🔄 Подписка на обновления задач
export const TASK_UPDATED_SUBSCRIPTION = gql`
  subscription {
    taskUpdated {
      id
      title
      description
      status
      dueDate
      value
      subgroupId
      createdBy {
        id
        fullName
        email
      }
      assignees {
        id
        fullName
        email
      }
      attachments {
        id
        fileName
      }
      tags {
        id
        name
        color
      }
      parentTaskId
      subTasksCount
    }
  }
`;

// 📋 Подписка на обновления групп/подгрупп
export const SUBGROUP_UPDATED_SUBSCRIPTION = gql`
  subscription($projectId: Long!) {
    subgroupUpdated(projectId: $projectId) {
      id
      name
      project {
        id
        name
      }
      members {
        id
        role
        user {
          id
          fullName
          email
        }
      }
    }
  }
`;

// 📁 Подписка на обновления проектов
export const PROJECT_UPDATED_SUBSCRIPTION = gql`
  subscription {
    projectUpdated {
      id
      name
      owner {
        id
        fullName
        email
      }
      members {
        id
        role
        user {
          id
          fullName
          email
        }
      }
      subgroups {
        id
        name
      }
    }
  }
`;

// 🔔 Подписка на новые уведомления
export const NOTIFICATION_CREATED_SUBSCRIPTION = gql`
  subscription($userId: Long!) {
    notificationCreated(userId: $userId) {
      id
      userId
      type
      title
      message
      isRead
      taskId
      projectId
      createdAt
      readAt
    }
  }
`;

// 📊 Подписка на изменение количества непрочитанных уведомлений
export const UNREAD_COUNT_UPDATED_SUBSCRIPTION = gql`
  subscription($userId: Long!) {
    unreadCountUpdated(userId: $userId) {
      userId
      unreadCount
    }
  }
`;
