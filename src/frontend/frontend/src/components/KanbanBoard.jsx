/* eslint-disable no-unused-vars */
import React, {useState, useEffect, useCallback} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {useQuery, useMutation, useApolloClient} from '@apollo/client';
import {GET_PROJECT_DETAILS, GET_TASKS_BY_SUBGROUP, GET_TASKS_BY_ASSIGNEE_AND_PROJECT, GET_ALL_SUBTASKS} from '../graphql/queries';
import {UPDATE_TASK, DELETE_TASK, CREATE_TASK, SET_TASK_ASSIGNEES} from '../graphql/mutations';
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

    // Состояния для подзадач на карточках
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [subTasksCache, setSubTasksCache] = useState({});
    const [loadingSubTasks, setLoadingSubTasks] = useState({});
    const [contextMenuTaskId, setContextMenuTaskId] = useState(null);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [newSubTaskTitle, setNewSubTaskTitle] = useState('');

    // Кэш для задач по группам
    const [cachedTasks, setCachedTasks] = useState({});

    // Состояния для сортировки
    const [sortBy, setSortBy] = useState('dueDate');
    const [sortOrder, setSortOrder] = useState('asc');
    const [isMobileSort, setIsMobileSort] = useState(window.innerWidth <= 480);

    // Состояния для фильтрации
    const [filters, setFilters] = useState({
        priority: [],
        dateFrom: null,
        dateTo: null,
        assignee: null
    });
    const [showFilterModal, setShowFilterModal] = useState(false);

    const [createTask] = useMutation(CREATE_TASK);
    const [updateTask] = useMutation(UPDATE_TASK);
    const [deleteTask] = useMutation(DELETE_TASK);
    const [setTaskAssignees] = useMutation(SET_TASK_ASSIGNEES);

    // Эффект для подсветки задачи
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
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            setIsMobileSort(window.innerWidth <= 480);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = () => setShowContextMenu(false);
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

    const handleToggleSubTaskComplete = async (taskId, subTaskId, currentStatus) => {
        const newStatus = currentStatus === 2 ? 'TODO' : 'REVIEW';
        await updateTask({
            variables: { id: subTaskId, status: newStatus }
        });
        await fetchSubTasksForTask(taskId, true);
        await refetchCurrentTasks();
    };

    const handleDeleteSubTask = async (taskId, subTaskId) => {
        await deleteTask({ variables: { id: subTaskId } });
        await fetchSubTasksForTask(taskId, true);
        await refetchCurrentTasks();
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
            assignee: null
        });
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

    const resetFilters = () => {
        setFilters({ priority: [], dateFrom: null, dateTo: null, assignee: null });
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
            if (editingTask) {
                await updateTask({
                    variables: {
                        id: editingTask.id,
                        title: taskData.title,
                        description: taskData.description || null,
                        dueDate: formattedDueDate,
                        value: taskData.value,
                        status: taskData.status,
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
                        status: taskData.status || 'TODO',
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

    const openContextMenu = (e, taskId) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuTaskId(taskId);
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
        setShowContextMenu(true);
        setNewSubTaskTitle('');
    };

    const handleContextMenuDelete = async () => {
        if (contextMenuTaskId) {
            await handleDeleteTask(contextMenuTaskId);
        }
        setShowContextMenu(false);
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
        const isExpanded = expandedTaskId === subTask.id;
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
                            <button className="subtask-menu-btn" onClick={(e) => openContextMenu(e, subTask.id)}>
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
                            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i> {childSubTasks.length} подзадач
                        </button>
                    )}
                </div>

                {isExpanded && (
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
                                    <span className="kanban-task-count">{tasksByStatus[status].length}</span>
                                </div>
                                <div className="kanban-task-list">
                                    {tasksByStatus[status].map((task) => {
                                        const dueWarningText = getDueWarningText(task);
                                        const dueWarningColor = getTaskDueDateColor(task);
                                        const subTasksCount = task.subTasksCount || 0;
                                        const currentSubTasks = subTasksCache[task.id] || [];
                                        const completedSubCount = currentSubTasks.filter(st => st.status === 2).length;
                                        const isExpanded = expandedTaskId === task.id;
                                        const isLoadingSubTasks = loadingSubTasks[task.id];

                                        return (
                                            <div
                                                key={task.id}
                                                id={`task-${task.id}`}
                                                className={`task-card ${isExpanded ? 'expanded' : ''} ${highlightedTask === task.id ? 'task-highlighted' : ''}`}
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
                                                            <button className="task-menu-btn-top" onClick={(e) => openContextMenu(e, task.id)}>
                                                                <i className="fas fa-ellipsis-v"></i>
                                                            </button>
                                                        )}
                                                    </div>
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
                                                        {task.assignees?.slice(0, 3).map(a => (
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
                                                            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i> {subTasksCount} подзадач
                                                        </button>
                                                    )}
                                                </div>
                                                {isExpanded && (
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
                />
            )}

            <ConfirmModal isOpen={deleteConfirm.isOpen} title="Удаление задачи" message="Вы действительно хотите удалить эту задачу? Это действие необратимо." onConfirm={confirmDeleteTask} onCancel={() => setDeleteConfirm({isOpen: false, taskId: null})} />

            {showContextMenu && (
                <div className="context-menu" style={{ position: 'fixed', top: contextMenuPosition.y, left: contextMenuPosition.x, zIndex: 10000 }} onClick={(e) => e.stopPropagation()}>
                    <div className="context-menu-item" onClick={handleContextMenuDelete}><i className="fas fa-trash-alt"></i> Удалить задачу</div>
                    <div className="context-menu-subtask">
                        <div className="context-menu-subtask-form">
                            <input type="text" placeholder="Название подзадачи..." value={newSubTaskTitle} onChange={(e) => setNewSubTaskTitle(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddSubTaskFromMenu(contextMenuTaskId)} autoFocus />
                            <button onClick={() => handleAddSubTaskFromMenu(contextMenuTaskId)}>Добавить</button>
                        </div>
                    </div>
                </div>
            )}

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