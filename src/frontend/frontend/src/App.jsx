import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import StartPage from './components/StartPage';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ProjectsList from './components/ProjectsList';
import AccountSettings from './components/AccountSettings';
import ProjectSettings from './components/ProjectSettings';
import KanbanBoard from './components/KanbanBoard';

const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading">Загрузка...</div>;
    if (!user) return <Navigate to="/login" />;
    return children;
};

const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading">Загрузка...</div>;
    return !user ? children : <Navigate to="/" />;
};

const RootRoute = () => {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading">Загрузка...</div>;
    if (user) {
        return (
            <Layout>
                <ProjectsList />
            </Layout>
        );
    }
    return <StartPage />;
};

function App() {
    return (
        <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<PublicRoute><LoginForm /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterForm /></PublicRoute>} />
            <Route path="/account" element={<PrivateRoute><Layout><AccountSettings /></Layout></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Layout><ProjectSettings /></Layout></PrivateRoute>} />
            <Route path="/board" element={<PrivateRoute><Layout><KanbanBoard /></Layout></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;