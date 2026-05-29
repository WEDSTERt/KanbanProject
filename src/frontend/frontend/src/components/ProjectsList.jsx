import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { GET_USER_PROJECTS } from '../graphql/queries';
import { CREATE_PROJECT } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import { useSSE } from '../contexts/SSEContext';

const ProjectsList = () => {
    const { user } = useAuth();
    const { subscribe, isReady } = useSSE();
    const navigate = useNavigate();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);
    const refetchRef = useRef(null);

    // Query БЕЗ polling (только начальная загрузка)
    const { loading, error, data, refetch } = useQuery(GET_USER_PROJECTS, {
        variables: { userId: user.id },
        fetchPolicy: 'cache-and-network',
        pollInterval: 0, // ❌ ОТКЛЮЧЕН polling
    });

    // Сохраняем refetch в ref чтобы использовать в SSE callback
    useEffect(() => {
        refetchRef.current = refetch;
    }, [refetch]);

    const [createProject] = useMutation(CREATE_PROJECT);

    // 🆕 SSE подписка на изменения проектов (используем глобальный контекст)
    // ✅ ИСПРАВЛЕНИЕ: Ждем когда SSE будет готов (isReady = true)
    useEffect(() => {
        if (!user?.id || !isReady) {
            console.log('⏳ ProjectsList: Waiting for SSE to be ready... (user:', user?.id, ', isReady:', isReady, ')');
            return;
        }

        console.log('🎯 ProjectsList subscribing to SSE events');

        // Подписываемся на события projects-changed
        const unsubscribeProjects = subscribe('projects-changed', (data) => {
            console.log('📬 ProjectsList received projects-changed event via SSE:', data);
            console.log('Calling refetch from refetchRef:', refetchRef.current);
            if (refetchRef.current) {
                refetchRef.current();
            }
        });

        // Подписываемся на события project-removed (когда пользователя удалили из проекта)
        const unsubscribeRemoved = subscribe('project-removed', (data) => {
            console.log('📬 ProjectsList received project-removed event via SSE:', data);
            console.log('Calling refetch from refetchRef:', refetchRef.current);
            if (refetchRef.current) {
                refetchRef.current();
            }
        });

        // Очищаем подписки при размонтировании
        return () => {
            console.log('🔌 ProjectsList unsubscribing from SSE events');
            unsubscribeProjects();
            unsubscribeRemoved();
        };
    }, [user?.id, isReady, subscribe]);

    useEffect(() => {
        document.body.style.overflow = showCreateModal ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [showCreateModal]);

    useEffect(() => {
        if (user) {
            refetch();
        }
    }, [user, refetch]);

    if (loading) return <div className="loading">Загрузка проектов...</div>;
    if (error) return <div className="message-error">Ошибка: {error.message}</div>;

    const projectsMap = new Map();
    [...(data.owned || []), ...(data.member || [])].forEach(p => projectsMap.set(p.id, p));
    const projects = Array.from(projectsMap.values());

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!projectName.trim()) return;
        try {
            await createProject({ variables: { name: projectName, ownerUserId: user.id } });
            setShowCreateModal(false);
            setProjectName('');
            refetch();
        } catch (err) {
            alert(`Ошибка создания: ${err.message}`);
        }
    };

    const handleOpenBoard = (projectId) => {
        navigate(`/board?projectId=${projectId}&subgroupId=my-tasks`);
    };

    const handleOpenSettings = (projectId) => {
        navigate(`/settings?projectId=${projectId}`);
    };

    const handleImportProject = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setIsImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = localStorage.getItem('jwtToken');
            const response = await fetch('/api/import/project', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Import failed');
            }
            const importedProject = await response.json();
            alert(`Проект "${importedProject.name}" успешно импортирован`);
            await refetch();
            navigate(`/board?projectId=${importedProject.id}&subgroupId=my-tasks`);
        } catch (err) {
            console.error(err);
            alert('Ошибка импорта проекта: ' + err.message);
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };

    const modalOverlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, margin: 0, padding: 0,
    };
    const modalContentStyle = {
        backgroundColor: 'white', padding: '24px', borderRadius: '12px',
        minWidth: '320px', maxWidth: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        zIndex: 100000,
    };

    const Modal = () => createPortal(
        <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <h3><i className="fas fa-plus-circle"></i> Новый проект</h3>
                <form onSubmit={handleCreateSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="project-name">Название проекта</label>
                        <input
                            className="form-input"
                            type="text"
                            id="project-name"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="flex-row" style={{ justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                        <button type="button" className="btn btn--secondary" onClick={() => setShowCreateModal(false)}>
                            <i className="fas fa-times"></i> Отмена
                        </button>
                        <button type="submit" className="btn">
                            <i className="fas fa-check"></i> Создать
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );

    const boardButtonStyle = {
        background: '#5568d3',
        fontWeight: 600,
        fontSize: '15px',
        padding: '12px 20px',
        transition: 'all 0.3s ease',
        border: 'none',
        borderRadius: '8px',
        color: 'white',
        cursor: 'pointer',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    };

    const settingsButtonStyle = {
        background: '#6c757d',
        fontWeight: 600,
        fontSize: '15px',
        padding: '12px 16px',
        transition: 'all 0.3s ease',
        border: 'none',
        borderRadius: '8px',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    };

    const handleBoardMouseEnter = (e) => {
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.background = '#4556c0';
    };

    const handleBoardMouseLeave = (e) => {
        e.target.style.transform = 'translateY(0)';
        e.target.style.background = '#5568d3';
    };

    const handleSettingsMouseEnter = (e) => {
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.background = '#5a626d';
    };

    const handleSettingsMouseLeave = (e) => {
        e.target.style.transform = 'translateY(0)';
        e.target.style.background = '#6c757d';
    };

    return (
        <>
            <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0 }}><i className="fas fa-folder-open"></i> Мои проекты</h2>
                <div className="flex-row" style={{ gap: '12px' }}>
                    <button className="btn" onClick={() => setShowCreateModal(true)}>
                        <i className="fas fa-plus"></i> Создать проект
                    </button>
                    <button
                        className="btn btn--secondary"
                        onClick={() => fileInputRef.current.click()}
                        disabled={isImporting}
                    >
                        <i className="fas fa-upload"></i> {isImporting ? 'Импорт...' : 'Импорт проекта'}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".zip"
                        style={{ display: 'none' }}
                        onChange={handleImportProject}
                    />
                </div>
            </div>
            {projects.length === 0 ? (
                <p>У вас пока нет проектов. Нажмите «Создать проект» или «Импорт проекта».</p>
            ) : (
                <div className="grid-2">
                    {projects.map((proj) => {
                        const isOwner = proj.owner.id === user.id;
                        const memberEntry = proj.members.find(m => m.userId === user.id);
                        const role = memberEntry?.role || (isOwner ? 'OWNER' : 'MEMBER');
                        const canViewSettings = role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';

                        return (
                            <div className="project-card" key={proj.id}>
                                <h3><i className="fas fa-chalkboard"></i> {proj.name}</h3>
                                <p><i className="fas fa-crown"></i> Владелец: {proj.owner.fullName}</p>
                                <p><i className="fas fa-users"></i> Участников: {proj.members.length}</p>
                                <p><i className="fas fa-tag"></i> Ваша роль: {role === 'OWNER' ? 'Владелец' : role === 'ADMIN' ? 'Администратор' : role === 'MEMBER' ? 'Участник' : 'Наблюдатель'}</p>
                                <div className="flex-row mt-4" style={{ gap: '12px' }}>
                                    <button
                                        style={boardButtonStyle}
                                        onClick={() => handleOpenBoard(proj.id)}
                                        onMouseEnter={handleBoardMouseEnter}
                                        onMouseLeave={handleBoardMouseLeave}
                                    >
                                        <i className="fas fa-chalkboard"></i> Открыть доску
                                    </button>
                                    {canViewSettings && (
                                        <button
                                            style={settingsButtonStyle}
                                            onClick={() => handleOpenSettings(proj.id)}
                                            onMouseEnter={handleSettingsMouseEnter}
                                            onMouseLeave={handleSettingsMouseLeave}
                                        >
                                            <i className="fas fa-cog"></i> Настройки
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {showCreateModal && <Modal />}
        </>
    );
};

export default ProjectsList;
