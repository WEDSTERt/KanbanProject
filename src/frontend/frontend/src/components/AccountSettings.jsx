import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_USER, DELETE_USER, LOGIN } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';
import { validateFullName, validatePassword } from '../utils/validation';

const AccountSettings = () => {
    const { user, loading, login, logout } = useAuth();
    const navigate = useNavigate();
    const [fullName, setFullName] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [message, setMessage] = useState(null);
    const [isError, setIsError] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        if (user) setFullName(user.fullName || '');
    }, [user]);

    const [updateUser] = useMutation(UPDATE_USER);
    const [deleteUser] = useMutation(DELETE_USER, {
        onCompleted: () => { logout(); navigate('/login'); },
        onError: (err) => { setMessage(err.message); setIsError(true); },
    });
    const [checkLogin] = useMutation(LOGIN);

    if (loading) return <div className="loading">Загрузка...</div>;
    if (!user) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setValidationError('');
        setMessage(null);

        // Валидация имени
        const nameValidation = validateFullName(fullName);
        if (!nameValidation.isValid) {
            setValidationError(nameValidation.error);
            return;
        }

        // Если новый пароль указан, проверяем старый
        if (newPassword) {
            const passValidation = validatePassword(newPassword);
            if (!passValidation.isValid) {
                setValidationError(passValidation.error);
                return;
            }
            if (!oldPassword) {
                setValidationError('Для смены пароля введите текущий пароль');
                return;
            }
            // Проверяем старый пароль через логин
            try {
                await checkLogin({ variables: { email: user.email, password: oldPassword } });
            } catch (err) {
                setValidationError('Неверный текущий пароль');
                return;
            }
        }

        try {
            const variables = { id: user.id, fullName: fullName.trim() };
            if (newPassword) variables.password = newPassword;
            const { data } = await updateUser({ variables });
            login(data.updateUser);
            setMessage('Профиль обновлён');
            setIsError(false);
            setOldPassword('');
            setNewPassword('');
        } catch (err) {
            setMessage(err.message);
            setIsError(true);
        }
    };

    const handleDeleteAccount = () => deleteUser({ variables: { id: user.id } });

    return (
        <div className="account-settings-container">
            <div className="card account-settings-card">
                <button className="modal-close--settings" onClick={() => navigate(-1)}>✕</button>
                <h2><i className="fas fa-user-cog"></i> Настройки профиля</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="account-fullname">Имя пользователя (Имя Фамилия)</label>
                        <input
                            className="form-input"
                            type="text"
                            id="account-fullname"
                            placeholder="Иван Иванов"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="account-old-password">Текущий пароль (обязателен для смены пароля)</label>
                        <div className="password-row">
                            <input
                                className="form-input"
                                type={showOldPassword ? 'text' : 'password'}
                                id="account-old-password"
                                placeholder="••••••••"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowOldPassword(!showOldPassword)}
                            >
                                <i className={showOldPassword ? 'fas fa-eye' : 'fas fa-eye-slash'}></i>
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="account-new-password">Новый пароль (оставьте пустым, чтобы не менять)</label>
                        <div className="password-row">
                            <input
                                className="form-input"
                                type={showNewPassword ? 'text' : 'password'}
                                id="account-new-password"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                                <i className={showNewPassword ? 'fas fa-eye' : 'fas fa-eye-slash'}></i>
                            </button>
                        </div>
                    </div>

                    {validationError && <div className="message-error">{validationError}</div>}
                    {message && <div className={isError ? 'message-error' : 'message-success'}>{message}</div>}

                    <div className="form-actions">
                        <button type="submit" className="btn">Сохранить изменения</button>
                        <button type="button" className="btn btn--danger" onClick={() => setShowDeleteConfirm(true)}>Удалить аккаунт</button>
                    </div>
                </form>
            </div>
            <ConfirmModal
                isOpen={showDeleteConfirm}
                title="Удаление аккаунта"
                message="Вы действительно хотите удалить свой аккаунт? Это действие необратимо. Все ваши проекты и задачи будут удалены."
                onConfirm={handleDeleteAccount}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
};

export default AccountSettings;