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
            createdBy { id fullName }
            assignees { id fullName email }
            attachments { id }
        }
    }
`;

export const GET_CURRENT_USER = gql`
    query GetCurrentUser {
        me {
            id
            fullName
            email
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
            createdBy { id fullName }
            assignees { id fullName email }
            subgroupId
            subgroup { id name }
            attachments { id }
        }
    }
`;