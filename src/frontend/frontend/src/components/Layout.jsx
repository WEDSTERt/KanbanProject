import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app-root">
            <header className="app-navbar">
                <div className="app-logo">
                    <i className="fas fa-tasks"></i> Kanban Docky
                </div>
                <div className="app-nav-links">
                    <Link to="/"><i className="fas fa-folder-open"></i> Проекты</Link>
                    <span className="app-user-info" onClick={() => navigate('/account')} style={{ cursor: 'pointer' }}>
            <i className="fas fa-user-circle"></i> {user?.fullName}
          </span>
                    <button className="btn btn--secondary btn--small" onClick={handleLogout}>
                        <i className="fas fa-sign-out-alt"></i> Выйти
                    </button>
                </div>
            </header>
            <main>{children}</main>
        </div>
    );
};

export default Layout;