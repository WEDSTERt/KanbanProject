import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { GET_PROJECT_DETAILS } from '../graphql/queries';
import {
    UPDATE_SUBGROUP,
    ADD_SUBGROUP_MEMBER,
    UPDATE_SUBGROUP_MEMBER,
    REMOVE_SUBGROUP_MEMBER,
} from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from './ConfirmModal';

const SubgroupSettingsModal = ({ subgroup, projectId, isOwner, onClose, onUpdate, onDelete }) => {
    const { user } = useAuth();
    const [name, setName] = useState(subgroup.name);
    const [members, setMembers] = useState(subgroup.members || []);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedRole, setSelectedRole] = useState('MEMBER');
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, memberId: null });

    const { data: projectData } = useQuery(GET_PROJECT_DETAILS, { variables: { projectId } });

    const [updateSubgroup] = useMutation(UPDATE_SUBGROUP);
    const [addMember] = useMutation(ADD_SUBGROUP_MEMBER);
    const [updateMember] = useMutation(UPDATE_SUBGROUP_MEMBER);
    const [removeMember] = useMutation(REMOVE_SUBGROUP_MEMBER);

    useEffect(() => {
        setMembers(subgroup.members || []);
    }, [subgroup]);

    const projectMembers = projectData?.project?.members || [];
    const availableMembers = projectMembers.filter(pm => !members.some(m => m.userId === pm.userId));

    const canManage = isOwner || subgroup.members.some(m => m.userId === user.id && m.role === 'LEADER');

    const handleUpdateName = async () => {
        if (!name.trim()) return;
        await updateSubgroup({ variables: { id: subgroup.id, name } });
        onUpdate();
    };

    const handleAddMember = async () => {
        if (!selectedUserId) return;
        try {
            const { data } = await addMember({
                variables: { subgroupId: subgroup.id, userId: selectedUserId, role: selectedRole },
            });
            const newMember = data.addSubgroupMember;
            const userInfo = projectMembers.find(m => m.userId === selectedUserId)?.user || { fullName: 'Unknown' };
            setMembers([...members, { ...newMember, user: userInfo }]);
            setSelectedUserId('');
            onUpdate();
        } catch (err) {
            console.error(err);
            alert('Ошибка добавления участника: ' + err.message);
        }
    };

    const handleRoleChange = async (memberId, newRole) => {
        await updateMember({ variables: { id: memberId, role: newRole } });
        setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
        onUpdate();
    };

    const handleRemoveMember = (memberId) => setDeleteConfirm({ isOpen: true, memberId });
    const confirmRemoveMember = async () => {
        await removeMember({ variables: { id: deleteConfirm.memberId } });
        setMembers(members.filter(m => m.id !== deleteConfirm.memberId));
        setDeleteConfirm({ isOpen: false, memberId: null });
        onUpdate();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>
                <h3>Настройки группы: {subgroup.name}</h3>

                <div className="form-group">
                    <label className="form-label" htmlFor="subgroup-name">Название группы</label>
                    <div className="flex-row" style={{ gap: '8px' }}>
                        <input
                            className="form-input"
                            type="text"
                            id="subgroup-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <button className="btn btn--secondary btn--small" onClick={handleUpdateName}>
                            <i className="fas fa-save"></i> Сохранить
                        </button>
                    </div>
                </div>

                <div className="form-group">
                    <div className="form-label">Участники</div>
                    <ul className="member-list">
                        {members.map(m => (
                            <li key={m.id} className="member-item">
                                <span>{m.user?.fullName || 'Unknown'} ({m.role})</span>
                                {canManage && m.userId !== user.id && (
                                    <div className="flex-row">
                                        <select
                                            className="form-select"
                                            id={`member-role-${m.id}`}
                                            name="member-role"
                                            value={m.role}
                                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                                            style={{ width: 'auto' }}
                                        >
                                            <option value="LEADER">Лидер</option>
                                            <option value="MEMBER">Участник</option>
                                        </select>
                                        <button className="btn btn--danger btn--small" onClick={() => handleRemoveMember(m.id)}>
                                            <i className="fas fa-user-minus"></i> Удалить
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>

                    {canManage && (
                        <div className="flex-row" style={{ marginTop: '12px', gap: '8px' }}>
                            <select
                                className="form-select"
                                id="subgroup-add-member"
                                name="new-member"
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                style={{ flex: 2 }}
                            >
                                <option value="">Выберите участника</option>
                                {availableMembers.map(m => (
                                    <option key={m.userId} value={m.userId}>{m.user.fullName}</option>
                                ))}
                            </select>
                            <select
                                className="form-select"
                                id="subgroup-member-role"
                                name="member-role-new"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                style={{ flex: 1 }}
                            >
                                <option value="LEADER">Лидер</option>
                                <option value="MEMBER">Участник</option>
                            </select>
                            <button className="btn" onClick={handleAddMember}>
                                <i className="fas fa-user-plus"></i> Добавить
                            </button>
                        </div>
                    )}
                </div>

                    <div className="flex-row" style={{ marginTop: '20px', justifyContent: 'space-between' }}>
                        {isOwner && (
                            <button className="btn btn--danger" onClick={() => { onDelete(); onClose(); }}>
                                <i className="fas fa-trash-alt"></i> Удалить группу
                            </button>
                        )}
                        <button className="btn btn--secondary" onClick={onClose}>
                            <i className="fas fa-times"></i> Закрыть
                        </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="Удаление участника"
                message="Вы действительно хотите удалить этого участника из группы?"
                onConfirm={confirmRemoveMember}
                onCancel={() => setDeleteConfirm({ isOpen: false, memberId: null })}
            />
        </div>
    );
};

export default SubgroupSettingsModal;