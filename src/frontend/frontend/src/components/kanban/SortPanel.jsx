import React from 'react';

const SortPanel = ({ sortBy, sortOrder, isMobileSort, onSortChange }) => {
    const getSortIcon = (sortType) => {
        if (sortBy !== sortType) return <i className="fas fa-sort"></i>;
        return sortOrder === 'asc' ? <i className="fas fa-sort-up"></i> : <i className="fas fa-sort-down"></i>;
    };

    const handleSortChange = (newSortBy) => {
        if (sortBy === newSortBy) {
            onSortChange(newSortBy, sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            onSortChange(newSortBy, 'asc');
        }
    };

    return (
        <div className="kanban-sort-panel">
            <span className="sort-label"><i className="fas fa-arrow-up-wide-short"></i> Сортировать:</span>
            {isMobileSort ? (
                <select 
                    className="form-select sort-select-mobile" 
                    value={sortBy} 
                    onChange={(e) => {
                        onSortChange(e.target.value, 'asc');
                    }}
                >
                    <option value="dueDate">По дедлайну</option>
                    <option value="priority">По важности</option>
                    <option value="creator">По создателю</option>
                </select>
            ) : (
                <>
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
                </>
            )}
        </div>
    );
};

export default SortPanel;
