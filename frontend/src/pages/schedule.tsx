import { useRef, useState } from 'react';
import { fetchWithCsrf } from '../utils/csrf';

const API_BASE_URL = 'http://localhost:8080';
const SCHEDULE_UPLOAD_URL = `${API_BASE_URL}/api/schedule/upload`;
const SUPPORTED_EXCEL_EXTENSIONS = '.xlsx,.xls,.xlsm,.xlsb';
const EMPTY_CELL = '';
const TABLE_HEADER_ROWS_COUNT = 4;
const DAY_NAMES = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WEEK_TYPES: WeekType[] = ['even', 'odd'];
const PAIR_NUMBER_PATTERN = /^\d+/;
const DAY_NAME_PATTERN = /понедельник|вторник|среда|четверг|пятница|суббота|воскресенье/i;
const ODD_WEEK_PATTERN = /неч[её]тн/i;
const EVEN_WEEK_PATTERN = /(?<!не)ч[её]тн/i;
const DAY_HEADER_TEXT = 'дни недели';
const PAIR_HEADER_TEXT = 'пара';
const TYPE_HEADER_TEXT = 'вид занятий';

type WeekType = 'even' | 'odd';
type ScheduleCellValue = string | number | boolean | null | undefined;

interface Cell {
  columnIndex: number;
  columnName: string;
  value: ScheduleCellValue;
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

interface WeekSegment {
  type: WeekType;
  start: number;
  end: number;
}

interface GroupOption {
  label: string;
  columnIndex: number;
  typeColumnIndex: number;
}

interface LessonCard {
  pair: string;
  type: string;
  title: string;
  teacher: string;
  room: string;
  details: string[];
}

interface DaySchedule {
  key: string;
  title: string;
  lessons: LessonCard[];
}

function normalizeCellValue(value: ScheduleCellValue): string {
  if (value === null || value === undefined) return EMPTY_CELL;
  return String(value).trim();
}

function isFilledCell(value: ScheduleCellValue): boolean {
  return normalizeCellValue(value).length > 0;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

function getMaxColumns(sheet: Sheet): number {
  let max = 0;
  const rows = Array.isArray(sheet.rows) ? sheet.rows : [];

  rows.forEach(row => {
    const cells = Array.isArray(row.cells) ? row.cells : [];
    cells.forEach(cell => {
      if (cell.columnIndex > max) max = cell.columnIndex;
    });
  });
  return max + 1;
}

function buildMatrix(sheet: Sheet): string[][] {
  const maxCols = getMaxColumns(sheet);
  const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
  const matrix = rows.map(row => {
    const rowCells: string[] = new Array(maxCols).fill(EMPTY_CELL);
    const cells = Array.isArray(row.cells) ? row.cells : [];

    cells.forEach(cell => {
      rowCells[cell.columnIndex] = normalizeCellValue(cell.value);
    });
    return rowCells;
  });

  const visibleColumnIndexes = Array.from({ length: maxCols }, (_, index) => index)
    .filter(colIndex => matrix.some(row => isFilledCell(row[colIndex])));

  return matrix
    .map(row => visibleColumnIndexes.map(colIndex => row[colIndex]))
    .filter(row => row.some(isFilledCell));
}

function resolveWeekType(value: string): WeekType | null {
  if (ODD_WEEK_PATTERN.test(value)) return 'odd';
  if (EVEN_WEEK_PATTERN.test(value)) return 'even';
  return null;
}

function formatWeekType(week: WeekType): string {
  return week === 'even' ? 'Чётная неделя' : 'Нечётная неделя';
}

function getWeekSegments(matrix: string[][]): WeekSegment[] {
  const headerRow = matrix[0] ?? [];
  const segments: WeekSegment[] = [];
  let currentType: WeekType | null = null;
  let currentStart = 0;

  headerRow.forEach((cell, colIdx) => {
    const weekType = resolveWeekType(cell);
    if (!weekType) return;

    if (!currentType) {
      currentType = weekType;
      currentStart = colIdx;
      return;
    }

    if (weekType !== currentType) {
      segments.push({ type: currentType, start: currentStart, end: colIdx });
      currentType = weekType;
      currentStart = colIdx;
    }
  });

  if (currentType) {
    segments.push({ type: currentType, start: currentStart, end: headerRow.length });
  }

  if (segments.length === 0 && headerRow.length > 0) {
    segments.push({ type: 'even', start: 0, end: headerRow.length });
  }

  return segments.filter(segment => segment.end > segment.start);
}

function getAvailableWeeks(segments: WeekSegment[]): WeekType[] {
  return WEEK_TYPES.filter(week => segments.some(segment => segment.type === week));
}

function getActiveWeek(selectedWeek: WeekType, availableWeeks: WeekType[]): WeekType {
  return availableWeeks.includes(selectedWeek) ? selectedWeek : availableWeeks[0] ?? 'even';
}

function getSegmentByWeek(segments: WeekSegment[], week: WeekType): WeekSegment | null {
  return segments.find(segment => segment.type === week) ?? segments[0] ?? null;
}

function headerIncludes(matrix: string[][], colIdx: number, text: string): boolean {
  const lowerText = text.toLowerCase();
  return [2, 3].some(rowIdx => normalizeCellValue(matrix[rowIdx]?.[colIdx]).toLowerCase().includes(lowerText));
}

function findColumnByHeader(matrix: string[][], segment: WeekSegment, text: string, fallbackOffset: number): number {
  for (let colIdx = segment.start; colIdx < segment.end; colIdx += 1) {
    if (headerIncludes(matrix, colIdx, text)) return colIdx;
  }

  return Math.min(segment.start + fallbackOffset, segment.end - 1);
}

function findTypeColumn(matrix: string[][], segment: WeekSegment, groupColumnIndex: number): number {
  for (let colIdx = groupColumnIndex - 1; colIdx >= segment.start; colIdx -= 1) {
    if (headerIncludes(matrix, colIdx, TYPE_HEADER_TEXT)) return colIdx;
  }

  return findColumnByHeader(matrix, segment, TYPE_HEADER_TEXT, 2);
}

function getGroupOptions(matrix: string[][], segment: WeekSegment): GroupOption[] {
  const groupHeaderRow = matrix[3] ?? [];
  const fallbackHeaderRow = matrix[2] ?? [];
  const options: GroupOption[] = [];

  for (let colIdx = segment.start; colIdx < segment.end; colIdx += 1) {
    const label = normalizeCellValue(groupHeaderRow[colIdx] || fallbackHeaderRow[colIdx]);
    const lowerLabel = label.toLowerCase();

    if (!label) continue;
    if (resolveWeekType(label)) continue;
    if (lowerLabel.includes(DAY_HEADER_TEXT)) continue;
    if (lowerLabel === PAIR_HEADER_TEXT) continue;
    if (lowerLabel.includes(TYPE_HEADER_TEXT)) continue;

    options.push({
      label,
      columnIndex: colIdx,
      typeColumnIndex: findTypeColumn(matrix, segment, colIdx),
    });
  }

  return options;
}

function getDayKey(value: string): string | null {
  const lowerValue = value.toLowerCase();
  if (!DAY_NAME_PATTERN.test(lowerValue)) return null;
  return DAY_NAMES.find(day => lowerValue.includes(day)) ?? null;
}

function createEmptyDaySchedules(): DaySchedule[] {
  return DAY_NAMES.map(day => ({
    key: day,
    title: capitalize(day),
    lessons: [],
  }));
}

function appendLessonDetail(lesson: LessonCard, value: string): void {
  const knownValues = [lesson.title, lesson.teacher, lesson.room, ...lesson.details];
  if (!value || knownValues.includes(value)) return;

  if (!lesson.title) {
    lesson.title = value;
    return;
  }
  if (!lesson.teacher) {
    lesson.teacher = value;
    return;
  }
  if (!lesson.room) {
    lesson.room = value;
    return;
  }

  lesson.details.push(value);
}

function buildDaySchedules(matrix: string[][], segment: WeekSegment, group: GroupOption): DaySchedule[] {
  const dayColumnIndex = findColumnByHeader(matrix, segment, DAY_HEADER_TEXT, 0);
  const pairColumnIndex = findColumnByHeader(matrix, segment, PAIR_HEADER_TEXT, 1);
  const daySchedules = createEmptyDaySchedules();
  const dayMap = new Map(daySchedules.map(day => [day.key, day]));
  const lessonMap = new Map<string, LessonCard>();

  for (let rowIdx = TABLE_HEADER_ROWS_COUNT; rowIdx < matrix.length; rowIdx += 1) {
    const row = matrix[rowIdx] ?? [];
    const dayKey = getDayKey(normalizeCellValue(row[dayColumnIndex]));
    const pair = normalizeCellValue(row[pairColumnIndex]);
    const lessonValue = normalizeCellValue(row[group.columnIndex]);

    if (!dayKey || !PAIR_NUMBER_PATTERN.test(pair) || !lessonValue) continue;

    const lessonKey = `${dayKey}:${pair}`;
    let lesson = lessonMap.get(lessonKey);

    if (!lesson) {
      lesson = {
        pair,
        type: normalizeCellValue(row[group.typeColumnIndex]),
        title: EMPTY_CELL,
        teacher: EMPTY_CELL,
        room: EMPTY_CELL,
        details: [],
      };
      lessonMap.set(lessonKey, lesson);
      dayMap.get(dayKey)?.lessons.push(lesson);
    }

    if (!lesson.type) {
      lesson.type = normalizeCellValue(row[group.typeColumnIndex]);
    }

    appendLessonDetail(lesson, lessonValue);
  }

  return daySchedules;
}

export default function Schedule() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState<WeekType>('even');
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setScheduleData(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
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

        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Ошибка загрузки: ${response.status}`);
      }

      const result = await response.json();
      const schedule = result.schedule;
      if (!schedule) {
        throw new Error('Ответ сервера не содержит поле schedule');
      }
      setScheduleData(schedule);
      setCurrentSheetIndex(0);
      setSelectedWeek('even');
      setSelectedGroupIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentSheet = scheduleData?.sheets[currentSheetIndex];
  const matrix = currentSheet ? buildMatrix(currentSheet) : [];
  const weekSegments = getWeekSegments(matrix);
  const availableWeeks = getAvailableWeeks(weekSegments);
  const activeWeek = getActiveWeek(selectedWeek, availableWeeks);
  const activeSegment = getSegmentByWeek(weekSegments, activeWeek);
  const groupOptions = activeSegment ? getGroupOptions(matrix, activeSegment) : [];
  const activeGroupIndex = Math.min(selectedGroupIndex, Math.max(groupOptions.length - 1, 0));
  const activeGroup = groupOptions[activeGroupIndex];
  const daySchedules = activeSegment && activeGroup
    ? buildDaySchedules(matrix, activeSegment, activeGroup)
    : createEmptyDaySchedules();

  return (
    <div className="schedule-page">
      <section className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">Учебная неделя</span>
          <h2>Расписание занятий</h2>
          <p>Выберите неделю и группу — расписание отобразится компактными карточками по дням.</p>
        </div>
        <button className="schedule-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={loading}>
          {loading ? 'Обрабатываем...' : 'Загрузить Excel'}
        </button>
      </section>

      <input
        type="file"
        ref={fileInputRef}
        className="schedule-file-input"
        onChange={handleFileChange}
        accept={SUPPORTED_EXCEL_EXTENSIONS}
      />

      {loading && <div className="schedule-alert schedule-alert--loading">Загрузка и обработка файла...</div>}
      {error && <div className="schedule-alert schedule-alert--error">{error}</div>}

      {!scheduleData && !loading && (
        <section className="schedule-empty-state">
          <div className="schedule-empty-state__icon">📚</div>
          <h3>Расписание ещё не загружено</h3>
          <p>Выберите файл формата XLS/XLSX, чтобы увидеть занятия по дням недели.</p>
        </section>
      )}

      {scheduleData && currentSheet && (
        <section className="schedule-card">
          <div className="schedule-toolbar">
            <div className="schedule-file-info">
              <span>Файл</span>
              <strong>{scheduleData.fileName}</strong>
              <small>{currentSheet.rowsCount} строк • {currentSheet.columnsCount} колонок</small>
            </div>

            <div className="schedule-controls">
              <label className="schedule-sheet-picker" htmlFor="sheetSelect">
                Курс / лист
                <select
                  id="sheetSelect"
                  className="schedule-select"
                  value={currentSheetIndex}
                  onChange={(event) => {
                    setCurrentSheetIndex(Number(event.target.value));
                    setSelectedGroupIndex(0);
                  }}
                >
                  {scheduleData.sheets.map((sheet, idx) => (
                    <option key={sheet.sheetName} value={idx}>
                      {sheet.sheetName}
                    </option>
                  ))}
                </select>
              </label>

              {availableWeeks.length > 0 && (
                <div className="schedule-week-toggle" role="group" aria-label="Выбор недели">
                  {availableWeeks.map(week => (
                    <button
                      key={week}
                      type="button"
                      className={`schedule-week-button ${activeWeek === week ? 'schedule-week-button--active' : ''}`}
                      onClick={() => setSelectedWeek(week)}
                    >
                      {formatWeekType(week)}
                    </button>
                  ))}
                </div>
              )}

              {groupOptions.length > 0 && (
                <label className="schedule-sheet-picker" htmlFor="groupSelect">
                  Группа / подгруппа
                  <select
                    id="groupSelect"
                    className="schedule-select"
                    value={activeGroupIndex}
                    onChange={(event) => setSelectedGroupIndex(Number(event.target.value))}
                  >
                    {groupOptions.map((group, idx) => (
                      <option key={`${group.label}-${group.columnIndex}`} value={idx}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {activeGroup ? (
            <div className="schedule-days-grid">
              {daySchedules.map(day => (
                <article key={day.key} className="schedule-day-card">
                  <header className="schedule-day-card__header">
                    <div>
                      <span className="schedule-day-card__eyebrow">{formatWeekType(activeWeek)}</span>
                      <h3>{day.title}</h3>
                    </div>
                    <strong>{day.lessons.length || '—'}</strong>
                  </header>

                  {day.lessons.length > 0 ? (
                    <div className="schedule-lessons-list">
                      {day.lessons.map(lesson => (
                        <div key={`${day.key}-${lesson.pair}-${lesson.title}`} className="schedule-lesson-card">
                          <div className="schedule-lesson-card__meta">
                            <span>{lesson.pair} пара</span>
                            {lesson.type && <em>{lesson.type}</em>}
                          </div>
                          <h4>{lesson.title}</h4>
                          {lesson.teacher && <p className="schedule-lesson-card__teacher">{lesson.teacher}</p>}
                          {lesson.room && <p className="schedule-lesson-card__room">📍 {lesson.room}</p>}
                          {lesson.details.map(detail => (
                            <p key={detail} className="schedule-lesson-card__detail">{detail}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="schedule-day-card__empty">Пар нет</div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="schedule-empty-state">
              <h3>Не удалось определить группы</h3>
              <p>Проверьте, что в файле есть строки с названиями групп и подгрупп.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
