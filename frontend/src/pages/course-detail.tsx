import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';

interface Course {
  id: number;
  title: string;
  description: string;
  teacherId: number;
  teacherName?: string;
  coverImage?: string;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        const res = await fetchWithCsrf(`http://localhost:8080/api/courses/${id}`);
        if (res.ok) {
          const data = await res.json();

          const teacherRes = await fetchWithCsrf(
            `http://localhost:8080/api/internal/user/${data.teacherId}`
          );
          const teacherData = teacherRes.ok ? await teacherRes.json() : null;

          setCourse({
            ...data,
            teacherName: teacherData
              ? `${teacherData.firstName} ${teacherData.lastName}`
              : 'Преподаватель',
          });

          setIsTeacher(user?.id === data.teacherId || user?.role === 'ADMIN');
        } else {
          navigate('/courses');
        }
      } catch (e) {
        console.error('Failed to load course', e);
        navigate('/courses');
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [id, navigate, user]);

  if (loading) return <div className="course-detail-page">Загрузка...</div>;
  if (!course) return <div className="course-detail-page">Курс не найден</div>;

  return (
    <div className="course-detail-page">
      {/* Большая обложка */}
      {course.coverImage && (
        <div
          className="detail-cover"
          style={{ backgroundImage: `url(${course.coverImage})` }}
        />
      )}

      <div className="course-header">
        <button className="btn-back" onClick={() => navigate('/courses')}>
          ← Назад к курсам
        </button>
        <div className="course-title-section">
          <h1>{course.title}</h1>
          <p className="course-teacher">👨‍🏫 {course.teacherName}</p>
        </div>
        {isTeacher && (
          <button className="btn-edit" onClick={() => navigate(`/courses/${id}/edit`)}>
            Редактировать курс
          </button>
        )}
      </div>

      <div className="course-content">
        <div className="course-description">
          <h2>О курсе</h2>
          <p>{course.description || 'Описание отсутствует'}</p>
        </div>

        <div className="course-sections">
          <div className="section">
            <h2>📚 Материалы курса</h2>
            <p className="empty">Материалы пока не добавлены</p>
            {isTeacher && (
              <button className="btn-add-material">+ Добавить материал</button>
            )}
          </div>

          <div className="section">
            <h2>📝 Задания</h2>
            <p className="empty">Задания пока не добавлены</p>
            {isTeacher && (
              <button className="btn-add-material">+ Добавить задание</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}