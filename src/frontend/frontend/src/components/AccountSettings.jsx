import React, {useState, useEffect} from 'react';
import {useMutation} from '@apollo/client';
import {UPDATE_USER, DELETE_USER} from '../graphql/mutations';
import {useAuth} from '../contexts/AuthContext';
import {useNavigate} from 'react-router-dom';
import ConfirmModal from './ConfirmModal';
import {validateFullName, validatePassword} from '../utils/validation';
import { useApolloClient } from '@apollo/client';

const AccountSettings = () => {
    const {user, loading, updateEmailNotifications, logout} = useAuth();
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
    const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(user?.emailNotificationsEnabled !== false);
    const [notificationMessage, setNotificationMessage] = useState(null);
    const [isNotificationUpdating, setIsNotificationUpdating] = useState(false);
    const client = useApolloClient();

    const [deleteUser] = useMutation(DELETE_USER, {
        onCompleted: () => {
            client.resetStore().then(() => {
                logout();
                navigate('/login');
            });
        },
        onError: (err) => {
            setMessage(err.message);
            setIsError(true);
        },
    });

    const [updateUser] = useMutation(UPDATE_USER);

    useEffect(() => {
        if (user) {
            setFullName(user.fullName || '');
            setEmailNotificationsEnabled(user.emailNotificationsEnabled !== false);
        }
    }, [user]);

    if (loading) return <div className="loading">Загрузка...</div>;
    if (!user) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setValidationError('');
        setMessage(null);

        const nameValidation = validateFullName(fullName);
        if (!nameValidation.isValid) {
            setValidationError(nameValidation.error);
            return;
        }

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
        }

        try {
            const variables = {id: user.id, fullName: fullName.trim()};
            if (newPassword) variables.password = newPassword;
            const {data} = await updateUser({variables});
            setMessage('Профиль обновлён');
            setIsError(false);
            setOldPassword('');
            setNewPassword('');
            window.location.reload();
        } catch (err) {
            setMessage(err.message);
            setIsError(true);
        }
    };

    const handleDeleteAccount = () => deleteUser({variables: {id: user.id}});

    const handleNotificationToggle = async () => {
        setIsNotificationUpdating(true);
        setNotificationMessage(null);
        const previousState = emailNotificationsEnabled;
        setEmailNotificationsEnabled(!previousState);

        try {
            const newValue = !previousState;
            await updateEmailNotifications(newValue);
            setNotificationMessage(newValue ? '✅ Email уведомления включены' : '🔕 Email уведомления отключены');
            setTimeout(() => setNotificationMessage(null), 3000);
        } catch (err) {
            setEmailNotificationsEnabled(previousState);
            setNotificationMessage(err.message);
            setIsError(true);
            setTimeout(() => setNotificationMessage(null), 3000);
        } finally {
            setIsNotificationUpdating(false);
        }
    };

    return (
        <div className="account-settings-container">
            <div className="card account-settings-card">
                <button className="modal-close--settings" onClick={() => navigate(-1)}>✕</button>
                <h2><i className="fas fa-user-cog"></i> Настройки профиля</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="account-email">Email</label>
                        <input
                            className="form-input"
                            type="email"
                            id="account-email"
                            value={user.email || ''}
                            disabled
                            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', opacity: 0.7 }}
                        />
                    </div>

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

                    {/* Переключатель email уведомлений - ВСЁ В ОДНОЙ СТРОКЕ */}
                    <div className="form-group">
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%'
                        }}>
                            <div>
                                <div style={{ fontWeight: '500', marginBottom: '4px', fontSize: '14px' }}>
                                    <i className="fas fa-envelope"></i> Email уведомления
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    Получать уведомления о новых задачах, изменениях и назначениях на почту
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleNotificationToggle}
                                disabled={isNotificationUpdating}
                                style={{
                                    width: '52px',
                                    height: '28px',
                                    borderRadius: '28px',
                                    backgroundColor: emailNotificationsEnabled ? '#22c55e' : '#cbd5e1',
                                    border: 'none',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    transition: 'all 0.2s',
                                    flexShrink: 0,
                                    marginLeft: '16px'
                                }}
                            >
                                <span style={{
                                    position: 'absolute',
                                    top: '3px',
                                    left: emailNotificationsEnabled ? '27px' : '3px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    backgroundColor: 'white',
                                    transition: 'left 0.2s'
                                }} />
                            </button>
                        </div>
                    </div>

                    {validationError && <div className="message-error">{validationError}</div>}
                    {message && <div className={isError ? 'message-error' : 'message-success'}>{message}</div>}
                    {notificationMessage && (
                        <div className={notificationMessage.includes('✅') || notificationMessage.includes('включены') ? 'message-success' : 'message-error'}>
                            {notificationMessage}
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="submit" className="btn">Сохранить изменения</button>
                        <button type="button" className="btn btn--danger"
                                onClick={() => setShowDeleteConfirm(true)}>Удалить аккаунт
                        </button>
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
