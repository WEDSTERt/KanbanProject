import React, { useState, useRef, useEffect, useCallback } from 'react';

const GanttChart = ({ tasks, onTaskDateChange }) => {
    const [resizing, setResizing] = useState({ active: false, taskId: null, edge: null });
    const [startX, setStartX] = useState(0);
    const [originalStartDate, setOriginalStartDate] = useState(null);
    const [originalEndDate, setOriginalEndDate] = useState(null);
    const [currentTaskId, setCurrentTaskId] = useState(null);
    const containerRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(800);
    const [rangeStart, setRangeStart] = useState(null);
    const [rangeEnd, setRangeEnd] = useState(null);
    const [dayWidth, setDayWidth] = useState(30);

    // Вычисляем диапазон дат при изменении задач
    useEffect(() => {
        if (!tasks || tasks.length === 0) return;

        // Фильтруем задачи с дедлайнами и без родителя (корневые)
        const tasksWithDates = tasks.filter(t => t.dueDate && (!t.parentTaskId || t.parentTaskId === 0));

        if (tasksWithDates.length === 0) return;

        const minDate = new Date(Math.min(...tasksWithDates.map(t => new Date(t.createdAt || t.dueDate).getTime())));
        const maxDate = new Date(Math.max(...tasksWithDates.map(t => new Date(t.dueDate).getTime())));

        const start = new Date(minDate);
        start.setDate(start.getDate() - 3);
        const end = new Date(maxDate);
        end.setDate(end.getDate() + 3);

        setRangeStart(start);
        setRangeEnd(end);
    }, [tasks]);

    // Пересчитываем ширину при изменении контейнера или диапазона
    useEffect(() => {
        if (containerRef.current && rangeStart && rangeEnd) {
            const width = containerRef.current.clientWidth - 200;
            setChartWidth(width > 0 ? width : 800);

            const totalDays = Math.ceil((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24));
            const newDayWidth = Math.max(30, width / totalDays);
            setDayWidth(newDayWidth);
        }
    }, [rangeStart, rangeEnd, containerRef.current?.clientWidth]);

    const getPosition = useCallback((date) => {
        if (!rangeStart) return 0;
        const daysDiff = Math.ceil((date - rangeStart) / (1000 * 60 * 60 * 24));
        return daysDiff * dayWidth;
    }, [rangeStart, dayWidth]);

    const getWidth = useCallback((startDate, endDate) => {
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        return Math.max(dayWidth, days * dayWidth);
    }, [dayWidth]);

    const handleMouseDown = (e, taskId, edge, startDate, endDate) => {
        e.preventDefault();
        e.stopPropagation();

        setResizing({ active: true, taskId, edge });
        setCurrentTaskId(taskId);
        setStartX(e.clientX);
        setOriginalStartDate(new Date(startDate));
        setOriginalEndDate(new Date(endDate));

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = useCallback((e) => {
        if (!resizing.active) return;

        const deltaX = e.clientX - startX;
        const daysDelta = Math.round(deltaX / dayWidth);

        if (daysDelta === 0) return;

        // Находим задачу в оригинальных данных (не в отфильтрованных)
        const task = tasks.find(t => t.id === resizing.taskId);
        if (!task || !task.dueDate) return;

        let newStartDate = new Date(originalStartDate);
        let newEndDate = new Date(originalEndDate);

        if (resizing.edge === 'left') {
            // Изменяем дату начала (создания)
            newStartDate.setDate(originalStartDate.getDate() + daysDelta);
            // Не даем началу стать позже конца
            if (newStartDate >= newEndDate) return;
            // Не даем выйти за пределы диапазона
            if (rangeStart && newStartDate < rangeStart) return;

            // Для задачи меняем только дату окончания,
            // так как дата создания не редактируется в этой версии
            // Но мы можем изменить dueDate (конечную дату) относительно начала
            const daysShift = daysDelta;
            newEndDate = new Date(originalEndDate);
            newEndDate.setDate(originalEndDate.getDate() + daysShift);

            if (onTaskDateChange) {
                onTaskDateChange(task.id, newStartDate, newEndDate);
            }
        } else if (resizing.edge === 'right') {
            // Изменяем дату окончания (dueDate)
            newEndDate.setDate(originalEndDate.getDate() + daysDelta);
            // Не даем концу стать раньше начала
            if (newEndDate <= newStartDate) return;
            // Не даем выйти за пределы диапазона
            if (rangeEnd && newEndDate > rangeEnd) return;

            if (onTaskDateChange) {
                onTaskDateChange(task.id, newStartDate, newEndDate);
            }
        }
    }, [resizing, startX, dayWidth, tasks, originalStartDate, originalEndDate, rangeStart, rangeEnd, onTaskDateChange]);

    const handleMouseUp = useCallback(() => {
        setResizing({ active: false, taskId: null, edge: null });
        setCurrentTaskId(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    if (!tasks || tasks.length === 0) {
        return <div className="gantt-empty">Нет задач для отображения</div>;
    }

    // Фильтруем задачи с дедлайнами и без родителя (корневые)
    const tasksWithDates = tasks.filter(t => t.dueDate && (!t.parentTaskId || t.parentTaskId === 0));

    if (tasksWithDates.length === 0) {
        return <div className="gantt-empty">Нет задач с указанными сроками</div>;
    }

    if (!rangeStart || !rangeEnd) {
        return <div className="gantt-empty">Загрузка...</div>;
    }

    const totalDays = Math.ceil((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24));

    const renderHeader = () => {
        const headers = [];
        let currentDate = new Date(rangeStart);
        let currentMonth = null;
        let monthStartIndex = 0;

        for (let i = 0; i <= totalDays; i++) {
            const date = new Date(currentDate);
            const month = date.toLocaleString('ru', { month: 'long', year: 'numeric' });

            if (currentMonth !== month) {
                if (currentMonth !== null) {
                    const monthWidth = (i - monthStartIndex) * dayWidth;
                    headers.push(
                        <div
                            key={`month-${month}`}
                            className="gantt-month-header"
                            style={{ width: monthWidth, left: monthStartIndex * dayWidth }}
                        >
                            {currentMonth}
                        </div>
                    );
                }
                currentMonth = month;
                monthStartIndex = i;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (currentMonth) {
            const monthWidth = (totalDays + 1 - monthStartIndex) * dayWidth;
            headers.push(
                <div
                    key={`month-${currentMonth}`}
                    className="gantt-month-header"
                    style={{ width: monthWidth, left: monthStartIndex * dayWidth }}
                >
                    {currentMonth}
                </div>
            );
        }

        return headers;
    };

    const getPriorityColor = (value) => {
        switch (value) {
            case 3: return '#dc2626';
            case 2: return '#f59e0b';
            case 1: return '#3b82f6';
            default: return '#64748b';
        }
    };

    return (
        <div className="gantt-container" ref={containerRef}>
            <div className="gantt-header">
                <div className="gantt-label-header">Задача</div>
                <div className="gantt-timeline-header" style={{ width: chartWidth }}>
                    <div className="gantt-months" style={{ width: chartWidth, position: 'relative' }}>
                        {renderHeader()}
                    </div>
                    <div className="gantt-days" style={{ width: chartWidth }}>
                        {Array.from({ length: Math.min(totalDays + 1, 31) }).map((_, i) => {
                            const date = new Date(rangeStart);
                            date.setDate(date.getDate() + i);
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            return (
                                <div
                                    key={i}
                                    className={`gantt-day ${isWeekend ? 'weekend' : ''}`}
                                    style={{ width: dayWidth }}
                                >
                                    {date.getDate()}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="gantt-body">
                {tasksWithDates.map(task => {
                    // startDate - дата создания задачи или dueDate - 7 дней
                    const startDate = task.createdAt ? new Date(task.createdAt) : new Date(task.dueDate);
                    startDate.setDate(startDate.getDate() - 3);
                    const endDate = new Date(task.dueDate);

                    // Корректируем, чтобы startDate не был позже endDate
                    if (startDate > endDate) {
                        startDate.setDate(endDate.getDate() - 3);
                    }

                    return (
                        <div key={task.id} className="gantt-row">
                            <div className="gantt-label">
                                <span
                                    className="gantt-task-title"
                                    style={{ borderLeftColor: getPriorityColor(task.value) }}
                                >
                                    {task.title}
                                </span>
                            </div>
                            <div className="gantt-bars" style={{ width: chartWidth, position: 'relative' }}>
                                <div
                                    className="gantt-bar"
                                    style={{
                                        left: getPosition(startDate),
                                        width: getWidth(startDate, endDate),
                                        backgroundColor: getPriorityColor(task.value),
                                        position: 'absolute',
                                    }}
                                >
                                    <div
                                        className="gantt-resize-handle left"
                                        onMouseDown={(e) => handleMouseDown(e, task.id, 'left', startDate, endDate)}
                                    />
                                    <div className="gantt-bar-label">
                                        {task.title.length > 20 ? task.title.substring(0, 18) + '...' : task.title}
                                    </div>
                                    <div
                                        className="gantt-resize-handle right"
                                        onMouseDown={(e) => handleMouseDown(e, task.id, 'right', startDate, endDate)}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {resizing.active && (
                <div
                    className="gantt-resizing-cursor"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 9999,
                        cursor: 'ew-resize'
                    }}
                />
            )}
        </div>
    );
};

export default GanttChart;