import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <NavLink
        to="/"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Главная
      </NavLink>

      <NavLink
        to="/schedule"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Расписание
      </NavLink>

      <NavLink
        to="/grades"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Оценки
      </NavLink>

      <NavLink
        to="/courses"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Курсы
      </NavLink>

      <NavLink
        to="/announcements"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Объявления
      </NavLink>

      <NavLink
        to="/profile"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Профиль
      </NavLink>
    </nav>
  )
}