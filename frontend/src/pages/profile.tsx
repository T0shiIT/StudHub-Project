import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated } = useAuth();

  // Новые локальные состояния
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [aboutText, setAboutText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Обработчик выбора файла аватарки
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Временный обработчик сохранения (позже замените на запрос к API)
  const handleSaveProfile = () => {
    // Здесь будет реальное сохранение на бэкенд
    console.log('Сохраняемые данные:', { avatarImage, aboutText });
    alert('Изменения сохранены локально! Позже тут будет отправка в БД.');
  };

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

      {/* Блок с аватаркой и основной информацией */}
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
        {/* Кликабельная аватарка – открывает выбор файла */}
        <div onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
          {avatarImage ? (
            <img
              src={avatarImage}
              alt="Загруженный аватар"
              style={{
                borderRadius: '50%',
                width: '100px',
                height: '100px',
                objectFit: 'cover'
              }}
            />
          ) : isYandex ? (
            <img
              src={`https://avatars.yandex.net/get-yapic/${user.default_avatar_id}/islands-200`}
              alt="Yandex Avatar"
              style={{
                borderRadius: '50%',
                width: '100px',
                height: '100px'
              }}
            />
          ) : (
            <div style={{
              borderRadius: '50%',
              width: '100px',
              height: '100px',
              backgroundColor: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: '#94a3b8'
            }}>
              <span>📷</span>
            </div>
          )}
        </div>

        {/* Скрытый input для загрузки файла */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />

        {/* Информация о пользователе */}
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

      {/* Блок "О себе" */}
      <div style={{
        marginTop: '24px',
        padding: '24px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>О себе</h3>
        <textarea
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          placeholder="Расскажите о себе..."
          rows={4}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            resize: 'vertical'
          }}
        />
        <button
          onClick={handleSaveProfile}
          style={{
            marginTop: '12px',
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Сохранить изменения
        </button>
      </div>

      {/* Кнопка чата - отдельным блоком */}
      <div style={{
        marginTop: '24px',
        display: 'flex',
        gap: '12px'
      }}>
        <button 
          onClick={() => navigate('/chat')} 
          style={{ 
            padding: '12px 24px',
            background: '#2563eb', 
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          Открыть чат
        </button>
      </div>
    </div>
  );
}