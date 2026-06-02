import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';

interface Course {
  id: number;
  title: string;
  description: string;
  teacherId: number;
  teacherName?: string;
  studentsCount?: number;
  enrolled?: boolean;
  coverImage?: string;
}

// Дефолтные обложки (градиенты + иконки)
const DEFAULT_COVERS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

export default function CoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    coverImage: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const getTeacherName = async (teacherId: number): Promise<string> => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/internal/user/${teacherId}`);
      if (res.ok) {
        const data = await res.json();
        return `${data.firstName} ${data.lastName}`;
      }
    } catch (e) {
      console.error('Failed to load teacher info', e);
    }
    return 'Преподаватель';
  };

  const loadCourses = async () => {
    try {
      const res = await fetchWithCsrf('http://localhost:8080/api/courses');
      if (res.ok) {
        const data = await res.json();

        const coursesWithDetails = await Promise.all(
          data.map(async (course: Course, idx: number) => {
            const teacherName = await getTeacherName(course.teacherId);

            const enrollStatusRes = await fetchWithCsrf(
              `http://localhost:8080/api/courses/${course.id}/enrollment-status`
            );
            const enrollData = enrollStatusRes.ok
              ? await enrollStatusRes.json()
              : { enrolled: false, studentsCount: 0 };

            return {
              ...course,
              teacherName,
              enrolled: enrollData.enrolled,
              studentsCount: enrollData.studentsCount || 0,
            };
          })
        );

        setCourses(coursesWithDetails);
      }
    } catch (e) {
      console.error('Failed to load courses', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newCourse.title.trim()) {
      setError('Введите название курса');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithCsrf('http://localhost:8080/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse),
      });

      if (res.ok) {
        const created = await res.json();
        setNewCourse({ title: '', description: '', coverImage: '' });
        setShowForm(false);
        navigate(`/courses/${created.id}`);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Не удалось создать курс');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnroll = async (courseId: number) => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/courses/${courseId}/enroll`, {
        method: 'POST',
      });

      if (res.ok) {
        await loadCourses();
        navigate(`/courses/${courseId}`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Не удалось записаться на курс');
      }
    } catch {
      alert('Ошибка сети');
    }
  };

  if (loading) return <div className="courses-page">Загрузка...</div>;

  return (
    <div className="courses-page">
      <div className="courses-header">
        <h1>Мои курсы</h1>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Отмена' : '+ Создать курс'}
          </button>
        )}
      </div>

      {showForm && (
        <form className="course-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Название курса"
            value={newCourse.title}
            onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
            disabled={submitting}
          />
          <textarea
            placeholder="Описание курса"
            value={newCourse.description}
            onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
            disabled={submitting}
          />
          <input
            type="url"
            placeholder="URL обложки (например: https://images.unsplash.com/...)"
            value={newCourse.coverImage}
            onChange={(e) => setNewCourse({ ...newCourse, coverImage: e.target.value })}
            disabled={submitting}
          />
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Создание...' : 'Создать'}
          </button>
        </form>
      )}

      {courses.length === 0 ? (
        <div className="empty-state">
          {canCreate
            ? 'Курсов пока нет. Создайте первый!'
            : 'Вы пока не записаны ни на один курс.'}
        </div>
      ) : (
        <div className="courses-grid">
          {courses.map((course) => (
            <div key={course.id} className="course-card">
              {/* Обложка */}
              <div
                className="course-cover"
                style={
                  course.coverImage
                    ? { backgroundImage: `url(${course.coverImage})` }
                    : {
                        background:
                          DEFAULT_COVERS[course.id % DEFAULT_COVERS.length],
                      }
                }
              >
                {!course.coverImage && (
                  <div className="course-cover-placeholder">📚</div>
                )}
              </div>

              {/* Содержимое */}
              <div className="course-body">
                <h3>{course.title}</h3>
                <p className="course-teacher">👨‍🏫 {course.teacherName || 'Преподаватель'}</p>
                <p className="course-students">👥 {course.studentsCount} студентов</p>

                <div className="course-actions">
                  {course.enrolled ? (
                    <button
                      className="btn-outline"
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      Перейти
                    </button>
                  ) : (
                    <button
                      className="btn-primary full-width"
                      onClick={() => handleEnroll(course.id)}
                    >
                      Записаться
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}