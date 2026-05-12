import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { GET_USER_PROJECTS } from '../graphql/queries';
import { CREATE_PROJECT } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';

const ProjectsList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [projectName, setProjectName] = useState('');

    const { loading, error, data, refetch } = useQuery(GET_USER_PROJECTS, {
        variables: { userId: user.id },
    });

    const [createProject] = useMutation(CREATE_PROJECT);

    useEffect(() => {
        document.body.style.overflow = showCreateModal ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [showCreateModal]);

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

    return (
        <>
            <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h2><i className="fas fa-folder-open"></i> Мои проекты</h2>
                <button className="btn" onClick={() => setShowCreateModal(true)}>
                    <i className="fas fa-plus"></i> Создать проект
                </button>
            </div>
            {projects.length === 0 ? (
                <p>У вас пока нет проектов. Нажмите «Создать проект».</p>
            ) : (
                <div className="grid-2">
                    {projects.map((proj) => {
                        const isOwner = proj.owner.id === user.id;
                        const memberEntry = proj.members.find(m => m.userId === user.id);
                        const role = memberEntry?.role || (isOwner ? 'OWNER' : 'MEMBER');
                        const canEdit = role === 'OWNER' || role === 'ADMIN';
                        return (
                            <div className="project-card" key={proj.id}>
                                <h3><i className="fas fa-chalkboard"></i> {proj.name}</h3>
                                <p><i className="fas fa-crown"></i> Владелец: {proj.owner.fullName}</p>
                                <p><i className="fas fa-users"></i> Участников: {proj.members.length}</p>
                                <div className="flex-row mt-4">
                                    <button className="btn btn--secondary btn--small" onClick={() => handleOpenBoard(proj.id)}>
                                        <i className="fas fa-chalkboard"></i> Открыть доску
                                    </button>
                                    {canEdit && (
                                        <button className="btn btn--small" onClick={() => navigate(`/settings?projectId=${proj.id}`, { state: { from: '/' } })}>
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