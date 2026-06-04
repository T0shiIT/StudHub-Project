import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import type { JournalData, UserRole } from '../types/journal';

const GRADES_URL = '/api/grades';
const GRADES_PREVIEW_URL = '/api/grades/preview';
const GRADES_SAVE_PREVIEW_URL = '/api/grades/save-preview';

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

  let normalizedRole: UserRole = 'STUDENT';
  const rawRole = (user?.role as string) || '';
  if (rawRole.toUpperCase().includes('ADMIN')) normalizedRole = 'ADMIN';
  else if (rawRole.toUpperCase().includes('TEACHER')) normalizedRole = 'TEACHER';
  const role = normalizedRole;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  const [journal, setJournal] = useState<JournalData | null>(null);
  const [previewData, setPreviewData] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState('');

  const [editingCell, setEditingCell] = useState<{
    studentId: number;
    oldDate: string;
    gradeId?: number;
    oldGrade: number | null;
  } | null>(null);
  const [tempGrade, setTempGrade] = useState('');
  const [tempDate, setTempDate] = useState('');
  const [savingCell, setSavingCell] = useState<{ studentId: number; date: string } | null>(null);
  const [gradeIdMap, setGradeIdMap] = useState<Record<number, Record<string, number>>>({});

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
    if (role === 'TEACHER' || role === 'ADMIN') {
      apiFetch('/api/grades/groups')
        .then(res => res.ok ? res.json() : [])
        .then((data: string[]) => {
          const filtered = data.filter(g => g && g.trim() !== '');
          setGroups(filtered);
          if (filtered.length === 0) return;
          if (user?.groupName && filtered.includes(user.groupName)) {
            setSelectedGroup(user.groupName);
          } else {
            setSelectedGroup(filtered[0]);
          }
        })
        .catch(err => console.error('Failed to load groups:', err));
    }
  }, [role, user?.groupName]);

  useEffect(() => {
    if (previewData) return;
    if (!isAuthenticated) return;

    const fetchJournal = async () => {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams();
        if (role === 'STUDENT') {
          // student – no group
        } else if (selectedGroup) {
          params.set('group', selectedGroup);
        } else {
          setJournal(null);
          setLoading(false);
          return;
        }

        const res = await apiFetch(`${GRADES_URL}${params.toString() ? `?${params}` : ''}`);
        if (!res.ok) throw new Error('Ошибка загрузки');
        const data = await res.json();

        const studentsMap = new Map();
        const datesSet = new Set<string>();
        const gradesMap: Record<number, Record<string, number | null>> = {};
        const newGradeIdMap: Record<number, Record<string, number>> = {};

        data.forEach((g: any) => {
          if (!studentsMap.has(g.studentId)) {
            const parts = g.studentFullName.trim().split(' ');
            const lastName = parts[0] || '';
            const firstName = parts.slice(1).join(' ') || '';
            studentsMap.set(g.studentId, { id: g.studentId, firstName, lastName });
            gradesMap[g.studentId] = {};
            newGradeIdMap[g.studentId] = {};
          }
          if (g.date) datesSet.add(g.date);
          gradesMap[g.studentId][g.date] = g.grade ? Number(g.grade) : null;
          newGradeIdMap[g.studentId][g.date] = g.id;
        });

        setJournal({
          students: Array.from(studentsMap.values()),
          dates: Array.from(datesSet).sort(),
          grades: gradesMap,
        });
        setGradeIdMap(newGradeIdMap);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchJournal();
  }, [isAuthenticated, role, selectedGroup, previewData]);

  const startEditing = (studentId: number, date: string, currentGrade: number | null) => {
    if (role !== 'TEACHER' && role !== 'ADMIN') return;
    const gradeId = gradeIdMap[studentId]?.[date];
    setEditingCell({ studentId, oldDate: date, gradeId, oldGrade: currentGrade });
    setTempGrade(currentGrade !== null ? String(currentGrade) : '');
    setTempDate(date);
  };

  const saveCell = async () => {
    if (!editingCell) return;
    const { studentId, oldDate, gradeId, oldGrade } = editingCell;

    let newGradeNum: number | null = null;
    if (tempGrade.trim() !== '') {
      newGradeNum = parseInt(tempGrade, 10);
      if (isNaN(newGradeNum) || newGradeNum < 2 || newGradeNum > 5) {
        alert('Оценка должна быть числом от 2 до 5');
        return;
      }
    }
    const newDate = tempDate;
    if (!newDate) {
      alert('Дата обязательна');
      return;
    }

    setSavingCell({ studentId, date: oldDate });

    try {
      if (!gradeId && newGradeNum === null) {
        alert('Введите оценку для создания');
        return;
      }

      if (!gradeId) {
        const res = await apiFetch(GRADES_URL, {
          method: 'POST',
          body: JSON.stringify({ studentId, subject: 'Основной предмет', grade: String(newGradeNum), date: newDate }),
        });
        if (!res.ok) throw new Error('Не удалось создать оценку');
        window.location.reload();
        return;
      }

      let gradeChanged = false, dateChanged = false;
      if (newGradeNum !== null && newGradeNum !== oldGrade) {
        const res = await apiFetch(`${GRADES_URL}/${gradeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ grade: String(newGradeNum) }),
        });
        if (!res.ok) throw new Error('Ошибка обновления оценки');
        gradeChanged = true;
      }
      if (newDate !== oldDate) {
        const res = await apiFetch(`${GRADES_URL}/${gradeId}/date`, {
          method: 'PATCH',
          body: JSON.stringify({ date: newDate }),
        });
        if (!res.ok) throw new Error('Ошибка обновления даты');
        dateChanged = true;
      }

      if (!gradeChanged && !dateChanged) {
        setEditingCell(null);
        setSavingCell(null);
        return;
      }

      setJournal(prev => {
        if (!prev) return prev;
        const newGrades = { ...prev.grades };
        const gradeValue = gradeChanged ? newGradeNum : oldGrade;
        if (dateChanged) {
          delete newGrades[studentId][oldDate];
          newGrades[studentId][newDate] = gradeValue;
          const newDates = [...prev.dates];
          if (!newDates.includes(newDate)) newDates.push(newDate);
          return { ...prev, dates: newDates.sort(), grades: newGrades };
        } else {
          newGrades[studentId][oldDate] = gradeValue;
          return { ...prev, grades: newGrades };
        }
      });
      if (dateChanged) {
        setGradeIdMap(prevMap => {
          const newMap = { ...prevMap };
          if (newMap[studentId]) {
            const gid = newMap[studentId][oldDate];
            delete newMap[studentId][oldDate];
            newMap[studentId][newDate] = gid;
          }
          return newMap;
        });
      }
      setEditingCell(null);
    } catch (err: any) {
      alert(err.message);
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
      const res = await apiFetch(GRADES_PREVIEW_URL, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      setPreviewData(data);
      setUploadMsg(`Таблица загружена, ${data.students.length} студентов, ${data.dates.length} дат`);
    } catch (err: any) {
      setUploadMsg(err.message);
      setPreviewData(null);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const clearPreview = () => {
    setPreviewData(null);
    setUploadMsg('');
  };

  const savePreviewToDb = async () => {
    if (!previewData) return;
    setSaving(true);
    try {
      const res = await apiFetch(GRADES_SAVE_PREVIEW_URL, {
        method: 'POST',
        body: JSON.stringify(previewData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Ошибка сохранения');
      alert(`Сохранено ${result.saved} оценок. Страница перезагрузится.`);
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const displayData = previewData || journal;
  const isPreviewMode = !!previewData;

  if (!isAuthenticated) {
    return (
      <div className="schedule-empty-state">
        <div className="schedule-empty-state__icon">🔐</div>
        <h3>Требуется авторизация</h3>
        <p>Войдите в систему для просмотра оценок.</p>
      </div>
    );
  }

  const heroSection = (
    <section className="schedule-hero">
      <div>
        <span className="schedule-eyebrow">Успеваемость</span>
        <h2>Журнал оценок</h2>
        <p>Просматривайте и редактируйте оценки и даты.</p>
      </div>
      <div className="schedule-hero-actions">
        {(role === 'ADMIN' || role === 'TEACHER') && (
          <>
            <button className="schedule-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Загрузка...' : 'Загрузить Excel (предпросмотр)'}
            </button>
            {isPreviewMode && (
              <>
                <button onClick={savePreviewToDb} disabled={saving} style={{ marginLeft: '12px' }}>
                  {saving ? 'Сохранение...' : '💾 Сохранить в журнал'}
                </button>
                <button onClick={clearPreview} style={{ marginLeft: '12px', padding: '6px 12px' }}>
                  Вернуться к журналу
                </button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );

  const fileInputElement = (
    <input type="file" ref={fileInputRef} className="schedule-file-input" onChange={handleFileUpload} accept=".xlsx,.xls" />
  );

  if (loading && !isPreviewMode) {
    return (
      <>
        {heroSection}
        <div className="schedule-alert schedule-alert--loading">Загрузка журнала оценок...</div>
      </>
    );
  }

  if (error && !isPreviewMode) {
    return (
      <>
        {heroSection}
        <div className="schedule-alert schedule-alert--error">{error}</div>
      </>
    );
  }

  if (!displayData || displayData.students.length === 0) {
    return (
      <>
        {heroSection}
        {fileInputElement}
        {uploading && <div className="schedule-alert schedule-alert--loading">Загрузка и обработка файла...</div>}
        {uploadMsg && <div className={`schedule-alert ${uploadMsg.startsWith('Таблица') ? 'schedule-alert--success' : 'schedule-alert--error'}`}>{uploadMsg}</div>}
        <div className="schedule-empty-state">
          <div className="schedule-empty-state__icon">📊</div>
          <h3>Журнал пуст</h3>
          <p>Данные не найдены или журнал ещё не заполнен.</p>
          {(role === 'ADMIN' || role === 'TEACHER') && <p style={{ marginTop: '12px' }}>Используйте кнопку <strong>«Загрузить Excel (предпросмотр)»</strong> выше.</p>}
        </div>
      </>
    );
  }

  return (
    <div className="schedule-page">
      {heroSection}
      {fileInputElement}
      {uploading && <div className="schedule-alert schedule-alert--loading">Загрузка и обработка файла...</div>}
      {uploadMsg && <div className={`schedule-alert ${uploadMsg.startsWith('Таблица') ? 'schedule-alert--success' : 'schedule-alert--error'}`}>{uploadMsg}</div>}

      {(role === 'TEACHER' || role === 'ADMIN') && groups.length > 0 && !isPreviewMode && (
        <div style={{ marginBottom: '20px', textAlign: 'right' }}>
          <label style={{ marginRight: '8px' }}>Группа:</label>
          <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{ padding: '6px 12px', borderRadius: '8px' }}>
            {groups.map(group => <option key={group} value={group}>{group}</option>)}
          </select>
        </div>
      )}

      {isPreviewMode && (
        <div style={{ marginBottom: '16px', padding: '8px', background: '#e0f2fe', borderRadius: '8px', textAlign: 'center' }}>
          🔍 Режим предпросмотра (данные из Excel, не сохранены в БД)
        </div>
      )}

      <section className="schedule-card">
        <div className="schedule-toolbar">
          <div className="schedule-file-info">
            <span>Журнал</span>
            <strong>Основной предмет</strong>
            <small>{displayData.students.length} студентов • {displayData.dates.length} дат</small>
          </div>
          <div className="schedule-controls">
            <span className="schedule-role-badge">Роль: <strong>{role === 'STUDENT' ? 'Студент' : role === 'TEACHER' ? 'Преподаватель' : 'Администратор'}</strong></span>
          </div>
        </div>

        <div className="grades-table-container">
          <table className="grades-table">
            <thead>
              <tr className="grades-table__header-row">
                <th className="grades-table__header grades-table__student-column">
                  <div><span className="grades-table__header-eyebrow">Список</span><h3>Студент</h3></div>
                </th>
                {displayData.dates.map((date) => (
                  <th key={date} className="grades-table__header">
                    <div><span className="grades-table__header-eyebrow">Дата</span><h4>{new Date(date).toLocaleDateString('ru-RU')}</h4></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.students.map((student) => {
                const isSavingThisRow = savingCell?.studentId === student.id;
                return (
                  <tr key={student.id} className="grades-table__row">
                    <td className="grades-table__cell grades-table__student-cell">
                      <div><strong>{student.lastName} {student.firstName}</strong><small>ID: {student.id}</small></div>
                    </td>
                    {displayData.dates.map((date) => {
                      const grade = displayData.grades[student.id]?.[date] ?? null;
                      const isEditing = editingCell?.studentId === student.id && editingCell.oldDate === date;
                      const isSaving = isSavingThisRow && savingCell?.date === date;
                      return (
                        <td
                          key={date}
                          className="grades-table__cell grades-table__grade-cell"
                          style={{
                            background: getGradeColor(grade),
                            cursor: (role === 'TEACHER' || role === 'ADMIN') && !isPreviewMode ? 'pointer' : 'default',
                          }}
                          onClick={() => !isEditing && (role === 'TEACHER' || role === 'ADMIN') && !isPreviewMode && startEditing(student.id, date, grade)}
                        >
                          {isSaving ? (
                            <span className="grades-table__saving">...</span>
                          ) : isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
                              <input
                                type="number"
                                min="2"
                                max="5"
                                placeholder="Оценка 2-5"
                                value={tempGrade}
                                onChange={(e) => setTempGrade(e.target.value)}
                                autoFocus
                                style={{ width: '100%', padding: '4px' }}
                              />
                              <input
                                type="date"
                                value={tempDate}
                                onChange={(e) => setTempDate(e.target.value)}
                                style={{ width: '100%', padding: '4px' }}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button onClick={saveCell} style={{ padding: '4px 8px' }}>💾 Сохранить</button>
                                <button onClick={() => setEditingCell(null)} style={{ padding: '4px 8px' }}>❌ Отмена</button>
                              </div>
                            </div>
                          ) : (
                            <span className="grades-table__grade-value" style={{ color: getGradeTextColor(grade) }}>
                              {grade !== null ? grade : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="schedule-empty-state" style={{ marginTop: '24px', background: '#fdf2f8', border: '1px solid #f9a8d4' }}>
          <div className="schedule-empty-state__icon">💡</div>
          <h3>Подсказка</h3>
          <p>
            {role === 'STUDENT' && 'Режим только для чтения. Редактирование недоступно.'}
            {role === 'TEACHER' && 'Кликните по любой ячейке – появится форма для ввода оценки и выбора даты. Также доступна загрузка Excel (предпросмотр).'}
            {role === 'ADMIN' && 'Кликните по любой ячейке – измените оценку и дату. Загрузка Excel работает в режиме предпросмотра (без сохранения в БД).'}
          </p>
        </div>
      </section>
    </div>
  );
}