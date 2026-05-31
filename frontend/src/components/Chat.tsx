import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../context/AuthContext';

interface Props {
  roomId: string;       // например "general" или "group-ИВТ-21" или "dm-1-3"
  title?: string;
}

export const Chat: React.FC<Props> = ({ roomId, title = 'Чат' }) => {
  const { user } = useAuth();
  const { messages, connected, error, sendMessage } = useChat(roomId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Автоскролл вниз при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-container">
      {/* Шапка */}
      <div className="chat-header">
        <span>{title}</span>
        <span className={`chat-status ${connected ? 'online' : 'offline'}`}>
          {connected ? '● онлайн' : '● офлайн'}
        </span>
      </div>

      {/* Ошибка */}
      {error && <div className="chat-error">{error}</div>}

      {/* Список сообщений */}
      <div className="chat-messages">
        {messages.map((msg, i) => {
          const isMe = user?.id === msg.sender_id;
          return (
            <div key={i} className={`chat-message ${isMe ? 'me' : 'other'}`}>
              {!isMe && <div className="chat-login">{msg.login}</div>}
              <div className="chat-bubble">{msg.text}</div>
              <div className="chat-time">{formatTime(msg.sent_at)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Инпут */}
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение..."
          rows={1}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!connected || !input.trim()}
        >
          Отправить
        </button>
      </div>
    </div>
  );
};
