import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useQuery, useMutation } from '@apollo/client';
import { GET_TASK_ATTACHMENTS, GET_TASK_SUBTASKS, GET_TAGS } from '../graphql/queries';
import { UPDATE_TASK, DELETE_TASK, CREATE_TAG, ADD_TAG_TO_TASK, REMOVE_TAG_FROM_TASK, DELETE_TAG_FROM_PROJECT } from '../graphql/mutations';
import AttachmentList from './AttachmentList';
import ConfirmModal from './ConfirmModal';

const TaskModal = ({
                       task,
                       assignableUsers,
                       initialAssigneeIds,
                       onSave,
                       onDeleteTask,
                       isMyTasksGroup,
                       isCreator,
                       canEdit = true,
                       isViewer = false,
                       onClose,
                       projectId,
                       refetchProjectTags,
                   }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState(null);
    const [status, setStatus] = useState('TODO');
    const [priority, setPriority] = useState(2);
    const [assigneeIds, setAssigneeIds] = useState([]);
    const [creatorId, setCreatorId] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#3b82f6');
    const [showCreateTag, setShowCreateTag] = useState(false);

    const users = assignableUsers || [];

    const { data: attachmentsData, refetch: refetchAttachments } = useQuery(GET_TASK_ATTACHMENTS, {
        variables: { taskId: task?.id },
        skip: !task?.id,
    });
    const { data: subTasksData, refetch: refetchSubTasks } = useQuery(GET_TASK_SUBTASKS, {
        variables: { taskId: task?.id },
        skip: !task?.id,
    });
    const { data: tagsData, refetch: refetchTags } = useQuery(GET_TAGS, {
        variables: { projectId },
        skip: !projectId,
        fetchPolicy: 'network-only',
    });
    const availableTags = tagsData?.tags || [];

    const [updateTask] = useMutation(UPDATE_TASK);
    const [deleteTask] = useMutation(DELETE_TASK);
    const [createTag] = useMutation(CREATE_TAG);
    const [addTagToTask] = useMutation(ADD_TAG_TO_TASK);
    const [removeTagFromTask] = useMutation(REMOVE_TAG_FROM_TASK);
    const [deleteTagFromProject] = useMutation(DELETE_TAG_FROM_PROJECT);

    useEffect(() => {
        if (task?.id && attachmentsData?.taskAttachments) setAttachments(attachmentsData.taskAttachments);
        else setAttachments([]);
    }, [attachmentsData, task?.id]);

    useEffect(() => {
        if (task?.tags) setSelectedTagIds(task.tags.map((t) => t.id));
    }, [task]);

    useEffect(() => {
        if (task) {
            setTitle(task.title || '');
            setDescription(task.description || '');
            setDueDate(task.dueDate ? new Date(task.dueDate) : null);
            let rawStatus = task.status;
            if (typeof rawStatus === 'number') rawStatus = rawStatus === 0 ? 'TODO' : rawStatus === 1 ? 'IN_PROGRESS' : 'REVIEW';
            else if (typeof rawStatus === 'string') rawStatus = rawStatus.toUpperCase().replace('INPROGRESS', 'IN_PROGRESS');
            setStatus(['TODO', 'IN_PROGRESS', 'REVIEW'].includes(rawStatus) ? rawStatus : 'TODO');
            setPriority(task.value || 2);
            setAssigneeIds(task.assignees?.map((a) => a.id) || []);
            setCreatorId(task.createdBy?.id || null);
            setIsEditing(false);
        } else {
            setTitle('');
            setDescription('');
            setDueDate(null);
            setStatus('TODO');
            setPriority(2);
            setAssigneeIds(initialAssigneeIds || []);
            setCreatorId(null);
            setIsEditing(true);
        }
    }, [task, initialAssigneeIds]);

    const handleStatusChange = async (newStatus) => {
        if (!task || isViewer) return;
        try {
            await updateTask({ variables: { id: task.id, status: newStatus } });
            setStatus(newStatus);
            if (onSave) onSave({ status: newStatus });
        } catch (err) {
            console.error(err);
            alert('Ошибка обновления статуса');
        }
    };

    const setCurrentDateTime = () => setDueDate(new Date());

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return alert('Введите название');
        if (isSaving) return;
        setIsSaving(true);
        try {
            let dueISO = null;
            if (dueDate) {
                if (dueDate < new Date()) return alert('Нельзя установить дедлайн в прошлом');
                dueISO = dueDate.toISOString();
            }
            let statusVal = status;
            if (typeof statusVal === 'number') statusVal = statusVal === 0 ? 'TODO' : statusVal === 1 ? 'IN_PROGRESS' : 'REVIEW';
            statusVal = statusVal.toUpperCase().replace('INPROGRESS', 'IN_PROGRESS');

            await onSave({
                title: title.trim(),
                description: description.trim() || null,
                dueDate: dueISO,
                status: statusVal,
                value: parseInt(priority),
                assigneeIds,
                creatorId,
            });
            onClose();
        } catch (err) {
            console.error(err);
            alert('Ошибка: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAssigneeToggle = (userId) => {
        setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const token = localStorage.getItem('jwtToken');
            const res = await fetch(`/api/files/upload/${task.id}`, {
                method: 'POST',
                headers: { Authorization: token ? `Bearer ${token}` : '' },
                body: formData,
            });
            if (!res.ok) throw new Error();
            await refetchAttachments();
        } catch (err) {
            alert('Ошибка загрузки файла');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDeleteFile = async (fileId) => {
        try {
            const token = localStorage.getItem('jwtToken');
            const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) await refetchAttachments();
            else alert('Ошибка удаления');
        } catch (err) {
            console.error(err);
            alert('Ошибка');
        }
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        try {
            await createTag({ variables: { projectId: parseInt(projectId), name: newTagName.trim(), color: newTagColor } });
            setNewTagName('');
            setNewTagColor('#3b82f6');
            setShowCreateTag(false);
            await refetchTags();
            if (refetchProjectTags) refetchProjectTags();
        } catch (err) {
            alert('Ошибка создания тега: ' + err.message);
        }
    };

    const handleToggleTag = async (tagId) => {
        if (!task?.id) return;
        try {
            if (selectedTagIds.includes(tagId)) {
                await removeTagFromTask({ variables: { taskId: parseInt(task.id), tagId: parseInt(tagId) } });
                setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
            } else {
                await addTagToTask({ variables: { taskId: parseInt(task.id), tagId: parseInt(tagId) } });
                setSelectedTagIds((prev) => [...prev, tagId]);
            }
            await refetchTags();
            if (refetchProjectTags) refetchProjectTags();
        } catch (err) {
            console.error(err);
            alert('Ошибка изменения тега');
        }
    };

    const handleDeleteTagFromProject = async (tagId, tagName) => {
        if (!window.confirm(`Удалить тег "${tagName}" из проекта?`)) return;
        try {
            await deleteTagFromProject({ variables: { tagId: parseInt(tagId), projectId: parseInt(projectId) } });
            await refetchTags();
            if (refetchProjectTags) refetchProjectTags();
            setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
        } catch (err) {
            alert('Ошибка удаления тега: ' + err.message);
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('ru', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    };

    const subTasks = subTasksData?.taskSubTasks || [];
    const completedCount = subTasks.filter((st) => st.status === 2).length;

    // Режим просмотра
    if (task && !isEditing) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content task-view-modal" onClick={(e) => e.stopPropagation()}>
                    <button className="modal-close" onClick={onClose}>✕</button>
                    <h3>Просмотр задачи</h3>
                    <div className="task-timestamps">
                        <div><i className="fas fa-plus-circle"></i> Создано: {formatDateTime(task.createdAt)}</div>
                        <div><i className="fas fa-edit"></i> Обновлено: {formatDateTime(task.updatedAt)}</div>
                    </div>
                    <div className="form-group"><label>Название</label><div className="form-input" style={{ background: '#f8fafc' }}>{task.title}</div></div>
                    <div className="form-group"><label>Описание</label><div className="form-input" style={{ background: '#f8fafc' }}>{task.description || '—'}</div></div>
                    {task.tags?.length > 0 && (
                        <div className="form-group">
                            <label><i className="fas fa-tags"></i> Теги</label>
                            <div className="form-input" style={{ background: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {task.tags.map((tag) => (
                                    <span key={tag.id} style={{ backgroundColor: tag.color, color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem' }}>{tag.name}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="form-group"><label>Дедлайн</label><div className="form-input" style={{ background: '#f8fafc' }}>{task.dueDate ? new Date(task.dueDate).toLocaleString() : '—'}</div></div>
                    <div className="form-group">
                        <label>Статус</label>
                        <select className="form-select" value={status} onChange={(e) => handleStatusChange(e.target.value)} disabled={isViewer}>
                            <option value="TODO">Создано</option>
                            <option value="IN_PROGRESS">В разработке</option>
                            <option value="REVIEW">Выполнено</option>
                        </select>
                    </div>
                    <div className="form-group"><label>Важность</label><div className="form-input" style={{ background: '#f8fafc' }}>{priority === 1 ? 'Низкая' : priority === 2 ? 'Средняя' : 'Высокая'}</div></div>
                    {task.createdBy && (
                        <div className="form-group"><label>Создатель</label><div className="form-input" style={{ background: '#f8fafc' }}><i className="fas fa-user"></i> {task.createdBy.fullName}</div></div>
                    )}
                    <div className="form-group"><label>Исполнители</label><div className="form-input" style={{ background: '#f8fafc' }}>{users.filter(u => assigneeIds.includes(u.userId)).map(u => u.user?.fullName).join(', ') || '—'}</div></div>
                    {subTasks.length > 0 && (
                        <div className="form-group">
                            <label>Подзадачи ({completedCount}/{subTasks.length})</label>
                            <ul className="subtasks-list">
                                {subTasks.map(st => <li key={st.id} className={st.status === 2 ? 'completed' : ''}>{st.title}</li>)}
                            </ul>
                        </div>
                    )}
                    <AttachmentList attachments={attachments} onDelete={handleDeleteFile} isEditMode={false} />
                    <div className="modal-actions">
                        {canEdit && isCreator && <button className="btn" onClick={() => setIsEditing(true)}><i className="fas fa-edit"></i> Редактировать</button>}
                        <button className="btn btn--secondary" onClick={onClose}>Закрыть</button>
                    </div>
                </div>
            </div>
        );
    }

    // Режим редактирования
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>
                <h3>{task ? 'Редактировать задачу' : 'Новая задача'}</h3>
                {task && (
                    <div className="task-timestamps">
                        <div><i className="fas fa-plus-circle"></i> Создано: {formatDateTime(task.createdAt)}</div>
                        <div><i className="fas fa-edit"></i> Обновлено: {formatDateTime(task.updatedAt)}</div>
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="task-title">Название *</label>
                        <input className="form-input" id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="task-desc">Описание</label>
                        <textarea className="form-textarea" id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows="5" />
                    </div>

                    {/* Теги с автопереносом */}
                    <div className="form-group">
                        <label><i className="fas fa-tags"></i> Теги</label>
                        <div className="tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px', maxWidth: '100%', overflow: 'hidden' }}>
                            {availableTags.map((tag) => {
                                const isSelected = selectedTagIds.includes(tag.id);
                                return (
                                    <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: 'calc(100% - 8px)' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleTag(tag.id)}
                                            style={{
                                                backgroundColor: isSelected ? tag.color : 'transparent',
                                                color: isSelected ? 'white' : tag.color,
                                                border: `1px solid ${tag.color}`,
                                                borderRadius: '20px',
                                                padding: '4px 12px',
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {tag.name}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteTagFromProject(tag.id, tag.name)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                        >
                                            <i className="fas fa-times-circle"></i>
                                        </button>
                                    </div>
                                );
                            })}
                            <button type="button" className="btn btn--secondary btn--small" onClick={() => setShowCreateTag(!showCreateTag)} style={{ whiteSpace: 'nowrap' }}>
                                <i className="fas fa-plus"></i> Новый тег
                            </button>
                        </div>
                        {showCreateTag && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                <input type="text" className="form-input" placeholder="Название тега" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
                                <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} style={{ width: '50px', height: '38px', borderRadius: '8px' }} />
                                <button type="button" className="btn" onClick={handleCreateTag}><i className="fas fa-check"></i></button>
                                <button type="button" className="btn btn--secondary" onClick={() => setShowCreateTag(false)}><i className="fas fa-times"></i></button>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="task-due">Дедлайн</label>
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
                                    placeholderText="Выберите дату и время"
                                    className="form-input"
                                    isClearable
                                />
                            </div>
                            <button type="button" className="btn btn--secondary btn--small" onClick={setCurrentDateTime}><i className="fas fa-clock"></i> Сейчас</button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="task-status">Статус</label>
                        <select className="form-select" id="task-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="TODO">Создано</option>
                            <option value="IN_PROGRESS">В разработке</option>
                            <option value="REVIEW">Выполнено</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="task-priority">Важность</label>
                        <select className="form-select" id="task-priority" value={priority} onChange={(e) => setPriority(parseInt(e.target.value))}>
                            <option value="1">Низкая</option>
                            <option value="2">Средняя</option>
                            <option value="3">Высокая</option>
                        </select>
                    </div>
                    {task && (
                        <div className="form-group">
                            <label htmlFor="task-creator">Создатель задачи</label>
                            <select className="form-select" id="task-creator" value={creatorId || ''} onChange={(e) => setCreatorId(e.target.value || null)}>
                                {users.map(member => (
                                    <option key={member.userId} value={member.userId}>{member.user?.fullName}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <fieldset className="form-group">
                        <legend>Исполнители</legend>
                        <div className="assignees-checkbox-list">
                            {users.map(member => (
                                <label key={member.userId}>
                                    <input type="checkbox" checked={assigneeIds.includes(member.userId)} onChange={() => handleAssigneeToggle(member.userId)} />
                                    {member.user?.fullName}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    {task && (
                        <div className="form-group">
                            <AttachmentList attachments={attachments} onDelete={handleDeleteFile} isEditMode={true} />
                            <div className="attachment-upload">
                                <label className="btn btn--secondary btn--small">
                                    <i className="fas fa-upload"></i> Загрузить файл
                                    <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
                                </label>
                                {uploading && <span className="uploading">Загрузка...</span>}
                            </div>
                        </div>
                    )}
                    <div className="modal-actions">
                        {task && <button type="button" className="btn btn--secondary" onClick={() => setIsEditing(false)}>Назад</button>}
                        {task && !isMyTasksGroup && <button type="button" className="btn btn--danger" onClick={() => setShowDeleteConfirm(true)}>Удалить задачу</button>}
                        <button type="submit" className="btn" disabled={isSaving}>Сохранить</button>
                    </div>
                </form>
            </div>
            <ConfirmModal
                isOpen={showDeleteConfirm}
                title="Удаление задачи"
                message="Вы уверены?"
                onConfirm={() => { onDeleteTask(task.id); setShowDeleteConfirm(false); }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
};

export default TaskModal;