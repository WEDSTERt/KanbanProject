import React from 'react';
import { useNavigate } from 'react-router-dom';

const StartPage = () => {
    const navigate = useNavigate();

    return (
        <div className="start-container">
            <div className="start-card">
                <h1><i className="fas fa-tasks"></i> Kanban Docky</h1>
                <p>Управляйте проектами, задачами и командами</p>
                <div className="start-buttons">
                    <button className="btn-primary" onClick={() => navigate('/login')}>
                        <i className="fas fa-sign-in-alt"></i> Вход
                    </button>
                    <button className="btn-outline" onClick={() => navigate('/register')}>
                        <i className="fas fa-user-plus"></i> Регистрация
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StartPage;