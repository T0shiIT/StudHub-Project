import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import icon2 from '../assets/icon2.jpeg';

// Импортируем аватары (чтобы получить URL по имени файла)
const avatarModules = import.meta.glob('../assets/avatars/*.png', { eager: true, query: '?url', import: 'default' });
const AVATAR_MAP = Object.fromEntries(
  Object.entries(avatarModules).map(([path, url]) => [
    path.split('/').pop()!,
    url as string
  ])
);

export default function Sidebar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState<string | null>(null);

  // Загружаем аватар из localStorage
  useEffect(() => {
    const savedAvatar = localStorage.getItem('selectedAvatar');
    if (savedAvatar && AVATAR_MAP[savedAvatar]) {
      setAvatar(AVATAR_MAP[savedAvatar]);
    } else {
      setAvatar(null);
    }
  }, []);

  // Слушаем изменения в localStorage (если аватар меняется в другой вкладке)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedAvatar = localStorage.getItem('selectedAvatar');
      if (savedAvatar && AVATAR_MAP[savedAvatar]) {
        setAvatar(AVATAR_MAP[savedAvatar]);
      } else {
        setAvatar(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const firstName = user?.firstName || user?.login || 'Пользователь';
  const initial = firstName ? firstName[0].toUpperCase() : 'U';

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">📚</span>
        <span className="sidebar-brand-text">StudHub</span>
      </div>

      {isAuthenticated && user && (
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {avatar ? (
              <img src={avatar} alt="Avatar" />
            ) : (
              initial
            )}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">
              {user.firstName || user.login || 'Пользователь'}
            </span>
            <span className="sidebar-user-role">
              {user.role === 'ADMIN' ? 'Администратор' : 
               user.role === 'TEACHER' ? 'Преподаватель' : 'Студент'}
            </span>
          </div>
        </div>
      )}

      <div className="sidebar-menu">
        <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-icon">🏠</span><span>Главная</span>
        </NavLink>
        {isAuthenticated && (
          <>
            <NavLink to="/schedule" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-icon">📅</span><span>Расписание</span>
            </NavLink>
            <NavLink to="/courses" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-icon">📚</span><span>Курсы</span>
            </NavLink>
            <NavLink to="/announcements" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-icon">📢</span><span>Объявления</span>
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-icon">👤</span><span>Профиль</span>
            </NavLink>
          </>
        )}
      </div>

      <div className="sidebar-footer">
        {isAuthenticated && (
          <button onClick={handleLogout} className="sidebar-logout">
            <span className="sidebar-icon">🚪</span><span>Выйти</span>
          </button>
        )}
        <div className="sidebar-bottom-logo">
          <img src={icon2} alt="StudHub Icon" />
        </div>
      </div>
    </nav>
  );
}