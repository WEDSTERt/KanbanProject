import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LoginPageProps {
  isRegister?: boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ isRegister = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const mutation = isRegister
        ? `
          mutation {
            createUser(
              email: "${email}"
              password: "${password}"
              fullName: "${fullName}"
            ) {
              token
              user {
                id
                email
              }
            }
          }
        `
        : `
          mutation {
            login(
              email: "${email}"
              password: "${password}"
            ) {
              token
              user {
                id
                email
              }
            }
          }
        `;

      const response = await fetch('http://localhost:8080/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mutation }),
      });

      const data = await response.json();

      if (data.errors) {
        setError(data.errors[0]?.message || 'Authentication failed');
        return;
      }

      const token = data.data?.createUser?.token || data.data?.login?.token;
      if (token) {
        localStorage.setItem('authToken', token);
        navigate('/projects');
      } else {
        setError('No token received');
      }
    } catch (err) {
      setError('Connection error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-form">
          <h1>ProjectKanban</h1>
          <h2>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="John Doe"
                />
              </div>
            )}

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="user@example.com"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn-login"
              disabled={loading}
            >
              {loading ? 'Loading...' : isRegister ? 'Create Account' : 'Login'}
            </button>
          </form>

          <div className="auth-toggle">
            {isRegister ? (
              <p>
                Already have an account?{' '}
                <a onClick={() => navigate('/login')}>Login</a>
              </p>
            ) : (
              <p>
                Don't have an account?{' '}
                <a onClick={() => navigate('/register')}>Register</a>
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .login-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .login-container {
          width: 100%;
          max-width: 400px;
          padding: 20px;
        }

        .login-form {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }

        .login-form h1 {
          text-align: center;
          color: #667eea;
          margin-bottom: 8px;
        }

        .login-form h2 {
          text-align: center;
          color: #333;
          font-size: 20px;
          margin-bottom: 24px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #333;
        }

        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .btn-login {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 12px;
          transition: all 0.3s ease;
        }

        .btn-login:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
        }

        .btn-login:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .alert {
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 13px;
        }

        .alert-error {
          background: #ffe0e0;
          color: #c33;
          border: 1px solid #ffb3b3;
        }

        .auth-toggle {
          text-align: center;
          margin-top: 16px;
          font-size: 13px;
          color: #666;
        }

        .auth-toggle a {
          color: #667eea;
          cursor: pointer;
          font-weight: 600;
        }

        .auth-toggle a:hover {
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          .login-form {
            padding: 20px;
          }

          .login-form h2 {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
