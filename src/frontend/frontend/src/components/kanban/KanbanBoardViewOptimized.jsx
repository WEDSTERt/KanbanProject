import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import TaskCard from './TaskCard';

/**
 * ✅ ОПТИМИЗАЦИЯ: Виртуализированный список задач
 * Рендерит только видимые задачи, значительно улучшает производительность
 * при больших списках (100+ задач в одной колонке)
 */
const VirtualizedTaskList = ({
    tasks,
    highlightedTask,
    expandedTaskIds,
    loadingSubTasks,
    subTasksCache,
    isViewer,
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
    activeSubgroupId,
}) => {
    // Мемоизированные отсортированные задачи
    const sortedTasks = useMemo(() => sortTasks(tasks), [tasks, sortTasks]);

    const Row = ({ index, style }) => {
        const task = sortedTasks[index];
        if (!task) return null;

        return (
            <div style={style}>
                <TaskCard
                    task={task}
                    status={task.status}
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
                    onEdit={onEdit}
                    onContextMenu={onContextMenu}
                    onDragStart={(e) => onDragStart(e, task.id, task.status)}
                    onToggleExpand={onToggleExpand}
                    onMouseEnter={onMouseEnter}
                    sortTasks={sortTasks}
                    searchParams={searchParams}
                    setSearchParams={setSearchParams}
                />
            </div>
        );
    };

    return (
        <AutoSizer>
            {({ height, width }) => (
                <List
                    height={height}
                    itemCount={sortedTasks.length}
                    itemSize={150} // примерная высота карточки
                    width={width}
                    overscanCount={5}
                >
                    {Row}
                </List>
            )}
        </AutoSizer>
    );
};

export default React.memo(VirtualizedTaskList);
