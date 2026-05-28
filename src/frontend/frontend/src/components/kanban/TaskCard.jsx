import React from 'react';
import SubTaskCard from './SubTaskCard';

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

const TaskCard = ({
    task,
    status,
    highlightedTask,
    isExpanded,
    isLoadingSubTasks,
    subTasks,
    isViewer,
    isMyTasksView,
    normalizeStatus,
    getTaskCardStyle,
    getDueWarningText,
    getTaskDueDateColor,
    onEdit,
    onContextMenu,
    onDragStart,
    onToggleExpand,
    onMouseEnter,
    sortTasks,
    searchParams,
    setSearchParams,
}) => {
    const dueWarningText = getDueWarningText(task);
    const dueWarningColor = getTaskDueDateColor(task);
    const subTasksCount = task.subTasksCount || 0;
    const completedSubCount = subTasks.filter(st => st.status === 2).length;
    const isTaskCompleted = normalizeStatus(task.status) === 'REVIEW';

    return (
        <div
            key={task.id}
            id={`task-${task.id}`}
            className={`task-card ${isExpanded ? 'expanded' : ''} ${highlightedTask === task.id ? 'task-highlighted' : ''}`}
            style={getTaskCardStyle(task)}
            draggable={!isViewer}
            onDragStart={onDragStart}
            onMouseEnter={() => onMouseEnter(task.id, searchParams, setSearchParams)}
        >
            <div className="task-card-main" onClick={() => onEdit(task)}>
                <div className="task-header-row">
                    <div className="task-title">
                        <span>{task.title}</span>
                        {task.attachments?.length > 0 && <i className="fas fa-paperclip attachment-icon"></i>}
                        {subTasksCount > 0 && <span className="subtasks-badge">{completedSubCount}/{subTasksCount}</span>}
                    </div>
                    {!isViewer && !isMyTasksView && (
                        <button className="task-menu-btn-top" onClick={(e) => onContextMenu(e, task, e.currentTarget)}>
                            <i className="fas fa-ellipsis-v"></i>
                        </button>
                    )}
                </div>

                {task.tags && task.tags.length > 0 && (
                    <div className="task-tags">
                        {task.tags.map((tag, idx) => (
                            <span 
                                key={`${task.id}-tag-${tag.id}-${idx}`} 
                                className="tag-badge" 
                                style={{ backgroundColor: tag.color || '#3b82f6' }}
                            >
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
                    <button 
                        className="task-expand-btn" 
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(task.id);
                        }}
                    >
                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i> {subTasksCount} подзадач
                    </button>
                )}
            </div>

            {isExpanded && (
                <div className="task-subtasks-expanded" onClick={(e) => e.stopPropagation()}>
                    {isLoadingSubTasks ? (
                        <div className="subtask-loading">Загрузка подзадач...</div>
                    ) : (
                        sortTasks(subTasks).map(subTask => (
                            <SubTaskCard
                                key={subTask.id}
                                subTask={subTask}
                                level={1}
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
                                subTasksCache={{}}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(TaskCard);
