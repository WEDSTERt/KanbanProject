/* eslint-disable no-unused-vars */
import React, {useState, useEffect, useCallback, useReducer} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {useQuery, useMutation, useApolloClient} from '@apollo/client';
import {GET_PROJECT_DETAILS, GET_TASKS_BY_SUBGROUP, GET_TASKS_BY_ASSIGNEE_AND_PROJECT, GET_ALL_SUBTASKS, GET_TAGS} from '../graphql/queries';
import {UPDATE_TASK, DELETE_TASK, CREATE_TASK, SET_TASK_ASSIGNEES, CREATE_TAG, ADD_TAG_TO_TASK, REMOVE_TAG_FROM_TASK, DELETE_TAG_FROM_PROJECT} from '../graphql/mutations';
import {useAuth} from '../contexts/AuthContext';
import SubgroupsPanel from './SubgroupsPanel';
import TaskModal from './TaskModal';
import ConfirmModal from './ConfirmModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const KanbanBoard = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const projectId = searchParams.get('projectId');
    const urlSubgroupId = searchParams.get('subgroupId');
    const highlightTaskId = searchParams.get('highlightTask');
    const {user} = useAuth();
    const client = useApolloClient();

    const [activeSubgroupId, setActiveSubgroupId] = useState(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({isOpen: false, taskId: null});
    const [initialAssigneeIds, setInitialAssigneeIds] = useState([]);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [showMobileGroups, setShowMobileGroups] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [viewMode, setViewMode] = useState('kanban');
    const [highlightedTask, setHighlightedTask] = useState(null);

    const [selectedTagFilters, setSelectedTagFilters] = useState([]);
    const [showTagFilter, setShowTagFilter] = useState(false);

    const [expandedTaskId, setExpandedTaskId] = useState(null);
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
    const [refreshContextMenu, setRefreshContextMenu] = useState(0);
    const [cachedTasks, setCachedTasks] = useState({});

    const [sortBy, setSortBy] = useState('dueDate');
    const [sortOrder, setSortOrder] = useState('asc');
    const [isMobileSort, setIsMobileSort] = useState(window.innerWidth <= 480);

    const [filters, setFilters] = useState({
        priority: [],
        dateFrom: null,
        dateTo: null,
        assignee: null,
        tags: []
    });
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [deleteTagConfirm, setDeleteTagConfirm] = useState({isOpen: false, tagId: null, tagName: ''});


    const [createTask] = useMutation(CREATE_TASK);
    const [updateTask] = useMutation(UPDATE_TASK);
    const [deleteTask] = useMutation(DELETE_TASK);
    const [setTaskAssignees] = useMutation(SET_TASK_ASSIGNEES);
    const [createTag] = useMutation(CREATE_TAG);
    const [addTagToTask] = useMutation(ADD_TAG_TO_TASK);
    const [removeTagFromTask] = useMutation(REMOVE_TAG_FROM_TASK);
    const [deleteTagFromProject] = useMutation(DELETE_TAG_FROM_PROJECT);

    const { data: tagsData, refetch: refetchTags } = useQuery(GET_TAGS, {
        variables: { projectId },
        skip: !projectId,
    });
    const availableTags = tagsData?.tags || [];

    useEffect(() => {
        if (highlightTaskId) {
            setHighlightedTask(highlightTaskId);
            const timer = setTimeout(() => {
                setHighlightedTask(null);
                searchParams.delete('highlightTask');
                setSearchParams(searchParams);
            }, 5000);

            setTimeout(() => {
                const taskElement = document.getElementById(`task-${highlightTaskId}`);
                if (taskElement) {
                    taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [highlightTaskId, searchParams, setSearchParams]);

    useEffect(() => {
        if (!projectId) navigate('/');
    }, [projectId, navigate]);
    useEffect(() => {
        if (projectId) {
            console.log('Loading tags for project:', projectId);
            refetchTags();
        }
    }, [projectId, refetchTags]);
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            setIsMobileSort(window.innerWidth <= 480);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = () => {
            setShowContextMenu(false);
            setShowCreateTag(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const {loading: projectLoading, data: projectData, refetch: refetchProject} = useQuery(GET_PROJECT_DETAILS, {
        variables: {projectId},
        skip: !projectId,
    });

    const {loading: tasksLoading, data: tasksData, refetch: refetchTasks, networkStatus: tasksNetworkStatus} = useQuery(GET_TASKS_BY_SUBGROUP, {
        variables: {subgroupId: activeSubgroupId},
        skip: !activeSubgroupId || activeSubgroupId === 'my-tasks',
        fetchPolicy: 'cache-and-network',
        notifyOnNetworkStatusChange: true,
    });

    const {loading: myTasksLoading, data: myTasksData, refetch: refetchMyTasks, networkStatus: myTasksNetworkStatus} = useQuery(GET_TASKS_BY_ASSIGNEE_AND_PROJECT, {
        variables: { userId: user.id, projectId: projectId },
        skip: activeSubgroupId !== 'my-tasks',
        fetchPolicy: 'cache-and-network',
        notifyOnNetworkStatusChange: true,
    });

    const refetchCurrentTasks = useCallback(() => {
        if (activeSubgroupId === 'my-tasks') {
            refetchMyTasks();
        } else if (activeSubgroupId) {
            refetchTasks();
        }
    }, [activeSubgroupId, refetchMyTasks, refetchTasks]);

    useEffect(() => {
        if (activeSubgroupId === 'my-tasks' && myTasksData?.tasksByAssigneeAndProject) {
            setCachedTasks(prev => ({ ...prev, [activeSubgroupId]: myTasksData.tasksByAssigneeAndProject }));
        } else if (tasksData?.tasksBySubgroup) {
            setCachedTasks(prev => ({ ...prev, [activeSubgroupId]: tasksData.tasksBySubgroup }));
        }
    }, [tasksData, myTasksData, activeSubgroupId]);

    // Синхронизация contextMenuTask при обновлении данных
    useEffect(() => {
        if (contextMenuTask && contextMenuTask.id && showContextMenu) {
            let updatedTask = null;

            if (activeSubgroupId === 'my-tasks' && myTasksData?.tasksByAssigneeAndProject) {
                updatedTask = myTasksData.tasksByAssigneeAndProject.find(t => t.id === contextMenuTask.id);
            } else if (tasksData?.tasksBySubgroup) {
                updatedTask = tasksData.tasksBySubgroup.find(t => t.id === contextMenuTask.id);
            }

            if (updatedTask && updatedTask.tags) {
                const currentTagIds = contextMenuTask.tags?.map(t => t.id).sort().join(',');
                const newTagIds = updatedTask.tags.map(t => t.id).sort().join(',');

                if (currentTagIds !== newTagIds) {
                    setContextMenuTask(prev => ({
                        ...prev,
                        tags: [...updatedTask.tags]
                    }));
                    setRefreshContextMenu(prev => prev + 1);
                }
            }
        }
    }, [myTasksData, tasksData, activeSubgroupId, contextMenuTask?.id, showContextMenu]);

    const fetchSubTasksForTask = useCallback(async (taskId, force = false) => {
        if (!force && subTasksCache[taskId]) return;

        setLoadingSubTasks(prev => ({ ...prev, [taskId]: true }));

        try {
            const { data } = await client.query({
                query: GET_ALL_SUBTASKS,
                variables: { taskIds: [taskId] },
                fetchPolicy: 'cache-first',
            });

            if (data?.tasksByIds?.length > 0) {
                const taskData = data.tasksByIds[0];
                setSubTasksCache(prev => ({ ...prev, [taskId]: taskData.subTasks || [] }));
            } else {
                setSubTasksCache(prev => ({ ...prev, [taskId]: [] }));
            }
        } catch (err) {
            console.error('Ошибка загрузки подзадач:', err);
            setSubTasksCache(prev => ({ ...prev, [taskId]: [] }));
        } finally {
            setLoadingSubTasks(prev => ({ ...prev, [taskId]: false }));
        }
    }, [client, subTasksCache]);

    const toggleExpandTask = useCallback((taskId) => {
        if (expandedTaskId === taskId) {
            setExpandedTaskId(null);
        } else {
            setExpandedTaskId(taskId);
            if (!subTasksCache[taskId]) {
                fetchSubTasksForTask(taskId);
            }
        }
    }, [expandedTaskId, subTasksCache, fetchSubTasksForTask]);

    // Добавление подзадачи
    const handleAddSubTaskFromMenu = async (taskId) => {
        if (!newSubTaskTitle.trim()) return;
        try {
            const realSubgroups = projectData?.project?.subgroups || [];
            const targetSubgroupId = activeSubgroupId === 'my-tasks' && realSubgroups.length > 0
                ? realSubgroups[0].id
                : activeSubgroupId;

            await createTask({
                variables: {
                    subgroupId: targetSubgroupId,
                    createdByUserId: user.id,
                    title: newSubTaskTitle.trim(),
                    description: null,
                    dueDate: null,
                    value: 2,
                    status: 'TODO',
                    assigneeIds: [user.id],
                    parentTaskId: taskId
                }
            });
            setNewSubTaskTitle('');
            await fetchSubTasksForTask(taskId, true);
            await refetchCurrentTasks();
            setShowContextMenu(false);
        } catch (err) {
            console.error('Ошибка добавления подзадачи:', err);
            alert('Ошибка добавления подзадачи');
        }
    };

    // Функция для добавления тега к задаче
    const handleAddTagToTask = async (taskId, tagId) => {
        try {
            const result = await addTagToTask({
                variables: { taskId, tagId }
            });

            if (result?.data?.addTagToTask) {
                setContextMenuTask(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        tags: [...(result.data.addTagToTask.tags || [])]
                    };
                });
                setRefreshContextMenu(prev => prev + 1);
            }

            await refetchCurrentTasks();
        } catch (err) {
            console.error('Ошибка добавления тега:', err);
            alert('Ошибка добавления тега: ' + err.message);
        }
    };

    const handleRemoveTagFromTask = async (taskId, tagId) => {
        try {
            const result = await removeTagFromTask({
                variables: { taskId, tagId }
            });

            if (result?.data?.removeTagFromTask) {
                setContextMenuTask(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        tags: [...(result.data.removeTagFromTask.tags || [])]
                    };
                });
                setRefreshContextMenu(prev => prev + 1);
            }

            await refetchCurrentTasks();
        } catch (err) {
            console.error('Ошибка удаления тега:', err);
            alert('Ошибка удаления тега: ' + err.message);
        }
    };

    // Функция для создания и добавления нового тега
    const handleCreateAndAddTag = async (taskId) => {
        if (!newTagName.trim()) return;
        try {
            const tagResult = await createTag({
                variables: {
                    projectId: projectId,
                    name: newTagName.trim(),
                    color: newTagColor
                }
            });
            const newTagId = tagResult.data.createTag.id;

            const addResult = await addTagToTask({
                variables: { taskId, tagId: newTagId }
            });

            if (addResult?.data?.addTagToTask) {
                setContextMenuTask(prev => ({
                    ...prev,
                    tags: [...(addResult.data.addTagToTask.tags || [])]
                }));
                setRefreshContextMenu(prev => prev + 1);
            }

            setNewTagName('');
            setNewTagColor('#3b82f6');
            setShowCreateTag(false);
            await refetchCurrentTasks();
            await refetchTags();
        } catch (err) {
            console.error('Ошибка создания и добавления тега:', err);
            alert('Ошибка: ' + err.message);
        }
    };

    const handleDeleteTagFromProject = (tagId, tagName) => {
        setDeleteTagConfirm({isOpen: true, tagId, tagName});
    };

    const confirmDeleteTagFromProject = async () => {
        if (!deleteTagConfirm.tagId) return;
        try {
            await deleteTagFromProject({
                variables: {
                    tagId: deleteTagConfirm.tagId,
                    projectId: projectId
                },
                update: (cache) => {
                    cache.evict({ fieldName: 'tags' });
                    cache.evict({ fieldName: 'tasksBySubgroup' });
                    cache.evict({ fieldName: 'tasksByAssigneeAndProject' });
                    cache.gc();
                }
            });
            setDeleteTagConfirm({isOpen: false, tagId: null, tagName: ''});

            await refetchTags();
            await refetchCurrentTasks();
            setShowContextMenu(false);
        } catch (err) {
            console.error('Ошибка удаления тега:', err);
            alert('Ошибка удаления тега: ' + err.message);
            setDeleteTagConfirm({isOpen: false, tagId: null, tagName: ''});
        }
    };

    const openContextMenu = (e, task) => {
        e.preventDefault();
        e.stopPropagation();

        // Получаем актуальную задачу из данных Apollo
        let actualTask = null;

        if (activeSubgroupId === 'my-tasks' && myTasksData?.tasksByAssigneeAndProject) {
            actualTask = myTasksData.tasksByAssigneeAndProject.find(t => t.id === task.id);
        } else if (tasksData?.tasksBySubgroup) {
            actualTask = tasksData.tasksBySubgroup.find(t => t.id === task.id);
        }

        // Если не нашли в данных, используем переданную задачу
        if (!actualTask) {
            actualTask = task;
        }

        setContextMenuTaskId(actualTask.id);
        setContextMenuTask({
            ...actualTask,
            tags: actualTask.tags ? [...actualTask.tags] : []
        });

        setContextMenuPosition({ x: e.clientX, y: e.clientY });
        setShowContextMenu(true);
        setNewTagName('');
        setNewTagColor('#3b82f6');
        setNewSubTaskTitle('');
        setShowCreateTag(false);
    };

    const handleContextMenuDelete = async () => {
        if (contextMenuTaskId) {
            await deleteTask({ variables: { id: contextMenuTaskId } });
            client.cache.evict({ fieldName: 'tasksBySubgroup' });
            client.cache.evict({ fieldName: 'tasksByAssigneeAndProject' });
            client.cache.gc();
            await refetchCurrentTasks();
        }
        setShowContextMenu(false);
    };

    useEffect(() => {
        if (!projectData?.project) return;
        const realSubgroups = projectData.project.subgroups || [];
        if (urlSubgroupId) {
            if (urlSubgroupId === 'my-tasks') setActiveSubgroupId('my-tasks');
            else if (realSubgroups.some(g => g.id === urlSubgroupId)) setActiveSubgroupId(urlSubgroupId);
            else {
                setActiveSubgroupId('my-tasks');
                setSearchParams({projectId, subgroupId: 'my-tasks'});
            }
        } else {
            setActiveSubgroupId('my-tasks');
            setSearchParams({projectId, subgroupId: 'my-tasks'});
        }
    }, [projectData, urlSubgroupId, projectId, setSearchParams]);

    const handleSelectSubgroup = (subgroupId) => {
        setActiveSubgroupId(subgroupId);
        setSearchParams({projectId, subgroupId});
        if (isMobile) setShowMobileGroups(false);
        setFilters({
            priority: [],
            dateFrom: null,
            dateTo: null,
            assignee: null,
            tags: []
        });
        setSelectedTagFilters([]);
        setExpandedTaskId(null);
        setSubTasksCache({});
    };

    if (projectLoading) return <div className="loading">Загрузка проекта...</div>;
    if (!projectData?.project) return <div className="message-error">Проект не найден</div>;

    const project = projectData.project;
    const isOwner = project.owner.id === user.id;
    const currentMember = project.members.find(m => m.userId === user.id);
    const canEditProject = isOwner || currentMember?.role === 'ADMIN';
    const isViewer = currentMember?.role === 'VIEWER';
    const canViewSettings = !isViewer;
    const realSubgroups = project.subgroups || [];
    const projectMembers = project.members || [];

    let tasks = [];
    if (activeSubgroupId === 'my-tasks') {
        tasks = myTasksData?.tasksByAssigneeAndProject || [];
    } else if (activeSubgroupId && tasksData?.tasksBySubgroup) {
        tasks = tasksData.tasksBySubgroup;
    }

    const showLoading = () => {
        if (activeSubgroupId === 'my-tasks') {
            return myTasksLoading && myTasksNetworkStatus === 1 && !myTasksData?.tasksByAssigneeAndProject;
        }
        return tasksLoading && tasksNetworkStatus === 1 && !tasksData?.tasksBySubgroup;
    };

    const applyFilters = (tasksArray) => {
        let filtered = [...tasksArray];

        if (filters.priority.length > 0) {
            filtered = filtered.filter(task => {
                const priority = task.value || 2;
                if (filters.priority.includes('high') && priority === 3) return true;
                if (filters.priority.includes('medium') && priority === 2) return true;
                if (filters.priority.includes('low') && priority === 1) return true;
                return false;
            });
        }

        if (filters.dateFrom || filters.dateTo) {
            filtered = filtered.filter(task => {
                if (!task.dueDate) return false;
                const dueDate = new Date(task.dueDate);
                if (filters.dateFrom && dueDate < filters.dateFrom) return false;
                if (filters.dateTo && dueDate > filters.dateTo) return false;
                return true;
            });
        }

        if (filters.assignee) {
            filtered = filtered.filter(task =>
                task.assignees?.some(a => a.id === filters.assignee)
            );
        }

        if (filters.tags && filters.tags.length > 0) {
            filtered = filtered.filter(task =>
                task.tags?.some(tag => filters.tags.includes(tag.id))
            );
        }

        return filtered;
    };

    const normalizeStatus = (status) => {
        if (status === undefined || status === null) return 'TODO';
        if (typeof status === 'number') {
            if (status === 0) return 'TODO';
            if (status === 1) return 'IN_PROGRESS';
            if (status === 2) return 'REVIEW';
            return 'TODO';
        }
        const upper = String(status).toUpperCase();
        if (upper === 'TODO') return 'TODO';
        if (upper === 'IN_PROGRESS' || upper === 'INPROGRESS') return 'IN_PROGRESS';
        if (upper === 'REVIEW') return 'REVIEW';
        return 'TODO';
    };

    const getTaskDueDateColor = (task) => {
        const status = normalizeStatus(task.status);
        if (status === 'REVIEW') return null;
        if (!task.dueDate) return null;
        const now = new Date();
        const due = new Date(task.dueDate);
        const hoursLeft = (due - now) / (1000 * 60 * 60);
        if (hoursLeft < 0) return '#dc2626';
        if (hoursLeft < 24) return '#f59e0b';
        if (hoursLeft < 72) return '#eab308';
        return null;
    };

    const getDueWarningText = (task) => {
        const status = normalizeStatus(task.status);
        if (status === 'REVIEW') return null;
        if (!task.dueDate) return null;
        const now = new Date();
        const due = new Date(task.dueDate);
        const hoursLeft = (due - now) / (1000 * 60 * 60);
        if (hoursLeft < 0) return 'Просрочено';
        if (hoursLeft < 24) return 'Менее суток';
        if (hoursLeft < 72) return 'Менее 3 дней';
        return null;
    };

    const getTaskCardStyle = (task, isSubTask = false) => {
        const dueDateColor = getTaskDueDateColor(task);
        const baseStyle = { borderLeftColor: dueDateColor || '#2563eb' };
        if (isSubTask) {
            return {
                ...baseStyle,
                padding: '6px 8px',
                fontSize: '0.75rem',
                marginLeft: '16px',
                backgroundColor: dueDateColor ? `${dueDateColor}08` : '#fafbfc',
            };
        }
        if (dueDateColor) {
            return { ...baseStyle, backgroundColor: `${dueDateColor}08` };
        }
        return baseStyle;
    };

    const sortTasks = (tasksArray) => {
        if (!tasksArray.length) return tasksArray;
        const sorted = [...tasksArray];
        switch (sortBy) {
            case 'dueDate':
                sorted.sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return sortOrder === 'asc'
                        ? new Date(a.dueDate) - new Date(b.dueDate)
                        : new Date(b.dueDate) - new Date(a.dueDate);
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
            default:
                break;
        }
        return sorted;
    };

    const statusLabels = {
        TODO: <><i className="fas fa-clipboard-list"></i> Создано</>,
        IN_PROGRESS: <><i className="fas fa-cogs"></i> В разработке</>,
        REVIEW: <><i className="fas fa-check-circle"></i> Выполнено</>,
    };
    const statusColors = {TODO: '#3b82f6', IN_PROGRESS: '#f59e0b', REVIEW: '#10b981'};

    const tasksForStatus = (status) => {
        const filtered = tasks.filter(t => normalizeStatus(t.status) === status);
        return sortTasks(applyFilters(filtered));
    };

    const tasksByStatus = {
        TODO: tasksForStatus('TODO'),
        IN_PROGRESS: tasksForStatus('IN_PROGRESS'),
        REVIEW: tasksForStatus('REVIEW'),
    };

    const getActiveFiltersCount = () => {
        let count = 0;
        if (filters.priority.length > 0) count++;
        if (filters.dateFrom || filters.dateTo) count++;
        if (filters.assignee) count++;
        if (filters.tags.length > 0) count++;
        return count;
    };

    const handlePriorityChange = (value) => {
        setFilters(prev => ({
            ...prev,
            priority: prev.priority.includes(value)
                ? prev.priority.filter(p => p !== value)
                : [...prev.priority, value]
        }));
    };

    const handleDateFromChange = (date) => {
        setFilters(prev => ({ ...prev, dateFrom: date }));
    };

    const handleDateToChange = (date) => {
        setFilters(prev => ({ ...prev, dateTo: date }));
    };

    const handleAssigneeChange = (e) => {
        setFilters(prev => ({ ...prev, assignee: e.target.value || null }));
    };

    const handleTagFilterToggle = (tagId) => {
        setFilters(prev => ({
            ...prev,
            tags: prev.tags.includes(tagId)
                ? prev.tags.filter(id => id !== tagId)
                : [...prev.tags, tagId]
        }));
        setSelectedTagFilters(prev =>
            prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
        );
    };

    const resetFilters = () => {
        setFilters({ priority: [], dateFrom: null, dateTo: null, assignee: null, tags: [] });
        setSelectedTagFilters([]);
    };

    let targetSubgroupForAssign = null;
    if (activeSubgroupId && activeSubgroupId !== 'my-tasks') {
        targetSubgroupForAssign = realSubgroups.find(g => g.id === activeSubgroupId);
    } else if (activeSubgroupId === 'my-tasks' && realSubgroups.length > 0) {
        targetSubgroupForAssign = realSubgroups[0];
    }
    const assignableUsers = targetSubgroupForAssign?.members || [];

    const handleCreateTask = () => {
        if (isCreatingTask) return;
        if (isViewer) {
            alert('У вас нет прав на создание задач');
            return;
        }
        if (!activeSubgroupId) {
            alert('Сначала выберите группу');
            return;
        }
        setIsCreatingTask(true);
        setEditingTask(null);
        setInitialAssigneeIds([]);
        setShowTaskModal(true);
        setIsCreatingTask(false);
    };

    const handleCloseTaskModal = () => {
        setShowTaskModal(false);
        setIsCreatingTask(false);
        setEditingTask(null);
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setShowTaskModal(true);
    };

    const handleSaveTask = async (taskData) => {
        try {
            const formattedDueDate = taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null;

            let statusValue = taskData.status;
            if (typeof statusValue === 'number') {
                statusValue = statusValue === 0 ? 'TODO' : statusValue === 1 ? 'IN_PROGRESS' : 'REVIEW';
            }
            statusValue = statusValue?.toUpperCase();
            if (statusValue === 'INPROGRESS') statusValue = 'IN_PROGRESS';

            if (editingTask) {
                await updateTask({
                    variables: {
                        id: editingTask.id,
                        title: taskData.title,
                        description: taskData.description || null,
                        dueDate: formattedDueDate,
                        value: taskData.value,
                        status: statusValue,
                    },
                });
                if (taskData.assigneeIds) {
                    await setTaskAssignees({variables: {taskId: editingTask.id, userIds: taskData.assigneeIds}});
                }
                if (taskData.creatorId && taskData.creatorId !== editingTask.createdBy?.id) {
                    await updateTask({
                        variables: { id: editingTask.id, createdByUserId: taskData.creatorId },
                    });
                }
                if (editingTask.parentTaskId && editingTask.parentTaskId !== 0) {
                    await fetchSubTasksForTask(editingTask.parentTaskId, true);
                }
            } else {
                let targetSubgroupId = activeSubgroupId;
                let assigneeIds = taskData.assigneeIds || [];
                if (activeSubgroupId === 'my-tasks') {
                    if (realSubgroups.length === 0) {
                        alert('Сначала создайте хотя бы одну группу в проекте');
                        return;
                    }
                    targetSubgroupId = realSubgroups[0].id;
                    if (!assigneeIds.includes(user.id)) assigneeIds.push(user.id);
                }
                await createTask({
                    variables: {
                        subgroupId: targetSubgroupId,
                        createdByUserId: taskData.creatorId || user.id,
                        title: taskData.title,
                        description: taskData.description || null,
                        dueDate: formattedDueDate,
                        value: taskData.value || 0,
                        status: statusValue,
                        assigneeIds,
                        parentTaskId: null
                    },
                });
            }
            await refetchCurrentTasks();
            setShowTaskModal(false);
        } catch (err) {
            console.error('Ошибка сохранения задачи:', err);
            alert('Ошибка: ' + err.message);
        }
    };

    const handleDeleteTask = (taskId) => setDeleteConfirm({isOpen: true, taskId});

    const confirmDeleteTask = async () => {
        if (isViewer) return;
        await deleteTask({variables: {id: deleteConfirm.taskId}});
        client.cache.evict({fieldName: 'tasksBySubgroup'});
        client.cache.evict({fieldName: 'tasksByAssigneeAndProject'});
        client.cache.gc();
        await refetchCurrentTasks();
        setDeleteConfirm({isOpen: false, taskId: null});
    };

    const handleDeleteTaskFromModal = async (taskId) => {
        await deleteTask({variables: {id: taskId}});
        client.cache.evict({fieldName: 'tasksBySubgroup'});
        client.cache.evict({fieldName: 'tasksByAssigneeAndProject'});
        client.cache.gc();
        await refetchCurrentTasks();
        setShowTaskModal(false);
    };

    const handleDragStart = (e, taskId, fromStatus) => {
        if (isViewer) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.setData('fromStatus', fromStatus);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = async (e, toStatus) => {
        if (isViewer) return;
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        const fromStatus = e.dataTransfer.getData('fromStatus');
        if (!taskId || fromStatus === toStatus) return;
        await updateTask({variables: {id: taskId, status: toStatus}});
        await refetchCurrentTasks();
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleSortChange = (newSortBy) => {
        if (sortBy === newSortBy) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('asc');
        }
    };

    const getSortIcon = (sortType) => {
        if (sortBy !== sortType) return <i className="fas fa-sort"></i>;
        return sortOrder === 'asc' ? <i className="fas fa-sort-up"></i> : <i className="fas fa-sort-down"></i>;
    };

    const FilterModal = () => (
        <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
            <div className="modal-content filter-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setShowFilterModal(false)}>✕</button>
                <h3><i className="fas fa-filter"></i> Фильтрация задач</h3>
                <div className="filter-modal-body">
                    <div className="filter-section">
                        <div className="filter-section-title"><i className="fas fa-chart-line"></i> Важность</div>
                        <div className="filter-options">
                            <label className={`filter-option ${filters.priority.includes('high') ? 'active' : ''}`}>
                                <input type="checkbox" checked={filters.priority.includes('high')} onChange={() => handlePriorityChange('high')} />
                                <span className="priority-high"><i className="fas fa-exclamation-triangle"></i> Высокая</span>
                            </label>
                            <label className={`filter-option ${filters.priority.includes('medium') ? 'active' : ''}`}>
                                <input type="checkbox" checked={filters.priority.includes('medium')} onChange={() => handlePriorityChange('medium')} />
                                <span className="priority-medium"><i className="fas fa-exclamation"></i> Средняя</span>
                            </label>
                            <label className={`filter-option ${filters.priority.includes('low') ? 'active' : ''}`}>
                                <input type="checkbox" checked={filters.priority.includes('low')} onChange={() => handlePriorityChange('low')} />
                                <span className="priority-low"><i className="fas fa-info-circle"></i> Низкая</span>
                            </label>
                        </div>
                    </div>
                    <div className="filter-divider"></div>
                    <div className="filter-section">
                        <div className="filter-section-title"><i className="fas fa-calendar-range"></i> Диапазон дат</div>
                        <div className="date-range-row">
                            <div className="date-field">
                                <DatePicker
                                    selected={filters.dateFrom}
                                    onChange={handleDateFromChange}
                                    dateFormat="dd.MM.yyyy"
                                    placeholderText="Дата от"
                                    className="form-input"
                                    isClearable
                                />
                            </div>
                            <span className="date-separator">—</span>
                            <div className="date-field">
                                <DatePicker
                                    selected={filters.dateTo}
                                    onChange={handleDateToChange}
                                    dateFormat="dd.MM.yyyy"
                                    placeholderText="Дата до"
                                    className="form-input"
                                    isClearable
                                />
                            </div>
                        </div>
                    </div>
                    <div className="filter-divider"></div>
                    <div className="filter-section">
                        <div className="filter-section-title"><i className="fas fa-user-check"></i> Исполнитель</div>
                        <select className="form-select" value={filters.assignee || ''} onChange={handleAssigneeChange}>
                            <option value="">Все исполнители</option>
                            {projectMembers.map(member => (
                                <option key={member.userId} value={member.userId}>{member.user.fullName}</option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-divider"></div>
                    <div className="filter-section">
                        <div className="filter-section-title"><i className="fas fa-tags"></i> Теги</div>
                        <div className="filter-options">
                            {availableTags.map((tag, idx) => (
                                <label
                                    key={`filter-tag-${tag.id}-${idx}`}
                                    className={`filter-option ${filters.tags.includes(tag.id) ? 'active' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={filters.tags.includes(tag.id)}
                                        onChange={() => handleTagFilterToggle(tag.id)}
                                    />
                                    <span style={{
                                        backgroundColor: tag.color,
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '0.75rem'
                                    }}>
                                        {tag.name}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="filter-modal-actions">
                    <button className="btn btn--secondary" onClick={resetFilters}><i className="fas fa-eraser"></i> Сбросить все</button>
                    <button className="btn" onClick={() => setShowFilterModal(false)}><i className="fas fa-check"></i> Применить</button>
                </div>
            </div>
        </div>
    );

    const SubTaskCard = ({ subTask, level = 1 }) => {
        const dueWarningText = getDueWarningText(subTask);
        const dueWarningColor = getTaskDueDateColor(subTask);
        const childSubTasks = subTasksCache[subTask.id] || [];
        const completedSubCount = childSubTasks.filter(st => st.status === 2).length;
        const isExpandedSub = expandedTaskId === subTask.id;
        const isLoading = loadingSubTasks[subTask.id];

        const subTaskStatus = normalizeStatus(subTask.status);
        const isCompleted = subTaskStatus === 'REVIEW';
        const isInProgress = subTaskStatus === 'IN_PROGRESS';

        const getStatusClass = () => {
            if (isCompleted) return 'review';
            if (isInProgress) return 'in-progress';
            return 'todo';
        };

        return (
            <div
                className={`task-card subtask-card level-${Math.min(level, 4)} ${getStatusClass()}`}
                style={getTaskCardStyle(subTask, true)}
                draggable={false}
            >
                <div className="task-card-main" onClick={() => handleEditTask(subTask)}>
                    <div className="subtask-header-row">
                        <div className="subtask-title">
                            <span>{'↳ '.repeat(level)}{subTask.title}</span>
                            {subTask.attachments?.length > 0 && <i className="fas fa-paperclip attachment-icon"></i>}
                            {childSubTasks.length > 0 && (
                                <span className="subtasks-badge subtask-badge">
                                    {completedSubCount}/{childSubTasks.length}
                                </span>
                            )}
                            <span className={`subtask-status-badge ${getStatusClass()}`}>
                                {subTaskStatus === 'TODO' && <><i className="fas fa-clipboard-list"></i> Создано</>}
                                {subTaskStatus === 'IN_PROGRESS' && <><i className="fas fa-cogs"></i> В работе</>}
                                {subTaskStatus === 'REVIEW' && <><i className="fas fa-check-circle"></i> Выполнена</>}
                            </span>
                        </div>
                        {!isViewer && activeSubgroupId !== 'my-tasks' && (
                            <button className="subtask-menu-btn" onClick={(e) => openContextMenu(e, subTask)}>
                                <i className="fas fa-ellipsis-v"></i>
                            </button>
                        )}
                    </div>

                    <div className="task-bottom-row subtask-bottom-row">
                        <div className={`task-priority priority-${subTask.value || 2} subtask-priority`}>
                            {subTask.value === 1 && <>Низкая</>}
                            {subTask.value === 2 && <>Средняя</>}
                            {subTask.value === 3 && <>Высокая</>}
                            {!subTask.value && <>Средняя</>}
                        </div>
                        <div className="task-date-group">
                            {dueWarningText && !isCompleted && (
                                <span className="task-due-warning subtask-warning" style={{
                                    backgroundColor: dueWarningColor,
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: '12px',
                                    fontSize: '0.6rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <i className="fas fa-exclamation-triangle"></i> {dueWarningText}
                                </span>
                            )}
                            {subTask.dueDate && (
                                <div className="task-date subtask-date" style={isCompleted ? { textDecoration: 'line-through', opacity: 0.6 } : {}}>
                                    <i className="far fa-calendar-alt"></i> {new Date(subTask.dueDate).toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="task-assignees subtask-assignees">
                        {subTask.assignees?.slice(0, 2).map(a => (
                            <div key={a.id} className="assignee-wrapper">
                                <span className="assignee-name subtask-assignee-name" style={isCompleted ? { opacity: 0.6 } : {}}>
                                    <i className="fas fa-user"></i> {a.fullName}
                                </span>
                                <span className="assignee-tooltip">{a.email}</span>
                            </div>
                        ))}
                        {subTask.assignees?.length > 2 && <span className="assignee-more">+{subTask.assignees.length - 2}</span>}
                    </div>
                </div>

                <div className="task-card-footer subtask-footer">
                    {childSubTasks.length > 0 && (
                        <button className="task-expand-btn subtask-expand-btn" onClick={(e) => { e.stopPropagation(); toggleExpandTask(subTask.id); }}>
                            <i className={`fas fa-chevron-${isExpandedSub ? 'up' : 'down'}`}></i> {childSubTasks.length} подзадач
                        </button>
                    )}
                </div>

                {isExpandedSub && (
                    <div className="task-subtasks-expanded subtask-subtasks-expanded" onClick={(e) => e.stopPropagation()}>
                        {isLoading ? <div className="subtask-loading">Загрузка...</div> : childSubTasks.map(nestedSubTask => (
                            <SubTaskCard key={nestedSubTask.id} subTask={nestedSubTask} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="kanban-layout">
            {!isMobile && (
                <SubgroupsPanel
                    projectId={projectId}
                    activeSubgroupId={activeSubgroupId}
                    onSelectSubgroup={handleSelectSubgroup}
                    isOwner={isOwner}
                    projectMembers={projectMembers}
                    onRefreshProject={refetchProject}
                />
            )}

            <div className="kanban-container">
                <div className="kanban-header-row">
                    <div className="kanban-title-area">
                        <h2 className="kanban-title"><i className="fas fa-chalkboard"></i> {project.name}</h2>
                        {isMobile && (
                            <button className="mobile-groups-btn" onClick={() => setShowMobileGroups(true)}>
                                <i className="fas fa-bars"></i> Группы
                            </button>
                        )}
                        {!isViewer && activeSubgroupId !== 'my-tasks' && (
                            <button className="btn" onClick={handleCreateTask} disabled={isCreatingTask}>
                                <i className="fas fa-plus"></i> Новая задача
                            </button>
                        )}
                    </div>
                    {canViewSettings && (
                        <button className="btn btn--secondary settings-btn" onClick={() => navigate(`/settings?projectId=${projectId}`)}>
                            <i className="fas fa-cog"></i> Настройки проекта
                        </button>
                    )}
                </div>

                <div className="kanban-controls-row">
                    <div className="kanban-sort-panel">
                        <span className="sort-label"><i className="fas fa-arrow-up-wide-short"></i> Сортировать:</span>
                        {isMobileSort ? (
                            <select
                                className="form-select sort-select-mobile"
                                value={sortBy}
                                onChange={(e) => {
                                    setSortBy(e.target.value);
                                    setSortOrder('asc');
                                }}
                                style={{ width: 'auto', minWidth: '130px', fontSize: '0.8rem', padding: '6px 10px', borderRadius: '30px' }}
                            >
                                <option value="dueDate">По дедлайну</option>
                                <option value="priority">По важности</option>
                                <option value="creator">По создателю</option>
                            </select>
                        ) : (
                            <>
                                <button className={`sort-btn ${sortBy === 'dueDate' ? 'active' : ''}`} onClick={() => handleSortChange('dueDate')}>
                                    <i className="fas fa-calendar-alt"></i> Дедлайн {getSortIcon('dueDate')}
                                </button>
                                <button className={`sort-btn ${sortBy === 'priority' ? 'active' : ''}`} onClick={() => handleSortChange('priority')}>
                                    <i className="fas fa-chart-line"></i> Важность {getSortIcon('priority')}
                                </button>
                                <button className={`sort-btn ${sortBy === 'creator' ? 'active' : ''}`} onClick={() => handleSortChange('creator')}>
                                    <i className="fas fa-user"></i> Создатель {getSortIcon('creator')}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="kanban-filter-panel">
                        <button className="filter-toggle-btn" onClick={() => setShowFilterModal(true)}>
                            <i className="fas fa-filter"></i> Фильтры
                            {getActiveFiltersCount() > 0 && <span className="filter-badge-count">{getActiveFiltersCount()}</span>}
                        </button>
                        <div className="filter-info">
                            {getActiveFiltersCount() > 0 && (
                                <span className="filter-badge">
                                    <i className="fas fa-filter"></i> Активно: {getActiveFiltersCount()}
                                    <button className="filter-badge-remove" onClick={resetFilters}><i className="fas fa-times-circle"></i></button>
                                </span>
                            )}
                            <span className="tasks-count">
                                <i className="fas fa-tasks"></i> {tasksByStatus.TODO.length + tasksByStatus.IN_PROGRESS.length + tasksByStatus.REVIEW.length}
                            </span>
                        </div>
                    </div>
                </div>

                {showLoading() && <div className="loading">Загрузка задач...</div>}

                {activeSubgroupId && viewMode === 'kanban' && (
                    <div className="kanban-board">
                        {['TODO', 'IN_PROGRESS', 'REVIEW'].map((status) => (
                            <div key={status} className="kanban-column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                                <div className="kanban-column-header">
                                    <h3 style={{borderLeftColor: statusColors[status]}}>{statusLabels[status]}</h3>
                                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                                        <span className="kanban-task-count">{tasksByStatus[status].length}</span>
                                    </div>
                                </div>
                                <div className="kanban-task-list">
                                    {tasksByStatus[status].map((task) => {
                                        const dueWarningText = getDueWarningText(task);
                                        const dueWarningColor = getTaskDueDateColor(task);
                                        const subTasksCount = task.subTasksCount || 0;
                                        const currentSubTasks = subTasksCache[task.id] || [];
                                        const completedSubCount = currentSubTasks.filter(st => st.status === 2).length;
                                        const isExpandedTask = expandedTaskId === task.id;
                                        const isLoadingSubTasks = loadingSubTasks[task.id];

                                        return (
                                            <div
                                                key={task.id}
                                                id={`task-${task.id}`}
                                                className={`task-card ${isExpandedTask ? 'expanded' : ''} ${highlightedTask === task.id ? 'task-highlighted' : ''}`}
                                                style={getTaskCardStyle(task)}
                                                draggable={!isViewer}
                                                onDragStart={(e) => handleDragStart(e, task.id, status)}
                                            >
                                                <div className="task-card-main" onClick={() => handleEditTask(task)}>
                                                    <div className="task-header-row">
                                                        <div className="task-title">
                                                            <span>{task.title}</span>
                                                            {task.attachments?.length > 0 && <i className="fas fa-paperclip attachment-icon"></i>}
                                                            {subTasksCount > 0 && <span className="subtasks-badge">{completedSubCount}/{subTasksCount}</span>}
                                                        </div>
                                                        {!isViewer && activeSubgroupId !== 'my-tasks' && (
                                                            <button className="task-menu-btn-top" onClick={(e) => openContextMenu(e, task)}>
                                                                <i className="fas fa-ellipsis-v"></i>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {task.tags && task.tags.length > 0 && (
                                                        <div className="task-tags" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                                                            {task.tags.map((tag, idx) => (
                                                                <span
                                                                    key={`${task.id}-tag-${tag.id}-${idx}`}
                                                                    style={{
                                                                        backgroundColor: tag.color || '#3b82f6',
                                                                        color: 'white',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px',
                                                                        fontSize: '0.65rem',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    {tag.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="task-bottom-row">
                                                        <div className={`task-priority priority-${task.value || 2}`}>
                                                            {task.value === 1 && <>Низкая</>}
                                                            {task.value === 2 && <>Средняя</>}
                                                            {task.value === 3 && <>Высокая</>}
                                                            {!task.value && <>Средняя</>}
                                                        </div>
                                                        <div className="task-date-group">
                                                            {task.dueDate && <div className="task-date"><i className="far fa-calendar-alt"></i> {new Date(task.dueDate).toLocaleString()}</div>}
                                                            {dueWarningText && (
                                                                <span className="task-due-warning" style={{ backgroundColor: dueWarningColor, color: 'white', padding: '2px 6px', borderRadius: '12px', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <i className="fas fa-exclamation-triangle"></i> {dueWarningText}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="task-assignees">
                                                        {task.assignees?.map(a => (
                                                            <div key={a.id} className="assignee-wrapper">
                                                                <span className="assignee-name"><i className="fas fa-user"></i> {a.fullName}</span>
                                                                <span className="assignee-tooltip">{a.email}</span>
                                                            </div>
                                                        ))}
                                                        {task.assignees?.length > 3 && <span className="assignee-more">+{task.assignees.length - 3}</span>}
                                                    </div>
                                                </div>
                                                <div className="task-card-footer">
                                                    {subTasksCount > 0 && (
                                                        <button className="task-expand-btn" onClick={(e) => { e.stopPropagation(); toggleExpandTask(task.id); }}>
                                                            <i className={`fas fa-chevron-${isExpandedTask ? 'up' : 'down'}`}></i> {subTasksCount} подзадач
                                                        </button>
                                                    )}
                                                </div>
                                                {isExpandedTask && (
                                                    <div className="task-subtasks-expanded" onClick={(e) => e.stopPropagation()}>
                                                        {isLoadingSubTasks ? <div className="subtask-loading">Загрузка подзадач...</div> : currentSubTasks.map(subTask => (
                                                            <SubTaskCard key={subTask.id} subTask={subTask} level={1} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showTaskModal && (
                <TaskModal
                    task={editingTask}
                    subgroupId={activeSubgroupId}
                    assignableUsers={assignableUsers}
                    initialAssigneeIds={initialAssigneeIds}
                    onSave={handleSaveTask}
                    onDeleteTask={handleDeleteTaskFromModal}
                    isMyTasksGroup={activeSubgroupId === 'my-tasks'}
                    isCreator={editingTask?.createdBy?.id === user.id}
                    canEdit={!isViewer && (editingTask?.createdBy?.id === user.id || canEditProject)}
                    isViewer={isViewer}
                    onClose={handleCloseTaskModal}
                    projectId={projectId}
                    refetchProjectTags={refetchTags}
                />
            )}

            <ConfirmModal isOpen={deleteConfirm.isOpen} title="Удаление задачи" message="Вы действительно хотите удалить эту задачу? Это действие необратимо." onConfirm={confirmDeleteTask} onCancel={() => setDeleteConfirm({isOpen: false, taskId: null})} />

            {/* Контекстное меню с подзадачами и тегами */}
            {showContextMenu && contextMenuTask && (
                <div
                    key={refreshContextMenu}
                    className="context-menu"
                    style={{ position: 'fixed', top: contextMenuPosition.y, left: contextMenuPosition.x, zIndex: 10000 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="context-menu-item" onClick={handleContextMenuDelete}>
                        <i className="fas fa-trash-alt"></i> Удалить задачу
                    </div>

                    <div className="context-menu-divider"></div>

                    {/* Блок добавления подзадачи */}
                    <div className="context-menu-subtask">
                        <div className="context-menu-subtask-form">
                            <input
                                type="text"
                                placeholder="Название подзадачи..."
                                value={newSubTaskTitle}
                                onChange={(e) => setNewSubTaskTitle(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddSubTaskFromMenu(contextMenuTaskId)}
                                autoFocus
                            />
                            <button onClick={() => handleAddSubTaskFromMenu(contextMenuTaskId)}>Добавить подзадачу</button>
                        </div>
                    </div>

                    <div className="context-menu-divider"></div>

                    {/* Блок тегов */}
                    <div style={{ padding: '8px 16px' }}>
                        <div style={{ fontWeight: '500', marginBottom: '8px', fontSize: '0.8rem', color: '#1e293b' }}>
                            <i className="fas fa-tags"></i> Теги
                        </div>
                        <div className="tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            {availableTags.map(tag => {
                                const taskTags = contextMenuTask?.tags || [];
                                const isTagOnTask = taskTags.some(t => t.id === tag.id);

                                return (
                                    <div key={`context-tag-${tag.id}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isTagOnTask) {
                                                    handleRemoveTagFromTask(contextMenuTask.id, tag.id);
                                                } else {
                                                    handleAddTagToTask(contextMenuTask.id, tag.id);
                                                }
                                            }}
                                            style={{
                                                backgroundColor: isTagOnTask ? tag.color : 'transparent',
                                                color: isTagOnTask ? 'white' : tag.color,
                                                border: `1px solid ${tag.color}`,
                                                borderRadius: '20px',
                                                padding: '4px 12px',
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {tag.name}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteTagFromProject(tag.id, tag.name)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                fontSize: '0.7rem',
                                                padding: '4px'
                                            }}
                                            title="Удалить тег из проекта"
                                        >
                                            <i className="fas fa-times-circle"></i>
                                        </button>
                                    </div>
                                );
                            })}

                            {!showCreateTag ? (
                                <button
                                    type="button"
                                    className="btn btn--secondary btn--small"
                                    onClick={() => setShowCreateTag(true)}
                                    style={{
                                        background: '#f1f5f9',
                                        border: 'none',
                                        borderRadius: '20px',
                                        padding: '4px 12px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <i className="fas fa-plus"></i> Новый тег
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Название тега"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', width: '100px' }}
                                        autoFocus
                                    />
                                    <input
                                        type="color"
                                        value={newTagColor}
                                        onChange={(e) => setNewTagColor(e.target.value)}
                                        style={{ width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => handleCreateAndAddTag(contextMenuTask.id)}
                                        style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                                    >
                                        <i className="fas fa-check"></i>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn--secondary"
                                        onClick={() => setShowCreateTag(false)}
                                        style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={deleteTagConfirm.isOpen}
                title="Удаление тега из проекта"
                message={`Вы действительно хотите удалить тег "${deleteTagConfirm.tagName}" из проекта? Это удалит тег отовсюду.`}
                onConfirm={confirmDeleteTagFromProject}
                onCancel={() => setDeleteTagConfirm({isOpen: false, tagId: null, tagName: ''})}
                confirmText="Удалить"
                confirmStyle="btn--danger"
            />
            {isMobile && showMobileGroups && (
                <div className="mobile-groups-modal" onClick={() => setShowMobileGroups(false)}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <SubgroupsPanel projectId={projectId} activeSubgroupId={activeSubgroupId} onSelectSubgroup={handleSelectSubgroup} isOwner={isOwner} projectMembers={projectMembers} onRefreshProject={refetchProject} />
                    </div>
                </div>
            )}

            {showFilterModal && <FilterModal />}
        </div>
    );
};

export default KanbanBoard;