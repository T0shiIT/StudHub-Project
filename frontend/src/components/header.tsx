import { useNavigate } from 'react-router-dom'

export default function Header() {
  const navigate = useNavigate()
  const isAuth = localStorage.getItem('isAuth') === 'true'

  const handleLogin = () => {
    navigate('/login')
  }

  const handleLogout = () => {
    localStorage.removeItem('isAuth')
    window.location.reload()
  }

  return (
    <header className="header">
      <h1>StudHub</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isAuth ? (
          <>
            <span>Андрей (TeamLead)</span>
            <button 
              className="btn" 
              onClick={handleLogout}
              style={{ background: '#ef4444' }}
            >
              Выйти
            </button>
          </>
        ) : (
          <button 
            className="btn" 
            onClick={handleLogin}
            style={{ background: '#3b82f6' }}
          >
            Войти
          </button>
        )}
      </div>
    </header>
  )
}