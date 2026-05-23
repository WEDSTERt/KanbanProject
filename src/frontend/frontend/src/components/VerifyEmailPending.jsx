import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { RESEND_VERIFICATION } from '../graphql/queries';
import { useAuth } from '../contexts/AuthContext';

const VerifyEmailPending = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const email = location.state?.email || '';
    const [resendMessage, setResendMessage] = useState('');
    const [resendError, setResendError] = useState('');
    const [countdown, setCountdown] = useState(0);

    const [resendVerification] = useMutation(RESEND_VERIFICATION);

    useEffect(() => {
        if (!email) {
            navigate('/register');
        }
    }, [email, navigate]);

    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleResendEmail = async () => {
        if (countdown > 0) return;

        setResendMessage('');
        setResendError('');

        try {
            await resendVerification({ variables: { email } });
            setResendMessage('Письмо с подтверждением отправлено повторно!');
            setCountdown(60);
        } catch (err) {
            setResendError(err.message);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="card" style={{maxWidth: 500, margin: '40px auto', textAlign: 'center'}}>
            <h2><i className="fas fa-envelope"></i> Подтверждение email</h2>

            <div style={{ margin: '24px 0' }}>
                <i className="fas fa-paper-plane" style={{ fontSize: '48px', color: '#2563eb' }}></i>
            </div>

            <p>
                На адрес <strong>{email}</strong> отправлено письмо с ссылкой для подтверждения.
            </p>
            <p>
                Пожалуйста, перейдите по ссылке в письме, чтобы активировать свой аккаунт.
            </p>

            <div className="divider" />

            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Не получили письмо? Проверьте папку "Спам" или нажмите кнопку ниже.
            </p>

            <div className="flex-row" style={{ justifyContent: 'center', marginTop: '16px' }}>
                <button
                    className="btn btn--secondary"
                    onClick={handleResendEmail}
                    disabled={countdown > 0}
                >
                    <i className="fas fa-redo-alt"></i>
                    {countdown > 0 ? ` (${countdown} сек)` : ' Отправить повторно'}
                </button>
                <button className="btn" onClick={handleLogout}>
                    <i className="fas fa-sign-out-alt"></i> Выйти
                </button>
            </div>

            {resendMessage && <div className="message-success" style={{ marginTop: '16px' }}>{resendMessage}</div>}
            {resendError && <div className="message-error" style={{ marginTop: '16px' }}>{resendError}</div>}
        </div>
    );
};

export default VerifyEmailPending;