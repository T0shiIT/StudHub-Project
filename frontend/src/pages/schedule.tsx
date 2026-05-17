import { useRef, useState } from 'react';

// ---------- Интерфейсы (из вашего JSON-файла) ----------
interface Cell {
  columnIndex: number;
  columnName: string;
  value: string | null;
}

interface Row {
  cells: Cell[];
  rowIndex: number;
}

interface Sheet {
  sheetName: string;
  rows: Row[];
  rowsCount: number;
  columnsCount: number;
}

interface ScheduleData {
  fileName: string;
  sheets: Sheet[];
  sheetsCount: number;
}

// ---------- Компонент ----------
export default function Schedule() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);

  // Настройки – измените под свой бэкенд
  const UPLOAD_URL = '/api/schedule/upload';
  // Если нужен токен авторизации (например, из localStorage)
  const authToken = localStorage.getItem('accessToken'); // или откуда вы его берёте

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setScheduleData(null);

    const formData = new FormData();
    // Уточните имя поля у бэкенда – обычно 'file'
    formData.append('file', file);

    try {
      const response = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: {
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 403) throw new Error('Нет прав доступа (требуется роль ADMIN)');
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }

      const result = await response.json();
      // Структура ответа: { message: "...", schedule: { ... } }
      const schedule = result.schedule;
      if (!schedule) {
        throw new Error('Ответ сервера не содержит поле schedule');
      }

      setScheduleData(schedule);
      setCurrentSheetIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---------- Вспомогательные функции для отображения таблицы ----------
  const getMaxColumns = (sheet: Sheet): number => {
    let max = 0;
    sheet.rows.forEach(row => {
      row.cells.forEach(cell => {
        if (cell.columnIndex > max) max = cell.columnIndex;
      });
    });
    return max + 1;
  };

  const buildMatrix = (sheet: Sheet): (string | null)[][] => {
    const maxCols = getMaxColumns(sheet);
    const matrix: (string | null)[][] = [];
    sheet.rows.forEach(row => {
      const rowCells: (string | null)[] = new Array(maxCols).fill(null);
      row.cells.forEach(cell => {
        rowCells[cell.columnIndex] = cell.value;
      });
      matrix.push(rowCells);
    });
    return matrix;
  };

  const renderTable = () => {
    if (!scheduleData) return null;
    const sheet = scheduleData.sheets[currentSheetIndex];
    if (!sheet) return <p>Нет данных для этого листа</p>;

    const matrix = buildMatrix(sheet);
    if (matrix.length === 0) return <p>Таблица пуста</p>;

    return (
      <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto', marginTop: '20px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    style={{
                      border: '1px solid #ccc',
                      padding: '6px 8px',
                      whiteSpace: 'nowrap',
                      backgroundColor: rowIdx % 2 === 0 ? '#f9f9f9' : '#fff',
                    }}
                  >
                    {cell !== null ? cell : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ---------- Рендер компонента ----------
  return (
    <div>
      <h2>Расписание занятий</h2>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept=".xlsx,.xls"
      />

      <button onClick={() => fileInputRef.current?.click()}>
        Загрузить Excel
      </button>

      {loading && <p style={{ marginTop: '12px' }}>Загрузка и обработка...</p>}
      {error && <p style={{ marginTop: '12px', color: 'red' }}>{error}</p>}

      {scheduleData && (
        <div style={{ marginTop: '24px' }}>
          <label htmlFor="sheetSelect">Выберите курс/лист: </label>
          <select
            id="sheetSelect"
            value={currentSheetIndex}
            onChange={(e) => setCurrentSheetIndex(Number(e.target.value))}
            style={{ marginLeft: '8px', padding: '4px 8px' }}
          >
            {scheduleData.sheets.map((sheet, idx) => (
              <option key={idx} value={idx}>
                {sheet.sheetName}
              </option>
            ))}
          </select>

          {renderTable()}
        </div>
      )}
    </div>
  );
}