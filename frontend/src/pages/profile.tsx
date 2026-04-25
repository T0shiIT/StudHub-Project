import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Загрузка профиля...</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Профиль</h2>
        <p style={{ color: '#64748b', marginTop: '16px' }}>
          Для просмотра профиля необходимо{' '}
          <Link to="/login" style={{ color: '#3b82f6' }}>авторизоваться</Link>
        </p>
      </div>
    );
  }

  const isYandex = Boolean(user.default_avatar_id);
  const fullName = user.real_name
    || [user.firstName, user.lastName].filter(Boolean).join(' ')
    || 'Имя не указано';
  const email = user.default_email || user.email || user.login;
  const statusText = isYandex ? 'Авторизован через Yandex' : 'Авторизован';
  const statusColor = isYandex ? '#10b981' : '#3b82f6';

  return (
    <div>
      <h2>👤 Профиль пользователя</h2>
      <div style={{
        marginTop: '24px',
        padding: '24px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '20px'
      }}>
        {isYandex && (
          <img
            src={`https://avatars.yandex.net/get-yapic/${user.default_avatar_id}/islands-200`}
            alt="Yandex Avatar"
            style={{ borderRadius: '50%', width: '100px', height: '100px' }}
          />
        )}

        <div>
          <p style={{ margin: '4px 0' }}><strong>Имя:</strong> {fullName}</p>
          {user.login && (
            <p style={{ margin: '4px 0' }}><strong>Логин:</strong> {user.login}</p>
          )}
          <p style={{ margin: '4px 0' }}><strong>Email:</strong> {email}</p>
          {user.group && (
            <p style={{ margin: '4px 0' }}><strong>Группа:</strong> {user.group}</p>
          )}
          <p style={{ margin: '4px 0', color: statusColor }}>
            <strong>Статус:</strong> {statusText}
          </p>
        </div>
      </div>
    </div>
  );
}
