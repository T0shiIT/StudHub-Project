import React from 'react';
import { Chat } from '../components/Chat';
import { useAuth } from '../context/AuthContext';
import '../components/chat.css';

const ChatPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div style={{ padding: '24px' }}>
      {user?.group && (
        <Chat roomId={`group-${user.group}`} title={`Чат группы ${user.group}`} />
      )}
    </div>
  );
};

export default ChatPage;
