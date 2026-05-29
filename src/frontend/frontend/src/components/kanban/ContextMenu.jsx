import React, { useEffect, useState, useRef } from 'react';

const ContextMenu = ({
    isOpen,
    position,
    task,
    onCreateSubtask,
    onDeleteTask,
    onClose,
    isViewer,
    availableTags = [],
    onTagToggle,
    onCreateNewTag,
    showCreateTag,
    onShowCreateTag,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    existingTagsForTask = [],
}) => {
    const menuRef = useRef(null);
    const [subtaskTitle, setSubtaskTitle] = useState('');

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, onClose]);

    if (!isOpen || !task) return null;

    const handleCreateSubtask = () => {
        if (subtaskTitle.trim() && onCreateSubtask) {
            onCreateSubtask(subtaskTitle);
            setSubtaskTitle('');
        }
    };

    const handleExportTask = () => {
        const taskData = JSON.stringify({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.value,
            dueDate: task.dueDate,
            assignees: task.assignees?.map(a => a.fullName).join(', '),
            tags: task.tags?.map(t => t.name).join(', '),
            createdBy: task.createdBy?.fullName,
        }, null, 2);
        
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(taskData));
        element.setAttribute('download', `task-${task.id}.json`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        onClose();
    };

    // Используем task.tags для определения активных тегов, так как они обновляются в реальном времени
    const currentTaskTags = task?.tags || [];

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                position: 'fixed',
                top: `${position.y}px`,
                left: `${position.x}px`,
                zIndex: 10001,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {onCreateSubtask && (
                <>
                    <div className="context-menu-item" onClick={handleCreateSubtask}>
                        <i className="fas fa-plus"></i> Добавить подзадачу
                    </div>

                    <div className="context-menu-subtask">
                        <div className="context-menu-subtask-form">
                            <textarea
                                placeholder="Название подзадачи..."
                                value={subtaskTitle}
                                onChange={(e) => setSubtaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                        handleCreateSubtask();
                                    }
                                }}
                            />
                            <button onClick={handleCreateSubtask}>
                                Создать
                            </button>
                        </div>
                    </div>

                    <div className="context-menu-divider"></div>
                </>
            )}

            {onTagToggle && availableTags.length > 0 && (
                <>
                    <div className="context-menu-tags">
                        <div className="context-menu-tags-title">ТЕГИ</div>
                        <div className="tags-container">
                            {availableTags.map(tag => {
                                const isActive = currentTaskTags.some(t => t.id === tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        className={`context-menu-tag-btn ${isActive ? 'active' : ''}`}
                                        style={{
                                            backgroundColor: isActive ? tag.color : 'transparent',
                                            color: isActive ? '#fff' : tag.color,
                                            border: `1px solid ${tag.color}`,
                                        }}
                                        onClick={() => onTagToggle(tag.id)}
                                    >
                                        {tag.name}
                                    </button>
                                );
                            })}
                        </div>

                        {showCreateTag && (
                            <div className="context-menu-new-tag-form">
                                <input
                                    type="text"
                                    placeholder="Название тега..."
                                    value={newTagName}
                                    onChange={(e) => setNewTagName(e.target.value)}
                                    className="context-menu-new-tag-input"
                                />
                                <input
                                    type="color"
                                    value={newTagColor}
                                    onChange={(e) => setNewTagColor(e.target.value)}
                                    className="context-menu-color-input"
                                />
                                <button onClick={() => onCreateNewTag && onCreateNewTag(newTagName, newTagColor)}>
                                    Создать тег
                                </button>
                            </div>
                        )}
                        <button
                            className="context-menu-tag-btn new-tag-btn"
                            onClick={() => onShowCreateTag && onShowCreateTag(!showCreateTag)}
                        >
                            {showCreateTag ? '✓ Готово' : '+ Новый тег'}
                        </button>
                    </div>

                    <div className="context-menu-divider"></div>
                </>
            )}

            {!isViewer && (
                <>
                    <div className="context-menu-item" onClick={handleExportTask}>
                        <i className="fas fa-download"></i> Экспортировать
                    </div>
                    <div className="context-menu-divider"></div>
                </>
            )}

            {onDeleteTask && !isViewer && (
                <div className="context-menu-item" onClick={onDeleteTask} style={{ color: '#ef4444' }}>
                    <i className="fas fa-trash"></i> Удалить
                </div>
            )}
        </div>
    );
};

export default ContextMenu;
