import React, {useState, useRef} from 'react';
import {useMutation} from '@apollo/client';
import {useNavigate, Link} from 'react-router-dom';
import {REGISTER} from '../graphql/mutations';
import {useAuth} from '../contexts/AuthContext';
import {validateFullName, validatePassword} from '../utils/validation';
import { Turnstile } from '@marsidev/react-turnstile';

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
    // Используем тестовый ключ для разработки
    //const siteKey = '1x00000000000000000000AA';
    const siteKey = '0x4AAAAAADSqCIC_dJTMGNYv';
    const handleTurnstileSuccess = (token) => {
        console.log("✅ Turnstile success, token:", token.substring(0, 20) + "...");
        setTurnstileToken(token);
        setIsVerified(true);
        setLocalError('');
        setTimeout(() => {
            setShouldHide(true);
        }, 1000);
    };

    const handleTurnstileError = () => {
        console.error("❌ Turnstile error");
        setTurnstileToken(null);
        setIsVerified(false);
        setShouldHide(false);
        setLocalError('Пожалуйста, подтвердите, что вы не робот');
    };

    const handleTurnstileExpire = () => {
        console.warn("⚠️ Turnstile expired");
        setTurnstileToken(null);
        setIsVerified(false);
        setShouldHide(false);
        setLocalError('Проверка истекла, пожалуйста, подтвердите снова');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("=== SUBMIT ===");
        console.log("Turnstile token present:", !!turnstileToken);

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
            <div className="card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center' }}>
                <div style={{ margin: '24px 0' }}>
                    <i className="fas fa-check-circle" style={{ fontSize: '64px', color: '#22c55e' }}></i>
                </div>
                <h2>Регистрация завершена!</h2>
                <p style={{ margin: '20px 0', color: '#4b5563' }}>
                    На адрес <strong>{registeredEmail}</strong> отправлено письмо с ссылкой для подтверждения.
                    Пожалуйста, проверьте свою почту и перейдите по ссылке, чтобы активировать аккаунт.
                </p>
                <div style={{
                    backgroundColor: '#f3f4f6',
                    padding: '12px',
                    borderRadius: '8px',
                    margin: '20px 0',
                    fontSize: '14px',
                    color: '#6b7280'
                }}>
                    <i className="fas fa-envelope"></i> Письмо может задержаться на несколько минут. Проверьте папку "Спам".
                </div>
                <div className="flex-row" style={{ justifyContent: 'center', gap: '16px', marginTop: '24px' }}>
                    <Link to="/login">
                        <button className="btn">
                            <i className="fas fa-sign-in-alt"></i> Перейти ко входу
                        </button>
                    </Link>
                    <Link to="/">
                        <button className="btn btn--secondary">
                            <i className="fas fa-home"></i> На главную
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="card" style={{maxWidth: 460, margin: '40px auto'}}>
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

                {!shouldHide && (
                    <div className="form-group" style={{ display: 'flex', justifyContent: 'center', minHeight: '90px' }}>
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

                {validationError && <div className="message-error">{validationError}</div>}
                {localError && <div className="message-error">{localError}</div>}

                <div className="flex-row">
                    <button
                        type="submit"
                        className="btn"
                        disabled={isSubmitting || !turnstileToken}
                    >
                        {isSubmitting ? 'Регистрация...' : <><i className="fas fa-user-plus"></i> Зарегистрироваться</>}
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