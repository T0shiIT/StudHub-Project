// src/components/NotificationBell.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, type AppNotification } from '../hooks/useNotifications';

const TOAST_DURATION_MS = 4500;

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Показываем тост при каждом новом уведомлении
  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[0];
    if (latest.read) return;

    setToasts((prev) => [...prev, latest]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== latest.id));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notifications[0]?.id]); // срабатывает только при появлении нового

  // Закрываем дропдаун при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotificationClick = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <>
      {/* ── Колокольчик ─────────────────────────────────────────────────── */}
      <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => { setOpen((v) => !v); if (!open) markAllRead(); }}
          title="Уведомления"
          style={{
            position: 'relative',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 22,
            lineHeight: 1,
            padding: '4px 6px',
            borderRadius: 8,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: '#ef4444',
              color: '#fff',
              borderRadius: '50%',
              fontSize: 10,
              fontWeight: 700,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* ── Дропдаун ──────────────────────────────────────────────────── */}
        {open && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 320,
            maxHeight: 420,
            overflowY: 'auto',
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            zIndex: 1000,
            border: '1px solid #e2e8f0',
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f1f5f9',
              fontWeight: 600,
              fontSize: 14,
              color: '#334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>Уведомления</span>
              {notifications.length > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#3b82f6', padding: 0,
                  }}
                >
                  Прочитать все
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                Нет уведомлений
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '12px 16px',
                    cursor: n.link ? 'pointer' : 'default',
                    background: n.read ? '#fff' : '#eff6ff',
                    borderBottom: '1px solid #f8fafc',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? '#fff' : '#eff6ff')}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{iconFor(n.eventType)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: n.read ? 400 : 600, fontSize: 13, color: '#1e293b' }}>
                        {n.title}
                      </div>
                      <div style={{
                        fontSize: 12, color: '#64748b', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {n.body}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        {formatTime(n.timestamp)}
                      </div>
                    </div>
                    {!n.read && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#3b82f6', flexShrink: 0, marginTop: 4,
                      }} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Тосты ───────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 2000,
        pointerEvents: 'none',
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #3b82f6',
              borderRadius: 10,
              padding: '12px 16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              maxWidth: 320,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              animation: 'slideInToast 0.3s ease',
              pointerEvents: 'auto',
            }}
          >
            <span style={{ fontSize: 20 }}>{iconFor(toast.eventType)}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{toast.title}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{toast.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CSS-анимация тоста ───────────────────────────────────────────── */}
      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function iconFor(type: string): string {
  switch (type) {
    case 'new_announcement':  return '📢';
    case 'schedule_updated':  return '📅';
    case 'grade_updated':     return '📝';
    default:                  return '🔔';
  }
}

function formatTime(ms: number): string {
  const now = Date.now();
  const diff = Math.floor((now - ms) / 1000);
  if (diff < 60)  return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
  return new Date(ms).toLocaleDateString('ru-RU');
}
