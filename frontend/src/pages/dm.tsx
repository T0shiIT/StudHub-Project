import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chat } from '../components/Chat';
import { useAuth } from '../context/AuthContext';
import { useDialogs, searchUsers } from '../hooks/useDialogs';
import { dmRoomId } from '../utils/token';
import './dm.css';

// Тип объявлен локально — не зависит от экспорта useDialogs
interface UserSearchResult {
  id: number;
  login: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const DirectMessagesPage: React.FC = () => {
  const { user } = useAuth();
  const { dialogs, loading, refresh, markRead } = useDialogs();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeRoom = searchParams.get('room');

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchUsers(query);
      setSearchResults(results.filter((r) => r.id !== user?.id));
      setSearching(false);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, user?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openDialog = (roomId: string) => {
    setSearchParams({ room: roomId });
    markRead(roomId);
    setSearchResults([]);
    setQuery('');
  };

  const startChatWith = (companion: UserSearchResult) => {
    if (!user) return;
    const roomId = dmRoomId(user.id, companion.id);
    openDialog(roomId);
    setTimeout(refresh, 500);
  };

  const formatTime = (ms: number) => {
    if (!ms) return '';
    const d = new Date(ms);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const activeDialog = dialogs.find((d) => d.roomId === activeRoom);
  const chatTitle = activeDialog?.companionFullName || activeDialog?.companionLogin || 'Диалог';

  return (
    <div className={`dm-layout ${activeRoom ? 'has-active' : ''}`}>
      <aside className="dm-sidebar">
        <div className="dm-sidebar-header"><h2>Сообщения</h2></div>

        <div className="dm-search-wrap" ref={searchRef}>
          <div className="dm-search-row">
            <span className="dm-search-icon">🔍</span>
            <input
              className="dm-search-input"
              type="text"
              placeholder="Найти пользователя..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && <span className="dm-search-spinner">⟳</span>}
          </div>

          {searchResults.length > 0 && (
            <ul className="dm-search-dropdown">
              {searchResults.map((r) => {
                const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ');
                return (
                  <li key={r.id} className="dm-search-result" onMouseDown={() => startChatWith(r)}>
                    <div className="dm-avatar dm-avatar-sm">
                      {(fullName || r.login)[0].toUpperCase()}
                    </div>
                    <div className="dm-search-result-info">
                      <span className="dm-search-result-name">{fullName || r.login}</span>
                      <span className="dm-search-result-login">@{r.login}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {query.trim() && !searching && searchResults.length === 0 && (
            <div className="dm-search-empty">Пользователи не найдены</div>
          )}
        </div>

        {loading && dialogs.length === 0 ? (
          <div className="dm-loading">Загрузка…</div>
        ) : (
          <ul className="dm-dialog-list">
            {dialogs.map((d) => (
              <li
                key={d.roomId}
                className={`dm-dialog-item ${activeRoom === d.roomId ? 'active' : ''}`}
                onClick={() => openDialog(d.roomId)}
              >
                <div className="dm-avatar">
                  {(d.companionFullName || d.companionLogin)[0].toUpperCase()}
                </div>
                <div className="dm-dialog-info">
                  <div className="dm-dialog-name">{d.companionFullName || d.companionLogin}</div>
                  <div className="dm-dialog-preview">{d.lastMessage || <em>Нет сообщений</em>}</div>
                </div>
                <div className="dm-dialog-meta">
                  <span className="dm-dialog-time">{formatTime(d.lastMessageTime)}</span>
                  {d.unreadCount > 0 && (
                    <span className="dm-unread-badge">{d.unreadCount}</span>
                  )}
                </div>
              </li>
            ))}
            {dialogs.length === 0 && !loading && (
              <li className="dm-empty">Нет диалогов. Найдите пользователя выше.</li>
            )}
          </ul>
        )}
      </aside>

      <main className="dm-main">
        {activeRoom ? (
          <Chat roomId={activeRoom} title={chatTitle} />
        ) : (
          <div className="dm-placeholder">
            <div className="dm-placeholder-icon">💬</div>
            <p>Выберите диалог или найдите пользователя</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default DirectMessagesPage;