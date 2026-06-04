import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dmRoomId } from '../utils/token';

interface Props {
  /** ID пользователя, которому хотим написать */
  targetUserId: number;
}

/**
 * Кнопка «Написать сообщение» для страницы профиля.
 * Не отображается, если смотришь на свой собственный профиль.
 */
export const SendMessageButton: React.FC<Props> = ({ targetUserId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user || user.id === targetUserId) return null;

  const handleClick = () => {
    navigate(`/messages?room=${dmRoomId(user.id, targetUserId)}`);
  };

  return (
    <button onClick={handleClick} className="send-message-btn">
      ✉ Написать сообщение
    </button>
  );
};
