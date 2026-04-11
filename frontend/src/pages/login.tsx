import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = () => {
    // Временно просто пускаем в систему
    localStorage.setItem('isAuthenticated', 'true');
    navigate('/schedule');
  };

  return (
    <div className="login-container">
      <h1>StudHub</h1>
      <p style={{ margin: '20px 0', color: '#64748b' }}>
        Единая платформа для студентов
      </p>
      <button className="btn btn-primary" onClick={handleLogin} style={{ width: '100%', marginBottom: '12px' }}>
        Войти через Яндекс
      </button>
      <button className="btn btn-vk" onClick={handleLogin} style={{ width: '100%' }}>
        Войти через ВК
      </button>
    </div>
  );
}