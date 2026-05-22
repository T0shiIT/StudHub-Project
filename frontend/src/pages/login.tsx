import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import yandexIcon from '../assets/yandex-icon.png';
import vkIcon from '../assets/vk-icon.png';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';

export default function Login() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.email || !formData.password) {
      setError('Заполните все поля');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Ошибка входа');
        return;
      }
      await refresh();
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', formData.email);
      navigate('/schedule');
    } catch {
      setError('Сервер недоступен');
    } finally {
      setSubmitting(false);
    }
  };

  const handleYandexLogin = () => {
    window.location.href = 'http://localhost:8080/oauth2/authorization/yandex';
  };

  const handleVkLogin = () => {
    localStorage.setItem('isAuthenticated', 'true');
    navigate('/schedule');
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <h1>StudHub</h1>
        <p>Единая платформа для студентов</p>
      </div>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <input type="email" name="email" placeholder="Login / Email"
                 value={formData.email} onChange={handleChange} required className="form-input" />
        </div>
        <div className="form-group">
          <input type="password" name="password" placeholder="Пароль"
                 value={formData.password} onChange={handleChange} required className="form-input" />
        </div>
        <button type="submit" className="btn btn-primary btn-login" disabled={submitting}>
          {submitting ? 'Входим…' : 'Войти'}
        </button>
      </form>
      <div className="social-login">
        <p>Или войдите через</p>
        <div className="social-icons">
          <button onClick={handleYandexLogin} className="social-icon yandex" title="Войти через Яндекс">
            <img src={yandexIcon} alt="Яндекс" />
          </button>
          <button onClick={handleVkLogin} className="social-icon vk" title="Войти через ВК">
            <img src={vkIcon} alt="ВК" />
          </button>
        </div>
      </div>
      <div className="auth-footer">
        <p>Ещё нет аккаунта?</p>
        <Link to="/register" className="btn btn-outline">Зарегистрироваться</Link>
      </div>
    </div>
  );
}