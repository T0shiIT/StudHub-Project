import { useRef, useState } from 'react';
import { fetchWithCsrf } from '../utils/csrf'; // <-- ВАЖНО: импорт утилиты

const API_BASE_URL = 'http://localhost:8080';
const SCHEDULE_UPLOAD_URL = `${API_BASE_URL}/api/schedule/upload`;
const SUPPORTED_EXCEL_EXTENSIONS = '.xlsx,.xls,.xlsm,.xlsb';

// ---------- Интерфейсы ----------
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setScheduleData(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // ИСПОЛЬЗУЕМ fetchWithCsrf вместо обычного fetch
      const response = await fetchWithCsrf(SCHEDULE_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 403) {
          const text = await response.text();
          throw new Error(
            text.includes('CSRF') || text.includes('Forbidden')
              ? 'Ошибка CSRF-токена. Обновите страницу и повторите.'
              : 'Нет прав доступа (требуется роль ADMIN)'
          );
        }
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }

      const result = await response.json();
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

  // ---------- Вспомогательные функции ----------
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
        accept={SUPPORTED_EXCEL_EXTENSIONS}
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