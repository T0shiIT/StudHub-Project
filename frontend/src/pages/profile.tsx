export default function Profile() {
  const isAuth = localStorage.getItem('isAuth') === 'true'

  if (!isAuth) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Профиль</h2>
        <p style={{ color: '#64748b', marginTop: '16px' }}>
          Для просмотра профиля необходимо <a href="/login" style={{ color: '#3b82f6' }}>авторизоваться</a>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2>👤 Профиль пользователя</h2>
      <div style={{ marginTop: '24px', padding: '24px', background: 'white', borderRadius: '8px' }}>
        <p><strong>Имя:</strong> Андрей</p>
        <p><strong>Роль:</strong> TeamLead</p>
        <p><strong>Группа:</strong> ИС-2024</p>
      </div>
    </div>
  )
}