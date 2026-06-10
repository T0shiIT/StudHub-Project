import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';
import type { JournalData, UserRole } from '../types/journal';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

const getGradeColor = (grade: string | null): string => {
  if (grade === null || grade === '') return '#f3e8ff';
  const num = parseInt(grade, 10);
  if (num === 5 || num === 4) return '#fce7f3';
  if (num === 3) return '#fbcfe8';
  if (num === 2) return '#f9a8d4';
  return '#f3e8ff';
};

const getGradeTextColor = (grade: string | null): string => {
  if (grade === null || grade === '') return '#6b21a8';
  const num = parseInt(grade, 10);
  if (num === 5 || num === 4) return '#be185d';
  if (num === 3) return '#9d174d';
  if (num === 2) return '#831843';
  return '#6b21a8';
};

export default function Grades() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
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
  const [uploadMsg, setUploadMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{
    studentId: number;
    oldDate: string;
    gradeId?: number;
    oldGrade: string | null;
  } | null>(null);
  const [tempGrade, setTempGrade] = useState('');
  const [tempDate, setTempDate] = useState('');
  const [savingCell, setSavingCell] = useState<{ studentId: number; date: string } | null>(null);
  const [gradeIdMap, setGradeIdMap] = useState<Record<number, Record<string, number>>>({});

  useEffect(() => {
    if (role === 'TEACHER' || role === 'ADMIN') {
      if (!courseId) return;
      fetchWithCsrf(`/api/grades/course/${courseId}/groups`)
        .then(res => res.ok ? res.json() : [])
        .then((data: string[]) => {
          const filtered = data.filter(g => g && g.trim() !== '');
          setGroups(filtered);
          if (filtered.length === 0) return;
          if (user?.groupName && filtered.includes(user.groupName)) setSelectedGroup(user.groupName);
          else setSelectedGroup(filtered[0]);
        })
        .catch(err => console.error('Failed to load groups:', err));
    }
  }, [role, user?.groupName, courseId]);

  useEffect(() => {
    if (previewData) return;
    if (!isAuthenticated || !courseId) return;

    const fetchGrades = async () => {
      setLoading(true);
      try {
        let url = `/api/grades/course/${courseId}`;
        if (role !== 'STUDENT' && selectedGroup) {
          url += `?group=${encodeURIComponent(selectedGroup)}`;
        }
        const res = await fetchWithCsrf(url);
        if (!res.ok) throw new Error('Ошибка загрузки');
        const data = await res.json();
        processGradesData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (role === 'STUDENT') {
      fetchGrades();
    } else if (selectedGroup) {
      fetchGrades();
    } else {
      setJournal(null);
      setLoading(false);
    }
  }, [isAuthenticated, role, selectedGroup, courseId, previewData]);

  const processGradesData = (data: any[]) => {
    const studentsMap = new Map();
    const datesSet = new Set<string>();
    const gradesMap: Record<number, Record<string, string | null>> = {};
    const newGradeIdMap: Record<number, Record<string, number>> = {};

    for (const g of data) {
      if (!studentsMap.has(g.studentId)) {
        const parts = (g.studentFullName || '').trim().split(' ');
        const lastName = parts[0] || '';
        const firstName = parts.slice(1).join(' ') || '';
        studentsMap.set(g.studentId, { id: g.studentId, firstName, lastName });
        gradesMap[g.studentId] = {};
        newGradeIdMap[g.studentId] = {};
      }
      if (g.date) datesSet.add(g.date);
      gradesMap[g.studentId][g.date] = g.grade !== null && g.grade !== undefined ? String(g.grade) : null;
      newGradeIdMap[g.studentId][g.date] = g.id;
    }

    setJournal({
      students: Array.from(studentsMap.values()),
      dates: Array.from(datesSet).sort(),
      grades: gradesMap,
    });
    setGradeIdMap(newGradeIdMap);
  };

  // Парсит дату формата "11.09.2024" или "2024-09-11" в ISO "2024-09-11"
  const parseDate = (raw: string): string | null => {
    if (!raw) return null;
    // DD.MM.YYYY
    const ddmmyyyy = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
    // YYYY-MM-DD уже ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return null;
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetchWithCsrf('/api/grades/preview', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');

      if (!data.sheets || !data.sheets[0]) {
        throw new Error('Неверный формат данных от сервера');
      }

      const sheet = data.sheets[0];

      // Формат журнала: строка-заголовок вида [№, "Фамилия Имя", "Группа", "11.09.2024", ...]
      // Определяем колонки-даты из заголовка через rows[0].cells
      const headerRow = sheet.rows?.[0];
      if (!headerRow) throw new Error('Не найден заголовок таблицы');

      const dateCols: { colIndex: number; isoDate: string }[] = [];
      let nameColIndex = -1;
      let groupColIndex = -1;

      for (const cell of headerRow.cells) {
        const val = String(cell.value ?? '').trim();
        const iso = parseDate(val);
        if (iso) {
          dateCols.push({ colIndex: cell.columnIndex, isoDate: iso });
        } else if (/фамил/i.test(val) || /имя/i.test(val)) {
          nameColIndex = cell.columnIndex;
        } else if (/групп/i.test(val)) {
          groupColIndex = cell.columnIndex;
        }
      }

      if (dateCols.length === 0) throw new Error('Не найдены колонки с датами в заголовке');
      if (nameColIndex === -1) throw new Error('Не найдена колонка "Фамилия Имя"');

      const studentsMap = new Map<number, { id: number; firstName: string; lastName: string; group: string }>();
      const datesSet = new Set<string>();
      const gradesMap: Record<number, Record<string, number>> = {};

      dateCols.forEach(d => datesSet.add(d.isoDate));

      // Строки данных (пропускаем строку-заголовок)
      for (const row of sheet.rows.slice(1)) {
        const cellByIndex: Record<number, any> = {};
        for (const cell of row.cells) cellByIndex[cell.columnIndex] = cell.value;

        const fullName = String(cellByIndex[nameColIndex] ?? '').trim();
        if (!fullName) continue;

        const group = String(cellByIndex[groupColIndex] ?? '').trim();

        // Полное ФИО кладём в firstName, lastName пустой — в БД имя может храниться целиком в firstName
        const firstName = fullName;
        const lastName = '';

        // Стабильный числовой id из строки fullName+group
        const idKey = fullName + '|' + group;
        let studentId = 0;
        for (let i = 0; i < idKey.length; i++) {
          studentId = ((studentId << 5) - studentId) + idKey.charCodeAt(i);
          studentId |= 0;
        }
        studentId = Math.abs(studentId);

        if (!studentsMap.has(studentId)) {
          studentsMap.set(studentId, { id: studentId, firstName, lastName, group });
          gradesMap[studentId] = {};
        }

        for (const { colIndex, isoDate } of dateCols) {
          const gradeVal = cellByIndex[colIndex];
          if (gradeVal !== null && gradeVal !== undefined) {
            gradesMap[studentId][isoDate] = Number(gradeVal);
          }
        }
      }

      const processedData = {
        students: Array.from(studentsMap.values()),
        dates: Array.from(datesSet).sort(),
        grades: gradesMap,
      };

      if (processedData.students.length === 0) {
        throw new Error('Не найдено студентов в файле. Проверьте формат таблицы.');
      }

      setPreviewData(processedData);
      setUploadMsg(`Таблица загружена, ${processedData.students.length} студентов, ${processedData.dates.length} дат`);
    } catch (err: any) {
      console.error(err);
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
    if (!previewData || !courseId) return;
    setSaving(true);
    try {
      const res = await fetchWithCsrf('/api/grades/save-preview', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ ...previewData, courseId: Number(courseId) }),
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

  const handleAddDateColumn = async () => {
    if (role !== 'TEACHER' && role !== 'ADMIN') return;
    const today = new Date().toISOString().split('T')[0];
    const newDate = prompt('Введите новую дату в формате ГГГГ-ММ-ДД:', today);
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      if (newDate) alert('Неверный формат даты. Используйте ГГГГ-ММ-ДД');
      return;
    }
    const targetData = previewData || journal;
    if (!targetData) return;
    if (targetData.dates.includes(newDate)) {
      alert('Такая дата уже существует');
      return;
    }
    const newGrades = { ...targetData.grades };
    targetData.students.forEach(student => {
      newGrades[student.id] = { ...newGrades[student.id], [newDate]: null };
    });
    const updatedData = {
      ...targetData,
      dates: [...targetData.dates, newDate].sort(),
      grades: newGrades,
    };
    if (previewData) setPreviewData(updatedData);
    else setJournal(updatedData);
  };

  const startEditing = (studentId: number, date: string, currentGrade: string | null) => {
    if (role !== 'TEACHER' && role !== 'ADMIN') return;
    if (previewData) {
      alert('В режиме предпросмотра редактирование недоступно. Сначала сохраните журнал.');
      return;
    }
    const gradeId = gradeIdMap[studentId]?.[date];
    setEditingCell({ studentId, oldDate: date, gradeId, oldGrade: currentGrade });
    setTempGrade(currentGrade ?? '');
    setTempDate(date);
  };

  const saveCell = async () => {
    if (!editingCell || !courseId) return;
    const { studentId, oldDate, gradeId, oldGrade } = editingCell;
    const newGradeValue = tempGrade.trim();
    const newDate = tempDate;

    if (!newDate) {
      setEditingCell(null);
      setSavingCell(null);
      return;
    }

    setSavingCell({ studentId, date: oldDate });

    try {
      if (!gradeId && !newGradeValue) {
        setEditingCell(null);
        setSavingCell(null);
        return;
      }

      if (!gradeId) {
        const res = await fetchWithCsrf('/api/grades', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({
            studentId,
            courseId: Number(courseId),
            subject: 'Основной предмет',
            grade: newGradeValue,
            date: newDate,
          }),
        });
        if (!res.ok) throw new Error('Не удалось создать оценку');
        window.location.reload();
        return;
      }

      let gradeChanged = false,
        dateChanged = false;

      if (newGradeValue !== (oldGrade ?? '')) {
        const res = await fetchWithCsrf(`/api/grades/${gradeId}`, {
          method: 'PATCH',
          headers: JSON_HEADERS,
          body: JSON.stringify({ grade: newGradeValue }),
        });
        if (!res.ok) throw new Error('Ошибка обновления оценки');
        gradeChanged = true;
      }

      if (newDate !== oldDate) {
        const res = await fetchWithCsrf(`/api/grades/${gradeId}/date`, {
          method: 'PATCH',
          headers: JSON_HEADERS,
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
        const gradeValue = newGradeValue || null;
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
      console.error('Error saving grade:', err);
      alert(err.message);
    } finally {
      setSavingCell(null);
    }
  };

  const handleDateColumnClick = async (oldDate: string) => {
    if (role !== 'TEACHER' && role !== 'ADMIN') return;
    if (previewData) {
      alert('В режиме предпросмотра нельзя изменить дату. Сначала сохраните журнал.');
      return;
    }
    if (!selectedGroup) {
      alert('Не выбрана группа');
      return;
    }
    const newDateStr = prompt('Введите новую дату в формате ГГГГ-ММ-ДД:', oldDate);
    if (!newDateStr) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) {
      alert('Неверный формат даты. Используйте ГГГГ-ММ-ДД');
      return;
    }
    try {
      const res = await fetchWithCsrf(`/api/grades/course/${courseId}/date-column`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          group: selectedGroup,
          subject: 'Основной предмет',
          oldDate,
          newDate: newDateStr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка обновления');
      alert(`Обновлено ${data.updated} оценок`);
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
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

  const displayData = previewData || journal;
  const isPreviewMode = !!previewData;
  const showUploadButton = role === 'ADMIN' || role === 'TEACHER';

  const heroSection = (
    <section className="schedule-hero">
      <div>
        <span className="schedule-eyebrow">Успеваемость</span>
        <h2>Журнал оценок курса</h2>
        <p>Просматривайте и редактируйте оценки и даты.</p>
      </div>
      <div className="schedule-hero-actions">
        {showUploadButton && (
          <>
            <button
              className="schedule-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ marginRight: '12px' }}
            >
              {uploading ? 'Загрузка...' : 'Загрузить Excel (предпросмотр)'}
            </button>
            {isPreviewMode && (
              <>
                <button onClick={savePreviewToDb} disabled={saving} style={{ marginRight: '12px' }}>
                  {saving ? 'Сохранение...' : '💾 Сохранить в журнал'}
                </button>
                <button onClick={clearPreview} style={{ marginRight: '12px' }}>
                  Вернуться к журналу
                </button>
              </>
            )}
          </>
        )}
        <button className="schedule-upload-btn" onClick={() => navigate(`/courses/${courseId}`)}>
          ← Назад к курсу
        </button>
      </div>
    </section>
  );

  const fileInputElement = (
    <input
      type="file"
      ref={fileInputRef}
      className="schedule-file-input"
      onChange={handleFileUpload}
      accept=".xlsx,.xls"
    />
  );

  if (loading && !isPreviewMode) {
    return (
      <>
        {heroSection}
        {fileInputElement}
        <div className="schedule-alert schedule-alert--loading">Загрузка журнала оценок...</div>
      </>
    );
  }

  if (error && !isPreviewMode) {
    return (
      <>
        {heroSection}
        {fileInputElement}
        <div className="schedule-alert schedule-alert--error">{error}</div>
      </>
    );
  }

  if (!displayData || !displayData.students || displayData.students.length === 0) {
    return (
      <>
        {heroSection}
        {fileInputElement}
        {uploading && <div className="schedule-alert schedule-alert--loading">Загрузка и обработка файла...</div>}
        {uploadMsg && (
          <div
            className={`schedule-alert ${
              uploadMsg.startsWith('Таблица') ? 'schedule-alert--success' : 'schedule-alert--error'
            }`}
          >
            {uploadMsg}
          </div>
        )}
        <div className="schedule-empty-state">
          <div className="schedule-empty-state__icon">📊</div>
          <h3>Журнал пуст</h3>
          <p>Данные не найдены или журнал ещё не заполнен.</p>
          {showUploadButton && (
            <p style={{ marginTop: '12px' }}>
              Используйте кнопку <strong>«Загрузить Excel (предпросмотр)»</strong> выше.
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="schedule-page">
      {heroSection}
      {fileInputElement}
      {uploading && <div className="schedule-alert schedule-alert--loading">Загрузка и обработка файла...</div>}
      {uploadMsg && (
        <div
          className={`schedule-alert ${
            uploadMsg.startsWith('Таблица') ? 'schedule-alert--success' : 'schedule-alert--error'
          }`}
        >
          {uploadMsg}
        </div>
      )}
      {isPreviewMode && (
        <div style={{ marginBottom: '16px', padding: '8px', background: '#e0f2fe', borderRadius: '8px', textAlign: 'center' }}>
          🔍 Режим предпросмотра (данные из Excel, не сохранены в БД)
        </div>
      )}
      {(role === 'TEACHER' || role === 'ADMIN') && groups.length > 0 && !isPreviewMode && (
        <div style={{ marginBottom: '20px', textAlign: 'right' }}>
          <label style={{ marginRight: '8px' }}>Группа:</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '8px' }}
          >
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>
      )}
      <section className="schedule-card">
        <div className="schedule-toolbar">
          <div className="schedule-file-info">
            <span>Журнал</span>
            <strong>Основной предмет</strong>
            <small>
              {displayData.students.length} студентов • {displayData.dates.length} дат
            </small>
          </div>
        </div>

        <div
          className="grades-table-container"
          style={{ overflowX: 'auto', width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px' }}
        >
          <table className="grades-table" style={{ minWidth: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead>
              <tr className="grades-table__header-row">
                <th
                  className="grades-table__header grades-table__student-column"
                  style={{
                    position: 'sticky',
                    left: 0,
                    backgroundColor: '#f9fafb',
                    zIndex: 20,
                    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                  }}
                >
                  <div>
                    <span className="grades-table__header-eyebrow">Список</span>
                    <h3>Студент</h3>
                  </div>
                </th>
                {displayData.dates.map((date) => (
                  <th
                    key={date}
                    className="grades-table__header"
                    onClick={() => (role === 'TEACHER' || role === 'ADMIN') && !isPreviewMode && handleDateColumnClick(date)}
                    style={{
                      cursor: (role === 'TEACHER' || role === 'ADMIN') && !isPreviewMode ? 'pointer' : 'default',
                      minWidth: '120px',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <span className="grades-table__header-eyebrow">Дата</span>
                      <h4>{new Date(date).toLocaleDateString('ru-RU')}</h4>
                    </div>
                  </th>
                ))}
                {(role === 'TEACHER' || role === 'ADMIN') && !isPreviewMode && (
                  <th className="grades-table__header grades-table__add-date-column" style={{ minWidth: '60px' }}>
                    <button onClick={handleAddDateColumn} title="Добавить новую дату" className="add-date-btn">
                      ＋
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayData.students.map((student) => {
                const isSavingThisRow = savingCell?.studentId === student.id;
                return (
                  <tr key={student.id} className="grades-table__row">
                    <td
                      className="grades-table__cell grades-table__student-cell"
                      style={{
                        position: 'sticky',
                        left: 0,
                        backgroundColor: '#ffffff',
                        zIndex: 10,
                        boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                      }}
                    >
                      <div>
                        <strong>
                          {student.lastName} {student.firstName}
                        </strong>
                        <small>ID: {student.id}</small>
                      </div>
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
                            minWidth: '120px',
                            textAlign: 'center',
                          }}
                          onClick={() =>
                            !isEditing &&
                            (role === 'TEACHER' || role === 'ADMIN') &&
                            !isPreviewMode &&
                            startEditing(student.id, date, grade)
                          }
                        >
                          {isSaving ? (
                            <span className="grades-table__saving">...</span>
                          ) : isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
                              <input
                                type="text"
                                placeholder="Оценка"
                                value={tempGrade}
                                onChange={(e) => setTempGrade(e.target.value)}
                                autoFocus
                                style={{ width: '100%', padding: '4px', textAlign: 'center' }}
                              />
                              <input
                                type="date"
                                value={tempDate}
                                onChange={(e) => setTempDate(e.target.value)}
                                style={{ width: '100%', padding: '4px' }}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', justifyContent: 'center' }}>
                                <button onClick={saveCell} style={{ padding: '4px 8px' }}>
                                  💾
                                </button>
                                <button onClick={() => setEditingCell(null)} style={{ padding: '4px 8px' }}>
                                  ❌
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span
                              className="grades-table__grade-value"
                              style={{ color: getGradeTextColor(grade), fontSize: '1.1rem', fontWeight: 'bold' }}
                            >
                              {grade !== null && grade !== '' ? grade : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {(role === 'TEACHER' || role === 'ADMIN') && !isPreviewMode && (
                      <td className="grades-table__cell grades-table__grade-cell" style={{ background: '#f9fafb', cursor: 'default', minWidth: '60px' }} />
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className="schedule-empty-state"
          style={{ marginTop: '24px', background: '#fdf2f8', border: '1px solid #f9a8d4' }}
        >
          <div className="schedule-empty-state__icon">🐙</div>
          <h3>Подсказка</h3>
          <p>
            {role === 'STUDENT' && 'Режим только для чтения. Редактирование недоступно.'}
            {role === 'TEACHER' &&
              'Кликните по ячейке для изменения оценки. Чтобы добавить новую дату, нажмите кнопку "＋" в заголовке таблицы. Для загрузки Excel используйте соответствующую кнопку.'}
            {role === 'ADMIN' &&
              'Кликните по ячейке для изменения оценки. Для добавления новой колонки с датой используйте кнопку "＋". Для загрузки Excel используйте соответствующую кнопку.'}
          </p>
        </div>
      </section>
    </div>
  );
}
