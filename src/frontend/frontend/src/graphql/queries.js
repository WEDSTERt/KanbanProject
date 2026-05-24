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

export const GET_TASKS_BY_SUBGROUP = gql`
    query GetTasksBySubgroup($subgroupId: ID!) {
        tasksBySubgroup(subgroupId: $subgroupId) {
            id
            title
            description
            dueDate
            status
            value
            createdAt
            updatedAt
            parentTaskId
            subTasksCount
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
            createdAt
            updatedAt
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

export const GET_TASKS_BY_ASSIGNEE_AND_PROJECT = gql`
    query GetTasksByAssigneeAndProject($userId: ID!, $projectId: ID!) {
        tasksByAssigneeAndProject(userId: $userId, projectId: $projectId) {
            id
            title
            description
            dueDate
            status
            value
            createdAt
            updatedAt
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
                createdAt
                updatedAt
                parentTaskId
                createdBy { id fullName }
                assignees { id fullName email }
                attachments { id }
                tags { id name color }
            }
        }
    }
`;

export const GET_TASK_SUBTASKS = gql`
    query GetTaskSubTasks($taskId: ID!) {
        taskSubTasks(taskId: $taskId) {
            id
            title
            description
            dueDate
            status
            value
            createdAt
            updatedAt
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