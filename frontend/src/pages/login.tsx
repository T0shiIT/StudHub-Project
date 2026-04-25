import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import yandexIcon from '../assets/yandex-icon.png'
import vkIcon from '../assets/vk-icon.png'

export default function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.email || !formData.password) {
      setError('Заполните все поля')
      return
    }

    // Временно просто пускаем в систему
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('userEmail', formData.email)
    navigate('/schedule')
  }

  const handleYandexLogin = () => {
    window.location.href = 'http://localhost:8080/oauth2/authorization/yandex'
  }

  const handleVkLogin = () => {
    // Пока заглушка
    localStorage.setItem('isAuthenticated', 'true')
    navigate('/schedule')
  }

  return (
    <div className="login-container">
      <div className="login-header">
        <h1>StudHub</h1>
        <p>Единая платформа для студентов</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <input
            type="email"
            name="email"
            placeholder="Login / Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <input
            type="password"
            name="password"
            placeholder="Пароль"
            value={formData.password}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>

        <button type="submit" className="btn btn-primary btn-login">
          Войти
        </button>
      </form>

      <div className="social-login">
        <p>Или войдите через</p>
        <div className="social-icons">
          <button 
            onClick={handleYandexLogin} 
            className="social-icon yandex"
            title="Войти через Яндекс"
          >
            <img src={yandexIcon} alt="Яндекс" />
          </button>
          <button 
            onClick={handleVkLogin} 
            className="social-icon vk"
            title="Войти через ВК"
          >
            <img src={vkIcon} alt="ВК" />
          </button>
        </div>
      </div>

      <div className="auth-footer">
        <p>Ещё нет аккаунта?</p>
        <Link to="/register" className="btn btn-outline">
          Зарегистрироваться
        </Link>
      </div>
    </div>
  )
}