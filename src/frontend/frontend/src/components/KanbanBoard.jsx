/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSSE } from '../contexts/SSEContext';
import { useKanbanLogic } from '../hooks/useKanbanLogic';
import SubgroupsPanel from './SubgroupsPanel';
import TaskModal from './TaskModal';
import ConfirmModal from './ConfirmModal';
import FilterPanel, { FilterModal } from './kanban/FilterPanel';
import SortPanel from './kanban/SortPanel';
import KanbanBoardView from './kanban/KanbanBoardView';
import { normalizeStatus, getTaskDueDateColor, getDueWarningText, getTaskCardStyle } from './kanban/utils';

const KanbanBoard = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const projectId = searchParams.get('projectId');
    const urlSubgroupId = searchParams.get('subgroupId');
    const highlightTaskId = searchParams.get('highlightTask');
    const { user } = useAuth();
    const { subscribe, sseService } = useSSE();

    // Используем custom hook для всей логики
    const logic = useKanbanLogic(projectId, urlSubgroupId, user);

    // Инициализация группы
    useEffect(() => {
        if (!logic.projectData?.project) return;
        const realSubgroups = logic.projectData.project.subgroups || [];
        if (urlSubgroupId) {
            if (urlSubgroupId === 'my-tasks') logic.setActiveSubgroupId('my-tasks');
            else if (realSubgroups.some(g => g.id === urlSubgroupId)) logic.setActiveSubgroupId(urlSubgroupId);
            else { logic.setActiveSubgroupId('my-tasks'); setSearchParams({ projectId, subgroupId: 'my-tasks' }); }
        } else { logic.setActiveSubgroupId('my-tasks'); setSearchParams({ projectId, subgroupId: 'my-tasks' }); }
    }, [logic.projectData, urlSubgroupId, projectId, setSearchParams]);

    // ✅ ИСПРАВЛЕННАЯ SSE подписка - ОДИН useEffect, правильная синхронизация
    useEffect(() => {
        if (!user?.id || !logic.activeSubgroupId || logic.activeSubgroupId === 'my-tasks' || !subscribe || !sseService) {
            return;
        }

        console.log('📡 KanbanBoard: Setting up SSE for subgroup', logic.activeSubgroupId);

        // ✅ Подписываем на subgroup в backend (один раз)
        sseService.subscribeToSubgroup(logic.activeSubgroupId)
            .catch(err => console.error('Failed to subscribe to subgroup:', err));

        // ✅ Используем ОДИН дебаунс таймер для обоих событий
        let updateTimeout = null;
        const scheduleRefetch = () => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                console.log('🔄 KanbanBoard: Refetching tasks for subgroup', logic.activeSubgroupId);
                if (logic.refetchCurrentTasks) {
                    logic.refetchCurrentTasks().catch(err => console.error('Refetch error:', err));
                }
            }, 100);
        };

        // ✅ Подписываемся на events и вызываем общий дебаунс
        const unsubscribeTaskUpdated = subscribe('task-updated', (data) => {
            const eventSubgroupId = Number(data.subgroupId_field);
            const currentSubgroupId = Number(logic.activeSubgroupId);
            console.log('📨 task-updated event:', { eventSubgroupId, currentSubgroupId, match: eventSubgroupId === currentSubgroupId });
            
            if (eventSubgroupId === currentSubgroupId) {
                scheduleRefetch();
            }
        });

        const unsubscribeTaskDeleted = subscribe('task-deleted', (data) => {
            const eventSubgroupId = Number(data.subgroupId_field);
            const currentSubgroupId = Number(logic.activeSubgroupId);
            console.log('📨 task-deleted event:', { eventSubgroupId, currentSubgroupId, match: eventSubgroupId === currentSubgroupId });
            
            if (eventSubgroupId === currentSubgroupId) {
                scheduleRefetch();
            }
        });

        // ✅ Cleanup: отписываемся от обоих events и закрываем soединение
        return () => {
            console.log('🔌 KanbanBoard: Cleaning up SSE subscriptions for subgroup', logic.activeSubgroupId);
            clearTimeout(updateTimeout);
            
            // Отписываемся от events
            if (unsubscribeTaskUpdated) unsubscribeTaskUpdated();
            if (unsubscribeTaskDeleted) unsubscribeTaskDeleted();
            
            // Закрываем соединение к subgroup
            if (sseService) {
                sseService.disconnect(`subgroup-${logic.activeSubgroupId}`);
            }
        };
    }, [user?.id, logic.activeSubgroupId, subscribe, logic.refetchCurrentTasks, sseService]);

    // Загрузка подзадач при изменении задач
    useEffect(() => {
        if (!logic.tasks.length) return;

        const taskIdsWithSubs = logic.tasks
            .filter(task => task.subTasksCount > 0 && !logic.subTasksCacheRef.current[task.id])
            .map(task => task.id);

        if (taskIdsWithSubs.length === 0) return;

        const visibleIds = taskIdsWithSubs.slice(0, 3);
        const otherIds = taskIdsWithSubs.slice(3);

        logic.loadSubTaskBatch(visibleIds).then(() => {
            if (otherIds.length > 0) {
                setTimeout(() => logic.loadSubTaskBatch(otherIds), 500);
            }
        });
    }, [logic.tasks, logic.loadSubTaskBatch]);

    // Highlight задачи
    useEffect(() => {
        if (highlightTaskId) {
            logic.setHighlightedTask(highlightTaskId);
            const timer = setTimeout(() => { logic.setHighlightedTask(null); searchParams.delete('highlightTask'); setSearchParams(searchParams); }, 5000);
            setTimeout(() => { const taskElement = document.getElementById(`task-${highlightTaskId}`); if (taskElement) taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 500);
            return () => clearTimeout(timer);
        }
    }, [highlightTaskId, searchParams, setSearchParams]);

    // Responsive
    useEffect(() => { if (!projectId) navigate('/'); }, [projectId, navigate]);
    useEffect(() => { const handleResize = () => { logic.setIsMobile(window.innerWidth <= 768); logic.setIsMobileSort(window.innerWidth <= 480); }; window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize); }, []);
    useEffect(() => { const handleClickOutside = () => { logic.setShowContextMenu(false); logic.setShowCreateTag(false); }; document.addEventListener('click', handleClickOutside); return () => document.removeEventListener('click', handleClickOutside); }, []);
    useEffect(() => { if (projectId) logic.refetchTags(); }, [projectId, logic.refetchTags]);

    // Проверка доступа
    useEffect(() => {
        if (!logic.activeSubgroupId || logic.activeSubgroupId === 'my-tasks' || !logic.projectData?.project) return;
        const subgroup = logic.projectData.project.subgroups?.find(s => s.id === logic.activeSubgroupId);
        if (!subgroup) { logic.setActiveSubgroupId('my-tasks'); setSearchParams({ projectId, subgroupId: 'my-tasks' }); return; }
        const userInGroup = subgroup.members?.some(m => m.userId === user.id);
        if (!userInGroup) { logic.setActiveSubgroupId('my-tasks'); setSearchParams({ projectId, subgroupId: 'my-tasks' }); }
    }, [logic.activeSubgroupId, logic.projectData?.project, user.id, projectId, setSearchParams]);

    useEffect(() => {
        if (!logic.projectLoading && logic.projectData?.project && user) {
            const isMember = logic.projectData.project.members.some(m => m.userId === user.id);
            if (!isMember) navigate('/');
        }
    }, [logic.projectLoading, logic.projectData?.project, user, navigate]);

    if (logic.projectLoading) return <div className="loading">Загрузка проекта...</div>;
    if (!logic.projectData?.project) return <div className="message-error">Проект не найден</div>;

    const project = logic.projectData.project;
    const isOwner = project.owner.id === user.id;
    const currentMember = project.members.find(m => m.userId === user.id);
    const canEditProject = isOwner || currentMember?.role === 'ADMIN';
    const isViewer = currentMember?.role === 'VIEWER';
    const canViewSettings = !isViewer;
    const realSubgroups = project.subgroups || [];
    const projectMembers = project.members || [];

    const showLoading = () => {
        if (logic.activeSubgroupId === 'my-tasks') return logic.myTasksLoading && logic.myTasksNetworkStatus === 1 && !logic.myTasksData?.tasksByAssigneeAndProject;
        return logic.tasksLoading && logic.tasksNetworkStatus === 1 && !logic.tasksData?.tasksBySubgroup;
    };

    // Вычисляем tasksByStatus в render (без useCallback!)
    const tasksForStatus = (status) => {
        const filtered = logic.tasks.filter(t => normalizeStatus(t.status) === status);
        return logic.sortTasks(logic.applyFilters(filtered));
    };

    const tasksByStatus = {
        TODO: tasksForStatus('TODO'),
        IN_PROGRESS: tasksForStatus('IN_PROGRESS'),
        REVIEW: tasksForStatus('REVIEW')
    };

    const getActiveFiltersCount = () => {
        let count = 0;
        if (logic.filters.priority.length > 0) count++;
        if (logic.filters.dateFrom || logic.filters.dateTo) count++;
        if (logic.filters.assignee) count++;
        if (logic.filters.tags.length > 0) count++;
        return count;
    };

    // Handlers (без useCallback!)
    const handleSelectSubgroup = (subgroupId) => {
        logic.setActiveSubgroupId(subgroupId);
        setSearchParams({ projectId, subgroupId });
        if (logic.isMobile) logic.setShowMobileGroups(false);
        logic.setFilters({ priority: [], dateFrom: null, dateTo: null, assignee: null, tags: [] });
        logic.setExpandedTaskIds(new Set());
    };

    const handleToggleExpandTask = (taskId) => {
        logic.setExpandedTaskIds(prev => { const newSet = new Set(prev); if (newSet.has(taskId)) newSet.delete(taskId); else { newSet.add(taskId); if (!logic.subTasksCacheRef.current[taskId]) logic.fetchSubTasksForTask(taskId); } return newSet; });
    };

    const handleCreateTask = () => {
        if (logic.isCreatingTask) return;
        if (isViewer) { alert('У вас нет прав на создание задач'); return; }
        if (!logic.activeSubgroupId) { alert('Сначала выберите группу'); return; }
        logic.setIsCreatingTask(true);
        logic.setEditingTask(null);
        logic.setInitialAssigneeIds([]);
        logic.setShowTaskModal(true);
        logic.setIsCreatingTask(false);
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

            if (logic.editingTask) {
                await logic.updateTask({ variables: { id: logic.editingTask.id, title: taskData.title, description: taskData.description || null, dueDate: formattedDueDate, value: taskData.value, status: statusValue } });
                if (taskData.assigneeIds) await logic.setTaskAssignees({ variables: { taskId: logic.editingTask.id, userIds: taskData.assigneeIds } });
                if (taskData.creatorId && taskData.creatorId !== logic.editingTask.createdBy?.id) {
                    await logic.updateTask({ variables: { id: logic.editingTask.id, createdByUserId: taskData.creatorId } });
                }
                if (logic.editingTask.parentTaskId && logic.editingTask.parentTaskId !== 0) {
                    await logic.fetchSubTasksForTask(logic.editingTask.parentTaskId, true);
                }
            } else {
                let targetSubgroupId = logic.activeSubgroupId;
                let assigneeIds = taskData.assigneeIds || [];
                if (logic.activeSubgroupId === 'my-tasks') {
                    if (realSubgroups.length === 0) { alert('Сначала создайте хотя бы одну группу в проекте'); return; }
                    targetSubgroupId = realSubgroups[0].id;
                    if (!assigneeIds.includes(user.id)) assigneeIds.push(user.id);
                }
                await logic.createTask({ variables: { subgroupId: targetSubgroupId, createdByUserId: taskData.creatorId || user.id, title: taskData.title, description: taskData.description || null, dueDate: formattedDueDate, value: taskData.value || 0, status: statusValue, assigneeIds, parentTaskId: null } });
            }
            logic.subTasksCacheRef.current = {};
            logic.setSubTasksCache({});
            logic.setExpandedTaskIds(new Set());
            await logic.refetchCurrentTasks();
            logic.setShowTaskModal(false);
        } catch (err) { console.error('Ошибка сохранения задачи:', err); alert('Ошибка: ' + err.message); }
    };

    const handleDragStart = (e, taskId, fromStatus) => {
        if (isViewer) { e.preventDefault(); return; }
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
        await logic.updateTask({ variables: { id: taskId, status: toStatus } });
        await logic.refetchCurrentTasks();
    };

    const handleDragOver = (e) => e.preventDefault();

    const handleSortChange = (newSortBy) => {
        if (logic.sortBy === newSortBy) {
            logic.setSortOrder(logic.sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            logic.setSortBy(newSortBy);
            logic.setSortOrder('asc');
        }
    };

    let targetSubgroupForAssign = null;
    if (logic.activeSubgroupId && logic.activeSubgroupId !== 'my-tasks') {
        targetSubgroupForAssign = realSubgroups.find(g => g.id === logic.activeSubgroupId);
    } else if (logic.activeSubgroupId === 'my-tasks' && realSubgroups.length > 0) {
        targetSubgroupForAssign = realSubgroups[0];
    }
    const assignableUsers = targetSubgroupForAssign?.members || [];

    const statusLabels = {
        TODO: <><i className="fas fa-clipboard-list"></i> Создано</>,
        IN_PROGRESS: <><i className="fas fa-cogs"></i> В разработке</>,
        REVIEW: <><i className="fas fa-check-circle"></i> Выполнено</>,
    };
    const statusColors = { TODO: '#3b82f6', IN_PROGRESS: '#f59e0b', REVIEW: '#10b981' };

    return (
        <div className="kanban-layout">
            {!logic.isMobile && (
                <SubgroupsPanel
                    projectId={projectId}
                    activeSubgroupId={logic.activeSubgroupId}
                    onSelectSubgroup={handleSelectSubgroup}
                    isOwner={isOwner}
                    projectMembers={projectMembers}
                    onRefreshProject={logic.refetchProject}
                />
            )}

            <div className="kanban-container">
                <div className="kanban-header-row">
                    <div className="kanban-title-area">
                        <h2 className="kanban-title"><i className="fas fa-chalkboard"></i> {project.name}</h2>
                        {logic.isMobile && (
                            <button className="mobile-groups-btn" onClick={() => logic.setShowMobileGroups(true)}>
                                <i className="fas fa-bars"></i> Группы
                            </button>
                        )}
                        {!isViewer && logic.activeSubgroupId !== 'my-tasks' && (
                            <button className="btn" onClick={handleCreateTask} disabled={logic.isCreatingTask}>
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
                    <SortPanel sortBy={logic.sortBy} sortOrder={logic.sortOrder} isMobileSort={logic.isMobileSort} onSortChange={handleSortChange} />
                    <FilterPanel
                        filters={logic.filters}
                        availableTags={logic.availableTags}
                        projectMembers={projectMembers}
                        onPriorityChange={(value) => logic.setFilters(prev => ({ ...prev, priority: prev.priority.includes(value) ? prev.priority.filter(p => p !== value) : [...prev.priority, value] }))}
                        onDateFromChange={(date) => logic.setFilters(prev => ({ ...prev, dateFrom: date }))}
                        onDateToChange={(date) => logic.setFilters(prev => ({ ...prev, dateTo: date }))}
                        onAssigneeChange={(e) => logic.setFilters(prev => ({ ...prev, assignee: e.target.value || null }))}
                        onTagFilterToggle={(tagId) => logic.setFilters(prev => ({ ...prev, tags: prev.tags.includes(tagId) ? prev.tags.filter(id => id !== tagId) : [...prev.tags, tagId] }))}
                        onResetFilters={() => logic.setFilters({ priority: [], dateFrom: null, dateTo: null, assignee: null, tags: [] })}
                        getActiveFiltersCount={getActiveFiltersCount}
                        onFilterModalToggle={() => logic.setShowFilterModal(true)}
                    />
                </div>

                {showLoading() && <div className="loading">Загрузка задач...</div>}

                {logic.activeSubgroupId && (
                    <KanbanBoardView
                        tasksByStatus={tasksByStatus}
                        statusLabels={statusLabels}
                        statusColors={statusColors}
                        highlightedTask={logic.highlightedTask}
                        expandedTaskIds={logic.expandedTaskIds}
                        loadingSubTasks={logic.loadingSubTasks}
                        subTasksCache={logic.subTasksCache}
                        isViewer={isViewer}
                        activeSubgroupId={logic.activeSubgroupId}
                        normalizeStatus={normalizeStatus}
                        getTaskCardStyle={getTaskCardStyle}
                        getDueWarningText={getDueWarningText}
                        getTaskDueDateColor={getTaskDueDateColor}
                        handleEditTask={(task) => { logic.setEditingTask(task); logic.setShowTaskModal(true); }}
                        openContextMenu={(e, task, el) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (logic.showContextMenu && logic.contextMenuTaskId === task.id) { logic.setShowContextMenu(false); logic.setContextMenuTaskId(null); logic.setContextMenuTask(null); return; }
                            let actualTask = task;
                            if (logic.activeSubgroupId === 'my-tasks' && logic.myTasksData?.tasksByAssigneeAndProject) actualTask = logic.myTasksData.tasksByAssigneeAndProject.find(t => t.id === task.id) || task;
                            else if (logic.tasksData?.tasksBySubgroup) actualTask = logic.tasksData.tasksBySubgroup.find(t => t.id === task.id) || task;
                            logic.setContextMenuTaskId(actualTask.id);
                            logic.setContextMenuTask({ ...actualTask, tags: actualTask.tags ? [...actualTask.tags] : [] });
                            let x = e.clientX, y = e.clientY;
                            if (el && el.getBoundingClientRect) { const rect = el.getBoundingClientRect(); x = rect.right + 5; y = rect.top; }
                            logic.setContextMenuPosition({ x, y });
                            logic.setShowContextMenu(true);
                        }}
                        handleDragStart={handleDragStart}
                        handleDrop={handleDrop}
                        handleDragOver={handleDragOver}
                        toggleExpandTask={handleToggleExpandTask}
                        sortTasks={logic.sortTasks}
                        onMouseEnter={() => { if (logic.highlightedTask) { logic.setHighlightedTask(null); searchParams.delete('highlightTask'); setSearchParams(searchParams); } }}
                        searchParams={searchParams}
                        setSearchParams={setSearchParams}
                    />
                )}
            </div>

            {logic.showTaskModal && (
                <TaskModal
                    task={logic.editingTask}
                    subgroupId={logic.activeSubgroupId}
                    assignableUsers={assignableUsers}
                    initialAssigneeIds={logic.initialAssigneeIds}
                    onSave={handleSaveTask}
                    onDeleteTask={async (taskId) => {
                        let taskToDelete = null;
                        if (logic.activeSubgroupId === 'my-tasks' && logic.myTasksData?.tasksByAssigneeAndProject) {
                            taskToDelete = logic.myTasksData.tasksByAssigneeAndProject.find(t => t.id === taskId);
                        } else if (logic.tasksData?.tasksBySubgroup) {
                            taskToDelete = logic.tasksData.tasksBySubgroup.find(t => t.id === taskId);
                        }
                        const parentId = taskToDelete?.parentTaskId;
                        await logic.deleteTask({ variables: { id: taskId } });
                        await logic.refetchCurrentTasks();
                        if (parentId && parentId !== 0) {
                            await logic.fetchSubTasksForTask(parentId, true);
                        }
                        logic.setShowTaskModal(false);
                    }}
                    isMyTasksGroup={logic.activeSubgroupId === 'my-tasks'}
                    isCreator={logic.editingTask?.createdBy?.id === user.id}
                    canEdit={!isViewer && (logic.editingTask?.createdBy?.id === user.id || canEditProject)}
                    isViewer={isViewer}
                    onClose={() => { logic.setShowTaskModal(false); logic.setIsCreatingTask(false); logic.setEditingTask(null); }}
                    projectId={projectId}
                    refetchProjectTags={logic.refetchTags}
                    refetchCurrentTasks={logic.refetchCurrentTasks}
                />
            )}

            <ConfirmModal isOpen={logic.deleteConfirm.isOpen} title="Удаление задачи" message="Вы действительно хотите удалить эту задачу? Это действие необратимо." onConfirm={async () => {
                if (isViewer) return;
                await logic.deleteTask({ variables: { id: logic.deleteConfirm.taskId } });
                await logic.refetchCurrentTasks();
                logic.setDeleteConfirm({ isOpen: false, taskId: null });
            }} onCancel={() => logic.setDeleteConfirm({ isOpen: false, taskId: null })} />

            {logic.isMobile && logic.showMobileGroups && (
                <div className="mobile-groups-modal" onClick={() => logic.setShowMobileGroups(false)}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <SubgroupsPanel projectId={projectId} activeSubgroupId={logic.activeSubgroupId} onSelectSubgroup={handleSelectSubgroup} isOwner={isOwner} projectMembers={projectMembers} onRefreshProject={logic.refetchProject} />
                    </div>
                </div>
            )}

            {logic.showFilterModal && <FilterModal filters={logic.filters} availableTags={logic.availableTags} projectMembers={projectMembers} onPriorityChange={(value) => logic.setFilters(prev => ({ ...prev, priority: prev.priority.includes(value) ? prev.priority.filter(p => p !== value) : [...prev.priority, value] }))} onDateFromChange={(date) => logic.setFilters(prev => ({ ...prev, dateFrom: date }))} onDateToChange={(date) => logic.setFilters(prev => ({ ...prev, dateTo: date }))} onAssigneeChange={(e) => logic.setFilters(prev => ({ ...prev, assignee: e.target.value || null }))} onTagFilterToggle={(tagId) => logic.setFilters(prev => ({ ...prev, tags: prev.tags.includes(tagId) ? prev.tags.filter(id => id !== tagId) : [...prev.tags, tagId] }))} onResetFilters={() => logic.setFilters({ priority: [], dateFrom: null, dateTo: null, assignee: null, tags: [] })} onClose={() => logic.setShowFilterModal(false)} />}
        </div>
    );
};

export default KanbanBoard;
