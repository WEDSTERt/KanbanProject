import {gql} from '@apollo/client';

export const GET_USER_PROJECTS = gql`
    query GetUserProjects($userId: ID!) {
        owned: projectsByOwner(ownerUserId: $userId) {
            id
            name
            owner { id fullName }
            members { id userId role }
        }
        member: projectsByMember(userId: $userId) {
            id
            name
            owner { id fullName }
            members { id userId role }
        }
    }
`;

export const GET_PROJECT_DETAILS = gql`
    query ProjectDetails($projectId: ID!) {
        project(id: $projectId) {
            id
            name
            owner { id fullName }
            members {
                id
                userId
                role
                notificationsEnabled
                user { id fullName email }
            }
            subgroups {
                id
                name
                members {
                    id
                    userId
                    role
                    user { id fullName email }
                }
            }
        }
    }
`;

export const GET_SUBGROUPS_BY_PROJECT = gql`
    query GetSubgroupsByProject($projectId: ID!) {
        subgroupsByProject(projectId: $projectId) {
            id
            name
            members {
                id
                userId
                role
                user { id fullName email }
            }
        }
    }
`;

export const GET_USERS = gql`
    query GetUsers($limit: Int, $offset: Int) {
        users(limit: $limit, offset: $offset) {
            id
            fullName
            email
        }
    }
`;

export const GET_TASK_ATTACHMENTS = gql`
    query GetTaskAttachments($taskId: ID!) {
        taskAttachments(taskId: $taskId) {
            id
            fileName
            fileType
            fileSize
            downloadUrl
        }
    }
`;

// ✅ ОПТИМИЗАЦИЯ: Основной запрос для загрузки задач подгруппы
export const GET_TASKS_BY_SUBGROUP = gql`
    query GetTasksBySubgroup($subgroupId: ID!) {
        tasksBySubgroup(subgroupId: $subgroupId) {
            id
            title
            description
            dueDate
            status
            value
            parentTaskId
            subTasksCount
            createdBy { id fullName }
            assignees { id fullName email }
            attachments { id }
            tags { id name color }
        }
    }
`;

// ✅ ОПТИМИЗАЦИЯ: Облегченная версия для быстрой загрузки (без описания)
// Используется при первой загрузке, кэшируется и обновляется полной версией
export const GET_TASKS_BY_SUBGROUP_LITE = gql`
    query GetTasksBySubgroupLite($subgroupId: ID!) {
        tasksBySubgroup(subgroupId: $subgroupId) {
            id
            title
            status
            value
            dueDate
            parentTaskId
            subTasksCount
            createdBy { id fullName }
            assignees { id fullName }
            tags { id name color }
        }
    }
`;

// ✅ ОПТИМИЗАЦИЯ: Пакетная версия для получения/обновления конкретных задач
// Используется для синхронизации после SSE событий (только ID тех что изменились)
export const GET_TASKS_BY_IDS = gql`
    query GetTasksByIds($ids: [ID!]!) {
        tasksByIds(ids: $ids) {
            id
            title
            description
            dueDate
            status
            value
            parentTaskId
            subTasksCount
            createdBy { id fullName }
            assignees { id fullName email }
            attachments { id }
            tags { id name color }
        }
    }
`;

// ✅ НОВОЕ: Запрос для загрузки ПОЛНОЙ информации о конкретной задаче (для TaskModal)
export const GET_TASK_BY_ID = gql`
    query GetTaskById($taskId: ID!) {
        task(id: $taskId) {
            id
            title
            description
            dueDate
            status
            value
            parentTaskId
            subTasksCount
            createdAt
            updatedAt
            createdBy { id fullName }
            assignees { id fullName email }
            attachments { id }
            tags { id name color }
        }
    }
`;

export const GET_CURRENT_USER = gql`
    query GetCurrentUser {
        me {
            id
            fullName
            email
            emailVerified
            emailNotificationsEnabled
        }
    }
`;

