import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { courseService } from '../../services/courseService';
import { CourseForm } from '../../components/courses/CourseForm';
import type { Course, CreateCourseRequest } from '../../types/course';
import { Link } from 'react-router-dom';

export default function CoursesList() {
  const { user, isAuthenticated } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await courseService.getCourses();
      setCourses(data);
    } catch (err) {
      setError('Не удалось загрузить курсы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadCourses();
  }, [isAuthenticated]);

  const handleCreate = async (data: CreateCourseRequest) => {
    await courseService.createCourse(data);
    await loadCourses();
    setShowCreateForm(false);
  };

  const handleEnroll = async (courseId: number) => {
    setActionLoading(courseId);
    try {
      await courseService.enroll(courseId);
      await loadCourses();
    } catch (err) {
      alert('Ошибка при записи на курс');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnenroll = async (courseId: number) => {
    if (!confirm('Вы уверены, что хотите покинуть курс?')) return;
    setActionLoading(courseId);
    try {
      await courseService.unenroll(courseId);
      await loadCourses();
    } catch (err) {
      alert('Ошибка при выходе из курса');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (courseId: number) => {
    if (!confirm('Архивировать курс? Он станет недоступен для студентов.')) return;
    setActionLoading(courseId);
    try {
      await courseService.archiveCourse(courseId);
      await loadCourses();
    } catch (err) {
      alert('Ошибка архивации');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (courseId: number) => {
    if (!confirm('Удалить курс навсегда? Это действие необратимо.')) return;
    setActionLoading(courseId);
    try {
      await courseService.deleteCourse(courseId);
      await loadCourses();
    } catch (err) {
      alert('Ошибка удаления');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAuthenticated) {
    return <div className="schedule-empty-state">Войдите, чтобы просматривать курсы.</div>;
  }

  if (loading) return <div className="schedule-alert schedule-alert--loading">Загрузка курсов...</div>;
  if (error) return <div className="schedule-alert schedule-alert--error">{error}</div>;

  const canCreate = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  return (
    <div className="schedule-page">
      <section className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">Обучение</span>
          <h2>Мои курсы</h2>
          <p>Все доступные вам курсы. Записывайтесь, изучайте и управляйте.</p>
        </div>
        {canCreate && (
          <div className="schedule-hero-actions">
            <button className="schedule-upload-btn" onClick={() => setShowCreateForm(true)}>
              + Создать курс
            </button>
          </div>
        )}
      </section>

      {courses.length === 0 ? (
        <div className="schedule-empty-state">
          <div className="schedule-empty-state__icon">📚</div>
          <h3>Нет курсов</h3>
          <p>Вы пока не записаны ни на один курс. Воспользуйтесь поиском или создайте курс сами.</p>
        </div>
      ) : (
        <div className="schedule-days-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {courses.map(course => {
            const isOwner = course.myRole === 'OWNER';
            const isMember = course.myRole === 'STUDENT' || course.myRole === 'TEACHER';
            const canEnroll = !isMember && course.enrollmentOpen && course.status === 'ACTIVE';
            const canManage = isOwner || user?.role === 'ADMIN';

            return (
              <article key={course.id} className="schedule-day-card">
                <div className="schedule-day-card__header" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <span className="schedule-day-card__eyebrow">{course.category || 'Общий'}</span>
                    <h3>{course.title}</h3>
                    {course.shortName && <small>{course.shortName}</small>}
                  </div>
                  <strong>{course.enrollments?.length || 0}</strong>
                </div>
                <div className="schedule-lessons-list" style={{ padding: '12px' }}>
                  <p style={{ color: '#475569', fontSize: '13px', marginBottom: '12px' }}>{course.description?.slice(0, 100)}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                    <Link to={`/courses/${course.id}`} className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>
                      Подробнее
                    </Link>
                    {canEnroll && (
                      <button onClick={() => handleEnroll(course.id)} disabled={actionLoading === course.id} className="btn btn-success">
                        Записаться
                      </button>
                    )}
                    {isMember && !isOwner && (
                      <button onClick={() => handleUnenroll(course.id)} disabled={actionLoading === course.id} className="btn btn-outline">
                        Покинуть
                      </button>
                    )}
                    {canManage && (
                      <>
                        <Link to={`/courses/${course.id}/edit`} className="btn btn-outline">Редактировать</Link>
                        {course.status !== 'ARCHIVED' && (
                          <button onClick={() => handleArchive(course.id)} disabled={actionLoading === course.id} className="btn btn-outline">
                            Архивировать
                          </button>
                        )}
                        <button onClick={() => handleDelete(course.id)} disabled={actionLoading === course.id} className="btn" style={{ background: '#ef4444', color: 'white' }}>
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showCreateForm && (
        <CourseForm
          title="Создание нового курса"
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}