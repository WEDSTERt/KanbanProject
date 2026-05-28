import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { GET_SUBGROUPS_BY_PROJECT } from '../graphql/queries';
import { DELETE_SUBGROUP } from '../graphql/mutations';
import { PROJECT_UPDATED_SUBSCRIPTION } from '../graphql/subscriptions';
import { useAuth } from '../contexts/AuthContext';
import { useSSE } from '../contexts/SSEContext';
import SubgroupSettingsModal from './SubgroupSettingsModal';
import CreateSubgroupModal from './CreateSubgroupModal';
import ConfirmModal from './ConfirmModal';

const SubgroupsPanel = ({
                            projectId,
                            activeSubgroupId,
                            onSelectSubgroup,
                            isOwner,
                            projectMembers,
                            onRefreshProject
                        }) => {
    const { user } = useAuth();
    const { subscribe } = useSSE();
    const [showSettingsFor, setShowSettingsFor] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, groupId: null });
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);
    const refetchRef = useRef(null);

    // Query БЕЗ polling (только начальная загрузка)
    const { loading, error, data, refetch } = useQuery(GET_SUBGROUPS_BY_PROJECT, {
        variables: { projectId },
        fetchPolicy: 'cache-and-network',
        pollInterval: 0, // ❌ ОТКЛЮЧЕН polling
    });

    // Сохраняем refetch в ref чтобы использовать в SSE callback
    useEffect(() => {
        refetchRef.current = refetch;
    }, [refetch]);
    
    const [deleteSubgroup] = useMutation(DELETE_SUBGROUP, { onCompleted: () => refetch() });

    // 🔄 Подписка на обновления групп (через обновления проектов, если WebSocket работает)
    const { data: projectUpdateData } = useSubscription(PROJECT_UPDATED_SUBSCRIPTION, {
        skip: !projectId,
        onError: (err) => {
            console.warn('⚠️ Project subscription error (using SSE):', err.message);
        },
    });

    // Обновить группы когда пришло обновление через subscription
    useEffect(() => {
        if (projectUpdateData?.projectUpdated) {
            console.log('📨 Project updated via subscription, refreshing subgroups:', projectUpdateData.projectUpdated);
            refetch();
        }
    }, [projectUpdateData, refetch]);

    // 🆕 SSE подписка на изменения подгрупп (используем глобальный контекст)
    useEffect(() => {
        if (!user?.id || !projectId) return;

        console.log('🎯 SubgroupsPanel subscribing to SSE events for project', projectId);

        // Подписываемся на события subgroups-changed для конкретного проекта
        const unsubscribeSubgroups = subscribe('subgroups-changed', (data) => {
            console.log('📬 SubgroupsPanel received subgroups-changed event via SSE:', data);
            console.log('Calling refetch from refetchRef:', refetchRef.current);
            if (refetchRef.current) {
                refetchRef.current();
            }
        });

        // Подписываемся на события projects-changed (для обновления членов проекта)
        const unsubscribeProjects = subscribe('projects-changed', (data) => {
            console.log('📬 SubgroupsPanel received projects-changed event via SSE:', data);
            if (onRefreshProject) onRefreshProject();
        });

        // Очищаем подписку при размонтировании
        return () => {
            console.log('🔌 SubgroupsPanel unsubscribing from SSE events');
            unsubscribeSubgroups();
            unsubscribeProjects();
        };
    }, [user?.id, projectId, subscribe, onRefreshProject]);

    if (loading) return <div className="loading">Загрузка групп...</div>;
    if (error) return <div className="message-error">{error.message}</div>;

    const allSubgroups = data?.subgroupsByProject || [];
    const currentMember = projectMembers?.find(m => m.userId === user.id);
    const isViewer = currentMember?.role === 'VIEWER';
    const isAdmin = currentMember?.role === 'ADMIN' || currentMember?.role === 'OWNER' || isOwner;
    const visibleSubgroups = (isOwner || isAdmin || isViewer)
        ? allSubgroups
        : allSubgroups.filter(group => group.members?.some(m => m.userId === user.id));

    const handleDeleteGroup = (groupId) => setDeleteConfirm({ isOpen: true, groupId });
    const confirmDeleteGroup = async () => {
        await deleteSubgroup({ variables: { id: deleteConfirm.groupId } });
        if (activeSubgroupId === deleteConfirm.groupId) onSelectSubgroup(null);
        refetch();
        setDeleteConfirm({ isOpen: false, groupId: null });
    };

    const canManageGroup = (group) => {
        if (isViewer) return false;
        if (isOwner) return true;
        const member = group.members?.find(m => m.userId === user.id);
        return member?.role === 'LEADER';
    };

    const handleImportSubgroup = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setIsImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = localStorage.getItem('jwtToken');
            const response = await fetch(`/api/import/subgroup/${projectId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Import failed');
            }
            const data = await response.json();
            alert(`Группа "${data.name}" успешно импортирована`);
            await refetch();
            if (onRefreshProject) onRefreshProject();
            // Переключаемся на импортированную группу
            onSelectSubgroup(data.id);
        } catch (err) {
            console.error(err);
            alert('Ошибка импорта группы: ' + err.message);
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };

    return (
        <div className="groups-panel">
            <div className="groups-header">
                <h3><i className="fas fa-layer-group"></i> Группы</h3>
                <div className="flex-row" style={{ gap: '8px' }}>
                    {(isOwner || isAdmin) && (
                        <>
                            <button className="groups-add-btn" onClick={() => setShowCreateModal(true)} title="Создать группу">
                                <i className="fas fa-plus"></i>
                            </button>
                            <button
                                className="groups-add-btn"
                                onClick={() => fileInputRef.current.click()}
                                disabled={isImporting}
                                title="Импортировать группу из ZIP"
                            >
                                <i className="fas fa-upload"></i>
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".zip"
                                style={{ display: 'none' }}
                                onChange={handleImportSubgroup}
                            />
                        </>
                    )}
                </div>
            </div>
            <ul className="groups-list">
                <li className={`groups-item ${activeSubgroupId === 'my-tasks' ? 'groups-item--active' : ''} groups-item--my-tasks`}
                    onClick={() => onSelectSubgroup('my-tasks')}>
                    <i className="fas fa-user-check"></i> <span>Мои задачи</span>
                </li>
                {visibleSubgroups.map((group) => (
                    <li key={group.id}
                        className={`groups-item ${activeSubgroupId === group.id ? 'groups-item--active' : ''}`}
                        onClick={() => onSelectSubgroup(group.id)}>
                        <i className="fas fa-folder"></i> <span>{group.name}</span>
                        {canManageGroup(group) && (
                            <button className="groups-settings-btn" onClick={(e) => {
                                e.stopPropagation();
                                setShowSettingsFor(group);
                            }}>
                                <i className="fas fa-cog"></i>
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            {showSettingsFor && (
                <SubgroupSettingsModal
                    subgroup={showSettingsFor}
                    projectId={projectId}
                    isOwner={isOwner}
                    onClose={() => setShowSettingsFor(null)}
                    onUpdate={() => {
                        refetch();
                        onSelectSubgroup(showSettingsFor.id);
                        if (onRefreshProject) onRefreshProject();
                    }}
                    onDelete={() => handleDeleteGroup(showSettingsFor.id)}
                />
            )}
            {showCreateModal && (
                <CreateSubgroupModal
                    projectId={projectId}
                    existingSubgroups={allSubgroups}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => {
                        refetch();
                        if (onRefreshProject) onRefreshProject();
                    }}
                />
            )}
            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="Удаление группы"
                message="Удалить группу? Все задачи внутри также будут удалены."
                onConfirm={confirmDeleteGroup}
                onCancel={() => setDeleteConfirm({ isOpen: false, groupId: null })}
            />
        </div>
    );
};

export default SubgroupsPanel;
