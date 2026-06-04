import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDialogs } from '../hooks/useDialogs'

// Отдельный компонент — вызывается только когда user точно есть.
// Это важно: useDialogs делает fetch токена, и если user=null — упадёт.
function UnreadBadge() {
  const { dialogs } = useDialogs()
  const total = dialogs.reduce((sum, d) => sum + d.unreadCount, 0)
  if (total === 0) return null
  return (
    <span className="sidebar-unread-badge">
      {total > 99 ? '99+' : total}
    </span>
  )
}

export default function Sidebar() {
  const { user, loading } = useAuth()

  return (
    <nav className="sidebar">
      <NavLink to="/"              className={({ isActive }) => isActive ? 'active' : ''}>Главная</NavLink>
      <NavLink to="/schedule"      className={({ isActive }) => isActive ? 'active' : ''}>Расписание</NavLink>
      <NavLink to="/grades"        className={({ isActive }) => isActive ? 'active' : ''}>Оценки</NavLink>
      <NavLink to="/courses"       className={({ isActive }) => isActive ? 'active' : ''}>Курсы</NavLink>
      <NavLink to="/announcements" className={({ isActive }) => isActive ? 'active' : ''}>Объявления</NavLink>

      <NavLink to="/messages"      className={({ isActive }) => isActive ? 'active' : ''}>
        Сообщения
        {/* Рендерим бейдж только если пользователь загружен — иначе useDialogs упадёт */}
        {!loading && user && <UnreadBadge />}
      </NavLink>

      <NavLink to="/profile"       className={({ isActive }) => isActive ? 'active' : ''}>Профиль</NavLink>
    </nav>
  )
}
