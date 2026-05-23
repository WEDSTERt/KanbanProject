import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { VERIFY_EMAIL } from '../graphql/queries';

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    const [status, setStatus] = useState('loading');
    const [errorMessage, setErrorMessage] = useState('');

    const [verifyEmail] = useMutation(VERIFY_EMAIL);

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setErrorMessage('Недействительная ссылка подтверждения');
            return;
        }

        const verify = async () => {
            try {
                const { data } = await verifyEmail({ variables: { token } });
                if (data?.verifyEmail) {
                    setStatus('success');
                    setTimeout(() => {
                        navigate('/login');
                    }, 3000);
                } else {
                    setStatus('error');
                    setErrorMessage('Ошибка подтверждения email');
                }
            } catch (err) {
                setStatus('error');
                setErrorMessage(err.message);
            }
        };

        verify();
    }, [token, verifyEmail, navigate]);

    return (
        <div className="card" style={{maxWidth: 460, margin: '40px auto', textAlign: 'center'}}>
            {status === 'loading' && (
                <>
                    <div className="loading" style={{ margin: '20px 0' }}>Подтверждение email...</div>
                    <p>Пожалуйста, подождите...</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <div style={{ margin: '20px 0', color: '#22c55e' }}>
                        <i className="fas fa-check-circle" style={{ fontSize: '48px' }}></i>
                    </div>
                    <h3>Email успешно подтвержден!</h3>
                    <p>Ваш аккаунт активирован. Вы будете перенаправлены на страницу входа.</p>
                </>
            )}

            {status === 'error' && (
                <>
                    <div style={{ margin: '20px 0', color: '#dc2626' }}>
                        <i className="fas fa-exclamation-triangle" style={{ fontSize: '48px' }}></i>
                    </div>
                    <h3>Ошибка подтверждения</h3>
                    <p className="message-error">{errorMessage}</p>
                    <button className="btn" onClick={() => navigate('/login')}>
                        Перейти на страницу входа
                    </button>
                </>
            )}
        </div>
    );
};

export default VerifyEmail;