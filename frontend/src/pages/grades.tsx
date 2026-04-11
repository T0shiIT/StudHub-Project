export default function Grades() {
  const isAuth = localStorage.getItem('isAuth') === 'true'

  if (!isAuth) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Журнал оценок</h2>
        <p style={{ color: '#64748b', marginTop: '16px' }}>
          Для просмотра оценок необходимо <a href="/login" style={{ color: '#3b82f6' }}>авторизоваться</a>
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