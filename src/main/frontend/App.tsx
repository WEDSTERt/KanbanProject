import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import client from './apolloClient';
import Layout from './Layout';
import './App.css';

// Pages
import LoginPage from './pages/LoginPage';
import ProjectsPage from './pages/ProjectsPage';
import DashboardPage from './pages/DashboardPage';

/**
 * Приватный маршрут - проверяет аутентификацию
 */
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

/**
 * Главный компонент приложения
 */
const App: React.FC = () => {
  return (
    <ApolloProvider client={client}>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage isRegister={true} />} />

          {/* Private Routes with Layout */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout>
                  <Navigate to="/projects" replace />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/projects"
            element={
              <PrivateRoute>
                <Layout>
                  <ProjectsPage />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </PrivateRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </Router>
    </ApolloProvider>
  );
};

export default App;
