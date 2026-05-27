import React, {useState, useRef} from 'react';
import {useMutation} from '@apollo/client';
import {useNavigate, Link} from 'react-router-dom';
import {REGISTER} from '../graphql/mutations';
import {useAuth} from '../contexts/AuthContext';
import {validateFullName, validatePassword} from '../utils/validation';
import { Turnstile } from '@marsidev/react-turnstile';
import '../styles/auth-form.css';

const RegisterForm = () => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');
    const [validationError, setValidationError] = useState('');
    const [turnstileToken, setTurnstileToken] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [shouldHide, setShouldHide] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const turnstileRef = useRef(null);

    const [registerMutation] = useMutation(REGISTER);
    const siteKey = '0x4AAAAAADSqCIC_dJTMGNYv';

    const handleTurnstileSuccess = (token) => {
        setTurnstileToken(token);
        setIsVerified(true);
        setLocalError('');
        setTimeout(() => {
            setShouldHide(true);
        }, 1000);
    };

    const handleTurnstileError = () => {
        setTurnstileToken(null);
        setIsVerified(false);
        setShouldHide(false);
        setLocalError('Пожалуйста, подтвердите, что вы не робот');
    };

    const handleTurnstileExpire = () => {
        setTurnstileToken(null);
        setIsVerified(false);
        setShouldHide(false);
        setLocalError('Проверка истекла, пожалуйста, подтвердите снова');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setValidationError('');
        setLocalError('');

        if (!turnstileToken) {
            setLocalError('Пожалуйста, подтвердите, что вы не робот');
            return;
        }

        const nameValidation = validateFullName(fullName);
        if (!nameValidation.isValid) {
            setValidationError(nameValidation.error);
            return;
        }

        const passValidation = validatePassword(password);
        if (!passValidation.isValid) {
            setValidationError(passValidation.error);
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setLocalError('Введите корректный email');
            return;
        }

        setIsSubmitting(true);

        try {
            const { data } = await registerMutation({
                variables: {
                    fullName: fullName.trim(),
                    email: email.trim().toLowerCase(),
                    password,
                    turnstileToken
                }
            });

            if (data?.createUser) {
                setRegistrationSuccess(true);
                setRegisteredEmail(email.trim().toLowerCase());
                setTurnstileToken(null);
                setFullName('');
                setEmail('');
                setPassword('');
            }
        } catch (err) {
            setLocalError(err.message);
            if (turnstileRef.current) {
                turnstileRef.current.reset();
            }
            setTurnstileToken(null);
            setIsVerified(false);
            setShouldHide(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (registrationSuccess) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="success-icon">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <h2 className="success-title">Регистрация завершена!</h2>
                    <p className="success-message">
                        На адрес <strong>{registeredEmail}</strong> отправлено письмо с ссылкой для подтверждения.
                    </p>
                    <div className="success-hint">
                        <i className="fas fa-envelope"></i>
                        <span>Письмо может задержаться на несколько минут. Проверьте папку "Спам".</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexDirection: 'column', marginTop: '24px' }}>
                        <Link to="/login" style={{ textDecoration: 'none' }}>
                            <button className="btn btn-primary btn-large">
                                <i className="fas fa-sign-in-alt"></i> Перейти ко входу
                            </button>
                        </Link>
                        <Link to="/" style={{ textDecoration: 'none' }}>
                            <button className="btn btn-secondary btn-large">
                                <i className="fas fa-home"></i> На главную
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-logo">
                        <i className="fas fa-user-plus"></i>
                    </div>
                    <h1>Создать аккаунт</h1>
                    <p className="auth-subtitle">Присоединитесь к Kanban Docky</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="reg-fullname">
                            <i className="fas fa-user"></i> Имя и фамилия
                        </label>
                        <input
                            className="form-input"
                            type="text"
                            id="reg-fullname"
                            placeholder="Иван Иванов"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="reg-email">
                            <i className="fas fa-envelope"></i> Email
                        </label>
                        <input
                            className="form-input"
                            type="email"
                            id="reg-email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="reg-password">
                            <i className="fas fa-lock"></i> Пароль
                        </label>
                        <div className="password-input-wrapper">
                            <input
                                className="form-input"
                                type={showPassword ? 'text' : 'password'}
                                id="reg-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                            >
                                <i className={showPassword ? 'fas fa-eye' : 'fas fa-eye-slash'}></i>
                            </button>
                        </div>
                    </div>

                    {!shouldHide && (
                        <div className="form-group turnstile-wrapper">
                            <Turnstile
                                ref={turnstileRef}
                                siteKey={siteKey}
                                onSuccess={handleTurnstileSuccess}
                                onError={handleTurnstileError}
                                onExpire={handleTurnstileExpire}
                                options={{
                                    size: 'normal',
                                    theme: 'light',
                                    language: 'ru',
                                    csp: true
                                }}
                            />
                        </div>
                    )}

                    {validationError && (
                        <div className="error-message">
                            <i className="fas fa-exclamation-circle"></i>
                            <span>{validationError}</span>
                        </div>
                    )}

                    {localError && (
                        <div className="error-message">
                            <i className="fas fa-exclamation-circle"></i>
                            <span>{localError}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary btn-large"
                        disabled={isSubmitting || !turnstileToken}
                    >
                        {isSubmitting ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> Регистрация...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-user-plus"></i> Зарегистрироваться
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Уже есть аккаунт?
                        <Link to="/login" className="auth-link">
                            Войти
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterForm;
