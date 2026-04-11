import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
        Главная
      </NavLink>
      <NavLink to="/schedule">Расписание</NavLink>
      <NavLink to="/grades">Оценки</NavLink>
      <NavLink to="/announcements">Объявления</NavLink>
      <NavLink to="/profile">Профиль</NavLink>
    </nav>
  )
}