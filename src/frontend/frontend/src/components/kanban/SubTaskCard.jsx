import React from 'react';

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

const SubTaskCard = ({
    subTask,
    level = 1,
    isViewer,
    isMyTasksView,
    normalizeStatus,
    getTaskCardStyle,
    getDueWarningText,
    getTaskDueDateColor,
    onEdit,
    onContextMenu,
    onToggleExpand,
    sortTasks,
    subTasksCache,
    expandedTaskIds = new Set(),
}) => {
    const dueWarningText = getDueWarningText(subTask);
    const dueWarningColor = getTaskDueDateColor(subTask);
    const childSubTasks = subTasksCache[subTask.id] || [];
    const completedSubCount = childSubTasks.filter(st => st.status === 2).length;
    const isExpandedSub = expandedTaskIds.has(subTask.id);
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
            <div className="task-card-main" onClick={() => onEdit(subTask)}>
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
                    {!isViewer && !isMyTasksView && (
                        <button className="subtask-menu-btn" onClick={(e) => onContextMenu(e, subTask, e.currentTarget)}>
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
                    <button 
                        className="task-expand-btn subtask-expand-btn" 
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(subTask.id);
                        }}
                    >
                        <i className={`fas fa-chevron-${isExpandedSub ? 'up' : 'down'}`}></i> {childSubTasks.length} подзадач
                    </button>
                )}
            </div>

            {isExpandedSub && (
                <div className="task-subtasks-expanded subtask-subtasks-expanded" onClick={(e) => e.stopPropagation()}>
                    {sortTasks(childSubTasks).map(nestedSubTask => (
                        <SubTaskCard
                            key={nestedSubTask.id}
                            subTask={nestedSubTask}
                            level={level + 1}
                            isViewer={isViewer}
                            isMyTasksView={isMyTasksView}
                            normalizeStatus={normalizeStatus}
                            getTaskCardStyle={getTaskCardStyle}
                            getDueWarningText={getDueWarningText}
                            getTaskDueDateColor={getTaskDueDateColor}
                            onEdit={onEdit}
                            onContextMenu={onContextMenu}
                            onToggleExpand={onToggleExpand}
                            sortTasks={sortTasks}
                            subTasksCache={subTasksCache}
                            expandedTaskIds={expandedTaskIds}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default React.memo(SubTaskCard);