export const GET_TASKS_BY_ASSIGNEE = gql`
    query GetTasksByAssignee($userId: ID!) {
        tasksByAssignee(userId: $userId) {
            id
            title
            description
            dueDate
            status
            value
            parentTaskId
            subTasksCount
            createdBy { id fullName }
            assignees { id fullName email }
            subgroupId
            subgroup { id name }
            attachments { id }
            tags { id name color }
        }
    }
`;

// ✅ ОПТИМИЗАЦИЯ: Облегченная версия задач пользователя (без описания)
export const GET_TASKS_BY_ASSIGNEE_LITE = gql`
    query GetTasksByAssigneeLite($userId: ID!) {
        tasksByAssignee(userId: $userId) {
            id
            title
            status
            value
            dueDate
            parentTaskId
            subTasksCount
            createdBy { id fullName }
            assignees { id fullName }
            subgroupId
            subgroup { id name }
            tags { id name color }
        }
    }
`;

// ✅ ОПТИМИЗАЦИЯ: Основной запрос задач пользователя в проекте
export const GET_TASKS_BY_ASSIGNEE_AND_PROJECT = gql`
    query GetTasksByAssigneeAndProject($userId: ID!, $projectId: ID!) {
        tasksByAssigneeAndProject(userId: $userId, projectId: $projectId) {
            id
            title
            description
            dueDate
            status
            value
            parentTaskId
            subTasksCount
            createdBy { id fullName }
            assignees { id fullName email }
            subgroupId
            subgroup { id name }
            attachments { id }
            tags { id name color }
        }
    }
`;

// ✅ ОПТИМИЗАЦИЯ: Облегченная версия для быстрой загрузки "мои задачи"
export const GET_TASKS_BY_ASSIGNEE_AND_PROJECT_LITE = gql`
    query GetTasksByAssigneeAndProjectLite($userId: ID!, $projectId: ID!) {
        tasksByAssigneeAndProject(userId: $userId, projectId: $projectId) {
            id
            title
            status
            value
            dueDate
            parentTaskId
            subTasksCount
            createdBy { id fullName }
            assignees { id fullName }
            subgroupId
            subgroup { id name }
            tags { id name color }
        }
    }
`;

// ✅ ОПТИМИЗАЦИЯ: Загрузка подзадач пакетом
export const GET_ALL_SUBTASKS = gql`
    query GetAllSubTasks($taskIds: [ID!]!) {
        tasksByIds(ids: $taskIds) {
            id
            subTasks {
                id
                title
                description
                dueDate
                status
                value
                parentTaskId
                createdBy { id fullName }
                assignees { id fullName email }
                attachments { id }
                tags { id name color }
            }
        }
    }
`;

// ✅ ИСПРАВЛЕНО: Теперь запрашиваем саму родительскую задачу со всеми полями
// Это предотвращает потерю тегов при загрузке подзадач
export const GET_TASK_SUBTASKS = gql`
    query GetTaskSubTasks($taskId: ID!) {
        task(id: $taskId) {
            id
            title
            description
            dueDate
            status
            value
            parentTaskId
            subTasksCount
            createdAt
            updatedAt
            createdBy { id fullName }
            assignees { id fullName email }
            attachments { id }
            tags { id name color }
        }
        taskSubTasks(taskId: $taskId) {
            id
            title
            description
            dueDate
            status
            value
            parentTaskId
            createdBy { id fullName }
            assignees { id fullName email }
            attachments { id }
            tags { id name color }
        }
    }
`;

export const VERIFY_EMAIL = gql`
    mutation VerifyEmail($token: String!) {
        verifyEmail(token: $token)
    }
`;

export const RESEND_VERIFICATION = gql`
    mutation ResendVerificationEmail($email: String!) {
        resendVerificationEmail(email: $email)
    }
`;

export const GET_TAGS = gql`
    query GetTags($projectId: ID!) {
        tags(projectId: $projectId) {
            id
            name
            color
            projectId
            createdAt
        }
    }
`;

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
