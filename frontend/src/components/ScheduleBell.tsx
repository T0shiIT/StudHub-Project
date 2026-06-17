import { useState, useEffect, useRef } from 'react';
import { fetchWithCsrf } from '../utils/csrf';
import type { Notification, NotificationsResponse } from '../types/notification';

const API_NOTIFICATIONS_URL = '/api/notifications';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах

export const ScheduleBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Закрытие попапа при клике вне его
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Опционально: можно вызывать markAllAsRead при закрытии, если хотите
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Загрузка и фильтрация уведомлений
  const fetchNotifications = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetchWithCsrf(`${API_NOTIFICATIONS_URL}?limit=50`);
      if (!response.ok) {
        if (response.status === 401) return; // Не авторизован
        console.warn('Failed to fetch notifications:', response.status);
        return;
      }
      
      const data: NotificationsResponse = await response.json();
      const rawNotifications: Notification[] = 
        Array.isArray(data.notifications) ? data.notifications :
        Array.isArray(data) ? data : [];

      // 🔥 ФИЛЬТРАЦИЯ: Убираем прочитанные уведомления, которым больше 7 дней
      const now = Date.now();
      const filteredNotifications = rawNotifications.filter(n => {
        if (!n.read) return true; // Непрочитанные оставляем всегда
        if (!n.createdAt) return true; // Если даты нет, оставляем на всякий случай
        
        const createdTime = new Date(n.createdAt).getTime();
        return (now - createdTime) < SEVEN_DAYS_MS; // Оставляем, если прошло меньше 7 дней
      });

      setNotifications(filteredNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Обновляем список при открытии попапа
  useEffect(() => {
    if (isOpen) {
      void fetchNotifications();
    }
  }, [isOpen]);

  // Отметить ВСЕ как прочитанные
  const handleMarkAllAsRead = async () => {
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount === 0) return;

    try {
      await fetchWithCsrf(`${API_NOTIFICATIONS_URL}/mark-all-read`, { method: 'PATCH' });
      // Обновляем локальный стейт, не делая новый запрос к серверу
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Отметить ОДНО конкретное уведомление как прочитанное (при клике на него)
  const handleMarkAsRead = async (id: number) => {
    try {
      await fetchWithCsrf(`${API_NOTIFICATIONS_URL}/mark-read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([id])
      });
      // Обновляем локальный стейт
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // 🔥 ЛОГИКА КРАСНОЙ ТОЧКИ: точка есть, только если есть хотя бы одно непрочитанное
  const hasUnread = notifications.some(n => !n.read);

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return 'время неизвестно';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="schedule-bell" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none', border: 'none', padding: 4, cursor: 'pointer',
          display: 'flex', alignItems: 'center', position: 'relative'
        }}
        aria-label="Уведомления"
        aria-expanded={isOpen}
      >
        <img src="/icons/bell.svg" alt="🔔" style={{ width: 22, height: 22 }} />
        
        {/* 🔥 КРАСНАЯ ТОЧКА: рендерится только если hasUnread === true */}
        {hasUnread && (
          <span style={{
            position: 'absolute', top: 2, right: 2, width: 8, height: 8,
            background: '#ef4444', borderRadius: '50%', border: '2px solid white'
          }} />
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 8, minWidth: 260,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
          padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000
        }}>
          {loading ? (
            <div style={{ color: '#6b7280', textAlign: 'center' }}>Загрузка...</div>
          ) : notifications.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'center' }}>Нет новых уведомлений</div>
          ) : (
            <>
              {/* Кнопка "Прочитать все" (показывается, только если есть непрочитанные) */}
              {hasUnread && (
                <button
                  onClick={handleMarkAllAsRead}
                  style={{
                    width: '100%', marginBottom: 12, padding: '6px 0',
                    background: '#f3f4f6', border: 'none', borderRadius: 6,
                    color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500
                  }}
                >
                  Прочитать все
                </button>
              )}

              {/* Список уведомлений */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && handleMarkAsRead(n.id)}
                    style={{
                      // 🔥 ВИЗУАЛЬНОЕ ВЫДЕЛЕНИЕ: прозрачность 0.6 для прочитанных
                      opacity: n.read ? 0.6 : 1,
                      cursor: n.read ? 'default' : 'pointer',
                      padding: 8,
                      borderRadius: 8,
                      transition: 'opacity 0.2s, background 0.2s',
                      background: n.read ? 'transparent' : '#f9fafb'
                    }}
                  >
                    <div style={{ fontWeight: n.read ? 400 : 600, fontSize: 14, color: '#111827', marginBottom: 4 }}>
                      {n.message || 'Расписание обновлено'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {formatDateTime(n.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};