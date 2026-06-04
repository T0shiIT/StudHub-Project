import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import type { JournalData, UserRole } from '../types/journal';

const GRADES_URL = '/api/grades';
const GRADES_UPLOAD_URL = '/api/grades/upload';

const getGradeColor = (grade: number | null): string => {
  if (grade === 5 || grade === 4) return '#fce7f3';
  if (grade === 3) return '#fbcfe8';
  if (grade === 2) return '#f9a8d4';
  return '#f3e8ff';
};

const getGradeTextColor = (grade: number | null): string => {
  if (grade === 5 || grade === 4) return '#be185d';
  if (grade === 3) return '#9d174d';
  if (grade === 2) return '#831843';
  return '#6b21a8';
};

export default function Grades() {
  const { user, isAuthenticated } = useAuth();
  const role: UserRole = (user?.role as UserRole) || 'STUDENT';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [journal, setJournal] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState('');

  const [editingCell, setEditingCell] = useState<{ studentId: number; date: string; gradeId?: number } | null>(null);
  const [tempGrade, setTempGrade] = useState('');
  const [savingCell, setSavingCell] = useState<{ studentId: number; date: string } | null>(null);

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];

    const isFormData = options.body instanceof FormData;

    return await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        ...(!isFormData && options.method !== 'GET' && { 'Content-Type': 'application/json' }),
        ...(csrfToken && { 'X-XSRF-TOKEN': csrfToken }),
        ...options.headers,
      },
    });
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchJournal = async () => {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams();
        if ((role === 'TEACHER' || role === 'ADMIN') && user?.groupName) {
          params.set('group', user.groupName);
        }

        const res = await apiFetch(`${GRADES_URL}?${params.toString()}`);

        if (!res.ok) {
          const errorData: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Ошибка сервера: ${res.status}`);
        }

        const data: Array<{
          id: number;
          studentId: number;
          studentFullName: string;
          subject: string;
          grade: string;
          date: string;
          teacherId?: number;
          teacherFullName?: string;
        }> = await res.json();

        const studentsMap = new Map<number, { id: number; firstName: string; lastName: string }>();
        const datesSet = new Set<string>();
        const gradesMap: { [studentId: number]: { [date: string]: number | null } } = {};

        data.forEach((g) => {
          if (!studentsMap.has(g.studentId)) {
            const parts = g.studentFullName.trim().split(' ');
            const lastName = parts[0] || '';
            const firstName = parts.slice(1).join(' ') || '';
            studentsMap.set(g.studentId, { id: g.studentId, firstName, lastName });
            gradesMap[g.studentId] = {};
          }
          if (g.date) datesSet.add(g.date);
          gradesMap[g.studentId][g.date] = g.grade ? Number(g.grade) : null;
        });

        setJournal({
          students: Array.from(studentsMap.values()),
          dates: Array.from(datesSet).sort(),
          grades: gradesMap,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Ошибка при загрузке данных';
        setError(errorMessage);
        console.error('Grades fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJournal();
  }, [isAuthenticated, role, user?.groupName]);

  const startEditing = (studentId: number, date: string, currentGrade: number | null, gradeId?: number) => {
    if (role !== 'TEACHER' && role !== 'ADMIN') return;
    setEditingCell({ studentId, date, gradeId });
    setTempGrade(currentGrade !== null ? String(currentGrade) : '');
  };

  const saveGrade = async (studentId: number, date: string) => {
    if (!editingCell) return;
    const newGrade = parseInt(tempGrade, 10);

    if (isNaN(newGrade) || newGrade < 2 || newGrade > 5) {
      alert('Разрешены только оценки от 2 до 5');
      return;
    }

    setSavingCell({ studentId, date });

    try {
      const { gradeId } = editingCell;
      if (gradeId) {
        const res = await apiFetch(`${GRADES_URL}/${gradeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ grade: String(newGrade) }),
        });
        if (!res.ok) {
          const errorData: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Не удалось обновить оценку');
        }
      } else {
        const res = await apiFetch(GRADES_URL, {
          method: 'POST',
          body: JSON.stringify({
            studentId,
            subject: 'Основной предмет',
            grade: String(newGrade),
            date,
          }),
        });
        if (!res.ok) {
          const errorData: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Не удалось создать оценку');
        }
      }

      setJournal((prev: JournalData | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          grades: {
            ...prev.grades,
            [studentId]: { ...prev.grades[studentId], [date]: newGrade },
          },
        };
      });
      setEditingCell(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка сохранения';
      alert(errorMessage);
    } finally {
      setSavingCell(null);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch(GRADES_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      const result: { processed?: number; failed?: number; error?: string } = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Ошибка загрузки');
      }

      setUploadMsg(`Успешно: ${result.processed || 0}, Ошибок: ${result.failed || 0}`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки файла';
      setUploadMsg(errorMessage);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="schedule-empty-state">
        <div className="schedule-empty-state__icon">🔐</div>
        <h3>Требуется авторизация</h3>
        <p>Войдите в систему для просмотра оценок.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="schedule-alert schedule-alert--loading">
        Загрузка журнала оценок...
      </div>
    );
  }

  if (error) {
    return (
      <div className="schedule-alert schedule-alert--error">
        {error}
      </div>
    );
  }

  // ✅ ИСПРАВЛЕНО: Кнопка загрузки теперь рендерится ВСЕГДА для ADMIN/TEACHER, даже если журнал пуст
  return (
    <div className="schedule-page">
      <section className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">Успеваемость</span>
          <h2>Журнал оценок</h2>
          <p>Просматривайте и редактируйте оценки студентов.</p>
        </div>
        <div className="schedule-hero-actions">
          {(role === 'ADMIN' || role === 'TEACHER') && (
            <button
              className="schedule-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Загрузка...' : 'Загрузить Excel'}
            </button>
          )}
        </div>
      </section>

      <input
        type="file"
        ref={fileInputRef}
        className="schedule-file-input"
        onChange={handleFileUpload}
        accept=".xlsx,.xls"
      />

      {uploading && (
        <div className="schedule-alert schedule-alert--loading">
          Загрузка и обработка файла...
        </div>
      )}

      {uploadMsg && (
        <div className={`schedule-alert ${uploadMsg.startsWith('Успешно') ? 'schedule-alert--success' : 'schedule-alert--error'}`}>
          {uploadMsg}
        </div>
      )}

      {/* Если журнал пуст — показываем пустое состояние, но кнопка уже отрендерена выше */}
      {!journal || journal.students.length === 0 ? (
        <div className="schedule-empty-state">
          <div className="schedule-empty-state__icon">📊</div>
          <h3>Журнал пуст</h3>
          <p>Данные не найдены или журнал ещё не заполнен.</p>
          {(role === 'ADMIN' || role === 'TEACHER') && (
            <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
              Используйте кнопку <strong>"Загрузить Excel"</strong> выше, чтобы добавить оценки.
            </p>
          )}
        </div>
      ) : (
        <section className="schedule-card">
          <div className="schedule-toolbar">
            <div className="schedule-file-info">
              <span>Журнал</span>
              <strong>Основной предмет</strong>
              <small>{journal.students.length} студентов • {journal.dates.length} дат</small>
            </div>
            <div className="schedule-controls">
              <span className="schedule-role-badge">
                Роль: <strong>{role === 'STUDENT' ? 'Студент' : role === 'TEACHER' ? 'Преподаватель' : 'Администратор'}</strong>
              </span>
            </div>
          </div>

          <div className="grades-table-container">
            <table className="grades-table">
              <thead>
                <tr className="grades-table__header-row">
                  <th className="grades-table__header grades-table__student-column">
                    <div>
                      <span className="grades-table__header-eyebrow">Список</span>
                      <h3>Студент</h3>
                    </div>
                  </th>
                  {journal.dates.map((date) => (
                    <th key={date} className="grades-table__header">
                      <div>
                        <span className="grades-table__header-eyebrow">Дата</span>
                        <h4>{new Date(date).toLocaleDateString('ru-RU')}</h4>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {journal.students.map((student) => (
                  <tr key={student.id} className="grades-table__row">
                    <td className="grades-table__cell grades-table__student-cell">
                      <div>
                        <strong>{student.lastName} {student.firstName}</strong>
                        <small>ID: {student.id}</small>
                      </div>
                    </td>
                    {journal.dates.map((date) => {
                      const grade = journal.grades[student.id]?.[date] ?? null;
                      const isEditing = editingCell?.studentId === student.id && editingCell.date === date;
                      const isSaving = savingCell?.studentId === student.id && savingCell.date === date;

                      return (
                        <td
                          key={date}
                          className="grades-table__cell grades-table__grade-cell"
                          style={{
                            background: getGradeColor(grade),
                            cursor: (role === 'TEACHER' || role === 'ADMIN') ? 'pointer' : 'default',
                          }}
                          onClick={() => !isEditing && (role === 'TEACHER' || role === 'ADMIN') && startEditing(student.id, date, grade)}
                        >
                          {isSaving ? (
                            <span className="grades-table__saving">...</span>
                          ) : isEditing ? (
                            <input
                              type="number"
                              min="2"
                              max="5"
                              value={tempGrade}
                              onChange={(e) => setTempGrade(e.target.value)}
                              onBlur={() => saveGrade(student.id, date)}
                              onKeyDown={(e) => e.key === 'Enter' && saveGrade(student.id, date)}
                              autoFocus
                              className="grades-table__input"
                            />
                          ) : (
                            <span
                              className="grades-table__grade-value"
                              style={{ color: getGradeTextColor(grade) }}
                            >
                              {grade !== null ? grade : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="schedule-empty-state" style={{ marginTop: '24px', background: '#fdf2f8', border: '1px solid #f9a8d4' }}>
            <div className="schedule-empty-state__icon">💡</div>
            <h3>Подсказка</h3>
            <p>
              {role === 'STUDENT' && 'Режим только для чтения. Редактирование недоступно.'}
              {role === 'TEACHER' && 'Кликните по ячейке для оценки, или используйте кнопку "Загрузить Excel" для массового импорта.'}
              {role === 'ADMIN' && 'Вам доступно редактирование и загрузка Excel-файлов для массового импорта оценок.'}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}