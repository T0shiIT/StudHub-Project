import { Link } from 'react-router-dom'

export default function RegisterSuccess() {
  const email = localStorage.getItem('registeredEmail') || 'ваш email'

  return (
    <div className="success-container">
      <div className="success-card">
        <div className="success-icon"></div>
        <h1>Регистрация успешна!</h1>
        <p className="success-text">
          Аккаунт для <strong>{email}</strong> успешно создан
        </p>
        <div className="success-info">
          <p>Теперь вы можете:</p>
          <ul>
            <li>Просматривать расписание занятий</li>
            <li>Отслеживать свои оценки</li>
            <li>Получать объявления от преподавателей</li>
          </ul>
        </div>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: '24px' }}>
          Войти в аккаунт
        </Link>
      </div>
    </div>
  )
}