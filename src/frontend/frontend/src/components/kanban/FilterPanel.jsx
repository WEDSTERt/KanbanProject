import React from 'react';

const FilterPanel = ({
    filters,
    availableTags,
    projectMembers,
    onPriorityChange,
    onDateFromChange,
    onDateToChange,
    onAssigneeChange,
    onTagFilterToggle,
    onResetFilters,
    getActiveFiltersCount,
    onFilterModalToggle,
}) => {
    return (
        <div className="kanban-filter-panel">
            <button className="filter-toggle-btn" onClick={onFilterModalToggle}>
                <i className="fas fa-filter"></i> Фильтры
                {getActiveFiltersCount() > 0 && <span className="filter-badge-count">{getActiveFiltersCount()}</span>}
            </button>
            <div className="kanban-export-import">
                <label className="btn btn--secondary btn--small" style={{ cursor: 'pointer' }}>
                    <i className="fas fa-upload"></i> Импорт
                    <input type="file" accept=".json" style={{ display: 'none' }} />
                </label>
            </div>
            <div className="filter-info">
                {getActiveFiltersCount() > 0 && (
                    <span className="filter-badge">
                        <i className="fas fa-filter"></i> Активно: {getActiveFiltersCount()}
                        <button className="filter-badge-remove" onClick={onResetFilters}>
                            <i className="fas fa-times-circle"></i>
                        </button>
                    </span>
                )}
            </div>
        </div>
    );
};

export const FilterModal = ({
    filters,
    availableTags,
    projectMembers,
    onPriorityChange,
    onDateFromChange,
    onDateToChange,
    onAssigneeChange,
    onTagFilterToggle,
    onResetFilters,
    onClose,
}) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content filter-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={onClose}>✕</button>
            <h3><i className="fas fa-filter"></i> Фильтрация задач</h3>
            <div className="filter-modal-body">
                <div className="filter-section">
                    <div className="filter-section-title"><i className="fas fa-chart-line"></i> Важность</div>
                    <div className="filter-options">
                        {[
                            { key: 'high', label: 'Высокая', icon: 'fa-signal', className: 'priority-high' },
                            { key: 'medium', label: 'Средняя', icon: 'fa-signal', className: 'priority-medium' },
                            { key: 'low', label: 'Низкая', icon: 'fa-signal', className: 'priority-low' }
                        ].map(opt => (
                            <label key={opt.key} className={`filter-option ${filters.priority.includes(opt.key) ? 'active' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    checked={filters.priority.includes(opt.key)} 
                                    onChange={() => onPriorityChange(opt.key)} 
                                />
                                <span className={opt.className}>
                                    <i className={`fas ${opt.icon}`}></i> {opt.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="filter-divider"></div>
                <div className="filter-section">
                    <div className="filter-section-title"><i className="fas fa-calendar-range"></i> Диапазон дат</div>
                    <div className="date-range-row">
                        <div className="date-field">
                            <input 
                                type="date" 
                                className="form-input" 
                                value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''} 
                                onChange={(e) => onDateFromChange(e.target.value ? new Date(e.target.value) : null)} 
                            />
                        </div>
                        <span className="filter-date-separator">—</span>
                        <div className="date-field">
                            <input 
                                type="date" 
                                className="form-input" 
                                value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''} 
                                onChange={(e) => onDateToChange(e.target.value ? new Date(e.target.value) : null)} 
                            />
                        </div>
                    </div>
                </div>
                <div className="filter-divider"></div>
                <div className="filter-section">
                    <div className="filter-section-title"><i className="fas fa-user-check"></i> Исполнитель</div>
                    <select className="form-select" value={filters.assignee || ''} onChange={onAssigneeChange}>
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
                                    onChange={() => onTagFilterToggle(tag.id)}
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
                <button className="btn btn--secondary" onClick={onResetFilters}>
                    <i className="fas fa-eraser"></i> Сбросить все
                </button>
                <button className="btn" onClick={onClose}>
                    <i className="fas fa-check"></i> Применить
                </button>
            </div>
        </div>
    </div>
);

export default FilterPanel;
