import { Link } from 'react-router-dom'

export default function RegisterSuccess() {
  const email = localStorage.getItem('registeredEmail') || 'ваш email'

  return (
    <div className="success-container">
      <div className="success-card">
        <div className="success-icon"></div>
        <h1>Подтвердите email</h1>
        <p className="success-text">
          Мы отправили письмо на <strong>{email}</strong>.
        </p>
        <div className="success-info">
          <p>Чтобы завершить регистрацию:</p>
          <ul>
            <li>Откройте письмо от StudHub</li>
            <li>Нажмите кнопку <b>«Подтвердить email»</b></li>
            <li>Вы автоматически попадёте на главную страницу</li>
          </ul>
          <p style={{ marginTop: '12px', color: '#64748b', fontSize: '13px' }}>
            Если письма нет — проверьте папку «Спам».
          </p>
        </div>
        <Link to="/login" className="btn btn-outline" style={{ marginTop: '24px' }}>
          Вернуться ко входу
        </Link>
      </div>
    </div>
  )
}
