import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { courseService } from '../../services/courseService';
import type { Course, AddMemberRequest } from '../../types/course';

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [actionLoading, setActionLoading] = useState(false);

  const loadCourse = async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      const data = await courseService.getCourse(Number(courseId));
      setCourse(data);
    } catch (err) {
      setError('Не удалось загрузить курс');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  const canManage = course?.myRole === 'OWNER' || user?.role === 'ADMIN';

  const handleAddMember = async () => {
    if (!newMemberId.trim()) return;
    setActionLoading(true);
    try {
      const req: AddMemberRequest = { userId: Number(newMemberId), courseRole: newMemberRole };
      await courseService.addMember(Number(courseId), req);
      await loadCourse();
      setShowAddMember(false);
      setNewMemberId('');
    } catch (err) {
      alert('Ошибка при добавлении участника');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Удалить участника из курса?')) return;
    setActionLoading(true);
    try {
      await courseService.removeMember(Number(courseId), userId);
      await loadCourse();
    } catch (err) {
      alert('Ошибка удаления');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="schedule-alert schedule-alert--loading">Загрузка курса...</div>;
  if (error) return <div className="schedule-alert schedule-alert--error">{error}</div>;
  if (!course) return <div className="schedule-empty-state">Курс не найден</div>;

  return (
    <div className="schedule-page">
      <section className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">{course.category || 'Курс'}</span>
          <h2>{course.title}</h2>
          <p>{course.description || 'Нет описания'}</p>
          <div style={{ marginTop: '8px', fontSize: '14px', color: '#475569' }}>
            Преподаватель: {course.ownerName} • Статус: {course.status === 'ACTIVE' ? 'Активен' : course.status === 'ARCHIVED' ? 'В архиве' : 'Удалён'}
          </div>
        </div>
        {canManage && (
          <div className="schedule-hero-actions">
            <button className="schedule-upload-btn" onClick={() => setShowAddMember(true)}>Добавить участника</button>
            <button className="btn btn-outline" onClick={() => navigate(`/courses/${course.id}/edit`)}>Редактировать курс</button>
          </div>
        )}
      </section>

      <section className="schedule-card">
        <div className="schedule-toolbar">
          <div className="schedule-file-info">
            <span>Участники курса</span>
            <strong>{course.enrollments?.length || 0} человек</strong>
          </div>
        </div>
        <div className="grades-table-container">
          <table className="grades-table">
            <thead>
              <tr className="grades-table__header-row">
                <th className="grades-table__header">Участник</th>
                <th className="grades-table__header">Роль</th>
                <th className="grades-table__header">Дата записи</th>
                {canManage && <th className="grades-table__header">Действия</th>}
              </tr>
            </thead>
            <tbody>
              {course.enrollments?.map(enr => (
                <tr key={enr.userId} className="grades-table__row">
                  <td className="grades-table__cell">{enr.userFullName} ({enr.userLogin})</td>
                  <td className="grades-table__cell">{enr.courseRole}</td>
                  <td className="grades-table__cell">{new Date(enr.enrolledAt).toLocaleDateString()}</td>
                  {canManage && (
                    <td className="grades-table__cell">
                      {enr.userId !== course.ownerId && (
                        <button onClick={() => handleRemoveMember(enr.userId)} disabled={actionLoading} className="btn" style={{ background: '#ef4444', color: 'white', padding: '4px 12px' }}>
                          Исключить
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {(!course.enrollments || course.enrollments.length === 0) && (
                <tr><td colSpan={canManage ? 4 : 3} className="grades-table__cell" style={{ textAlign: 'center' }}>Нет участников</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showAddMember && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '400px' }}>
            <h3>Добавить участника</h3>
            <div className="form-group">
              <label>ID пользователя</label>
              <input type="number" value={newMemberId} onChange={e => setNewMemberId(e.target.value)} className="form-input" placeholder="Введите числовой ID" />
            </div>
            <div className="form-group">
              <label>Роль в курсе</label>
              <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value as any)} className="form-input">
                <option value="STUDENT">Студент</option>
                <option value="TEACHER">Преподаватель</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowAddMember(false)} className="btn btn-outline">Отмена</button>
              <button onClick={handleAddMember} disabled={actionLoading} className="btn btn-primary">Добавить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}