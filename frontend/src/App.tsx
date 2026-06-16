import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/layout'
import Login from './pages/login'
import Register from './pages/register'
import RegisterSuccess from './pages/registersuccess'
import Welcome from './pages/welcome'
import Schedule from './pages/schedule'
import Announcements from './pages/announcements'
import Profile from './pages/profile'
import ChatPage from "./pages/chat";
import CoursesPage from './pages/courses'
import CourseDetailPage from './pages/course-detail'
import CourseEditPage from './pages/course-edit';
import MaterialDetailPage from './pages/material-detail';
import TestPassing from './pages/TestPassing';
import TestResult from './pages/test-result';          // новый импорт
import MaterialEditPage from './pages/material-edit';
import Grades from './pages/grades';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-success" element={<RegisterSuccess />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Welcome />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="profile" element={<Profile />} />
            <Route path="chat" element={<ChatPage />} />
            
            <Route path="courses/:id/edit" element={<CourseEditPage />} />
            <Route path="courses/:id/materials/:materialId" element={<MaterialDetailPage />} />
            <Route path="courses/:id" element={<CourseDetailPage />} />
            <Route path="courses/:courseId/grades" element={<Grades />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/:courseId/materials/:materialId/test" element={<TestPassing />} />
            <Route path="courses/:courseId/materials/:materialId/result" element={<TestResult />} />
            <Route path="courses/:courseId/materials/:materialId/edit" element={<MaterialEditPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App