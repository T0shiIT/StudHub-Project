import { useState, useEffect, useRef } from 'react';
import { fetchWithCsrf } from '../utils/csrf';
import type { Notification, NotificationsResponse } from '../types/notification';

const API_NOTIFICATIONS_URL = 'http://localhost:8080/api/notifications';

export const ScheduleBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastChange, setLastChange] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Закрытие попапа при клике вне
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Загрузка последнего уведомления об изменении расписания
  const fetchLastScheduleChange = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetchWithCsrf(`${API_NOTIFICATIONS_URL}?limit=10`);
      if (!response.ok) {
        if (response.status === 401) {
          // Пользователь не авторизован — просто скрываем уведомления
          return;
        }
        console.warn('Failed to fetch notifications:', response.status);
        return;
      }
      const data: NotificationsResponse = await response.json();
      const notifications: Notification[] = 
        Array.isArray(data.notifications) ? data.notifications :
        Array.isArray(data) ? data : [];
      
      // Фильтруем уведомления, связанные с расписанием
      const scheduleChanges = notifications.filter(n => 
        n.type?.toUpperCase().includes('SCHEDULE') || 
        n.message?.toLowerCase().includes('расписани')
      );
      
      if (scheduleChanges.length > 0) {
        // Берем самое новое (предполагаем, что бэкенд возвращает в порядке убывания)
        setLastChange(scheduleChanges[0]);
      }
    } catch (error) {
      console.error('Error fetching schedule change notification:', error);
    } finally {
      setLoading(false);
    }
  };

  // Обновляем при открытии попапа
  useEffect(() => {
    if (isOpen) {
      void fetchLastScheduleChange();
    }
  }, [isOpen]);

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return 'время неизвестно';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="schedule-bell" ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Кнопка-колокольчик */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}
        aria-label="Уведомления об изменении расписания"
        aria-expanded={isOpen}
      >
        <img
          src="/icons/bell.svg"
          alt="🔔"
          style={{ 
            width: 22, 
            height: 22,
            filter: 'var(--bell-filter, none)' // можно переопределить в CSS при ховере
          }}
        />
        {/* Индикатор нового уведомления (опционально) */}
        {lastChange && !lastChange.read && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 8,
            height: 8,
            background: '#ef4444',
            borderRadius: '50%',
            border: '2px solid white'
          }} />
        )}
      </button>

      {/* Попап с информацией */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          marginTop: 8,
          minWidth: 220,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 1000,
          fontSize: 14
        }}>
          {loading ? (
            <div style={{ color: '#6b7280' }}>Загрузка...</div>
          ) : lastChange ? (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Расписание обновлено
              </div>
              <div style={{ color: '#6b7280', fontSize: 13 }}>
                {formatDateTime(lastChange.createdAt)}
              </div>
              {lastChange.message && lastChange.message !== 'Расписание обновлено' && (
                <div style={{ marginTop: 8, color: '#374151', fontSize: 13 }}>
                  {lastChange.message}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#6b7280' }}>
              Изменений в расписании нет
            </div>
          )}
        </div>
      )}
    </div>
  );
};