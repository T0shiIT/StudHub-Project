import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';

export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const handleLogin = () => navigate('/login');

  const handleLogout = async () => {
    localStorage.removeItem('isAuthenticated');
    try {
      await fetchWithCsrf('http://localhost:8080/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error', e);
    }
    window.location.href = 'http://localhost:5173';
  };

  return (
    <header className="header">
      <h1>StudHub</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isAuthenticated ? (
          <>
            <span>{user?.login || user?.default_email || 'Пользователь'}</span>
            <button className="btn" onClick={handleLogout} style={{ background: '#ef4444' }}>
              Выйти
            </button>
          </>
        ) : (
          <button className="btn" onClick={handleLogin} style={{ background: '#3b82f6' }}>
            Войти
          </button>
        )}
      </div>
    </header>
  );
}