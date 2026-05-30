import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { GET_TASK_ATTACHMENTS, GET_TASK_SUBTASKS, GET_TAGS, GET_TASK_BY_ID } from '../graphql/queries';
import { UPDATE_TASK, DELETE_TASK, CREATE_TAG, ADD_TAG_TO_TASK, REMOVE_TAG_FROM_TASK, DELETE_TAG_FROM_PROJECT, SET_TASK_ASSIGNEES } from '../graphql/mutations';
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
                       refetchCurrentTasks,
                   }) => {
    const client = useApolloClient();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState(null);
    const [dueDateInput, setDueDateInput] = useState('');
    const [status, setStatus] = useState('TODO');
    const [priority, setPriority] = useState(2);
    const [assigneeIds, setAssigneeIds] = useState([]);
    const [originalAssigneeIds, setOriginalAssigneeIds] = useState([]);
    const [creatorId, setCreatorId] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [originalTagIds, setOriginalTagIds] = useState([]);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#3b82f6');
    const [showCreateTag, setShowCreateTag] = useState(false);

    const users = assignableUsers || [];

    // ✅ Все useQuery должны идти ПЕРЕД использованием их данных
    const { data: fullTaskData, refetch: refetchFullTask } = useQuery(GET_TASK_BY_ID, {
        variables: { taskId: task?.id },
        skip: !task?.id,
        fetchPolicy: 'network-first',
        onCompleted: (data) => {
            console.log('✅ GET_TASK_BY_ID completed for task', data?.task?.id, '- tags:', data?.task?.tags?.length || 0, data?.task?.tags);
        },
        onError: (error) => {
            console.error('❌ GET_TASK_BY_ID error:', error);
        },
    });

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
        fetchPolicy: 'cache-and-network',
        notifyOnNetworkStatusChange: true,
    });
    const availableTags = tagsData?.tags || [];

    const [updateTask] = useMutation(UPDATE_TASK);
    const [deleteTask] = useMutation(DELETE_TASK);
    const [createTag] = useMutation(CREATE_TAG);
    const [addTagToTask] = useMutation(ADD_TAG_TO_TASK);
    const [removeTagFromTask] = useMutation(REMOVE_TAG_FROM_TASK);
    const [deleteTagFromProject] = useMutation(DELETE_TAG_FROM_PROJECT);
    const [setTaskAssignees] = useMutation(SET_TASK_ASSIGNEES);

    // ✅ ИСПРАВЛЕНИЕ: Теперь fullTask использует уже объявленные переменные
    const fullTask = subTasksData?.task || fullTaskData?.task || task;

    useEffect(() => {
        if (task?.id && attachmentsData?.taskAttachments) setAttachments(attachmentsData.taskAttachments);
        else setAttachments([]);
    }, [attachmentsData, task?.id]);

    // ✅ Используем теги из ПОЛНОЙ задачи
    useEffect(() => {
        if (fullTask?.tags) {
            console.log('📌 TaskModal: Теги загружены:', fullTask.tags);
            const tagIds = fullTask.tags.map((t) => t.id);
            setSelectedTagIds(tagIds);
            setOriginalTagIds(tagIds);
        } else {
            console.log('⚠️ TaskModal: Теги не найдены в fullTask');
            setSelectedTagIds([]);
            setOriginalTagIds([]);
        }
    }, [fullTask?.tags]);

    useEffect(() => {
        if (fullTask) {
            setTitle(fullTask.title || '');
            setDescription(fullTask.description || '');
            setDueDate(fullTask.dueDate ? new Date(fullTask.dueDate) : null);
            if (fullTask.dueDate) {
                const date = new Date(fullTask.dueDate);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                setDueDateInput(`${year}-${month}-${day}T${hours}:${minutes}`);
            } else {
                setDueDateInput('');
            }
            let rawStatus = fullTask.status;
            if (typeof rawStatus === 'number') rawStatus = rawStatus === 0 ? 'TODO' : rawStatus === 1 ? 'IN_PROGRESS' : 'REVIEW';
            else if (typeof rawStatus === 'string') rawStatus = rawStatus.toUpperCase().replace('INPROGRESS', 'IN_PROGRESS');
            setStatus(['TODO', 'IN_PROGRESS', 'REVIEW'].includes(rawStatus) ? rawStatus : 'TODO');
            setPriority(fullTask.value || 2);
            
            const newAssigneeIds = fullTask.assignees?.map((a) => a.id) || [];
            setAssigneeIds(newAssigneeIds);
            setOriginalAssigneeIds(newAssigneeIds);
            
            setCreatorId(fullTask.createdBy?.id || null);
            setIsEditing(false);
        } else {
            setTitle('');
            setDescription('');
            setDueDate(null);
            setDueDateInput('');
            setStatus('TODO');
            setPriority(2);
            const newIds = initialAssigneeIds || [];
            setAssigneeIds(newIds);
            setOriginalAssigneeIds(newIds);
            setCreatorId(null);
            setIsEditing(true);
        }
    }, [fullTask, initialAssigneeIds]);

    const handleStatusChange = async (newStatus) => {
        if (!fullTask || isViewer) return;
        try {
            await updateTask({ variables: { id: fullTask.id, status: newStatus } });
            setStatus(newStatus);
            if (onSave) onSave({ status: newStatus });
        } catch (err) {
            console.error(err);
            alert('Ошибка обновления статуса');
        }
    };

    const setCurrentDateTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setDueDateInput(`${year}-${month}-${day}T${hours}:${minutes}`);
        setDueDate(now);
    };

    const handleDueDateChange = (e) => {
        const value = e.target.value;
        setDueDateInput(value);
        if (value) {
            setDueDate(new Date(value));
        } else {
            setDueDate(null);
        }
    };

    // ✅ НОВОЕ: Сохранение изменённых тегов
    const saveTags = async () => {
        if (!fullTask?.id) return;
        
        try {
            // Тегов добавили
            const tagsToAdd = selectedTagIds.filter(id => !originalTagIds.includes(id));
            for (const tagId of tagsToAdd) {
                await addTagToTask({ variables: { taskId: parseInt(fullTask.id), tagId: parseInt(tagId) } });
            }
            
            // Тегов удалили
            const tagsToRemove = originalTagIds.filter(id => !selectedTagIds.includes(id));
            for (const tagId of tagsToRemove) {
                await removeTagFromTask({ variables: { taskId: parseInt(fullTask.id), tagId: parseInt(tagId) } });
            }
            
            console.log('✅ Теги сохранены');
        } catch (err) {
            console.error('❌ Ошибка сохранения тегов:', err);
            throw err;
        }
    };

    // ✅ НОВОЕ: Сохранение изменённых исполнителей
    const saveAssignees = async () => {
        if (!fullTask?.id) return;
        
        try {
            // Проверяем есть ли изменения
            if (JSON.stringify(assigneeIds.sort()) !== JSON.stringify(originalAssigneeIds.sort())) {
                await setTaskAssignees({ variables: { taskId: fullTask.id, userIds: assigneeIds } });
                client.cache.evict({ fieldName: 'tasksBySubgroup' });
                client.cache.evict({ fieldName: 'tasksByAssigneeAndProject' });
                client.cache.gc();
                if (refetchCurrentTasks) await refetchCurrentTasks();
                console.log('✅ Исполнители сохранены');
            }
        } catch (err) {
            console.error('❌ Ошибка сохранения исполнителей:', err);
            throw err;
        }
    };

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

            console.log('💾 handleSubmit onSave with:', { title, selectedTagIds });
            await onSave({
                title: title.trim(),
                description: description.trim() || null,
                dueDate: dueISO,
                status: statusVal,
                value: parseInt(priority),
                assigneeIds,
                creatorId,
            });
            console.log('✅ onSave complete');
            
            // ✅ НОВОЕ: Сохраняем теги и исполнителей ПОСЛЕ сохранения остального
            await saveTags();
            await saveAssignees();
            
            // ИСПРАВЛЕНО: Дождаться refetch перед закрытием модала
            // Это гарантирует, что теги будут загружены из бэка
            if (refetchFullTask) {
                console.log('⏳ Waiting for refetchFullTask...');
                const result = await refetchFullTask();
                console.log('✅ refetchFullTask done, tags:', result?.data?.task?.tags?.length);
            }
            
            // Затем закрываем модал
            onClose();
        } catch (err) {
            console.error(err);
            alert('Ошибка: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ✅ ИСПРАВЛЕНИЕ: handleAssigneeToggle теперь НЕ сохраняет в БД, только меняет локальное состояние
    const handleAssigneeToggle = (userId) => {
        setAssigneeIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
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
            const res = await fetch(`/api/files/upload/${fullTask.id}`, {
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
            const { data } = await createTag({ 
                variables: { 
                    projectId: parseInt(projectId), 
                    name: newTagName.trim(), 
                    color: newTagColor 
                } 
            });
            
            if (data?.createTag) {
                client.cache.evict({ fieldName: 'tags' });
                client.cache.gc();
            }
            
            setNewTagName('');
            setNewTagColor('#3b82f6');
            setShowCreateTag(false);
            await refetchTags();
            if (refetchProjectTags) await refetchProjectTags();
        } catch (err) {
            alert('Ошибка создания тега: ' + err.message);
        }
    };

    // ✅ ИСПРАВЛЕНИЕ: handleToggleTag теперь НЕ сохраняет в БД, только меняет локальное состояние
    const handleToggleTag = (tagId) => {
        setSelectedTagIds((prev) =>
            prev.includes(tagId)
                ? prev.filter((id) => id !== tagId)
                : [...prev, tagId]
        );
    };

    const handleDeleteTagFromProject = async (tagId, tagName) => {
        if (!window.confirm(`Удалить тег "${tagName}" из проекта?`)) return;
        try {
            await deleteTagFromProject({ variables: { tagId: parseInt(tagId), projectId: parseInt(projectId) } });
            
            // ИСПРАВЛЕНИЕ: Используем network-first для полного обновления
            await refetchTags();
            if (refetchProjectTags) await refetchProjectTags();
            setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
            if (refetchCurrentTasks) await refetchCurrentTasks();
            if (refetchFullTask) await refetchFullTask();
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
    if (fullTask && !isEditing) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content task-view-modal" onClick={(e) => e.stopPropagation()}>
                    <button className="modal-close" onClick={onClose}>✕</button>
                    <h3>Просмотр задачи</h3>
                    <div className="task-timestamps">
                        <div><i className="fas fa-plus-circle"></i> Создано: {formatDateTime(fullTask.createdAt)}</div>
                        <div><i className="fas fa-edit"></i> Обновлено: {formatDateTime(fullTask.updatedAt)}</div>
                    </div>
                    <div className="form-group"><label>Название</label><div className="form-input" style={{ background: '#f8fafc' }}>{fullTask.title}</div></div>
                    <div className="form-group"><label>Описание</label><div className="form-input" style={{ background: '#f8fafc', whiteSpace: 'pre-wrap', wordWrap: 'break-word', lineHeight: '1.5', minHeight: '80px' }}>{fullTask.description || '—'}</div></div>
                    {fullTask.tags?.length > 0 && (
                        <div className="form-group">
                            <label><i className="fas fa-tags"></i> Теги</label>
                            <div className="form-input" style={{ background: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {fullTask.tags.map((tag) => (
                                    <span key={tag.id} style={{ backgroundColor: tag.color, color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem' }}>{tag.name}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="form-group"><label>Дедлайн</label><div className="form-input" style={{ background: '#f8fafc' }}>{fullTask.dueDate ? new Date(fullTask.dueDate).toLocaleString() : '—'}</div></div>
                    <div className="form-group">
                        <label>Статус</label>
                        <select className="form-select" style={{background: 'white'}} value={status} onChange={(e) => handleStatusChange(e.target.value)} disabled={isViewer}>
                            <option value="TODO">Создано</option>
                            <option value="IN_PROGRESS">В разработке</option>
                            <option value="REVIEW">Выполнено</option>
                        </select>
                    </div>
                    <div className="form-group"><label>Важность</label><div className="form-input" style={{ background: '#f8fafc' }}>{priority === 1 ? 'Низкая' : priority === 2 ? 'Средняя' : 'Высокая'}</div></div>
                    {fullTask.createdBy && (
                        <div className="form-group"><label>Создатель</label><div className="form-input" style={{ background: '#f8fafc' }}><i className="fas fa-user"></i> {fullTask.createdBy.fullName}</div></div>
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
                <h3>{fullTask ? 'Редактировать задачу' : 'Новая задача'}</h3>
                {fullTask && (
                    <div className="task-timestamps">
                        <div><i className="fas fa-plus-circle"></i> Создано: {formatDateTime(fullTask.createdAt)}</div>
                        <div><i className="fas fa-edit"></i> Обновлено: {formatDateTime(fullTask.updatedAt)}</div>
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="task-title">Название *</label>
                        <input className="form-input editable-field" id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="task-desc">Описание</label>
                        <textarea className="form-textarea editable-field" id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows="12" style={{ minHeight: '250px', resize: 'vertical' }} />
                    </div>

                    {/* Теги с автопереносом */}
                    <div className="form-group">
                        <label><i className="fas fa-tags"></i> Теги ({selectedTagIds.length})</label>
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
                                <input 
                                    type="datetime-local" 
                                    id="task-due"
                                    className="form-input" 
                                    value={dueDateInput}
                                    onChange={handleDueDateChange}
                                />
                            </div>
                            <button type="button" className="btn btn--secondary btn--small" onClick={setCurrentDateTime}><i className="fas fa-clock"></i> Сейчас</button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="task-status">Статус</label>
                        <select className="form-select editable-field" id="task-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="TODO">Создано</option>
                            <option value="IN_PROGRESS">В разработке</option>
                            <option value="REVIEW">Выполнено</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="task-priority">Важность</label>
                        <select className="form-select editable-field" id="task-priority" value={priority} onChange={(e) => setPriority(parseInt(e.target.value))}>
                            <option value="1">Низкая</option>
                            <option value="2">Средняя</option>
                            <option value="3">Высокая</option>
                        </select>
                    </div>
                    {fullTask && (
                        <div className="form-group">
                            <label htmlFor="task-creator">Создатель задачи</label>
                            <select className="form-select editable-field" id="task-creator" value={creatorId ? String(creatorId) : ''} onChange={(e) => setCreatorId(e.target.value ? parseInt(e.target.value) : null)}>
                                <option value="">-- Выберите --</option>
                                {users.map(member => (
                                    <option key={member.userId} value={member.userId}>{member.user?.fullName}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <fieldset className="form-group">
                        <legend>Исполнители</legend>
                        <div className="assignees-checkbox-list editable-field">
                            {users.map(member => (
                                <label key={member.userId}>
                                    <input type="checkbox" checked={assigneeIds.includes(member.userId)} onChange={() => handleAssigneeToggle(member.userId)} />
                                    {member.user?.fullName}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    {fullTask && (
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
                        {fullTask && <button type="button" className="btn btn--secondary" onClick={() => setIsEditing(false)}>Назад</button>}
                        {fullTask && !isMyTasksGroup && <button type="button" className="btn btn--danger" onClick={() => setShowDeleteConfirm(true)}>Удалить задачу</button>}
                        <button type="submit" className="btn" disabled={isSaving}>Сохранить</button>
                    </div>
                </form>
            </div>
            <ConfirmModal
                isOpen={showDeleteConfirm}
                title="Удаление задачи"
                message="Вы уверены?"
                onConfirm={() => { onDeleteTask(fullTask.id); setShowDeleteConfirm(false); }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
};

export default TaskModal;
