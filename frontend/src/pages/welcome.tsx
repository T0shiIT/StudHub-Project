import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

export default function Welcome() {
  return (
    <div className="welcome-container">
      <div className="welcome-card">
        {/* Логотип */}
        <img src={logo} alt="StudHub Logo" className="welcome-logo" />
        
        <h1 className="welcome-title">Добро пожаловать в StudHub</h1>
        <p className="welcome-desc">
          Единая платформа для расписания, оценок и объявлений
        </p>

        <div className="welcome-actions">
          <Link to="/schedule" className="btn btn-primary">Расписание</Link>
          <Link to="/grades" className="btn btn-success">Мои оценки</Link>
          <Link to="/login" className="btn btn-outline">Войти в аккаунт</Link>
        </div>

        <div className="welcome-features">
          <div className="feature">
            <span></span>
            <p>Уведомления об изменениях</p>
          </div>
          <div className="feature">
            <span></span>
            <p>Важные объявления</p>
          </div>
          <div className="feature">
            <span></span>
            <p>Работает на любом устройстве</p>
          </div>
        </div>
      </div>
    </div>
  )
}