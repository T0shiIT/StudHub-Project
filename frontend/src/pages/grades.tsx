import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Grades() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Журнал оценок</h2>
        <p style={{ color: '#64748b', marginTop: '16px' }}>Проверяем авторизацию...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Журнал оценок</h2>
        <p style={{ color: '#64748b', marginTop: '16px' }}>
          Для просмотра оценок необходимо <Link to="/login" style={{ color: '#3b82f6' }}>авторизоваться</Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2>Журнал оценок</h2>
      <p style={{ color: '#64748b', marginTop: '16px' }}>
        Здесь будет таблица с оценками (задача Анны)
      </p>
    </div>
  )
}