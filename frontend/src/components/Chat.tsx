import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../context/AuthContext';
import './chat.css';  // ← важно, чтобы стили загрузились

interface Props {
  roomId: string;
  title?: string;
}

export const Chat: React.FC<Props> = ({ roomId, title = 'Чат' }) => {
  const { user } = useAuth();
  const { messages, connected, error, sendMessage } = useChat(roomId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !connected || isSending) return;
    setIsSending(true);
    sendMessage(text);
    setInput('');
    setTimeout(() => setIsSending(false), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const getInitials = (login: string) => {
    if (!login) return '?';
    const parts = login.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return login.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (login: string) => {
    const colors = [
      '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c',
      '#65a30d', '#0891b2', '#0d9488', '#4f46e5', '#9333ea'
    ];
    let hash = 0;
    for (let i = 0; i < login.length; i++) {
      hash = login.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="chat-wrapper">
      <div className="chat-container">
        {/* Шапка */}
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-room-icon">
              <span>💬</span>
            </div>
            <div>
              <div className="chat-room-title">{title}</div>
              <div className={`chat-status ${connected ? 'online' : 'offline'}`}>
                {connected ? '● Онлайн' : '● Офлайн'}
              </div>
            </div>
          </div>
          <button className="chat-leave-btn" onClick={() => window.history.back()}>
            ✕ Выйти
          </button>
        </div>

        {error && <div className="chat-error">{error}</div>}

        {/* Сообщения */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <span className="chat-empty-icon">💬</span>
              <p>Сообщений пока нет</p>
              <span className="chat-empty-hint">Напишите что-нибудь!</span>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMe = user?.id === msg.sender_id;
            return (
              <div
                key={idx}
                className={`message-wrapper ${isMe ? 'own' : 'other'}`}
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                {!isMe && (
                  <div
                    className="avatar"
                    style={{ backgroundColor: getAvatarColor(msg.login || '') }}
                  >
                    {getInitials(msg.login || '')}
                  </div>
                )}
                <div className="message-content">
                  {!isMe && <div className="sender-name">{msg.login || 'Неизвестный'}</div>}
                  <div className={`message-bubble ${isMe ? 'own' : 'other'}`}>
                    <div className="message-text">{msg.text}</div>
                    <div className="message-time">{formatTime(msg.sent_at)}</div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Инпут */}
        <div className="chat-input-area">
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите сообщение..."
            rows={1}
            disabled={!connected}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!connected || !input.trim() || isSending}
          >
            {isSending ? '⏳' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
};