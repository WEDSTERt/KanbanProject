import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import {
    GET_PROJECT_DETAILS,
    GET_TASKS_BY_SUBGROUP,
    GET_TASKS_BY_SUBGROUP_LITE,
    GET_TASKS_BY_ASSIGNEE_AND_PROJECT,
    GET_TASKS_BY_ASSIGNEE_AND_PROJECT_LITE,
    GET_TASKS_BY_IDS,
    GET_ALL_SUBTASKS,
    GET_TAGS,
} from '../graphql/queries';
import {
    UPDATE_TASK,
    DELETE_TASK,
    CREATE_TASK,
    SET_TASK_ASSIGNEES,
    CREATE_TAG,
    ADD_TAG_TO_TASK,
    REMOVE_TAG_FROM_TASK,
    DELETE_TAG_FROM_PROJECT,
} from '../graphql/mutations';
import { normalizeStatus } from '../components/kanban/utils';

export const useKanbanLogic = (projectId, urlSubgroupId, user) => {
    const client = useApolloClient();
    const subTasksCacheRef = useRef({});
    const [isLowBandwidth, setIsLowBandwidth] = useState(false);

    // State
    const [activeSubgroupId, setActiveSubgroupId] = useState(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, taskId: null });
    const [initialAssigneeIds, setInitialAssigneeIds] = useState([]);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [showMobileGroups, setShowMobileGroups] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [highlightedTask, setHighlightedTask] = useState(null);
    const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
    const [subTasksCache, setSubTasksCache] = useState({});
    const [loadingSubTasks, setLoadingSubTasks] = useState({});
    const [contextMenuTaskId, setContextMenuTaskId] = useState(null);
    const [contextMenuTask, setContextMenuTask] = useState(null);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#3b82f6');
    const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
    const [showCreateTag, setShowCreateTag] = useState(false);
    const [sortBy, setSortBy] = useState('dueDate');
    const [sortOrder, setSortOrder] = useState('asc');
    const [isMobileSort, setIsMobileSort] = useState(window.innerWidth <= 480);
    const [filters, setFilters] = useState({
        priority: [],
        dateFrom: null,
        dateTo: null,
        assignee: null,
        tags: [],
    });
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [deleteTagConfirm, setDeleteTagConfirm] = useState({ isOpen: false, tagId: null, tagName: '' });

    // ✅ Детектирование низкой скорости интернета
    useEffect(() => {
        if (navigator.connection) {
            const updateConnectionStatus = () => {
                const effectiveType = navigator.connection.effectiveType;
                setIsLowBandwidth(effectiveType === '2g' || effectiveType === '3g');
            };
            
            navigator.connection.addEventListener('change', updateConnectionStatus);
            updateConnectionStatus();
            
            return () => {
                navigator.connection.removeEventListener('change', updateConnectionStatus);
            };
        }
    }, []);

    // Mutations
    const [createTask] = useMutation(CREATE_TASK);
    const [updateTask] = useMutation(UPDATE_TASK);
    const [deleteTask] = useMutation(DELETE_TASK);
    const [setTaskAssignees] = useMutation(SET_TASK_ASSIGNEES);
    const [createTag] = useMutation(CREATE_TAG);
    const [addTagToTask] = useMutation(ADD_TAG_TO_TASK);
    const [removeTagFromTask] = useMutation(REMOVE_TAG_FROM_TASK);
    const [deleteTagFromProject] = useMutation(DELETE_TAG_FROM_PROJECT);

    // Queries
    const { data: tagsData, refetch: refetchTags } = useQuery(GET_TAGS, {
        variables: { projectId },
        skip: !projectId,
        fetchPolicy: 'cache-first',
    });
    const availableTags = tagsData?.tags || [];

    const { loading: projectLoading, data: projectData, refetch: refetchProject } = useQuery(GET_PROJECT_DETAILS, {
        variables: { projectId },
        skip: !projectId,
        fetchPolicy: 'cache-first',
    });

    // ✅ ОПТИМИЗАЦИЯ: Используем LITE версию если низкая скорость или первая загрузка
    const { loading: tasksLoading, data: tasksData, refetch: refetchTasks, networkStatus: tasksNetworkStatus } = useQuery(
        isLowBandwidth ? GET_TASKS_BY_SUBGROUP_LITE : GET_TASKS_BY_SUBGROUP,
        { 
            variables: { subgroupId: activeSubgroupId }, 
            skip: !activeSubgroupId || activeSubgroupId === 'my-tasks', 
            fetchPolicy: 'cache-and-network', 
            notifyOnNetworkStatusChange: true, 
            pollInterval: 0 
        }
    );

    // ✅ ОПТИМИЗАЦИЯ: Облегченная версия для "мои задачи" при низкой скорости
    const { loading: myTasksLoading, data: myTasksData, refetch: refetchMyTasks, networkStatus: myTasksNetworkStatus } = useQuery(
        isLowBandwidth ? GET_TASKS_BY_ASSIGNEE_AND_PROJECT_LITE : GET_TASKS_BY_ASSIGNEE_AND_PROJECT,
        { 
            variables: { userId: user.id, projectId: projectId }, 
            skip: activeSubgroupId !== 'my-tasks' || !user.id || !projectId, 
            fetchPolicy: 'cache-and-network', 
            notifyOnNetworkStatusChange: true, 
            pollInterval: 0 
        }
    );

    const refetchCurrentTasks = useCallback(async () => {
        if (activeSubgroupId === 'my-tasks') await refetchMyTasks();
        else if (activeSubgroupId) await refetchTasks();
    }, [activeSubgroupId, refetchMyTasks, refetchTasks]);

    let tasks = [];
    if (activeSubgroupId === 'my-tasks') tasks = myTasksData?.tasksByAssigneeAndProject || [];
    else if (activeSubgroupId && tasksData?.tasksBySubgroup) tasks = tasksData.tasksBySubgroup;

    // ✅ ОПТИМИЗАЦИЯ: Частичное обновление задач после SSE событий
    const updateTasksFromSSE = useCallback(async (changedTaskIds) => {
        if (!changedTaskIds.length || !client) return;
        
        try {
            const { data } = await client.query({
                query: GET_TASKS_BY_IDS,
                variables: { ids: changedTaskIds },
                fetchPolicy: 'network-only', // Всегда получаем свежие данные
            });

            if (data?.tasksByIds) {
                // Обновляем кэш Apollo автоматически
                data.tasksByIds.forEach(updatedTask => {
                    client.cache.writeQuery({
                        query: GET_TASKS_BY_SUBGROUP,
                        variables: { subgroupId: activeSubgroupId },
                        data: {
                            tasksBySubgroup: tasks.map(t => 
                                t.id === updatedTask.id ? updatedTask : t
                            )
                        }
                    });
                });
            }
        } catch (err) {
            console.error('Ошибка обновления задач из SSE:', err);
        }
    }, [client, activeSubgroupId, tasks]);

    // ✅ Оптимизированная загрузка подзадач с умным кэшированием и батчингом
    const loadSubTaskBatch = useCallback(async (taskIds, force = false) => {
        if (!taskIds.length) return;
        
        const idsToLoad = force 
            ? taskIds 
            : taskIds.filter(id => !subTasksCacheRef.current[id] && !loadingSubTasks[id]);
        
        if (!idsToLoad.length) return;

        const batchSize = 3;
        for (let i = 0; i < idsToLoad.length; i += batchSize) {
            const batch = idsToLoad.slice(i, i + batchSize);
            
            setLoadingSubTasks(prev => {
                const newState = { ...prev };
                batch.forEach(id => { newState[id] = true; });
                return newState;
            });

            try {
                const { data } = await client.query({
                    query: GET_ALL_SUBTASKS,
                    variables: { taskIds: batch },
                    fetchPolicy: 'cache-first',
                });
                
                if (data?.tasksByIds) {
                    const newCache = { ...subTasksCacheRef.current };
                    data.tasksByIds.forEach(taskData => {
                        if (taskData?.id) newCache[taskData.id] = taskData.subTasks || [];
                    });
                    subTasksCacheRef.current = newCache;
                    setSubTasksCache(newCache);
                }
            } catch (err) {
                console.error('Ошибка загрузки подзадач:', err);
            } finally {
                setLoadingSubTasks(prev => {
                    const newState = { ...prev };
                    batch.forEach(id => { delete newState[id]; });
                    return newState;
                });
            }

            if (i + batchSize < idsToLoad.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }, [client, loadingSubTasks]);

    const fetchSubTasksForTask = useCallback(async (taskId, force = false) => {
        if (!force && subTasksCacheRef.current[taskId]) return;
        
        setLoadingSubTasks(prev => ({ ...prev, [taskId]: true }));
        try {
            const { data } = await client.query({ 
                query: GET_ALL_SUBTASKS, 
                variables: { taskIds: [taskId] }, 
                fetchPolicy: 'cache-first' 
            });
            if (data?.tasksByIds?.length > 0) {
                const newCache = { ...subTasksCacheRef.current, [taskId]: data.tasksByIds[0].subTasks || [] };
                subTasksCacheRef.current = newCache;
                setSubTasksCache(newCache);
            } else {
                const newCache = { ...subTasksCacheRef.current, [taskId]: [] };
                subTasksCacheRef.current = newCache;
                setSubTasksCache(newCache);
            }
        } catch (err) {
            console.error('Ошибка загрузки подзадач:', err);
            const newCache = { ...subTasksCacheRef.current, [taskId]: [] };
            subTasksCacheRef.current = newCache;
            setSubTasksCache(newCache);
        } finally { setLoadingSubTasks(prev => ({ ...prev, [taskId]: false })); }
    }, [client]);

    // ✅ Оптимизированная фильтрация
    const applyFilters = useCallback((tasksArray) => {
        let filtered = [...tasksArray];
        if (filters.priority.length > 0) {
            filtered = filtered.filter(task => {
                const priority = task.value || 2;
                return filters.priority.some(p => 
                    (p === 'high' && priority === 3) ||
                    (p === 'medium' && priority === 2) ||
                    (p === 'low' && priority === 1)
                );
            });
        }
        if (filters.dateFrom || filters.dateTo) {
            filtered = filtered.filter(task => {
                if (!task.dueDate) return false;
                const dueDate = new Date(task.dueDate).getTime();
                if (filters.dateFrom && dueDate < filters.dateFrom.getTime()) return false;
                if (filters.dateTo && dueDate > filters.dateTo.getTime()) return false;
                return true;
            });
        }
        if (filters.assignee) {
            filtered = filtered.filter(task => task.assignees?.some(a => a.id === filters.assignee));
        }
        if (filters.tags?.length > 0) {
            filtered = filtered.filter(task => task.tags?.some(tag => filters.tags.includes(tag.id)));
        }
        return filtered;
    }, [filters]);

    // ✅ Оптимизированная сортировка
    const sortTasks = useCallback((tasksArray) => {
        if (!tasksArray.length) return tasksArray;
        const sorted = [...tasksArray];
        
        switch (sortBy) {
            case 'dueDate':
                sorted.sort((a, b) => {
                    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                });
                break;
            case 'priority':
                sorted.sort((a, b) => {
                    const priorityA = a.value || 2;
                    const priorityB = b.value || 2;
                    return sortOrder === 'asc' ? priorityA - priorityB : priorityB - priorityA;
                });
                break;
            case 'creator':
                sorted.sort((a, b) => {
                    const nameA = a.createdBy?.fullName || '';
                    const nameB = b.createdBy?.fullName || '';
                    return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
                });
                break;
            default: break;
        }
        return sorted;
    }, [sortBy, sortOrder]);

    return {
        // State
        activeSubgroupId, setActiveSubgroupId,
        showTaskModal, setShowTaskModal,
        editingTask, setEditingTask,
        deleteConfirm, setDeleteConfirm,
        initialAssigneeIds, setInitialAssigneeIds,
        isCreatingTask, setIsCreatingTask,
        showMobileGroups, setShowMobileGroups,
        isMobile, setIsMobile,
        highlightedTask, setHighlightedTask,
        expandedTaskIds, setExpandedTaskIds,
        subTasksCache, setSubTasksCache,
        loadingSubTasks, setLoadingSubTasks,
        contextMenuTaskId, setContextMenuTaskId,
        contextMenuTask, setContextMenuTask,
        showContextMenu, setShowContextMenu,
        contextMenuPosition, setContextMenuPosition,
        newTagName, setNewTagName,
        newTagColor, setNewTagColor,
        newSubTaskTitle, setNewSubTaskTitle,
        showCreateTag, setShowCreateTag,
        sortBy, setSortBy,
        sortOrder, setSortOrder,
        isMobileSort, setIsMobileSort,
        filters, setFilters,
        showFilterModal, setShowFilterModal,
        deleteTagConfirm, setDeleteTagConfirm,
        
        // Query data
        tagsData, availableTags, refetchTags,
        projectLoading, projectData, refetchProject,
        tasksLoading, tasksData, refetchTasks, tasksNetworkStatus,
        myTasksLoading, myTasksData, refetchMyTasks, myTasksNetworkStatus,
        tasks,
        
        // Mutations
        createTask, updateTask, deleteTask, setTaskAssignees,
        createTag, addTagToTask, removeTagFromTask, deleteTagFromProject,
        
        // Functions
        refetchCurrentTasks,
        loadSubTaskBatch,
        fetchSubTasksForTask,
        applyFilters,
        sortTasks,
        updateTasksFromSSE,
        
        // Refs
        subTasksCacheRef,
        isLowBandwidth,
    };
};
