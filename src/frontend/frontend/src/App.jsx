import React, { useEffect } from 'react';
import {Routes, Route, Navigate} from 'react-router-dom';
import {useAuth} from './contexts/AuthContext';
import {NotificationProvider} from './contexts/NotificationContext';
import {SSEProvider} from './contexts/SSEContext.jsx';
import Layout from './components/Layout';
import NotificationCenter from './components/NotificationCenter';
import StartPage from './components/StartPage';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ProjectsList from './components/ProjectsList';
import AccountSettings from './components/AccountSettings';
import ProjectSettings from './components/ProjectSettings';
import KanbanBoard from './components/KanbanBoard';
import VerifyEmail from './components/VerifyEmail';
import VerifyEmailPending from './components/VerifyEmailPending';
import OAuth2Redirect from './components/OAuth2Redirect';

const PrivateRoute = ({children}) => {
    const {user, loading} = useAuth();
    if (loading) return <div className="loading">Загрузка...</div>;
    if (!user) return <Navigate to="/login"/>;

    if (user && user.emailVerified === false) {
        return <Navigate to="/verify-email-pending" state={{ email: user.email }} />;
    }

    return children;
};

const PublicRoute = ({children}) => {
    const {user, loading} = useAuth();
    if (loading) return <div className="loading">Загрузка...</div>;
    return !user ? children : <Navigate to="/"/>;
};

const HomePage = () => {
    const {user, loading} = useAuth();
    if (loading) return <div className="loading">Загрузка...</div>;
    if (user) {
        if (user.emailVerified === false) {
            return <Navigate to="/verify-email-pending" state={{ email: user.email }} />;
        }
        return (
            <Layout>
                <ProjectsList/>
            </Layout>
        );
    }
    return <StartPage/>;
};

// ✅ ИСПРАВЛЕНИЕ: SSEProvider ВНУТРИ, чтобы он получал userId от useAuth()
function App() {
    return (
        <SSEProvider>
            <NotificationProvider>
                <AppContent />
                <NotificationCenter />
            </NotificationProvider>
        </SSEProvider>
    );
}

function AppContent() {
    const { user } = useAuth();

    return (
        <Routes>
            {/* OAuth2 редирект */}
            <Route path="/oauth2-redirect" element={<OAuth2Redirect />} />

            {/* Публичные маршруты */}
            <Route path="/verify-email" element={<VerifyEmail/>}/>
            <Route path="/login" element={<PublicRoute><LoginForm/></PublicRoute>}/>
            <Route path="/register" element={<PublicRoute><RegisterForm/></PublicRoute>}/>
            
            {/* Защищённые маршруты */}
            <Route path="/verify-email-pending" element={<PrivateRoute><VerifyEmailPending/></PrivateRoute>}/>
            <Route path="/account" element={<PrivateRoute><Layout><AccountSettings/></Layout></PrivateRoute>}/>
            <Route path="/settings" element={<PrivateRoute><Layout><ProjectSettings/></Layout></PrivateRoute>}/>
            <Route path="/board" element={<PrivateRoute><Layout><KanbanBoard/></Layout></PrivateRoute>}/>
            
            {/* Главная страница */}
            <Route path="/" element={<HomePage/>}/>
            
            {/* Catch-all - ПОСЛЕДНИЙ */}
            <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
    );
}

export default App;
