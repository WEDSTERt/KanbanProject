import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { VERIFY_EMAIL } from '../graphql/queries';

const VerifyEmail = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    
    const [status, setStatus] = useState('loading');
    const [errorMessage, setErrorMessage] = useState('');
    
    // ✅ ИСПРАВЛЕНО: Используем ref чтобы отследить был ли уже запрос
    // React Strict Mode вызывает эффекты дважды, нам нужно это предотвратить
    const verificationAttemptedRef = useRef(false);

    const [verifyEmail, { loading: verifying }] = useMutation(VERIFY_EMAIL);

    useEffect(() => {
        console.log('📍 URL:', window.location.href);
        console.log('🔐 Token from URL param:', token);

        if (!token) {
            setStatus('error');
            setErrorMessage('Ошибка: не передан токен верификации. Проверьте ссылку в письме.');
            console.error('❌ No token in URL');
            return;
        }

        // ✅ ИСПРАВЛЕНО: Проверяем что верификация ещё не попытана
        if (verificationAttemptedRef.current) {
            console.log('⏭️ Verification already attempted, skipping duplicate call');
            return;
        }

        console.log('🔍 Starting email verification with token:', token);

        const verify = async () => {
            try {
                const { data } = await verifyEmail({ 
                    variables: { token }
                });
                
                console.log('✅ Verification response:', data);

                if (data?.verifyEmail === true) {
                    setStatus('success');
                    console.log('🎉 Email verified successfully!');
                    
                    setTimeout(() => {
                        navigate('/login');
                    }, 3000);
                } else if (data?.verifyEmail === false) {
                    setStatus('error');
                    setErrorMessage('Ошибка верификации: некорректный или истёкший токен. Попробуйте запросить новое письмо.');
                } else {
                    setStatus('error');
                    setErrorMessage('Неизвестная ошибка при подтверждении email');
                }
            } catch (err) {
                console.error('❌ Verification error:', err);
                setStatus('error');
                
                const errorMsg = err.message || 'Ошибка при подтверждении email';
                
                if (errorMsg.includes('Invalid verification token')) {
                    setErrorMessage('Ошибка: недействительный токен. Проверьте ссылку в письме.');
                } else if (errorMsg.includes('token has expired')) {
                    setErrorMessage('Ошибка: ссылка верификации истекла. Запросите новое письмо.');
                } else if (errorMsg.includes('Email already verified')) {
                    setErrorMessage('Этот email уже был подтверждён ранее.');
                } else {
                    setErrorMessage(`Ошибка подтверждения: ${errorMsg}`);
                }
            }
        };

        // ✅ Отмечаем что попытка верификации началась
        verificationAttemptedRef.current = true;
        verify();
    }, [token, verifyEmail, navigate]);

    return (
        <div className="card" style={{maxWidth: 460, margin: '40px auto', textAlign: 'center'}}>
            {status === 'loading' && (
                <>
                    <div className="loading" style={{ margin: '20px 0' }}>
                        ⏳ Подтверждение email...
                    </div>
                    <p>Пожалуйста, подождите...</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <div style={{ margin: '20px 0', color: '#22c55e' }}>
                        <i className="fas fa-check-circle" style={{ fontSize: '48px' }}></i>
                    </div>
                    <h3>✅ Email успешно подтвержден!</h3>
                    <p>Ваш аккаунт активирован. Вы будете перенаправлены на страницу входа через 3 секунды...</p>
                </>
            )}

            {status === 'error' && (
                <>
                    <div style={{ margin: '20px 0', color: '#dc2626' }}>
                        <i className="fas fa-exclamation-triangle" style={{ fontSize: '48px' }}></i>
                    </div>
                    <h3>❌ Ошибка подтверждения</h3>
                    <p className="message-error" style={{
                        backgroundColor: '#fee2e2',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        padding: '12px',
                        marginBottom: '16px',
                        color: '#991b1b'
                    }}>
                        {errorMessage}
                    </p>
                    <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                        Проверьте, что:
                    </p>
                    <ul style={{ textAlign: 'left', display: 'inline-block', fontSize: '14px', color: '#666' }}>
                        <li>✓ Ссылка скопирована полностью из письма</li>
                        <li>✓ Письмо не было отправлено более 24 часов назад</li>
                        <li>✓ Вы не подтверждали этот email ранее</li>
                    </ul>
                    <div style={{ marginTop: '20px' }}>
                        <button 
                            className="btn" 
                            onClick={() => navigate('/login')}
                            style={{ marginRight: '10px' }}
                        >
                            Перейти на страницу входа
                        </button>
                        <button 
                            className="btn" 
                            onClick={() => navigate('/register')}
                            style={{ background: '#666' }}
                        >
                            Зарегистрироваться заново
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default VerifyEmail;
