/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import {
    GET_PROJECT_DETAILS,
    GET_TASKS_BY_SUBGROUP,
    GET_TASKS_BY_ASSIGNEE_AND_PROJECT,
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
import { useAuth } from '../contexts/AuthContext';
import SubgroupsPanel from './SubgroupsPanel';
import TaskModal from './TaskModal';
import ConfirmModal from './ConfirmModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// --- Вспомогательные компоненты для рендеринга ---
const TaskPriority = ({ value }) => {
    const priority = value || 2;
    return (
        <div className={`task-priority priority-${priority}`}>
            {priority === 1 && <>Низкая</>}
            {priority === 2 && <>Средняя</>}
            {priority === 3 && <>Высокая</>}
            {!value && <>Средняя</>}
        </div>
    );
};

const TaskDueDate = ({ dueDate, isCompleted = false }) => {
    if (!dueDate) return null;
    return (
        <div className={`task-date ${isCompleted ? 'task-completed' : ''}`}>
            <i className="far fa-calendar-alt"></i> {new Date(dueDate).toLocaleString()}
        </div>
    );
};

const DueWarning = ({ dueWarningText, dueWarningColor }) => {
    if (!dueWarningText) return null;
    return (
        <span className="due-warning" style={{ backgroundColor: dueWarningColor }}>
            <i className="fas fa-exclamation-triangle"></i> {dueWarningText}
        </span>
    );
};

const TaskAssignees = ({ assignees, maxDisplay = 3, isCompleted = false }) => {
    if (!assignees?.length) return null;
    const displayed = assignees.slice(0, maxDisplay);
    const remaining = assignees.length - maxDisplay;
    return (
        <div className="task-assignees">
            {displayed.map(a => (
                <div key={a.id} className="assignee-wrapper">
                    <span className={`assignee-name ${isCompleted ? 'assignee-name-completed' : ''}`}>
                        <i className="fas fa-user"></i> {a.fullName}
                    </span>
                    <span className="assignee-tooltip">{a.email}</span>
                </div>
            ))}
            {remaining > 0 && <span className="assignee-more">+{remaining}</span>}
        </div>
    );
};

// Utility function to normalize status for import
const normalizeStatusForImport = (status) => {
    if (typeof status === 'number') {
        if (status === 0) return 'TODO';
        if (status === 1) return 'IN_PROGRESS';
        if (status === 2) return 'REVIEW';
        return 'TODO';
    }
    const upper = String(status).toUpperCase();
    if (upper === 'INPROGRESS') return 'IN_PROGRESS';
    if (['TODO', 'IN_PROGRESS', 'REVIEW'].includes(upper)) return upper;
    return 'TODO';
};

// --- Основной компонент KanbanBoard ---
const KanbanBoard = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const projectId = searchParams.get('projectId');
    const urlSubgroupId = searchParams.get('subgroupId');
    const highlightTaskId = searchParams.get('highlightTask');
    const { user } = useAuth();
    const client = useApolloClient();

    const [activeSubgroupId, setActiveSubgroupId] = useState(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, taskId: null });
    const [initialAssigneeIds, setInitialAssigneeIds] = useState([]);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [showMobileGroups, setShowMobileGroups] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [viewMode, setViewMode] = useState('kanban');
    const [highlightedTask, setHighlightedTask] = useState(null);
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
    const [cachedTasks, setCachedTasks] = useState({});
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
        fetchPolicy: 'network-only',
    });
    const availableTags = tagsData?.tags || [];

    const { loading: projectLoading, data: projectData, refetch: refetchProject } = useQuery(GET_PROJECT_DETAILS, {
        variables: { projectId },
        skip: !projectId,
    });

    const { loading: tasksLoading, data: tasksData, refetch: refetchTasks, networkStatus: tasksNetworkStatus } = useQuery(
        GET_TASKS_BY_SUBGROUP,
        {
            variables: { subgroupId: activeSubgroupId },
            skip: !activeSubgroupId || activeSubgroupId === 'my-tasks',
            fetchPolicy: 'cache-and-network',
            notifyOnNetworkStatusChange: true,
        }
    );

    const { loading: myTasksLoading, data: myTasksData, refetch: refetchMyTasks, networkStatus: myTasksNetworkStatus } = useQuery(
        GET_TASKS_BY_ASSIGNEE_AND_PROJECT,
        {
            variables: { userId: user.id, projectId: projectId },
            skip: activeSubgroupId !== 'my-tasks',
            fetchPolicy: 'cache-and-network',
            notifyOnNetworkStatusChange: true,
        }
    );

    const refetchCurrentTasks = useCallback(() => {
        if (activeSubgroupId === 'my-tasks') {
            refetchMyTasks();
        } else if (activeSubgroupId) {
            refetchTasks();
        }
    }, [activeSubgroupId, refetchMyTasks, refetchTasks]);

    let tasks = [];
    if (activeSubgroupId === 'my-tasks') {
        tasks = myTasksData?.tasksByAssigneeAndProject || [];
    } else if (activeSubgroupId && tasksData?.tasksBySubgroup) {
        tasks = tasksData.tasksBySubgroup;
    }

    // Автоматическая загрузка подзадач для отображения прогресса
    useEffect(() => {
        if (!tasks.length) return;
        const taskIdsToLoad = tasks
            .filter(task => task.subTasksCount > 0 && !subTasksCache[task.id])
            .map(task => task.id);
        if (taskIdsToLoad.length === 0) return;

        const loadSubTasksProgress = async () => {
            setLoadingSubTasks(prev => {
                const newState = { ...prev };
                taskIdsToLoad.forEach(id => { newState[id] = true; });
                return newState;
            });
            try {
                const { data } = await client.query({
                    query: GET_ALL_SUBTASKS,
                    variables: { taskIds: taskIdsToLoad },
                    fetchPolicy: 'network-only',
                });
                if (data?.tasksByIds) {
                    setSubTasksCache(prev => {
                        const newCache = { ...prev };
                        data.tasksByIds.forEach(taskData => {
                            if (taskData?.id) {
                                newCache[taskData.id] = taskData.subTasks || [];
                            }
                        });
                        return newCache;
                    });
                }
            } catch (err) {
                console.error('Ошибка загрузки подзадач для прогресса:', err);
            } finally {
                setLoadingSubTasks(prev => {
                    const newState = { ...prev };
                    taskIdsToLoad.forEach(id => { delete newState[id]; });
                    return newState;
                });
            }
        };
        loadSubTasksProgress();
    }, [tasks, subTasksCache, client]);

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
        const handleClickOutside = () => {
            setShowContextMenu(false);
            setShowCreateTag(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        if (projectId) {
            refetchTags();
        }
    }, [projectId, refetchTags]);

    const fetchSubTasksForTask = useCallback(async (taskId, force = false) => {
        if (!force && subTasksCache[taskId]) return;

        setLoadingSubTasks(prev => ({ ...prev, [taskId]: true }));

        try {
            const { data } = await client.query({
                query: GET_ALL_SUBTASKS,
                variables: { taskIds: [taskId] },
                fetchPolicy: force ? 'network-only' : 'cache-first',
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

    // --- Работа с тегами ---
    const handleAddTagToTask = async (taskId, tagId) => {
        try {
            await addTagToTask({ variables: { taskId: parseInt(taskId), tagId: parseInt(tagId) } });
            await refetchCurrentTasks();
            await refetchTags();
        } catch (err) {
            console.error(err);
            alert('Ошибка добавления тега: ' + err.message);
        }
    };

    const handleRemoveTagFromTask = async (taskId, tagId) => {
        try {
            await removeTagFromTask({ variables: { taskId: parseInt(taskId), tagId: parseInt(tagId) } });
            await refetchCurrentTasks();
            await refetchTags();
        } catch (err) {
            console.error(err);
            alert('Ошибка удаления тега: ' + err.message);
        }
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        try {
            await createTag({
                variables: { projectId: parseInt(projectId), name: newTagName.trim(), color: newTagColor },
            });
            setNewTagName('');
            setNewTagColor('#3b82f6');
            setShowCreateTag(false);
            await refetchTags();
        } catch (err) {
            alert('Ошибка создания тега: ' + err.message);
        }
    };

    const handleDeleteTagFromProject = async (tagId, tagName) => {
        if (!window.confirm(`Удалить тег "${tagName}" из проекта?`)) return;
        try {
            await deleteTagFromProject({ variables: { tagId: parseInt(tagId), projectId: parseInt(projectId) } });
            await refetchTags();
            await refetchCurrentTasks();
        } catch (err) {
            alert('Ошибка удаления тега: ' + err.message);
        }
    };

    const openContextMenu = (e, task, targetElement = null) => {
        e.preventDefault();
        e.stopPropagation();

        if (showContextMenu && contextMenuTaskId === task.id) {
            setShowContextMenu(false);
            setContextMenuTaskId(null);
            setContextMenuTask(null);
            return;
        }

        let actualTask = null;
        if (activeSubgroupId === 'my-tasks' && myTasksData?.tasksByAssigneeAndProject) {
            actualTask = myTasksData.tasksByAssigneeAndProject.find(t => t.id === task.id);
        } else if (tasksData?.tasksBySubgroup) {
            actualTask = tasksData.tasksBySubgroup.find(t => t.id === task.id);
        }
        if (!actualTask) actualTask = task;

        setContextMenuTaskId(actualTask.id);
        setContextMenuTask({
            ...actualTask,
            tags: actualTask.tags ? [...actualTask.tags] : [],
        });

        let x, y;
        if (targetElement && targetElement.getBoundingClientRect) {
            const rect = targetElement.getBoundingClientRect();
            x = rect.right + 5;
            y = rect.top;
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        setContextMenuPosition({ x, y });
        setShowContextMenu(true);
        setNewTagName('');
        setNewTagColor('#3b82f6');
        setNewSubTaskTitle('');
        setShowCreateTag(false);
    };

    const handleContextMenuDelete = async () => {
        if (contextMenuTaskId) {
            const parentId = contextMenuTask?.parentTaskId;
            await deleteTask({ variables: { id: contextMenuTaskId } });
            await refetchCurrentTasks();
            if (parentId && parentId !== 0 && parentId !== null) {
                await fetchSubTasksForTask(parentId, true);
            }
            setShowContextMenu(false);
            setContextMenuTaskId(null);
            setContextMenuTask(null);
        }
    };

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
                    parentTaskId: taskId,
                },
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

    const transliterateTitle = (title) => {
        const translitMap = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
            'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
            'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
            'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
            'я': 'ya', 'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
            'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
            'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H',
            'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E',
            'Ю': 'Yu', 'Я': 'Ya'
        };
        return title
            .split('')
            .map(char => translitMap[char] || char)
            .join('')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 50);
    };

    const handleExportSingleTask = (task) => {
        const cleanTask = (t) => {
            const cleaned = {
                title: t.title,
                description: t.description || null,
                dueDate: t.dueDate || null,
                value: t.value || 2,
                status: t.status,
            };
            const subs = subTasksCache[t.id] || [];
            if (subs.length) cleaned.subTasks = subs.map(st => cleanTask(st));
            return cleaned;
        };
        const exportData = cleanTask(task);
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const transliteratedTitle = transliterateTitle(task.title);
        a.download = `task_${task.id}_${transliteratedTitle}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportTasks = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (activeSubgroupId === 'my-tasks') {
            alert('Импорт недоступен для раздела "Мои задачи"');
            event.target.value = '';
            return;
        }
        if (!confirm('Импорт добавит новые задачи к существующим. Продолжить?')) {
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let imported = JSON.parse(e.target.result);
                let tasksToImport = Array.isArray(imported) ? imported : [imported];
                let createdCount = 0, errorCount = 0;

                const createTaskRecursively = async (taskData, parentId = null) => {
                    const { subTasks, ...rest } = taskData;
                    try {
                        // Normalize status to valid enum value
                        const normalizedStatus = normalizeStatusForImport(rest.status);
                        
                        const res = await createTask({
                            variables: {
                                subgroupId: activeSubgroupId,
                                createdByUserId: user.id,
                                title: rest.title,
                                description: rest.description || null,
                                dueDate: rest.dueDate || null,
                                value: rest.value || 2,
                                status: normalizedStatus,
                                assigneeIds: [],
                                parentTaskId: parentId,
                            },
                        });
                        createdCount++;
                        const newId = res.data.createTask.id;
                        if (subTasks && subTasks.length) {
                            for (const sub of subTasks) {
                                await createTaskRecursively(sub, newId);
                            }
                        }
                    } catch (err) {
                        console.error(err);
                        errorCount++;
                    }
                };

                for (const t of tasksToImport) {
                    await createTaskRecursively(t);
                }

                alert(`Импорт завершён. Создано задач: ${createdCount}, ошибок: ${errorCount}`);
                await refetchCurrentTasks();
                setSubTasksCache({});
                setExpandedTaskId(null);
            } catch (err) {
                console.error(err);
                alert('Ошибка импорта: ' + err.message);
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    useEffect(() => {
        if (!projectData?.project) return;
        const realSubgroups = projectData.project.subgroups || [];
        if (urlSubgroupId) {
            if (urlSubgroupId === 'my-tasks') setActiveSubgroupId('my-tasks');
            else if (realSubgroups.some(g => g.id === urlSubgroupId)) setActiveSubgroupId(urlSubgroupId);
            else {
                setActiveSubgroupId('my-tasks');
                setSearchParams({ projectId, subgroupId: 'my-tasks' });
            }
        } else {
            setActiveSubgroupId('my-tasks');
            setSearchParams({ projectId, subgroupId: 'my-tasks' });
        }
    }, [projectData, urlSubgroupId, projectId, setSearchParams]);

    const handleSelectSubgroup = (subgroupId) => {
        setActiveSubgroupId(subgroupId);
        setSearchParams({ projectId, subgroupId });
        if (isMobile) setShowMobileGroups(false);
        setFilters({
            priority: [],
            dateFrom: null,
            dateTo: null,
            assignee: null,
            tags: [],
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

    const showLoading = () => {
        if (activeSubgroupId === 'my-tasks') {
            return myTasksLoading && myTasksNetworkStatus === 1 && !myTasksData?.tasksByAssigneeAndProject;
        }
        return tasksLoading && tasksNetworkStatus === 1 && !tasksData?.tasksBySubgroup;
    };

    const normalizeStatus = (status) => {
        if (typeof status === 'number') {
            if (status === 0) return 'TODO';
            if (status === 1) return 'IN_PROGRESS';
            if (status === 2) return 'REVIEW';
            return 'TODO';
        }
        const upper = String(status).toUpperCase();
        if (upper === 'INPROGRESS') return 'IN_PROGRESS';
        if (['TODO', 'IN_PROGRESS', 'REVIEW'].includes(upper)) return upper;
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

    const statusLabels = {
        TODO: <><i className="fas fa-clipboard-list"></i> Создано</>,
        IN_PROGRESS: <><i className="fas fa-cogs"></i> В разработке</>,
        REVIEW: <><i className="fas fa-check-circle"></i> Выполнено</>,
    };
    const statusColors = { TODO: '#3b82f6', IN_PROGRESS: '#f59e0b', REVIEW: '#10b981' };

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
                : [...prev.priority, value],
        }));
    };

    const handleDateFromChange = (date) => setFilters(prev => ({ ...prev, dateFrom: date }));
    const handleDateToChange = (date) => setFilters(prev => ({ ...prev, dateTo: date }));
    const handleAssigneeChange = (e) => setFilters(prev => ({ ...prev, assignee: e.target.value || null }));
    const handleTagFilterToggle = (tagId) => {
        setFilters(prev => ({
            ...prev,
            tags: prev.tags.includes(tagId) ? prev.tags.filter(id => id !== tagId) : [...prev.tags, tagId],
        }));
    };
    const resetFilters = () => {
        setFilters({ priority: [], dateFrom: null, dateTo: null, assignee: null, tags: [] });
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
                    await setTaskAssignees({ variables: { taskId: editingTask.id, userIds: taskData.assigneeIds } });
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
                        parentTaskId: null,
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
            setDeleteTagConfirm({ isOpen: false, tagId: null, tagName: '' });
            await refetchTags();
            await refetchCurrentTasks();
            setShowContextMenu(false);
        } catch (err) {
            console.error('Ошибка удаления тега:', err);
            alert('Ошибка удаления тега: ' + err.message);
            setDeleteTagConfirm({ isOpen: false, tagId: null, tagName: '' });
        }
    };

    const handleDeleteTaskFromModal = async (taskId) => {
        let taskToDelete = null;
        if (activeSubgroupId === 'my-tasks' && myTasksData?.tasksByAssigneeAndProject) {
            taskToDelete = myTasksData.tasksByAssigneeAndProject.find(t => t.id === taskId);
        } else if (tasksData?.tasksBySubgroup) {
            taskToDelete = tasksData.tasksBySubgroup.find(t => t.id === taskId);
        }
        const parentId = taskToDelete?.parentTaskId;
        await deleteTask({ variables: { id: taskId } });
        await refetchCurrentTasks();
        if (parentId && parentId !== 0) {
            await fetchSubTasksForTask(parentId, true);
        }
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
        await updateTask({ variables: { id: taskId, status: toStatus } });
        await refetchCurrentTasks();
    };

    const handleDragOver = (e) => e.preventDefault();

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

    // Модальное окно фильтрации
    const FilterModal = () => (
        <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
            <div className="modal-content filter-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setShowFilterModal(false)}>✕</button>
                <h3><i className="fas fa-filter"></i> Фильтрация задач</h3>
                <div className="filter-modal-body">
                    <div className="filter-section">
                        <div className="filter-section-title"><i className="fas fa-chart-line"></i> Важность</div>
                        <div className="filter-options">
                            {[
                                { key: 'high', label: 'Высокая', icon: 'fa-exclamation-triangle', className: 'priority-high' },
                                { key: 'medium', label: 'Средняя', icon: 'fa-exclamation', className: 'priority-medium' },
                                { key: 'low', label: 'Низкая', icon: 'fa-info-circle', className: 'priority-low' }
                            ].map(opt => (
                                <label key={opt.key} className={`filter-option ${filters.priority.includes(opt.key) ? 'active' : ''}`}>
                                    <input type="checkbox" checked={filters.priority.includes(opt.key)} onChange={() => handlePriorityChange(opt.key)} />
                                    <span className={opt.className}><i className={`fas ${opt.icon}`}></i> {opt.label}</span>
                                </label>
                            ))}
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
                            <span className="filter-date-separator">—</span>
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
                                    <span className="filter-tag-badge" style={{ backgroundColor: tag.color }}>
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

    // Компонент подзадачи
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
                            <button className="subtask-menu-btn" onClick={(e) => openContextMenu(e, subTask, e.currentTarget)}>
                                <i className="fas fa-ellipsis-v"></i>
                            </button>
                        )}
                    </div>

                    <div className="task-bottom-row subtask-bottom-row">
                        <TaskPriority value={subTask.value} />
                        <div className="task-date-group">
                            <DueWarning dueWarningText={dueWarningText} dueWarningColor={dueWarningColor} />
                            <TaskDueDate dueDate={subTask.dueDate} isCompleted={isCompleted} />
                        </div>
                    </div>
                    <TaskAssignees assignees={subTask.assignees} maxDisplay={2} isCompleted={isCompleted} />
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
                            <select className="form-select sort-select-mobile" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setSortOrder('asc'); }}>
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
                        <div className="kanban-export-import">
                            <label className="btn btn--secondary btn--small" style={{ cursor: 'pointer' }}>
                                <i className="fas fa-upload"></i> Импорт
                                <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportTasks} />
                            </label>
                        </div>
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
                                    <h3 style={{ borderLeftColor: statusColors[status] }}>{statusLabels[status]}</h3>
                                    <div className="column-header-right">
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
                                        const isTaskCompleted = normalizeStatus(task.status) === 'REVIEW';

                                        return (
                                            <div
                                                key={task.id}
                                                id={`task-${task.id}`}
                                                className={`task-card ${isExpandedTask ? 'expanded' : ''} ${highlightedTask === task.id ? 'task-highlighted' : ''}`}
                                                style={getTaskCardStyle(task)}
                                                draggable={!isViewer}
                                                onDragStart={(e) => handleDragStart(e, task.id, status)}
                                                onMouseEnter={() => {
                                                    if (highlightedTask === task.id) {
                                                        setHighlightedTask(null);
                                                        searchParams.delete('highlightTask');
                                                        setSearchParams(searchParams);
                                                    }
                                                }}
                                            >
                                                <div className="task-card-main" onClick={() => handleEditTask(task)}>
                                                    <div className="task-header-row">
                                                        <div className="task-title">
                                                            <span>{task.title}</span>
                                                            {task.attachments?.length > 0 && <i className="fas fa-paperclip attachment-icon"></i>}
                                                            {subTasksCount > 0 && <span className="subtasks-badge">{completedSubCount}/{subTasksCount}</span>}
                                                        </div>
                                                        {!isViewer && activeSubgroupId !== 'my-tasks' && (
                                                            <button className="task-menu-btn-top" onClick={(e) => openContextMenu(e, task, e.currentTarget)}>
                                                                <i className="fas fa-ellipsis-v"></i>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {task.tags && task.tags.length > 0 && (
                                                        <div className="task-tags">
                                                            {task.tags.map((tag, idx) => (
                                                                <span key={`${task.id}-tag-${tag.id}-${idx}`} className="tag-badge" style={{ backgroundColor: tag.color || '#3b82f6' }}>
                                                                    {tag.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="task-bottom-row">
                                                        <TaskPriority value={task.value} />
                                                        <div className="task-date-group">
                                                            <TaskDueDate dueDate={task.dueDate} isCompleted={isTaskCompleted} />
                                                            <DueWarning dueWarningText={dueWarningText} dueWarningColor={dueWarningColor} />
                                                        </div>
                                                    </div>
                                                    <TaskAssignees assignees={task.assignees} maxDisplay={3} isCompleted={isTaskCompleted} />
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

            <ConfirmModal isOpen={deleteConfirm.isOpen} title="Удаление задачи" message="Вы действительно хотите удалить эту задачу? Это действие необратимо." onConfirm={async () => {
                if (isViewer) return;
                await deleteTask({ variables: { id: deleteConfirm.taskId } });
                await refetchCurrentTasks();
                setDeleteConfirm({ isOpen: false, taskId: null });
            }} onCancel={() => setDeleteConfirm({ isOpen: false, taskId: null })} />

            {showContextMenu && contextMenuTask && (
                <div className="context-menu" style={{ position: 'fixed', top: contextMenuPosition.y, left: contextMenuPosition.x, zIndex: 10000 }} onClick={(e) => e.stopPropagation()}>
                    <div className="context-menu-item" onClick={handleContextMenuDelete}><i className="fas fa-trash-alt"></i> Удалить задачу</div>
                    <div className="context-menu-divider" />
                    <div className="context-menu-item" onClick={() => handleExportSingleTask(contextMenuTask)}><i className="fas fa-download"></i> Экспортировать задачу</div>
                    <div className="context-menu-divider" />
                    <div className="context-menu-subtask">
                        <div className="context-menu-subtask-form">
                            <textarea rows={2} placeholder="Название подзадачи" value={newSubTaskTitle} onChange={(e) => setNewSubTaskTitle(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleAddSubTaskFromMenu(contextMenuTaskId); } }} autoFocus />
                            <button onClick={() => handleAddSubTaskFromMenu(contextMenuTaskId)}>Добавить подзадачу</button>
                        </div>
                    </div>
                    <div className="context-menu-divider" />
                    <div style={{ padding: '8px 16px' }}>
                        <div className="context-menu-section-title"><i className="fas fa-tags"></i> Теги</div>
                        <div className="tags-container">
                            {availableTags.map(tag => {
                                const isTagOnTask = contextMenuTask.tags?.some(t => t.id === tag.id);
                                return (
                                    <div key={`context-tag-${tag.id}`} className="context-menu-tag-wrapper">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (isTagOnTask) await handleRemoveTagFromTask(contextMenuTask.id, tag.id);
                                                else await handleAddTagToTask(contextMenuTask.id, tag.id);
                                                setShowContextMenu(false);
                                            }}
                                            className="context-menu-tag-btn"
                                            style={{
                                                backgroundColor: isTagOnTask ? tag.color : 'transparent',
                                                color: isTagOnTask ? 'white' : tag.color,
                                                border: `1px solid ${tag.color}`,
                                            }}
                                        >
                                            {tag.name}
                                        </button>
                                        <button type="button" onClick={() => handleDeleteTagFromProject(tag.id, tag.name)} className="delete-tag-icon">
                                            <i className="fas fa-times-circle"></i>
                                        </button>
                                    </div>
                                );
                            })}
                            {!showCreateTag ? (
                                <button type="button" className="btn btn--secondary btn--small" onClick={() => setShowCreateTag(true)} style={{ whiteSpace: 'nowrap' }}>
                                    <i className="fas fa-plus"></i> Новый тег
                                </button>
                            ) : (
                                <div className="context-menu-new-tag-form">
                                    <input type="text" className="form-input context-menu-new-tag-input" placeholder="Название тега" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                                    <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="context-menu-color-input" />
                                    <button type="button" className="btn" onClick={handleCreateTag}><i className="fas fa-check"></i></button>
                                    <button type="button" className="btn btn--secondary" onClick={() => setShowCreateTag(false)}><i className="fas fa-times"></i></button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={deleteTagConfirm.isOpen} title="Удаление тега из проекта" message={`Вы действительно хотите удалить тег "${deleteTagConfirm.tagName}" из проекта? Это удалит тег отовсюду.`} onConfirm={confirmDeleteTagFromProject} onCancel={() => setDeleteTagConfirm({ isOpen: false, tagId: null, tagName: '' })} confirmText="Удалить" confirmStyle="btn--danger" />

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




