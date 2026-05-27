import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {ApolloProvider} from '@apollo/client';
import {client} from './apollo';
import {AuthProvider} from './contexts/AuthContext';
import App from './App';
import './styles/index.css';

// Функция для подавления определённых ошибок в консоли
(function suppressErrors() {
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalLog = console.log;

    const ignoredPatterns = [
        'Form submission canceled',
        'No stored cache to restore',
        'React DevTools',
        'Private Access Token challenge',
        'The next request for the Private Access Token challenge may return a 401',
        'normal?lang',
        'Failed to parse audio',
        'Failed to parse video',
        'Invalid (ambiguous) video codec',
        'Form submission canceled',
        'xr-spatial-tracking',
        'Private Access Token',
        'TrustedHTML',
        'TrustedScript',
        'TrustedScriptURL',
        'about:srcdoc',
        'sandboxed',
        'allow-scripts',
        'Blocked script execution',
        'challenges.cloudflare.com',
        'Cannot determine Turnstile\'s embedded location',
        'Cannot find Widget',
        'Turnstile already has been loaded',
        'Turnstile has already been rendered',
        'An error occurred! For more details, see the full error text'
    ];

    // Перехват console.error
    console.error = function(...args) {
        const message = args[0]?.toString() || '';
        if (ignoredPatterns.some(pattern => message.includes(pattern))) {
            return;
        }
        originalError.apply(console, args);
    };

    // Перехват console.warn
    console.warn = function(...args) {
        const message = args[0]?.toString() || '';
        if (ignoredPatterns.some(pattern => message.includes(pattern))) {
            return;
        }
        originalWarn.apply(console, args);
    };

    // Фильтруем только важные сообщения Turnstile
    console.log = function(...args) {
        const message = args[0]?.toString() || '';
        if (message.includes('Turnstile success')) {
            originalLog.apply(console, args);
        }
    };

    // Перехват ошибок на уровне window
    window.addEventListener('error', (e) => {
        const message = e.message || '';
        const filename = e.filename || '';
        if (ignoredPatterns.some(pattern =>
            message.includes(pattern) || filename.includes(pattern)
        )) {
            e.preventDefault();
            e.stopPropagation();
            return true;
        }
    }, true);

    // Перехват необработанных Promise ошибок
    window.addEventListener('unhandledrejection', (e) => {
        const message = e.reason?.message || '';
        if (ignoredPatterns.some(pattern => message.includes(pattern))) {
            e.preventDefault();
        }
    });
})();

// Очистка кэша при ошибках Apollo
window.addEventListener('error', (e) => {
    const message = e.message || '';
    if (message.includes('ApolloProvider') || message.includes('client instance')) {
        console.log('Очистка кэша Apollo...');
        localStorage.removeItem('apollo-cache-persist');
        localStorage.removeItem('jwtToken');
        setTimeout(() => window.location.reload(), 100);
    }
});

// Рендеринг приложения
ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ApolloProvider client={client}>
            <BrowserRouter
                future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                }}
            >
                <AuthProvider>
                    <App/>
                </AuthProvider>
            </BrowserRouter>
        </ApolloProvider>
    </React.StrictMode>
);