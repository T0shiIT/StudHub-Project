import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { getAllGroups, updateUserGroup, getUserGroup } from '../api/groups';

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, refreshUser } = useAuth();

  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [aboutText, setAboutText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [groupLoading, setGroupLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([getAllGroups(), getUserGroup()])
        .then(([groupsRes, userGroupRes]) => {
          setAvailableGroups(groupsRes.data);
          const currentGroup = userGroupRes.data || '';
          setSelectedGroup(currentGroup);
        })
        .catch(err => console.error('Ошибка загрузки групп:', err));
    }
  }, [isAuthenticated]);

  const handleGroupChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGroup = e.target.value;
    setSelectedGroup(newGroup);
    setGroupLoading(true);
    setSaveMessage(null);
    try {
      await updateUserGroup(newGroup);
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
        setSelectedGroup(current.data || '');
      } catch {
        // не критично
      }
    } finally {
      setGroupLoading(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    console.log('Сохраняемые данные:', { avatarImage, aboutText });
    alert('Изменения сохранены локально! Позже тут будет отправка в БД.');
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}><h2>Загрузка профиля...</h2></div>;
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

  return (
    <div>
      <h2>👤 Профиль пользователя</h2>

      <div style={{ marginTop: '24px', padding: '24px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
          {avatarImage ? (
            <img src={avatarImage} alt="Аватар" style={{ borderRadius: '50%', width: '100px', height: '100px', objectFit: 'cover' }} />
          ) : isYandex ? (
            <img src={`https://avatars.yandex.net/get-yapic/${(user as any).default_avatar_id}/islands-200`} alt="Yandex Avatar" style={{ borderRadius: '50%', width: '100px', height: '100px' }} />
          ) : (
            <div style={{ borderRadius: '50%', width: '100px', height: '100px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: '#94a3b8' }}>
              <span>📷</span>
            </div>
          )}
        </div>
        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleAvatarChange} />
        <div>
          <p><strong>Имя:</strong> {fullName}</p>
          {user?.login && <p><strong>Логин:</strong> {user.login}</p>}
          <p><strong>Email:</strong> {email}</p>
        </div>
      </div>

      <div style={{ marginTop: '24px', padding: '24px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>Учебная группа</h3>
        <select
          value={selectedGroup}
          onChange={handleGroupChange}
          disabled={groupLoading}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
        >
          <option value="">-- Не выбрана --</option>
          {availableGroups.map(group => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
        {groupLoading && <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Сохранение...</p>}
        {saveMessage && (
          <p style={{ marginTop: '8px', fontSize: '12px', color: saveMessage.type === 'success' ? '#10b981' : '#ef4444' }}>
            {saveMessage.text}
          </p>
        )}
      </div>

      <div style={{ marginTop: '24px', padding: '24px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>О себе</h3>
        <textarea
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          placeholder="Расскажите о себе..."
          rows={4}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', resize: 'vertical' }}
        />
        <button onClick={handleSaveProfile} style={{ marginTop: '12px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
          Сохранить изменения
        </button>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
        <button onClick={() => navigate('/chat')} style={{ padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
          Открыть чат
        </button>
      </div>
    </div>
  );
}