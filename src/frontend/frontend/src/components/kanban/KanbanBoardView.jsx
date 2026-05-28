import React from 'react';
import TaskCard from './TaskCard';

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

const KanbanBoardView = ({
    tasksByStatus,
    statusLabels,
    statusColors,
    highlightedTask,
    expandedTaskIds,
    loadingSubTasks,
    subTasksCache,
    isViewer,
    activeSubgroupId,
    normalizeStatus,
    getTaskCardStyle,
    getDueWarningText,
    getTaskDueDateColor,
    handleEditTask,
    openContextMenu,
    handleDragStart,
    handleDrop,
    handleDragOver,
    toggleExpandTask,
    sortTasks,
    onMouseEnter,
    searchParams,
    setSearchParams,
}) => {
    return (
        <div className="kanban-board">
            {['TODO', 'IN_PROGRESS', 'REVIEW'].map((status) => (
                <div 
                    key={status} 
                    className="kanban-column" 
                    onDragOver={handleDragOver} 
                    onDrop={(e) => handleDrop(e, status)}
                >
                    <div className="kanban-column-header">
                        <h3 style={{ borderLeftColor: statusColors[status] }}>
                            {statusLabels[status]}
                        </h3>
                        <div className="column-header-right">
                            <span className="kanban-task-count">
                                {tasksByStatus[status].length}
                            </span>
                        </div>
                    </div>
                    <div className="kanban-task-list">
                        {tasksByStatus[status].map((task) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                status={status}
                                highlightedTask={highlightedTask}
                                isExpanded={expandedTaskIds.has(task.id)}
                                isLoadingSubTasks={loadingSubTasks[task.id]}
                                subTasks={subTasksCache[task.id] || []}
                                isViewer={isViewer}
                                isMyTasksView={activeSubgroupId === 'my-tasks'}
                                normalizeStatus={normalizeStatus}
                                getTaskCardStyle={getTaskCardStyle}
                                getDueWarningText={getDueWarningText}
                                getTaskDueDateColor={getTaskDueDateColor}
                                onEdit={handleEditTask}
                                onContextMenu={openContextMenu}
                                onDragStart={(e) => handleDragStart(e, task.id, status)}
                                onToggleExpand={toggleExpandTask}
                                onMouseEnter={onMouseEnter}
                                sortTasks={sortTasks}
                                searchParams={searchParams}
                                setSearchParams={setSearchParams}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default KanbanBoardView;
