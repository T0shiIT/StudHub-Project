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
import ChatPage from './pages/chat'
import CoursesPage from './pages/courses'
import CourseDetailPage from './pages/course-detail'
import CourseEditPage from './pages/course-edit'
import DirectMessagesPage from './pages/dm'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Публичные маршруты */}
          <Route path="/login"            element={<Login />} />
          <Route path="/register"         element={<Register />} />
          <Route path="/register-success" element={<RegisterSuccess />} />

          {/* Защищённые маршруты */}
          <Route path="/" element={<Layout />}>
            <Route index                    element={<Welcome />} />
            <Route path="schedule"          element={<Schedule />} />
            <Route path="grades"            element={<Grades />} />
            <Route path="announcements"     element={<Announcements />} />
            <Route path="profile"           element={<Profile />} />
            <Route path="chat"              element={<ChatPage />} />
            <Route path="courses"           element={<CoursesPage />} />
            <Route path="courses/:id"       element={<CourseDetailPage />} />
            <Route path="courses/:id/edit"  element={<CourseEditPage />} />
            <Route path="messages"          element={<DirectMessagesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
