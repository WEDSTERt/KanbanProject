import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { GET_PROJECT_DETAILS, GET_USER_PROJECTS, GET_USERS } from '../graphql/queries';
import { GET_TASKS_BY_SUBGROUP } from '../graphql/queries';
import {
    UPDATE_PROJECT,
    ADD_PROJECT_MEMBER,
    UPDATE_MEMBER_ROLE,
    REMOVE_MEMBER,
    DELETE_PROJECT,
    SET_TASK_ASSIGNEES,
    REMOVE_SUBGROUP_MEMBER,
    UPDATE_TASK,
    UPDATE_PROJECT_NOTIFICATIONS,
} from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from './ConfirmModal';

const ProjectSettings = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const projectId = searchParams.get('projectId');
    const { user } = useAuth();
    const client = useApolloClient();
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberRole, setNewMemberRole] = useState('MEMBER');
    const [message, setMessage] = useState(null);
    const [isError, setIsError] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, memberId: null, isProject: false });
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [projectNotificationsEnabled, setProjectNotificationsEnabled] = useState(true);
    const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const { loading, error, data, refetch } = useQuery(GET_PROJECT_DETAILS, { variables: { projectId } });
    const { data: usersData } = useQuery(GET_USERS, { variables: { limit: 100 } });

    const [updateProject] = useMutation(UPDATE_PROJECT);
    const [addMember] = useMutation(ADD_PROJECT_MEMBER);
    const [updateRole] = useMutation(UPDATE_MEMBER_ROLE);
    const [removeMember] = useMutation(REMOVE_MEMBER);
    const [removeSubgroupMember] = useMutation(REMOVE_SUBGROUP_MEMBER);
    const [setTaskAssignees] = useMutation(SET_TASK_ASSIGNEES);
    const [updateTask] = useMutation(UPDATE_TASK);
    const [deleteProject] = useMutation(DELETE_PROJECT, {
        onCompleted: () => navigate('/'),
        refetchQueries: [{ query: GET_USER_PROJECTS, variables: { userId: user.id } }],
    });
    const [updateProjectNotifications] = useMutation(UPDATE_PROJECT_NOTIFICATIONS);

    useEffect(() => {
        if (data?.project) {
            const currentMember = data.project.members.find(m => m.userId === user.id);
            if (currentMember) {
                setProjectNotificationsEnabled(currentMember.notificationsEnabled !== false);
            }
        }
    }, [data, user.id]);

    if (loading) return <div className="loading">Загрузка настроек проекта...</div>;
    if (error) return <div className="message-error">{error.message}</div>;
    if (!projectId) return <div className="message-error">Проект не указан</div>;

    const project = data.project;
    const isOwner = project.owner.id === user.id;
    const currentMember = project.members.find(m => m.userId === user.id);
    const isAdmin = isOwner || currentMember?.role === 'ADMIN' || currentMember?.role === 'OWNER';
    const isMember = currentMember?.role === 'MEMBER';
    const canManage = isAdmin;
    const canViewSettings = isAdmin || isMember;

    if (!canViewSettings) {
        return <div className="message-error">У вас нет доступа к настройкам этого проекта.</div>;
    }

    const handleUpdateName = async () => {
        if (!newProjectName.trim()) return;
        try {
            await updateProject({ variables: { id: projectId, name: newProjectName.trim() } });
            refetch();
            setMessage('Название обновлено');
            setIsError(false);
            setRenameModalOpen(false);
            setNewProjectName('');
        } catch (err) {
            setMessage(err.message);
            setIsError(true);
        }
    };

    const handleRoleChange = async (memberId, newRole) => {
        if (!isAdmin) {
            setMessage('У вас нет прав на изменение ролей');
            setIsError(true);
            return;
        }

        const member = project.members.find(m => m.id === memberId);
        if (!member) return;
        if (member.userId === project.owner.id) {
            setMessage('Нельзя изменить роль владельца проекта');
            setIsError(true);
            return;
        }
        if (member.role === 'OWNER') {
            setMessage('Нельзя изменить роль владельца проекта');
            setIsError(true);
            return;
        }
        if (member.userId === user.id) {
            setMessage('Нельзя изменить собственную роль');
            setIsError(true);
            return;
        }

        try {
            if (newRole === 'VIEWER') {
                const userId = member.userId;
                const subgroups = project.subgroups || [];
                const newCreatorId = user.id;

                for (const sg of subgroups) {
                    try {
                        const { data: tasksData } = await client.query({
                            query: GET_TASKS_BY_SUBGROUP,
                            variables: { subgroupId: sg.id },
                            fetchPolicy: 'network-only',
                        });
                        const tasks = tasksData?.tasksBySubgroup || [];

                        for (const task of tasks) {
                            if (task.assignees?.some(a => a.id === userId)) {
                                const newIds = task.assignees.filter(a => a.id !== userId).map(a => a.id);
                                try {
                                    await setTaskAssignees({ variables: { taskId: task.id, userIds: newIds } });
                                } catch (e) {
                                    console.error('Ошибка удаления из задачи', e);
                                }
                            }

                            if (task.createdBy?.id === userId) {
                                try {
                                    await updateTask({
                                        variables: {
                                            id: task.id,
                                            createdByUserId: newCreatorId,
                                        },
                                    });
                                } catch (e) {
                                    console.error('Ошибка передачи задачи', e);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Ошибка запроса задач подгруппы', e);
                    }
                }

                client.cache.evict({ fieldName: 'tasksBySubgroup' });
                client.cache.evict({ fieldName: 'tasksByAssignee' });
                client.cache.gc();

                for (const sg of subgroups) {
                    const sgMember = sg.members?.find(m => m.userId === userId);
                    if (sgMember) {
                        try {
                            await removeSubgroupMember({ variables: { id: sgMember.id } });
                        } catch (err) {
                            console.error('Ошибка удаления из подгруппы', err);
                        }
                    }
                }
            }

            await updateRole({ variables: { id: memberId, role: newRole } });
            await refetch();
            setMessage('Роль обновлена');
            setIsError(false);
        } catch (err) {
            setMessage(err.message);
            setIsError(true);
        }
    };

    const handleRemoveMember = (memberId) => {
        if (!isAdmin) {
            setMessage('У вас нет прав на удаление участников');
            setIsError(true);
            return;
        }
        setDeleteConfirm({ isOpen: true, memberId, isProject: false });
    };

    const confirmRemoveMember = async () => {
        const member = project.members.find(m => m.id === deleteConfirm.memberId);
        if (member?.role === 'OWNER') {
            setMessage('Нельзя удалить владельца проекта');
            setIsError(true);
            setDeleteConfirm({ isOpen: false, memberId: null, isProject: false });
            return;
        }
        await removeMember({ variables: { id: deleteConfirm.memberId } });
        await refetch();
        setMessage('Участник удалён');
        setIsError(false);
        setDeleteConfirm({ isOpen: false, memberId: null, isProject: false });
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!isAdmin) {
            setMessage('У вас нет прав на добавление участников');
            setIsError(true);
            return;
        }

        setSearchError('');
        if (!newMemberEmail.trim()) return;
        const allUsers = usersData?.users || [];
        const foundUser = allUsers.find(u => u.email.toLowerCase() === newMemberEmail.trim().toLowerCase());
        if (!foundUser) {
            setSearchError('Пользователь с таким email не найден');
            return;
        }
        if (project.members.some(m => m.userId === foundUser.id)) {
            setSearchError('Пользователь уже является участником проекта');
            return;
        }
        try {
            await addMember({ variables: { projectId, userId: foundUser.id, role: newMemberRole } });
            refetch();
            setNewMemberEmail('');
            setMessage('Участник добавлен');
            setIsError(false);
        } catch (err) {
            setMessage(err.message);
            setIsError(true);
        }
    };

    const handleDeleteProject = () => {
        if (!isAdmin) {
            setMessage('У вас нет прав на удаление проекта');
            setIsError(true);
            return;
        }
        setDeleteConfirm({ isOpen: true, isProject: true });
    };

    const confirmDeleteProject = async () => {
        await deleteProject({ variables: { id: projectId } });
        setDeleteConfirm({ isOpen: false, isProject: false });
    };

    const openRenameModal = () => {
        if (!isAdmin) {
            setMessage('У вас нет прав на переименование проекта');
            setIsError(true);
            return;
        }
        setNewProjectName(project.name);
        setRenameModalOpen(true);
    };

    const handleNotificationToggle = async () => {
        setIsUpdatingNotifications(true);
        const previousState = projectNotificationsEnabled;
        setProjectNotificationsEnabled(!previousState);

        try {
            await updateProjectNotifications({
                variables: {
                    projectId: projectId,
                    notificationsEnabled: !previousState
                }
            });
            setMessage(!previousState ? 'Уведомления для проекта включены' : 'Уведомления для проекта отключены');
            setIsError(false);
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            setProjectNotificationsEnabled(previousState);
            setMessage(err.message);
            setIsError(true);
        } finally {
            setIsUpdatingNotifications(false);
        }
    };

    const transliterateTitle = (title) => { const m = {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya","А":"A","Б":"B","В":"V","Г":"G","Д":"D","Е":"E","Ё":"Yo","Ж":"Zh","З":"Z","И":"I","Й":"Y","К":"K","Л":"L","М":"M","Н":"N","О":"O","П":"P","Р":"R","С":"S","Т":"T","У":"U","Ф":"F","Х":"H","Ц":"Ts","Ч":"Ch","Ш":"Sh","Щ":"Sch","Ъ":"","Ы":"Y","Ь":"","Э":"E","Ю":"Yu","Я":"Ya"}; return title.split("").map(c=>m[c]||c).join("").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+`$/g,"").slice(0,50); }; const handleExportProject = async () => {
        setIsExporting(true);
        try {
            const token = localStorage.getItem('jwtToken');
            const response = await fetch(`/api/export/project/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Export failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project_${projectId}_${transliterateTitle(project.name)}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Ошибка экспорта проекта: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <button className="modal-close--settings" onClick={() => navigate(-1)}>✕</button>
            <h2><i className="fas fa-cog"></i> Настройки проекта</h2>

            <div className="card">
                <h3><i className="fas fa-bell"></i> Уведомления</h3>
                <div className="form-group">
                    <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <label className="form-label" style={{ marginBottom: '4px' }}>
                                <i className="fas fa-envelope"></i> Email уведомления по проекту
                            </label>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                                Получать уведомления о задачах, изменениях и назначениях в этом проекте
                            </p>
                            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                                <i className="fas fa-info-circle"></i> Отключение здесь переопределяет глобальные настройки
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleNotificationToggle}
                            disabled={isUpdatingNotifications}
                            style={{
                                width: '52px',
                                height: '28px',
                                borderRadius: '28px',
                                backgroundColor: projectNotificationsEnabled ? '#22c55e' : '#cbd5e1',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                        >
                            <span style={{
                                position: 'absolute',
                                top: '3px',
                                left: projectNotificationsEnabled ? '27px' : '3px',
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: 'white',
                                transition: 'left 0.2s'
                            }} />
                        </button>
                    </div>
                </div>

                {isAdmin && (
                    <>
                        <div className="divider" />

                        <h3><i className="fas fa-pen"></i> Основное</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="project-name">Название проекта</label>
                            <input className="form-input" type="text" id="project-name" value={project.name} readOnly />
                        </div>
                        <div className="flex-row" style={{ gap: '12px', marginBottom: '20px' }}>
                            <button className="btn btn--secondary" onClick={openRenameModal}>
                                <i className="fas fa-edit"></i> Изменить название
                            </button>
                            <button className="btn btn--secondary" onClick={handleExportProject} disabled={isExporting}>
                                <i className="fas fa-download"></i> {isExporting ? 'Экспорт...' : 'Экспорт проекта'}
                            </button>
                        </div>

                        <div className="divider" />

                        <h3><i className="fas fa-users"></i> Участники</h3>
                        <div>
                            {project.members.map((m) => (
                                <div key={m.id} className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                                    <span>
                                        <strong>{m.user.fullName}</strong> ({m.user.email})
                                        <span className="badge-role">{m.role}</span>
                                        {m.userId === user.id && <span className="badge-role" style={{ background: '#22c55e', color: 'white' }}>Вы</span>}
                                    </span>
                                    <div className="flex-row">
                                        <select
                                            className="form-select"
                                            id={`role-select-${m.id}`}
                                            value={m.role}
                                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                                            style={{ width: 'auto' }}
                                            disabled={m.userId === project.owner.id || m.role === 'OWNER' || m.userId === user.id}
                                        >
                                            <option value="ADMIN">Админ</option>
                                            <option value="MEMBER">Участник</option>
                                            <option value="VIEWER">Наблюдатель</option>
                                        </select>
                                        <button
                                            className="btn btn--danger btn--small"
                                            onClick={() => handleRemoveMember(m.id)}
                                            disabled={m.userId === project.owner.id || m.role === 'OWNER' || m.userId === user.id}
                                        >
                                            <i className="fas fa-user-minus"></i> Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddMember} className="mt-4">
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-member-email">Добавить участника по email</label>
                                <div className="flex-row">
                                    <input className="form-input" type="email" id="new-member-email" value={newMemberEmail}
                                           onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="Email пользователя"
                                           style={{ flex: 2 }} />
                                    <select className="form-select" id="new-member-role" value={newMemberRole}
                                            onChange={(e) => setNewMemberRole(e.target.value)} style={{ flex: 1 }}>
                                        <option value="ADMIN">Админ</option>
                                        <option value="MEMBER">Участник</option>
                                        <option value="VIEWER">Наблюдатель</option>
                                    </select>
                                    <button type="submit" className="btn">
                                        <i className="fas fa-user-plus"></i> Добавить
                                    </button>
                                </div>
                                {searchError && <div className="message-error" style={{ marginTop: '8px' }}>{searchError}</div>}
                            </div>
                        </form>

                        <div className="divider" />

                        <button className="btn btn--danger" onClick={handleDeleteProject}>
                            <i className="fas fa-trash-alt"></i> Удалить проект
                        </button>
                    </>
                )}

                {!isAdmin && isMember && (
                    <div className="info-message" style={{ marginTop: '20px', padding: '16px', background: '#f0fdf4', borderRadius: '12px', color: '#166534' }}>
                        <i className="fas fa-info-circle"></i> Вы участник проекта. Для управления проектом обратитесь к администратору.
                    </div>
                )}

                {message && <div className={`mt-4 ${isError ? 'message-error' : 'message-success'}`}>{message}</div>}
            </div>

            {renameModalOpen && (
                <div className="modal-overlay" onClick={() => setRenameModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setRenameModalOpen(false)}>✕</button>
                        <h3><i className="fas fa-edit"></i> Переименовать проект</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="rename-project-name">Название проекта</label>
                            <input
                                className="form-input"
                                type="text"
                                id="rename-project-name"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <button className="btn btn--secondary" onClick={() => setRenameModalOpen(false)}>
                                <i className="fas fa-times"></i> Отмена
                            </button>
                            <button className="btn" onClick={handleUpdateName}>
                                <i className="fas fa-save"></i> Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title={deleteConfirm.isProject ? "Удаление проекта" : "Удаление участника"}
                message={deleteConfirm.isProject
                    ? "Вы действительно хотите удалить проект? Все данные будут потеряны."
                    : "Вы действительно хотите удалить этого участника из проекта?"}
                onConfirm={deleteConfirm.isProject ? confirmDeleteProject : confirmRemoveMember}
                onCancel={() => setDeleteConfirm({ isOpen: false, memberId: null, isProject: false })}
            />
        </div>
    );
};

export default ProjectSettings;


