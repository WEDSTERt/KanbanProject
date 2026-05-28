import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationBadge from './components/NotificationBadge';
import './layout.css';

interface User {
  id: number;
  email: string;
  fullName: string;
}

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Получить текущего пользователя при загрузке
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          navigate('/login');
          return;
        }

        // Запрос через GraphQL
        const response = await fetch('http://localhost:8080/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `
              query {
                me {
                  id
                  email
                  fullName
                }
              }
            `,
          }),
        });

        const data = await response.json();

        if (data.errors) {
          console.error('GraphQL error:', data.errors);
          setError('Failed to load user');
          navigate('/login');
          return;
        }

        if (data.data?.me) {
          setCurrentUser(data.data.me);
          console.log('✅ Current user loaded:', data.data.me);
        }
      } catch (err) {
        console.error('Error fetching user:', err);
        setError('Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [navigate]);

  // Обработчик логаута
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="layout-loading">
        <div className="spinner">🔄 Loading...</div>
      </div>
    );
  }

  if (error && !currentUser) {
    return (
      <div className="layout-error">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/login')}>Go to Login</button>
      </div>
    );
  }

  return (
    <div className="layout">
      {/* Header */}
      <header className="layout-header">
        <div className="header-container">
          {/* Left side */}
          <div className="header-left">
            <div className="logo">
              <span className="logo-icon">📋</span>
              <span className="logo-text">ProjectKanban</span>
            </div>

            <nav className="header-nav">
              <a href="/projects" className="nav-link">Projects</a>
              <a href="/dashboard" className="nav-link">Dashboard</a>
            </nav>
          </div>

          {/* Right side */}
          <div className="header-right">
            {/* Notification Badge 🔔 */}
            {currentUser && (
              <NotificationBadge 
                userId={currentUser.id}
                onCountChange={(count) => {
                  console.log(`Unread notifications: ${count}`);
                }}
              />
            )}

            {/* User Menu */}
            <div className="user-menu">
              <div className="user-info">
                <span className="user-avatar">👤</span>
                <div className="user-details">
                  <div className="user-name">{currentUser?.fullName}</div>
                  <div className="user-email">{currentUser?.email}</div>
                </div>
              </div>

              <button 
                className="logout-btn"
                onClick={handleLogout}
                title="Logout"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="layout-main">
        <div className="main-content">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="layout-footer">
        <div className="footer-content">
          <p>&copy; 2024 ProjectKanban. All rights reserved.</p>
          <div className="footer-links">
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
            <a href="#support">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
