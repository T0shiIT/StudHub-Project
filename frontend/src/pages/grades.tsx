import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { JournalData, UserRole } from '../types/journal';

//моковые данные заглушка покешта
const MOCK_JOURNAL: JournalData = {
  students: [
    { id: 1, firstName: 'игорь', lastName: 'петров' },
    { id: 2, firstName: 'татьяна', lastName: 'сидорова' },
    { id: 3, firstName: 'григорий', lastName: 'козлов' },
  ],
  dates: ['2026-05-05', '2026-05-07', '2026-05-12', '2026-05-14'],
  grades: {
    1: { '2026-05-05': 5, '2026-05-07': 4, '2026-05-12': null, '2026-05-14': 3 },
    2: { '2026-05-05': 4, '2026-05-07': 5, '2026-05-12': 2, '2026-05-14': 4 },
    3: { '2026-05-05': null, '2026-05-07': 3, '2026-05-12': 5, '2026-05-14': 5 },
  },
};

const getGradeColor = (grade: number | null) => {
  if (grade === 5 || grade === 4) return '#49b36e'; 
  if (grade === 3) return '#fff478';                
  if (grade === 2) return '#ff3d3d';                
  return '#9e9e9e';                                
};

export default function Grades() {
  const { user, isAuthenticated } = useAuth();
  const role: UserRole = (user?.role as UserRole) || 'admin';

  const [journal, setJournal] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState('');

  const [editingCell, setEditingCell] = useState<{ studentId: number; date: string } | null>(null);
  const [tempGrade, setTempGrade] = useState('');
  const [savingCell, setSavingCell] = useState<{ studentId: number; date: string } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // загрузка журналам при открытии стр
  useEffect(() => {
    // имитация GET-запроса: /api/journal?subject_id=...
    const timer = setTimeout(() => {
      setJournal(MOCK_JOURNAL);
      setLoading(false);
    }, 800); 

    return () => clearTimeout(timer); 
  }, []);

  const startEditing = (studentId: number, date: string, currentGrade: number | null) => {
    if (role !== 'teacher') return;
    setEditingCell({ studentId, date });
    setTempGrade(currentGrade !== null ? String(currentGrade) : '');
  };

  const saveGrade = async (studentId: number, date: string) => {
    const newGrade = parseInt(tempGrade, 10);
    if (isNaN(newGrade) || newGrade < 2 || newGrade > 5) {
      alert('Разрешены только оценки от 2 до 5');
      return;
    }

    setSavingCell({ studentId, date });  

    try {
      // имитация PATCH-запроса: /api/journal/grade
      await new Promise((res, rej) => setTimeout(Math.random() > 0.2 ? res : rej, 600));

      setJournal((prev) => {
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
    } catch {
      alert('Не удалось сохранить оценку. Проверьте соединение.');
    } finally {
      setSavingCell(null); 
    }
  };

  // кнопка выгрузки эксель таблички для админа
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg('');

    try {
      // имитация POST-запроса: /api/journal/upload
      await new Promise((res) => setTimeout(res, 1000));
      setUploadMsg('Успешно загружено');
    } catch {
      setUploadMsg('Ошибка загрузки или неверный формат файла');
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  if (!isAuthenticated) return <p style={{ textAlign: 'center', marginTop: '40px' }}>Войдите в систему для просмотра оценок.</p>;
  if (loading) return <p style={{ textAlign: 'center', marginTop: '40px' }}> Загрузка журнала...</p>;
  if (error) return <p style={{ textAlign: 'center', marginTop: '40px', color: '#ef4444' }}>{error}</p>;
  if (!journal) return <p style={{ textAlign: 'center', marginTop: '40px' }}>Данные не найдены.</p>;

  return (
    <div>
      <h2>Журнал оценок</h2>
      {role === 'admin' && (
        <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #3b82f6' }}>
          <h3 style={{ marginBottom: '12px' }}>Загрузка данных из Excel</h3>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
            id="excel-upload"
          />
          <label
            htmlFor="excel-upload"
            style={{
              cursor: uploading ? 'not-allowed' : 'pointer',
              color: '#3b82f6',
              fontWeight: 600,
              textDecoration: 'underline',
              userSelect: 'none',
            }}
          >
            {uploading ? '⏳ Отправка...' : '📎 Выбрать файл'}
          </label>
          {uploadMsg && (
            <p style={{ marginTop: '8px', color: uploadMsg.startsWith('') ? '#10b981' : '#ef4444' }}>
              {uploadMsg}
            </p>
          )}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#1e293b', color: 'white' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Студент</th>
            {journal.dates.map((date) => (
              <th key={date} style={{ padding: '12px', textAlign: 'center' }}>
                {new Date(date).toLocaleDateString('ru-RU')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {journal.students.map((student) => (
            <tr key={student.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px', fontWeight: 500 }}>
                {student.lastName} {student.firstName}
              </td>
              {journal.dates.map((date) => {
                const grade = journal.grades[student.id]?.[date] ?? null;
                const isEditing = editingCell?.studentId === student.id && editingCell.date === date;
                const isSaving = savingCell?.studentId === student.id && savingCell.date === date;

                return (
                  <td
                    key={date}
                    style={{
                      padding: 0,
                      textAlign: 'center',
                      background: getGradeColor(grade),
                      cursor: role === 'teacher' ? 'pointer' : 'default',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => !isEditing && role === 'teacher' && startEditing(student.id, date, grade)}
                  >
                    {isSaving ? (
                      <span style={{ color: '#6b7280', fontSize: '14px' }}>...</span>
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
                        style={{
                          width: '100%',
                          height: '48px',
                          border: 'none',
                          background: 'transparent',
                          textAlign: 'center',
                          outline: '2px solid #3b82f6',
                          fontSize: '16px',
                          fontWeight: 600,
                        }}
                      />
                    ) : (
                      <span style={{ padding: '12px', display: 'block', fontWeight: 600, color: '#334155' }}>
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

      <p style={{ marginTop: '20px', color: '#64748b', fontSize: '14px' }}>
        Ваша роль: <b>{role}</b>.{' '}
        {role === 'student' ? 'Режим только для чтения. Редактирование недоступно.' : ''}
        {role === 'teacher' ? 'Кликните по любой ячейке, чтобы поставить оценку (2–5).' : ''}
        {role === 'admin' ? 'Вам доступна загрузка Excel-файлов для массового импорта.' : ''}
      </p>
    </div>
  );
}   