import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_SUBGROUPS_BY_PROJECT } from '../graphql/queries';
import { DELETE_SUBGROUP } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import SubgroupSettingsModal from './SubgroupSettingsModal';
import CreateSubgroupModal from './CreateSubgroupModal';
import ConfirmModal from './ConfirmModal';

const SubgroupsPanel = ({ projectId, activeSubgroupId, onSelectSubgroup, isOwner, projectMembers, onRefreshProject }) => {
    const { user } = useAuth();
    const [showSettingsFor, setShowSettingsFor] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, groupId: null });

    const { loading, error, data, refetch } = useQuery(GET_SUBGROUPS_BY_PROJECT, { variables: { projectId } });
    const [deleteSubgroup] = useMutation(DELETE_SUBGROUP, { onCompleted: () => refetch() });

    if (loading) return <div className="loading">Загрузка групп...</div>;
    if (error) return <div className="message-error">{error.message}</div>;

    const allSubgroups = data?.subgroupsByProject || [];
    const isAdmin = projectMembers?.some(m => m.userId === user.id && (m.role === 'ADMIN' || m.role === 'OWNER')) || false;
    const visibleSubgroups = (isOwner || isAdmin)
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
        if (isOwner) return true;
        const member = group.members?.find(m => m.userId === user.id);
        return member?.role === 'LEADER';
    };

    return (
        <div className="groups-panel">
            <div className="groups-header">
                <h3><i className="fas fa-layer-group"></i> Группы</h3>
                {(isOwner || isAdmin) && (
                    <button className="groups-add-btn" onClick={() => setShowCreateModal(true)}>
                        <i className="fas fa-plus"></i>
                    </button>
                )}
            </div>
            <ul className="groups-list">
                <li className={`groups-item ${activeSubgroupId === 'my-tasks' ? 'groups-item--active' : ''} groups-item--my-tasks`} onClick={() => onSelectSubgroup('my-tasks')}>
                    <i className="fas fa-user-check"></i> <span>Мои задачи</span>
                </li>
                {visibleSubgroups.map((group) => (
                    <li key={group.id} className={`groups-item ${activeSubgroupId === group.id ? 'groups-item--active' : ''}`} onClick={() => onSelectSubgroup(group.id)}>
                        <i className="fas fa-folder"></i> <span>{group.name}</span>
                        {canManageGroup(group) && (
                            <button className="groups-settings-btn" onClick={(e) => { e.stopPropagation(); setShowSettingsFor(group); }}>
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
                    onUpdate={() => { refetch(); onSelectSubgroup(showSettingsFor.id); if (onRefreshProject) onRefreshProject(); }}
                    onDelete={() => handleDeleteGroup(showSettingsFor.id)}
                />
            )}
            {showCreateModal && (
                <CreateSubgroupModal
                    projectId={projectId}
                    existingSubgroups={allSubgroups}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => { refetch(); if (onRefreshProject) onRefreshProject(); }}
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