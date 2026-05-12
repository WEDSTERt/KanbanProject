import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_SUBGROUP } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';

const CreateSubgroupModal = ({ projectId, existingSubgroups, onClose, onCreated }) => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [createSubgroup] = useMutation(CREATE_SUBGROUP);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const trimmed = name.trim();
        if (!trimmed) return;
        if (existingSubgroups.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) {
            setError('Группа с таким названием уже существует в этом проекте');
            return;
        }
        try {
            await createSubgroup({ variables: { projectId, name: trimmed, creatorUserId: user.id } });
            onCreated();
            onClose();
        } catch (err) {
            console.error('Ошибка создания подгруппы:', err);
            setError(err.message);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>
                <h3>Создать новую группу</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="subgroup-name">Название группы</label>
                        <input className="form-input" type="text" id="subgroup-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
                    </div>
                    {error && <div className="message-error">{error}</div>}
                    <div className="modal-actions">
                        <button type="button" className="btn btn--secondary" onClick={onClose}>
                            <i className="fas fa-times"></i> Отмена
                        </button>
                        <button type="submit" className="btn">
                            <i className="fas fa-plus"></i> Создать
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateSubgroupModal;