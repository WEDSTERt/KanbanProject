import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';
import { LOGIN } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';

const LoginForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');
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
        try {
            await login(email, password);
            navigate('/'); // перенаправление после того, как пользователь установлен
        } catch (err) {
            setLocalError(err.message);
        }
    };

    return (
        <div className="card" style={{ maxWidth: 460, margin: '40px auto' }}>
            <h2><i className="fas fa-lock"></i> Вход в Kanban Docky</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label" htmlFor="login-email">Email</label>
                    <input
                        className="form-input"
                        type="email"
                        id="login-email"
                        placeholder="ivan@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="login-password">Пароль</label>
                    <div className="password-row">
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
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            <i className={showPassword ? 'fas fa-eye' : 'fas fa-eye-slash'}></i>
                        </button>
                    </div>
                </div>
                {localError && <div className="message-error">{localError}</div>}
                <div className="flex-row">
                    <button type="submit" className="btn" disabled={loading}>
                        <i className="fas fa-sign-in-alt"></i> Войти
                    </button>
                    <Link to="/register">
                        <button type="button" className="btn btn--secondary">
                            <i className="fas fa-user-plus"></i> Регистрация
                        </button>
                    </Link>
                </div>
            </form>
        </div>
    );
};

export default LoginForm;