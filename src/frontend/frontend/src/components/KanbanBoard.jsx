import React, {useState, useEffect} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {useQuery, useMutation, useApolloClient} from '@apollo/client';
import {GET_PROJECT_DETAILS} from '../graphql/queries';
import {GET_TASKS_BY_SUBGROUP, GET_TASKS_BY_ASSIGNEE} from '../graphql/queries';
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

    // Состояния для сортировки (можно выбрать только одну)
    const [sortBy, setSortBy] = useState('dueDate');
    const [sortOrder, setSortOrder] = useState('asc');

    // Состояния для фильтрации
    const [filters, setFilters] = useState({
        priority: [],
        dateFrom: null,
        dateTo: null,
        assignee: null
    });
    const [showFilterModal, setShowFilterModal] = useState(false);

    useEffect(() => {
        if (!projectId) navigate('/');
    }, [projectId, navigate]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const {loading: projectLoading, data: projectData, refetch: refetchProject} = useQuery(GET_PROJECT_DETAILS, {
        variables: {projectId},
        skip: !projectId,
    });

    const {loading: tasksLoading, data: tasksData, refetch: refetchTasks} = useQuery(GET_TASKS_BY_SUBGROUP, {
        variables: {subgroupId: activeSubgroupId},
        skip: !activeSubgroupId || activeSubgroupId === 'my-tasks',
    });

    const {loading: myTasksLoading, data: myTasksData, refetch: refetchMyTasks} = useQuery(GET_TASKS_BY_ASSIGNEE, {
        variables: {userId: user.id},
        skip: activeSubgroupId !== 'my-tasks',
    });

    const [createTask] = useMutation(CREATE_TASK);
    const [updateTask] = useMutation(UPDATE_TASK);
    const [deleteTask] = useMutation(DELETE_TASK);
    const [setTaskAssignees] = useMutation(SET_TASK_ASSIGNEES);

    const refetchCurrentTasks = () => {
        if (activeSubgroupId === 'my-tasks') refetchMyTasks();
        else if (activeSubgroupId) refetchTasks();
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
    };

    if (projectLoading) return <div className="loading">Загрузка проекта...</div>;
    if (!projectData?.project) return <div className="message-error">Проект не найден</div>;

    const project = projectData.project;
    const isOwner = project.owner.id === user.id;
    const currentMember = project.members.find(m => m.userId === user.id);
    const canEditProject = isOwner || currentMember?.role === 'ADMIN';
    const isViewer = currentMember?.role === 'VIEWER';
    const realSubgroups = project.subgroups || [];
    const projectMembers = project.members || [];

    let tasks = [];
    if (activeSubgroupId === 'my-tasks') {
        const allTasks = myTasksData?.tasksByAssignee || [];
        const currentSubgroupIds = new Set(realSubgroups.map(g => g.id));
        tasks = allTasks.filter(task => currentSubgroupIds.has(task.subgroupId));
    } else if (activeSubgroupId) {
        tasks = tasksData?.tasksBySubgroup || [];
    }

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

        if (hoursLeft < 0) {
            return '#dc2626';
        } else if (hoursLeft < 24) {
            return '#f59e0b';
        } else if (hoursLeft < 72) {
            return '#eab308';
        }
        return null;
    };

    const getDueWarningText = (task) => {
        const status = normalizeStatus(task.status);
        if (status === 'REVIEW') return null;

        if (!task.dueDate) return null;

        const now = new Date();
        const due = new Date(task.dueDate);
        const hoursLeft = (due - now) / (1000 * 60 * 60);

        if (hoursLeft < 0) {
            return 'Просрочено';
        } else if (hoursLeft < 24) {
            return 'Менее суток';
        } else if (hoursLeft < 72) {
            return 'Менее 3 дней';
        }
        return null;
    };

    const getTaskCardStyle = (task) => {
        const dueDateColor = getTaskDueDateColor(task);
        if (dueDateColor) {
            return {
                borderLeftColor: dueDateColor,
                backgroundColor: `${dueDateColor}08`,
            };
        }
        return { borderLeftColor: '#2563eb' };
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
                    const dateA = new Date(a.dueDate);
                    const dateB = new Date(b.dueDate);
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
                    const comparison = nameA.localeCompare(nameB);
                    return sortOrder === 'asc' ? comparison : -comparison;
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
        const filteredTasks = applyFilters(filtered);
        return sortTasks(filteredTasks);
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
        setFilters(prev => {
            const newPriority = prev.priority.includes(value)
                ? prev.priority.filter(p => p !== value)
                : [...prev.priority, value];
            return { ...prev, priority: newPriority };
        });
    };

    const handleDateFromChange = (date) => {
        setFilters(prev => ({ ...prev, dateFrom: date }));
    };

    const handleDateToChange = (date) => {
        setFilters(prev => ({ ...prev, dateTo: date }));
    };

    const handleAssigneeChange = (e) => {
        const value = e.target.value;
        setFilters(prev => ({ ...prev, assignee: value || null }));
    };

    const resetFilters = () => {
        setFilters({
            priority: [],
            dateFrom: null,
            dateTo: null,
            assignee: null
        });
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
                        variables: {
                            id: editingTask.id,
                            createdByUserId: taskData.creatorId,
                        },
                    });
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
                    },
                });
            }
            await refetchCurrentTasks();
            if (activeSubgroupId !== 'my-tasks') await refetchMyTasks();
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
        client.cache.evict({fieldName: 'tasksByAssignee'});
        client.cache.gc();
        await refetchCurrentTasks();
        if (activeSubgroupId !== 'my-tasks') await refetchMyTasks();
        setDeleteConfirm({isOpen: false, taskId: null});
    };

    const handleDeleteTaskFromModal = async (taskId) => {
        try {
            await deleteTask({variables: {id: taskId}});
            client.cache.evict({fieldName: 'tasksBySubgroup'});
            client.cache.evict({fieldName: 'tasksByAssignee'});
            client.cache.gc();
            await refetchCurrentTasks();
            if (activeSubgroupId !== 'my-tasks') await refetchMyTasks();
            setShowTaskModal(false);
        } catch (err) {
            console.error('Ошибка удаления задачи:', err);
            alert('Ошибка удаления: ' + err.message);
        }
    };

    const handleDragStart = (e, taskId, fromStatus) => {
        if (isViewer) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.setData('fromStatus', fromStatus);
    };
    const handleDrop = async (e, toStatus) => {
        if (isViewer) return;
        const taskId = e.dataTransfer.getData('taskId');
        const fromStatus = e.dataTransfer.getData('fromStatus');
        if (fromStatus === toStatus) return;
        await updateTask({variables: {id: taskId, status: toStatus}});
        refetchCurrentTasks();
        if (activeSubgroupId !== 'my-tasks') refetchMyTasks();
    };
    const handleDragOver = (e) => e.preventDefault();

    const isLoading = (activeSubgroupId === 'my-tasks') ? myTasksLoading : tasksLoading;

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
                        <div className="filter-section-title">
                            <i className="fas fa-chart-line"></i> Важность
                        </div>
                        <div className="filter-options">
                            <label className={`filter-option ${filters.priority.includes('high') ? 'active' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={filters.priority.includes('high')}
                                    onChange={() => handlePriorityChange('high')}
                                />
                                <span className="priority-high">
                                    <i className="fas fa-exclamation-triangle"></i> Высокая
                                </span>
                            </label>
                            <label className={`filter-option ${filters.priority.includes('medium') ? 'active' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={filters.priority.includes('medium')}
                                    onChange={() => handlePriorityChange('medium')}
                                />
                                <span className="priority-medium">
                                    <i className="fas fa-exclamation"></i> Средняя
                                </span>
                            </label>
                            <label className={`filter-option ${filters.priority.includes('low') ? 'active' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={filters.priority.includes('low')}
                                    onChange={() => handlePriorityChange('low')}
                                />
                                <span className="priority-low">
                                    <i className="fas fa-info-circle"></i> Низкая
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="filter-divider"></div>

                    <div className="filter-section">
                        <div className="filter-section-title">
                            <i className="fas fa-calendar-range"></i> Диапазон дат
                        </div>
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
                        <div className="filter-section-title">
                            <i className="fas fa-user-check"></i> Исполнитель
                        </div>
                        <select
                            className="form-select"
                            value={filters.assignee || ''}
                            onChange={handleAssigneeChange}
                        >
                            <option value="">Все исполнители</option>
                            {projectMembers.map(member => (
                                <option key={member.userId} value={member.userId}>
                                    {member.user.fullName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="filter-modal-actions">
                    <button className="btn btn--secondary" onClick={resetFilters}>
                        <i className="fas fa-eraser"></i> Сбросить все
                    </button>
                    <button className="btn" onClick={() => setShowFilterModal(false)}>
                        <i className="fas fa-check"></i> Применить
                    </button>
                </div>
            </div>
        </div>
    );

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
                {/* Первая строка: имя проекта и кнопка настроек */}
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

                    {canEditProject && (
                        <button className="btn btn--secondary settings-btn"
                                onClick={() => navigate(`/settings?projectId=${projectId}`)}>
                            <i className="fas fa-cog"></i> Настройки проекта
                        </button>
                    )}
                </div>

                {/* Вторая строка: сортировка и фильтр */}
                <div className="kanban-controls-row">
                    <div className="kanban-sort-panel">
                        <span className="sort-label"><i className="fas fa-arrow-up-wide-short"></i> Сортировать:</span>
                        <button
                            className={`sort-btn ${sortBy === 'dueDate' ? 'active' : ''}`}
                            onClick={() => handleSortChange('dueDate')}
                        >
                            <i className="fas fa-calendar-alt"></i> Дедлайн {getSortIcon('dueDate')}
                        </button>
                        <button
                            className={`sort-btn ${sortBy === 'priority' ? 'active' : ''}`}
                            onClick={() => handleSortChange('priority')}
                        >
                            <i className="fas fa-chart-line"></i> Важность {getSortIcon('priority')}
                        </button>
                        <button
                            className={`sort-btn ${sortBy === 'creator' ? 'active' : ''}`}
                            onClick={() => handleSortChange('creator')}
                        >
                            <i className="fas fa-user"></i> Создатель {getSortIcon('creator')}
                        </button>
                    </div>

                    <div className="kanban-filter-panel">
                        <button
                            className="filter-toggle-btn"
                            onClick={() => setShowFilterModal(true)}
                        >
                            <i className="fas fa-filter"></i> Фильтры
                            {getActiveFiltersCount() > 0 && (
                                <span className="filter-badge-count">{getActiveFiltersCount()}</span>
                            )}
                        </button>

                        <div className="filter-info">
                            {getActiveFiltersCount() > 0 && (
                                <span className="filter-badge">
                                    <i className="fas fa-filter"></i>
                                    Активно: {getActiveFiltersCount()}
                                    <button className="filter-badge-remove" onClick={resetFilters}>
                                        <i className="fas fa-times-circle"></i>
                                    </button>
                                </span>
                            )}
                            <span className="tasks-count">
                                <i className="fas fa-tasks"></i> {
                                tasksByStatus.TODO.length +
                                tasksByStatus.IN_PROGRESS.length +
                                tasksByStatus.REVIEW.length
                            }
                            </span>
                        </div>
                    </div>
                </div>

                {isLoading && <div className="loading">Загрузка задач...</div>}

                {activeSubgroupId && (
                    <div className="kanban-board">
                        {['TODO', 'IN_PROGRESS', 'REVIEW'].map((status) => (
                            <div key={status} className="kanban-column" onDragOver={handleDragOver}
                                 onDrop={(e) => handleDrop(e, status)}>
                                <div className="kanban-column-header">
                                    <h3 style={{borderLeftColor: statusColors[status]}}>{statusLabels[status]}</h3>
                                    <span className="kanban-task-count">{tasksByStatus[status].length}</span>
                                </div>
                                <div className="kanban-task-list">
                                    {tasksByStatus[status].map((task) => {
                                        const dueWarningText = getDueWarningText(task);
                                        const dueWarningColor = getTaskDueDateColor(task);

                                        return (
                                            <div
                                                key={task.id}
                                                className="task-card"
                                                style={getTaskCardStyle(task)}
                                                draggable={!isViewer}
                                                onDragStart={(e) => handleDragStart(e, task.id, status)}
                                                onClick={() => handleEditTask(task)}
                                            >
                                                <div className="task-title">
                                                    <span>{task.title}</span>
                                                    {task.attachments && task.attachments.length > 0 && (
                                                        <i className="fas fa-paperclip attachment-icon"></i>
                                                    )}
                                                </div>

                                                <div className="task-meta"/>
                                                <div className="task-bottom-row">
                                                    <div className={`task-priority priority-${task.value || 2}`}>
                                                        {task.value === 1 && <>🔵 Низкая</>}
                                                        {task.value === 2 && <>🟡 Средняя</>}
                                                        {task.value === 3 && <>🔴 Высокая</>}
                                                        {!task.value && <> Средняя</>}
                                                    </div>
                                                    <div className="task-date-group">
                                                        {dueWarningText && (
                                                            <span className="task-due-warning" style={{
                                                                backgroundColor: dueWarningColor,
                                                                color: 'white',
                                                                padding: '2px 6px',
                                                                borderRadius: '12px',
                                                                fontSize: '0.65rem',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}>
                                                                <i className="fas fa-exclamation-triangle"></i> {dueWarningText}
                                                            </span>
                                                        )}
                                                        {task.dueDate && (
                                                            <div className="task-date">
                                                                <i className="far fa-calendar-alt"></i> {new Date(task.dueDate).toLocaleString([], {
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="task-assignees">
                                                    {task.assignees?.map(a => (
                                                        <div key={a.id} className="assignee-wrapper">
                                                            <span className="assignee-name">
                                                                <i className="fas fa-user"></i> {a.fullName}
                                                            </span>
                                                            <span className="assignee-tooltip">{a.email}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {!isViewer && activeSubgroupId !== 'my-tasks' && (
                                                    <button className="task-delete-btn" onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTask(task.id);
                                                    }}>
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
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

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="Удаление задачи"
                message="Вы действительно хотите удалить эту задачу? Это действие необратимо."
                onConfirm={confirmDeleteTask}
                onCancel={() => setDeleteConfirm({isOpen: false, taskId: null})}
            />

            {isMobile && showMobileGroups && (
                <div className="mobile-groups-modal" onClick={() => setShowMobileGroups(false)}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <SubgroupsPanel
                            projectId={projectId}
                            activeSubgroupId={activeSubgroupId}
                            onSelectSubgroup={handleSelectSubgroup}
                            isOwner={isOwner}
                            projectMembers={projectMembers}
                            onRefreshProject={refetchProject}
                        />
                    </div>
                </div>
            )}

            {showFilterModal && <FilterModal />}
        </div>
    );
};

export default KanbanBoard;