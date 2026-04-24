import { gql } from '@apollo/client';


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
    ) {
      id
      title
      description
      dueDate
      status
      value
      createdBy { id fullName }
      assignees { id fullName }
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
  ) {
    updateTask(
      id: $id
      subgroupId: $subgroupId
      title: $title
      description: $description
      dueDate: $dueDate
      value: $value
      status: $status
    ) {
      id
      title
      description
      dueDate
      status
      value
    }
  }
`;

export const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;



// Подгруппы
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

// Члены подгруппы
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
// Добавить в конец файла

export const SET_TASK_ASSIGNEES = gql`
  mutation SetTaskAssignees($taskId: ID!, $userIds: [ID!]!) {
    setTaskAssignees(taskId: $taskId, userIds: $userIds) {
      id
      assignees { id fullName }
    }
  }
`;

// Если нужны отдельные мутации (но setTaskAssignees удобнее)
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
      }
    }
  }
`;

export const REGISTER = gql`
  mutation CreateUser($fullName: String!, $email: String!, $password: String!) {
    createUser(fullName: $fullName, email: $email, password: $password) {
      token
      user {
        id
        fullName
        email
      }
    }
  }
`;