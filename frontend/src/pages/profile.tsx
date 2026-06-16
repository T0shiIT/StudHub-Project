import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { getAllGroups, updateUserGroup, getUserGroup } from '../api/groups';

// Импортируем все аватары из папки assets/avatars/
const avatarModules = import.meta.glob('../assets/avatars/*.png', { eager: true, query: '?url', import: 'default' });
// Получаем массив объектов { name, url }
const AVATAR_LIST = Object.entries(avatarModules).map(([path, url]) => ({
  name: path.split('/').pop()!,
  url: url as string,
}));

// Ключи для localStorage
const STORAGE_KEYS = {
  avatar: 'selectedAvatar',
  about: 'aboutText',
  group: 'selectedGroup',
};

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, refreshUser } = useAuth();

  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [aboutText, setAboutText] = useState('');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [groupLoading, setGroupLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Загружаем сохранённые данные из localStorage при монтировании
  useEffect(() => {
    const savedAvatar = localStorage.getItem(STORAGE_KEYS.avatar);
    if (savedAvatar) {
      setSelectedAvatar(savedAvatar);
    }
    const savedAbout = localStorage.getItem(STORAGE_KEYS.about);
    if (savedAbout) {
      setAboutText(savedAbout);
    }
  }, []);

  // Если пользователь пришёл с сервера и у него есть avatar, используем его
  useEffect(() => {
    if (user && (user as any).avatar) {
      setSelectedAvatar((user as any).avatar);
      localStorage.setItem(STORAGE_KEYS.avatar, (user as any).avatar);
    }
  }, [user]);

  // Загрузка групп и текущей группы пользователя
  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([getAllGroups(), getUserGroup()])
        .then(([groupsRes, userGroupRes]) => {
          setAvailableGroups(groupsRes.data || []);
          const currentGroup = userGroupRes.data?.group || '';
          if (currentGroup) {
            setSelectedGroup(currentGroup);
            localStorage.setItem(STORAGE_KEYS.group, currentGroup);
          } else {
            const savedGroup = localStorage.getItem(STORAGE_KEYS.group) || '';
            setSelectedGroup(savedGroup);
          }
        })
        .catch(err => {
          console.error('Ошибка загрузки групп:', err);
          const savedGroup = localStorage.getItem(STORAGE_KEYS.group) || '';
          setSelectedGroup(savedGroup);
        });
    }
  }, [isAuthenticated]);

  const handleGroupChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGroup = e.target.value;
    setSelectedGroup(newGroup);
    setGroupLoading(true);
    setSaveMessage(null);
    try {
      await updateUserGroup(newGroup);
      localStorage.setItem(STORAGE_KEYS.group, newGroup);
      setSaveMessage({ text: 'Группа успешно обновлена', type: 'success' });
      await refreshUser();
    } catch (error: any) {
      const errorMsg =
        typeof error.response?.data === 'string'
          ? error.response.data
          : error.response?.data?.message || 'Ошибка при сохранении группы';
      setSaveMessage({ text: errorMsg, type: 'error' });
      try {
        const current = await getUserGroup();
        setSelectedGroup(current.data?.group || '');
      } catch {
        // не критично
      }
    } finally {
      setGroupLoading(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleSaveProfile = async () => {
    try {
      localStorage.setItem(STORAGE_KEYS.avatar, selectedAvatar);
      localStorage.setItem(STORAGE_KEYS.about, aboutText);
      setSaveMessage({ text: 'Изменения сохранены локально', type: 'success' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({ text: error.message || 'Ошибка', type: 'error' });
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Загрузка профиля...</div>;
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

  const isYandex = (user as any)?.default_avatar_id;
  const fullName = (user as any)?.real_name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Имя не указано';
  const email = (user as any)?.default_email || user?.email || user?.login;
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Находим URL выбранного аватара
  const selectedAvatarUrl = AVATAR_LIST.find(a => a.name === selectedAvatar)?.url || null;

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <h1>Профиль пользователя</h1>
        <p>Управляйте своими данными</p>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Левая колонка: аватар и основная информация */}
        <div className="dashboard-column">
          <div className="dashboard-section" style={{ textAlign: 'center' }}>
            <div 
              onClick={() => setIsAvatarModalOpen(true)}
              style={{ cursor: 'pointer', display: 'inline-block' }}
            >
              {selectedAvatarUrl ? (
                <img 
                  src={selectedAvatarUrl} 
                  alt="Аватар" 
                  style={{ 
                    borderRadius: '50%', 
                    width: '120px', 
                    height: '120px', 
                    objectFit: 'cover',
                    border: '3px solid #e2e8f0',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                />
              ) : isYandex ? (
                <img 
                  src={`https://avatars.yandex.net/get-yapic/${(user as any).default_avatar_id}/islands-200`} 
                  alt="Yandex Avatar" 
                  style={{ 
                    borderRadius: '50%', 
                    width: '120px', 
                    height: '120px',
                    border: '3px solid #e2e8f0'
                  }} 
                />
              ) : (
                <div style={{ 
                  borderRadius: '50%', 
                  width: '120px', 
                  height: '120px', 
                  backgroundColor: '#2563eb', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '48px', 
                  color: 'white',
                  fontWeight: 'bold',
                  border: '3px solid #e2e8f0',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  {initials || '?'}
                </div>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
              Нажмите на аватар, чтобы выбрать
            </p>
            <h3 style={{ marginTop: '12px', marginBottom: '4px' }}>{fullName}</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>@{user?.login || 'user'}</p>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{email}</p>
            {user?.role && (
              <span style={{ 
                display: 'inline-block', 
                background: '#e2e8f0', 
                padding: '2px 12px', 
                borderRadius: '20px', 
                fontSize: '0.75rem',
                marginTop: '8px',
                color: '#475569'
              }}>
                {user.role}
              </span>
            )}
          </div>
        </div>

        {/* Правая колонка: группа и о себе */}
        <div className="dashboard-column">
          <div className="dashboard-section">
            <h3 style={{ marginBottom: '12px', fontSize: '1.1rem' }}>Учебная группа</h3>
            <select
              value={selectedGroup}
              onChange={handleGroupChange}
              disabled={groupLoading}
              style={{ 
                width: '100%', 
                padding: '10px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="">-- Не выбрана --</option>
              {availableGroups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            {groupLoading && <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Сохранение...</p>}
            {saveMessage && (
              <p style={{ 
                marginTop: '8px', 
                fontSize: '12px', 
                color: saveMessage.type === 'success' ? '#10b981' : '#ef4444' 
              }}>
                {saveMessage.text}
              </p>
            )}
          </div>

          <div className="dashboard-section">
            <h3 style={{ marginBottom: '12px', fontSize: '1.1rem' }}>О себе</h3>
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
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button 
              onClick={handleSaveProfile} 
              style={{ 
                padding: '12px 24px', 
                background: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
            >
              Сохранить изменения
            </button>
            <button 
              onClick={() => navigate('/chat')} 
              style={{ 
                padding: '12px 24px', 
                background: 'transparent', 
                color: '#2563eb', 
                border: '2px solid #2563eb', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2563eb';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#2563eb';
              }}
            >
              Открыть чат
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно выбора аватара */}
      {isAvatarModalOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsAvatarModalOpen(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '16px', textAlign: 'center' }}>Выберите аватар</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', 
              gap: '12px',
            }}>
              {AVATAR_LIST.map(({ name, url }) => {
                const isSelected = selectedAvatar === name;
                return (
                  <div 
                    key={name}
                    onClick={() => {
                      setSelectedAvatar(name);
                      localStorage.setItem(STORAGE_KEYS.avatar, name);
                      setIsAvatarModalOpen(false);
                    }}
                    style={{ 
                      cursor: 'pointer',
                      border: isSelected ? '3px solid #2563eb' : '2px solid transparent',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      width: '70px',
                      height: '70px',
                      transition: 'border-color 0.2s, transform 0.2s',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      margin: '0 auto',
                    }}
                  >
                    <img 
                      src={url} 
                      alt={name}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        borderRadius: '50%',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button 
                onClick={() => setIsAvatarModalOpen(false)}
                style={{
                  padding: '8px 24px',
                  background: '#e2e8f0',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}