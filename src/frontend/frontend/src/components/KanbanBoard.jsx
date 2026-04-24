import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { GET_PROJECT_DETAILS } from '../graphql/queries';
import { GET_TASKS_BY_SUBGROUP, GET_TASKS_BY_ASSIGNEE } from '../graphql/queries';
import { UPDATE_TASK, DELETE_TASK, CREATE_TASK, SET_TASK_ASSIGNEES } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import SubgroupsPanel from './SubgroupsPanel';
import TaskModal from './TaskModal';
import ConfirmModal from './ConfirmModal';

const KanbanBoard = () => {

}
export default KanbanBoard;