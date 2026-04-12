import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext' // ← Убедись, что путь верный
import Layout from './components/layout'
import Login from './pages/login'
import Welcome from './pages/welcome'
import Schedule from './pages/schedule'
import Grades from './pages/grades'
import Announcements from './pages/announcements'
import Profile from './pages/profile'

function App() {
  return (
    // Оборачиваем всё приложение в провайдер авторизации
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Welcome />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="grades" element={<Grades />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App