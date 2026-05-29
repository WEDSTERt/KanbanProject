import {gql} from '@apollo/client';

export const UPDATE_USER = gql`
    mutation UpdateUser($id: ID!, $fullName: String, $password: String) {
        updateUser(id: $id, fullName: $fullName, password: $password) {
            id
            fullName
            email
        }
    }
`;

export const CREATE_PROJECT = gql`
    mutation CreateProject($name: String!, $ownerUserId: ID!) {
        createProject(name: $name, ownerUserId: $ownerUserId) {
            id
            name
            owner {
                id
                fullName
            }
            members {
                id
                userId
                role
            }
        }
    }
`;

export const UPDATE_PROJECT = gql`
    mutation UpdateProject($id: ID!, $name: String) {
        updateProject(id: $id, name: $name) {
            id
            name
        }
    }
`;

export const ADD_PROJECT_MEMBER = gql`
    mutation AddProjectMember($projectId: ID!, $userId: ID!, $role: RoleProject) {
        addProjectMember(projectId: $projectId, userId: $userId, role: $role) {
            id
        }
    }
`;

export const UPDATE_MEMBER_ROLE = gql`
    mutation UpdateProjectMember($id: ID!, $role: RoleProject) {
        updateProjectMember(id: $id, role: $role) {
            id
            role
        }
    }
`;

export const REMOVE_MEMBER = gql`
    mutation RemoveProjectMember($id: ID!) {
        removeProjectMember(id: $id)
    }
`;

export const DELETE_PROJECT = gql`
    mutation DeleteProject($id: ID!) {
        deleteProject(id: $id)
    }
`;

export const CREATE_TASK = gql`
    mutation CreateTask(
        $subgroupId: ID!
        $createdByUserId: ID!
        $title: String!
        $description: String
        $dueDate: DateTime
        $value: Int
        $status: TaskStatus
        $assigneeIds: [ID!]
        $parentTaskId: ID
    ) {
        createTask(
            subgroupId: $subgroupId
            createdByUserId: $createdByUserId
            title: $title
            description: $description
            dueDate: $dueDate
            value: $value
            status: $status
            assigneeIds: $assigneeIds
            parentTaskId: $parentTaskId
        ) {
            id
            title
            description
            dueDate
            status
            value
            parentTaskId
            createdBy { id fullName }
            assignees { id fullName }
            tags { id name color }
        }
    }
`;

export const UPDATE_TASK = gql`
    mutation UpdateTask(
        $id: ID!
        $subgroupId: ID
        $title: String
        $description: String
        $dueDate: DateTime
        $value: Int
        $status: TaskStatus
        $createdByUserId: ID
        $parentTaskId: ID
    ) {
        updateTask(
            id: $id
            subgroupId: $subgroupId
            title: $title
            description: $description
            dueDate: $dueDate
            value: $value
            status: $status
            createdByUserId: $createdByUserId
            parentTaskId: $parentTaskId
        ) {
            id
            title
            description
            dueDate
            status
            value
            parentTaskId
            createdBy {
                id
                fullName
            }
            tags { id name color }
        }
    }
`;

export const DELETE_TASK = gql`
    mutation DeleteTask($id: ID!) {
        deleteTask(id: $id)
    }
`;

export const CREATE_SUBGROUP = gql`
    mutation CreateSubgroup($projectId: ID!, $name: String!, $creatorUserId: ID!) {
        createSubgroup(projectId: $projectId, name: $name, creatorUserId: $creatorUserId) {
            id
            name
        }
    }
`;

export const UPDATE_SUBGROUP = gql`
    mutation UpdateSubgroup($id: ID!, $name: String) {
        updateSubgroup(id: $id, name: $name) {
            id
            name
        }
    }
`;

export const DELETE_USER = gql`
    mutation DeleteUser($id: ID!) {
        deleteUser(id: $id)
    }
`;

export const DELETE_SUBGROUP = gql`
    mutation DeleteSubgroup($id: ID!) {
        deleteSubgroup(id: $id)
    }
`;

export const ADD_SUBGROUP_MEMBER = gql`
    mutation AddSubgroupMember($subgroupId: ID!, $userId: ID!, $role: RoleSubgroup) {
        addSubgroupMember(subgroupId: $subgroupId, userId: $userId, role: $role) {
            id
            userId
            role
        }
    }
`;

export const UPDATE_SUBGROUP_MEMBER = gql`
    mutation UpdateSubgroupMember($id: ID!, $role: RoleSubgroup) {
        updateSubgroupMember(id: $id, role: $role) {
            id
            role
        }
    }
`;

