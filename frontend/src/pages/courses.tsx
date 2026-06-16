import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';

interface CourseProgress {
  percent: number;
  hasGradedMaterials: boolean;
}

interface Course {
  id: number;
  title: string;
  description: string;
  teacherId: number;
  teacherName?: string;
  coverImage?: string;
  enrollmentCount?: number;
  enrolled?: boolean;
  status?: string;
  progress?: CourseProgress | null;
}

export default function CoursesPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '', coverImage: '', status: 'ACTIVE' });
  const [creating, setCreating] = useState(false);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
  const fetchTeacherName = async (teacherId: number): Promise<string> => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/internal/user/${teacherId}`);
      if (res.ok) {
        const data = await res.json();
        return `${data.firstName} ${data.lastName}`;
      }
    } catch (e) {
      console.error(e);
    }
    return 'Преподаватель';
  };

  const loadCourses = async () => {
    setLoadingCourses(true);
    try {
      const res = await fetchWithCsrf('http://localhost:8080/api/courses');
      if (!res.ok) throw new Error('Failed to fetch courses');
      let coursesData: Course[] = await res.json();

      const needsTeacherName = coursesData.some(c => !c.teacherName);
      if (needsTeacherName) {
        const enriched = await Promise.all(
          coursesData.map(async (course) => {
            if (!course.teacherName && course.teacherId) {
              const name = await fetchTeacherName(course.teacherId);
              return { ...course, teacherName: name };
            }
            return course;
          })
        );
        coursesData = enriched;
      }

      let finalCourses = coursesData.map((c) => ({
        ...c,
        enrollmentCount: c.enrollmentCount ?? 0,
        enrolled: c.enrolled ?? false,
        status: c.status || 'ACTIVE',
        progress: null,
      }));

      if (user) {
        const withProgress = await Promise.all(
          finalCourses.map(async (course) => {
            let canViewProgress = false;
            if (user.role === 'STUDENT') canViewProgress = course.enrolled;
            else if (user.role === 'TEACHER') canViewProgress = course.teacherId === user.id;
            else if (user.role === 'ADMIN') canViewProgress = true;

            if (canViewProgress) {
              try {
                const progRes = await fetchWithCsrf(`http://localhost:8080/api/courses/${course.id}/progress`);
                if (progRes.ok) {
                  const progData = await progRes.json();
                  return {
                    ...course,
                    progress: {
                      percent: progData.percent,
                      hasGradedMaterials: progData.hasGradedMaterials,
                    },
                  };
                }
              } catch (e) {
                console.error(`Failed to load progress for course ${course.id}`, e);
              }
            }
            return course;
          })
        );
        finalCourses = withProgress;
      }
      setCourses(finalCourses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourse.title.trim()) {
      alert('Введите название курса');
      return;
    }
    setCreating(true);
    try {
      const res = await fetchWithCsrf('http://localhost:8080/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCourse.title,
          description: newCourse.description,
          coverImage: newCourse.coverImage || null,
          status: newCourse.status,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Курс создан!');
      setShowCreateModal(false);
      setNewCourse({ title: '', description: '', coverImage: '', status: 'ACTIVE' });
      await loadCourses();
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const enrollInCourse = async (courseId: number) => {
    if (!user) return;
    setEnrollingId(courseId);
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/courses/${courseId}/enroll`, {
        method: 'POST',
      });
      if (res.ok || (res.status === 400 && (await res.clone().text()).includes('Уже записан'))) {
        setCourses((prev) =>
          prev.map((course) =>
            course.id === courseId
              ? {
                  ...course,
                  enrollmentCount: (course.enrollmentCount || 0) + 1,
                  enrolled: true,
                }
              : course
          )
        );
        navigate(`/courses/${courseId}`);
      } else {
        const errorText = await res.text();
        alert('Ошибка записи: ' + errorText);
      }
    } catch (err: any) {
      alert('Ошибка записи: ' + err.message);
    } finally {
      setEnrollingId(null);
    }
  };

  // ===== ХУКИ (useEffect) — ВСЕ ДО ПРОВЕРКИ =====
  useEffect(() => {
    loadCourses();
  }, [location.pathname]);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) loadCourses();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  useEffect(() => {
    const handleFocus = () => loadCourses();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // ===== ЗАЩИТА МАРШРУТА (ПОСЛЕ ВСЕХ ХУКОВ) =====
  if (authLoading) {
    return <div className="dashboard-loading">Загрузка...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const canCreate = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  return (
    <div className="courses-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Мои курсы</h1>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            + Создать курс
          </button>
        )}
      </div>

      {loadingCourses ? (
        <div>Загрузка курсов...</div>
      ) : courses.length === 0 ? (
        <p className="empty">У вас пока нет курсов</p>
      ) : (
        <div className="courses-grid">
          {courses.map((course) => {
            const isStudent = user?.role === 'STUDENT';
            const isInactive = course.status === 'INACTIVE';
            const showEnrollButton = user && !course.enrolled && !(isStudent && isInactive);
            const isEnrollingNow = enrollingId === course.id;

            return (
              <div key={course.id} className="course-card">
                <Link to={`/courses/${course.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {course.coverImage && (
                    <div
                      className="course-card-cover"
                      style={{ backgroundImage: `url(${course.coverImage})` }}
                    />
                  )}
                  <div className="course-card-content">
                    <h3>{course.title}</h3>
                    <p>{course.description?.slice(0, 100)}...</p>
                    <div className="course-meta">
                      <span className="teacher">👨‍🏫 {course.teacherName || 'Преподаватель'}</span>
                      <span className="students">👥 {course.enrollmentCount || 0} студентов</span>
                      {isInactive && <span className="inactive-badge">🔒 Неактивный</span>}
                    </div>
                  </div>
                </Link>

                {showEnrollButton && (
                  <button
                    className="btn-enroll"
                    onClick={() => enrollInCourse(course.id)}
                    disabled={isEnrollingNow}
                  >
                    {isEnrollingNow ? 'Запись...' : 'Записаться'}
                  </button>
                )}

                {course.progress && course.progress.hasGradedMaterials && (
                  <div className="course-progress-mini">
                    <span>Пройдено: {course.progress.percent}%</span>
                    <div className="progress-bg">
                      <div
                        className="progress-fill"
                        style={{ width: `${course.progress.percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Создание нового курса</h2>
            <div className="form-group">
              <label>Название курса *</label>
              <input
                type="text"
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                placeholder="Например: Программирование на Java"
              />
            </div>
            <div className="form-group">
              <label>Описание</label>
              <textarea
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                rows={3}
                placeholder="Краткое описание курса"
              />
            </div>
            <div className="form-group">
              <label>URL обложки курса (необязательно)</label>
              <input
                type="url"
                value={newCourse.coverImage}
                onChange={(e) => setNewCourse({ ...newCourse, coverImage: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="form-group">
              <label>Статус курса</label>
              <select
                value={newCourse.status}
                onChange={(e) => setNewCourse({ ...newCourse, status: e.target.value })}
              >
                <option value="ACTIVE">Активный (доступен студентам)</option>
                <option value="INACTIVE">Неактивный (только преподаватели и админ)</option>
              </select>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Отмена
              </button>
              <button className="btn-primary" onClick={handleCreateCourse} disabled={creating}>
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}