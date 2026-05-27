import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';
import { LOGIN } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import '../styles/auth-form.css';

const LoginForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const [loginMutation, { data, error, loading }] = useMutation(LOGIN);

    useEffect(() => {
        if (data?.login) {
            login(data.login);
            navigate('/');
        } else if (data && !data?.login) {
            setLocalError('Неверный email или пароль');
        }
        if (error) {
            setLocalError(error.message);
        }
    }, [data, error, login, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        setIsLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setLocalError(err.message);
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = '/oauth2/authorization/google';
    };

    const handleYandexLogin = () => {
        window.location.href = '/oauth2/authorization/yandex';
    };

    const handleGitHubLogin = () => {
        window.location.href = '/oauth2/authorization/github';
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-logo">
                        <i className="fas fa-kanban"></i>
                    </div>
                    <h1>Kanban Docky</h1>
                    <p className="auth-subtitle">Управление проектами и задачами</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="login-email">
                            <i className="fas fa-envelope"></i> Email
                        </label>
                        <input
                            className="form-input"
                            type="email"
                            id="login-email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="login-password">
                            <i className="fas fa-lock"></i> Пароль
                        </label>
                        <div className="password-input-wrapper">
                            <input
                                className="form-input"
                                type={showPassword ? 'text' : 'password'}
                                id="login-password"
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

                    {localError && (
                        <div className="error-message">
                            <i className="fas fa-exclamation-circle"></i>
                            <span>{localError}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary btn-large"
                        disabled={isLoading || loading}
                    >
                        {isLoading || loading ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> Вход...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-sign-in-alt"></i> Войти
                            </>
                        )}
                    </button>
                </form>

                <div className="divider">
                    <span>или</span>
                </div>

                <div className="oauth-buttons">
                    <button
                        type="button"
                        className="oauth-btn oauth-google"
                        onClick={handleGoogleLogin}
                        title="Войти через Google"
                    >
                        <svg className="oauth-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span>Google</span>
                    </button>

                    <button
                        type="button"
                        className="oauth-btn oauth-yandex"
                        onClick={handleYandexLogin}
                        title="Войти через Яндекс"
                    >
                        <svg className="oauth-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M10.5 2h3v14h-3V2zm6 0h3v10h-3V2zm-12 4h3v10h-3V6z"/>
                        </svg>
                        <span>Яндекс</span>
                    </button>

                    <button
                        type="button"
                        className="oauth-btn oauth-github"
                        onClick={handleGitHubLogin}
                        title="Войти через GitHub"
                    >
                        <i className="fab fa-github"></i>
                        <span>GitHub</span>
                    </button>
                </div>

                <div className="auth-footer">
                    <p>Нет аккаунта? 
                        <Link to="/register" className="auth-link">
                            Зарегистрируйтесь
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;
