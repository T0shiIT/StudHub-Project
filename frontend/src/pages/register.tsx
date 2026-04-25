import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    login: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    group: ''
  })
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (formData.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }

    try {
      const response = await fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          login: formData.login,
          group: formData.group
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error || 'Ошибка при регистрации')
        return
      }

      localStorage.setItem('registeredEmail', formData.email)
      // Обновляем глобальный AuthContext, чтобы /profile увидел активную сессию
      await refresh()
      navigate('/register-success')
    } catch (err) {
      setError('Не удалось связаться с сервером')
    }
  }

  return (
    <div className="login-container">
      <h1>Регистрация</h1>
      <p style={{ marginBottom: '24px', color: '#64748b' }}>
        Создайте аккаунт для доступа к платформе
      </p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="register-form">
        <div className="form-row">
          <input
            type="text"
            name="firstName"
            placeholder="Имя"
            value={formData.firstName}
            onChange={handleChange}
            required
            className="form-input"
          />
          <input
            type="text"
            name="lastName"
            placeholder="Фамилия"
            value={formData.lastName}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          className="form-input"
        />

        <input
          type="text"
          name="login"
          placeholder="Логин"
          value={formData.login}
          onChange={handleChange}
          required
          className="form-input"
        />

        <input
          type="text"
          name="group"
          placeholder="Группа (например, ИС-2024)"
          value={formData.group}
          onChange={handleChange}
          required
          className="form-input"
        />

        <input
          type="password"
          name="password"
          placeholder="Пароль"
          value={formData.password}
          onChange={handleChange}
          required
          className="form-input"
        />

        <input
          type="password"
          name="confirmPassword"
          placeholder="Подтвердите пароль"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          className="form-input"
        />

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
          Зарегистрироваться
        </button>
      </form>

      <div className="auth-footer" style={{ marginTop: '20px' }}>
        <p>Уже есть аккаунт?</p>
        <Link to="/login" className="btn btn-outline" style={{ marginTop: '12px' }}>
          Войти
        </Link>
      </div>
    </div>
  )
}