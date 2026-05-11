import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useQuery, useMutation } from '@apollo/client';
import { GET_TASK_ATTACHMENTS } from '../graphql/queries';
import { UPDATE_TASK } from '../graphql/mutations';
import AttachmentList from './AttachmentList';
import ConfirmModal from './ConfirmModal';

const TaskModal = ({
                       task,
                       subgroupId,
                       assignableUsers,
                       initialAssigneeIds,
                       onSave,
                       onDeleteTask,
                       isMyTasksGroup,
                       isCreator,
                       onClose
                   }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState(null);
    const [status, setStatus] = useState('TODO');
    const [priority, setPriority] = useState(2);
    const [assigneeIds, setAssigneeIds] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const users = assignableUsers || [];

    const { data: attachmentsData, refetch: refetchAttachments } = useQuery(GET_TASK_ATTACHMENTS, {
        variables: { taskId: task?.id },
        skip: !task?.id,
    });

    const [updateTask] = useMutation(UPDATE_TASK);

    useEffect(() => {
        if (task) {
            // Существующая задача – заполняем поля и начинаем в режиме просмотра
            setTitle(task.title || '');
            setDescription(task.description || '');
            setDueDate(task.dueDate ? new Date(task.dueDate) : null);
            let rawStatus = task.status;
            if (typeof rawStatus === 'number') {
                rawStatus = rawStatus === 0 ? 'TODO' : rawStatus === 1 ? 'IN_PROGRESS' : 'REVIEW';
            } else if (typeof rawStatus === 'string') {
                rawStatus = rawStatus.toUpperCase();
                if (rawStatus === 'INPROGRESS') rawStatus = 'IN_PROGRESS';
            }
            setStatus(rawStatus === 'TODO' || rawStatus === 'IN_PROGRESS' || rawStatus === 'REVIEW' ? rawStatus : 'TODO');
            setPriority(task.value || 2);
            setAssigneeIds(task.assignees?.map(a => a.id) || []);
            setIsEditing(false); // режим просмотра
        } else {
            // Новая задача – режим редактирования
            setTitle('');
            setDescription('');
            setDueDate(null);
            setStatus('TODO');
            setPriority(2);
            setAssigneeIds(initialAssigneeIds || []);
            setIsEditing(true);
        }
    }, [task, initialAssigneeIds]);

    const handleStatusChange = async (newStatus) => {
        if (!task) return;
        try {
            await updateTask({
                variables: {
                    id: task.id,
                    status: newStatus,
                },
            });
            setStatus(newStatus);
            if (onSave) onSave({ status: newStatus });
        } catch (err) {
            console.error('Ошибка обновления статуса:', err);
            alert('Ошибка обновления статуса');
        }
    };

    const setCurrentDateTime = () => {
        setDueDate(new Date());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            alert('Введите название задачи');
            return;
        }
        if (isSaving) return;
        setIsSaving(true);
        try {
            let dueDateISO = null;
            if (dueDate) {
                if (dueDate < new Date()) {
                    alert('Нельзя установить дедлайн в прошлом');
                    return;
                }
                dueDateISO = dueDate.toISOString();
            }
            await onSave({
                title: title.trim(),
                description: description.trim() || null,
                dueDate: dueDateISO,
                status,
                value: parseInt(priority),
                assigneeIds,
            });
            onClose();
        } catch (err) {
            console.error(err);
            alert('Ошибка сохранения');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAssigneeToggle = (userId) => {
        setAssigneeIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const token = localStorage.getItem('jwtToken');
            const response = await fetch(`/api/files/upload/${task.id}`, {
                method: 'POST',
                headers: { Authorization: token ? `Bearer ${token}` : '' },
                body: formData,
            });
            if (!response.ok) throw new Error('Upload failed');
            await refetchAttachments();
        } catch (err) {
            console.error(err);
            alert('Ошибка загрузки файла');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDeleteClick = () => setShowDeleteConfirm(true);
    const handleConfirmDelete = () => {
        if (task && onDeleteTask) onDeleteTask(task.id);
        setShowDeleteConfirm(false);
    };
    const handleCancelDelete = () => setShowDeleteConfirm(false);

    const customHeader = ({ date, changeYear, changeMonth, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
        <div className="custom-datepicker-header">
            <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled}>{"<"}</button>
            <select value={date.getFullYear()} onChange={({ target: { value } }) => changeYear(parseInt(value))}>
                {Array.from({ length: 10 }, (_, i) => date.getFullYear() - 5 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                ))}
            </select>
            <select value={date.getMonth()} onChange={({ target: { value } }) => changeMonth(parseInt(value))}>
                {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{new Date(0, i).toLocaleString('ru', { month: 'long' })}</option>
                ))}
            </select>
            <button onClick={increaseMonth} disabled={nextMonthButtonDisabled}>{">"}</button>
        </div>
    );

    // Режим просмотра – только для существующей задачи, когда isEditing === false
    if (task && !isEditing) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content task-view-modal" onClick={(e) => e.stopPropagation()}>
                    <button className="modal-close" onClick={onClose}>✕</button>
                    <h3>Просмотр задачи</h3>
                    <div className="form-group">
                        <label className="form-label">Название</label>
                        <div className="form-input" style={{ background: '#f8fafc' }}>{task.title}</div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Описание</label>
                        <div className="form-input task-description-view">
                            {task.description || '—'}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Дедлайн (дата и время)</label>
                        <div className="form-input" style={{ background: '#f8fafc' }}>
                            {task.dueDate ? new Date(task.dueDate).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Статус</label>
                        <select
                            className="form-select"
                            value={status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                        >
                            <option value="TODO">Создано</option>
                            <option value="IN_PROGRESS">В разработке</option>
                            <option value="REVIEW">Выполнено</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Важность</label>
                        <div className="form-input" style={{ background: '#f8fafc' }}>
                            {priority === 1 && '🔵 Низкая'}
                            {priority === 2 && '🟡 Средняя'}
                            {priority === 3 && '🔴 Высокая'}
                        </div>
                    </div>
                    {task.createdBy && (
                        <div className="form-group">
                            <label className="form-label">Создатель</label>
                            <div className="form-input" style={{ background: '#f8fafc' }}>
                                <i className="fas fa-user"></i> {task.createdBy.fullName}
                            </div>
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Исполнители</label>
                        <div className="form-input" style={{ background: '#f8fafc' }}>
                            {users.filter(u => assigneeIds.includes(u.userId)).map(u => u.user?.fullName).join(', ') || '—'}
                        </div>
                    </div>
                    {task && (
                        <div className="form-group">
                            <AttachmentList
                                attachments={attachmentsData?.taskAttachments || []}
                                onDelete={refetchAttachments}
                            />
                        </div>
                    )}
                    <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                        {isCreator && (
                            <button type="button" className="btn" onClick={() => setIsEditing(true)}>
                                <i className="fas fa-edit"></i> Редактировать
                            </button>
                        )}
                        <button type="button" className="btn btn--secondary" onClick={onClose}>
                            <i className="fas fa-times"></i> Закрыть
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Режим редактирования (для новой задачи или когда isEditing === true)
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>
                <h3>{task ? 'Редактировать задачу' : 'Новая задача'}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="task-title">Название *</label>
                        <input
                            className="form-input"
                            type="text"
                            id="task-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="task-desc">Описание</label>
                        <textarea
                            className="form-textarea"
                            id="task-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows="3"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="task-due">Дедлайн (дата и время)</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <DatePicker
                                    selected={dueDate}
                                    onChange={(date) => setDueDate(date)}
                                    showTimeSelect
                                    dateFormat="dd.MM.yyyy HH:mm"
                                    timeFormat="HH:mm"
                                    timeIntervals={15}
                                    minDate={new Date()}
                                    filterTime={(time) => time >= new Date()}
                                    placeholderText="Выберите дату и время"
                                    className="form-input"
                                    isClearable
                                    customHeader={customHeader}
                                />
                            </div>
                            <button
                                type="button"
                                className="btn btn--secondary btn--small"
                                onClick={setCurrentDateTime}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                <i className="fas fa-clock"></i> Сейчас
                            </button>
                        </div>
                        <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                            <i className="fas fa-clock"></i> Можно выбрать только текущую или будущую дату и время.
                        </small>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="task-status">Статус</label>
                        <select
                            className="form-select"
                            id="task-status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="TODO">Создано</option>
                            <option value="IN_PROGRESS">В разработке</option>
                            <option value="REVIEW">Выполнено</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="task-priority">Важность</label>
                        <select
                            className="form-select"
                            id="task-priority"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                        >
                            <option value="1">Низкая</option>
                            <option value="2">Средняя</option>
                            <option value="3">Высокая</option>
                        </select>
                    </div>
                    {task && task.createdBy && (
                        <div className="form-group">
                            <label className="form-label">Создатель</label>
                            <div className="form-input" style={{ background: '#f8fafc' }}>
                                <i className="fas fa-user"></i> {task.createdBy.fullName}
                            </div>
                        </div>
                    )}
                    <fieldset className="form-group">
                        <legend className="form-label"><i className="fas fa-user-friends"></i> Исполнители (только участники текущей подгруппы)</legend>
                        <div className="assignees-checkbox-list">
                            {users.map(member => (
                                <label key={member.userId} className="assignees-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={assigneeIds.includes(member.userId)}
                                        onChange={() => handleAssigneeToggle(member.userId)}
                                    />
                                    {member.user?.fullName || `Пользователь ${member.userId}`}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    {task && (
                        <div className="form-group">
                            <AttachmentList
                                attachments={attachmentsData?.taskAttachments || []}
                                onDelete={refetchAttachments}
                            />
                            <div className="attachment-upload">
                                <label className="btn btn--secondary btn--small">
                                    <i className="fas fa-upload"></i> Загрузить файл
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                                {uploading && <span className="uploading">Загрузка...</span>}
                            </div>
                        </div>
                    )}
                    <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                        {task && (
                            <button type="button" className="btn btn--secondary" onClick={() => setIsEditing(false)}>
                                <i className="fas fa-arrow-left"></i> Назад
                            </button>
                        )}
                        {task && !isMyTasksGroup && (
                            <button type="button" className="btn btn--danger" onClick={handleDeleteClick}>
                                <i className="fas fa-trash-alt"></i> Удалить задачу
                            </button>
                        )}
                        <button type="submit" className="btn" disabled={isSaving}>
                            <i className="fas fa-save"></i> Сохранить
                        </button>
                    </div>
                </form>
            </div>
            <ConfirmModal
                isOpen={showDeleteConfirm}
                title="Удаление задачи"
                message="Вы действительно хотите удалить эту задачу? Это действие необратимо."
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </div>
    );
};

export default TaskModal;