export const REMOVE_SUBGROUP_MEMBER = gql`
    mutation RemoveSubgroupMember($id: ID!) {
        removeSubgroupMember(id: $id)
    }
`;

export const SET_TASK_ASSIGNEES = gql`
    mutation SetTaskAssignees($taskId: ID!, $userIds: [ID!]!) {
        setTaskAssignees(taskId: $taskId, userIds: $userIds) {
            id
            assignees { id fullName }
        }
    }
`;

export const ASSIGN_USER_TO_TASK = gql`
    mutation AssignUserToTask($taskId: ID!, $userId: ID!) {
        assignUserToTask(taskId: $taskId, userId: $userId) {
            id
            assignees { id fullName }
        }
    }
`;

export const UNASSIGN_USER_FROM_TASK = gql`
    mutation UnassignUserFromTask($taskId: ID!, $userId: ID!) {
        unassignUserFromTask(taskId: $taskId, userId: $userId) {
            id
            assignees { id fullName }
        }
    }
`;

export const LOGIN = gql`
    mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
            token
            user {
                id
                fullName
                email
                emailVerified
            }
        }
    }
`;

export const REGISTER = gql`
    mutation CreateUser($fullName: String!, $email: String!, $password: String!, $turnstileToken: String!) {
        createUser(fullName: $fullName, email: $email, password: $password, turnstileToken: $turnstileToken) {
            token
            user {
                id
                fullName
                email
                emailVerified
            }
        }
    }
`;

export const UPDATE_EMAIL_NOTIFICATIONS = gql`
    mutation UpdateEmailNotifications($emailNotificationsEnabled: Boolean!) {
        updateEmailNotifications(emailNotificationsEnabled: $emailNotificationsEnabled) {
            id
            fullName
            email
            emailNotificationsEnabled
        }
    }
`;

export const UPDATE_PROJECT_NOTIFICATIONS = gql`
    mutation UpdateProjectNotifications($projectId: ID!, $notificationsEnabled: Boolean!) {
        updateProjectNotifications(projectId: $projectId, notificationsEnabled: $notificationsEnabled) {
            id
            notificationsEnabled
        }
    }
`;

// ============ TAGS ============
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

export const CREATE_TAG = gql`
    mutation CreateTag($projectId: ID!, $name: String!, $color: String) {
        createTag(projectId: $projectId, name: $name, color: $color) {
            id
            name
            color
        }
    }
`;

export const UPDATE_TAG = gql`
    mutation UpdateTag($id: ID!, $name: String, $color: String) {
        updateTag(id: $id, name: $name, color: $color) {
            id
            name
            color
        }
    }
`;

export const DELETE_TAG = gql`
    mutation DeleteTag($id: ID!) {
        deleteTag(id: $id)
    }
`;

// ✅ ИСПРАВЛЕНИЕ: Возвращаем ПОЛНЫЕ данные задачи, чтобы кэш обновился везде
export const ADD_TAG_TO_TASK = gql`
    mutation AddTagToTask($taskId: ID!, $tagId: ID!) {
        addTagToTask(taskId: $taskId, tagId: $tagId) {
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

// ✅ ИСПРАВЛЕНИЕ: Возвращаем ПОЛНЫЕ данные задачи, чтобы кэш обновился везде
export const REMOVE_TAG_FROM_TASK = gql`
    mutation RemoveTagFromTask($taskId: ID!, $tagId: ID!) {
        removeTagFromTask(taskId: $taskId, tagId: $tagId) {
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

export const ADD_MULTIPLE_TAGS_TO_TASK = gql`
    mutation AddMultipleTagsToTask($taskId: ID!, $tagIds: [ID!]!) {
        addMultipleTagsToTask(taskId: $taskId, tagIds: $tagIds) {
            id
            tags {
                id
                name
                color
            }
        }
    }
`;

export const SET_TASK_TAGS = gql`
    mutation SetTaskTags($taskId: ID!, $tagIds: [ID!]!) {
        setTaskTags(taskId: $taskId, tagIds: $tagIds) {
            id
            tags {
                id
                name
                color
            }
        }
    }
`;

export const DELETE_TAG_FROM_PROJECT = gql`
    mutation DeleteTagFromProject($tagId: ID!, $projectId: ID!) {
        deleteTagFromProject(tagId: $tagId, projectId: $projectId)
    }
`;
