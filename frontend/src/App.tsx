import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/layout'
import Login from './pages/login'
import Register from './pages/register'
import RegisterSuccess from './pages/registersuccess'
import Welcome from './pages/welcome'
import Schedule from './pages/schedule'
import Grades from './pages/grades'
import Announcements from './pages/announcements'
import Profile from './pages/profile'
import ChatPage from "./pages/chat";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Публичные маршруты авторизации */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-success" element={<RegisterSuccess />} />
          
          {/* Защищённые маршруты приложения */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Welcome />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="grades" element={<Grades />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="profile" element={<Profile />} />
            <Route path="/chat" element={<ChatPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App