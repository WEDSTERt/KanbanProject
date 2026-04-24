import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';
import { REGISTER } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import { validateFullName, validatePassword } from '../utils/validation';

const RegisterForm = () => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');
    const [validationError, setValidationError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const [registerMutation, { data, error, loading }] = useMutation(REGISTER);

    useEffect(() => {
        if (data?.createUser) {
            login(data.createUser);
            navigate('/');
        }
        if (error) {
            setLocalError(error.message);
        }
    }, [data, error, login, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setValidationError('');
        setLocalError('');
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
        try {
            await register(fullName, email, password);
            navigate('/');
        } catch (err) {
            setLocalError(err.message);
        }
    };

    return (
        <div className="card" style={{ maxWidth: 460, margin: '40px auto' }}>
            <h2><i className="fas fa-user-plus"></i> Создать аккаунт</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label" htmlFor="reg-fullname">Имя и фамилия</label>
                    <input
                        className="form-input"
                        type="text"
                        id="reg-fullname"
                        placeholder="Иван Иванов"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="reg-email">Email</label>
                    <input
                        className="form-input"
                        type="email"
                        id="reg-email"
                        placeholder="ivan@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="reg-password">Пароль</label>
                    <div className="password-row">
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
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            <i className={showPassword ? 'fas fa-eye' : 'fas fa-eye-slash'}></i>
                        </button>
                    </div>
                </div>
                {validationError && <div className="message-error">{validationError}</div>}
                {localError && <div className="message-error">{localError}</div>}
                <div className="flex-row">
                    <button type="submit" className="btn" disabled={loading}>
                        <i className="fas fa-user-plus"></i> Зарегистрироваться
                    </button>
                    <Link to="/login">
                        <button type="button" className="btn btn--secondary">
                            <i className="fas fa-times"></i> Отмена
                        </button>
                    </Link>
                </div>
            </form>
        </div>
    );
};

export default RegisterForm;