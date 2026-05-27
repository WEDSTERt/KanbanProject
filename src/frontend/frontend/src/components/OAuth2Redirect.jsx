import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// ВАЖНО: этот компонент НЕ использует useAuth() контекст
// Он работает на уровне localStorage напрямую

const OAuth2Redirect = () => {
    console.log('🔴 OAuth2Redirect component MOUNTED');
    const location = useLocation();
    const navigate = useNavigate();
    const [processed, setProcessed] = useState(false);

    useEffect(() => {
        if (processed) return;
        
        console.log('🟡 useEffect triggered');
        console.log('🟡 location.search:', location.search);
        
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        
        console.log('🔵 Token from URL:', token);
        
        if (token && token.trim().length > 0) {
            console.log('✅ Valid token found');
            setProcessed(true);
            
            try {
                // Сохраняем токен НАПРЯМУЮ в localStorage
                localStorage.setItem('jwtToken', token);
                console.log('💾 Token saved to localStorage');
                
                const verified = localStorage.getItem('jwtToken');
                console.log('✅ Verification - token in storage:', verified?.substring(0, 20) + '...');
                console.log('✅ All localStorage keys:', Object.keys(localStorage));
                
                // Полная перезагрузка страницы — это гарантирует, что контекст перезагружается
                console.log('🚀 Reloading page to refresh auth context...');
                setTimeout(() => {
                    window.location.href = '/';
                }, 500);
            } catch (e) {
                console.error('❌ Error:', e.message);
                navigate('/login');
            }
        } else {
            console.log('❌ No valid token');
            navigate('/login');
        }
    }, [location.search, processed, navigate]);

    return (
        <div style={{
            padding: '20px',
            textAlign: 'center',
            fontSize: '16px',
            backgroundColor: '#f0f0f0',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
        }}>
            <div>
                <p>Перенаправление...</p>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '20px' }}>
                    Если это окно не закроется за 5 секунд, 
                    <a href="/" style={{ marginLeft: '5px', color: '#0066cc' }}>нажмите здесь</a>
                </p>
            </div>
        </div>
    );
};

export default OAuth2Redirect;
