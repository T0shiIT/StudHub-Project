import React from 'react';
import { Navigate } from 'react-router-dom';
import { Chat } from '../components/Chat';
import { useAuth } from '../context/AuthContext';
import '../components/chat.css';

const ChatPage: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();

  // ===== ЗАЩИТА МАРШРУТА =====
  if (loading) {
    return <div className="dashboard-loading">Загрузка...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ padding: '24px' }}>
      {user?.group ? (
        <Chat roomId={`group-${user.group}`} title={`Чат группы ${user.group}`} />
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          У вас не указана группа. Укажите её в профиле, чтобы присоединиться к чату.
        </div>
      )}
    </div>
  );
};

export default ChatPage;