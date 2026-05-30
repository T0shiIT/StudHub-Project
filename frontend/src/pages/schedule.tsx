import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { fetchWithCsrf } from '../utils/csrf';

const API_BASE_URL = 'http://localhost:8080';
const SCHEDULE_UPLOAD_URL = `${API_BASE_URL}/api/schedule/upload`;
const SCHEDULE_UPLOADS_URL = `${API_BASE_URL}/api/schedule/uploads`;
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
const UNKNOWN_ERROR_MESSAGE = 'Неизвестная ошибка';
const INVALID_SCHEDULE_RESPONSE_MESSAGE = 'Ответ сервера не содержит корректное расписание';
const EMPTY_SCHEDULE_SELECT_VALUE = '';
const SEARCH_LOCALE = 'ru-RU';
const SCHEDULE_SEARCH_PLACEHOLDER = 'Поиск по группе или дате';
const SCHEDULE_PICKER_DEFAULT_TEXT = 'Выберите расписание';
const SCHEDULE_PICKER_EMPTY_TEXT = 'Ничего не найдено';

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {

  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

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

interface SavedSchedule {
  id: number;
  fileName: string;
  fileType: string;
  uploadedBy: string;
  createdAt: string | null;
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

function isScheduleData(value: unknown): value is ScheduleData {
  if (!value || typeof value !== 'object') return false;
  const schedule = value as ScheduleData;
  return typeof schedule.fileName === 'string' && Array.isArray(schedule.sheets);
}

function toScheduleData(value: unknown): ScheduleData {
  if (!isScheduleData(value)) {
    throw new Error(INVALID_SCHEDULE_RESPONSE_MESSAGE);
  }
  return value;
}

function formatScheduleDate(value: string | null | undefined): string {
  if (!value) return 'без даты';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ru-RU', DATE_FORMAT_OPTIONS).format(date);
}

function formatSavedScheduleOption(schedule: SavedSchedule): string {
  return schedule.fileName || `Расписание ${formatScheduleDate(schedule.createdAt)}`;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase(SEARCH_LOCALE);
}

function getSavedScheduleSearchText(schedule: SavedSchedule): string {
  return normalizeSearchValue(`${schedule.fileName} ${schedule.uploadedBy} ${formatScheduleDate(schedule.createdAt)}`);
}

function matchesSavedScheduleSearch(schedule: SavedSchedule, searchQuery: string): boolean {
  if (!searchQuery) return true;
  return getSavedScheduleSearchText(schedule).includes(searchQuery);
}

function toNumericId(value: unknown): number | null {
  const numericId = Number(value);

  return Number.isFinite(numericId) && numericId > 0 ? numericId : null;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
}

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  const errorBody = await response.clone().json().catch(() => null);
  if (errorBody && typeof errorBody === 'object' && 'error' in errorBody) {
    const message = String((errorBody as { error: unknown }).error);
    if (message) return message;
  }

  const text = await response.text().catch(() => EMPTY_CELL);
  return text || fallback;
}

function createSavedScheduleFromUpload(result: Record<string, unknown>, schedule: ScheduleData): SavedSchedule | null {
  const id = toNumericId(result.id);
  if (!id) return null;

  return {
    id,
    fileName: String(result.fileName || schedule.fileName),
    fileType: String(result.fileType || EMPTY_CELL),
    uploadedBy: String(result.uploadedBy || EMPTY_CELL),
    createdAt: result.createdAt ? String(result.createdAt) : null,
  };
}

export default function Schedule() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [savedSchedulesLoading, setSavedSchedulesLoading] = useState(true);
  const [scheduleOpening, setScheduleOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedSchedulePickerRef = useRef<HTMLDivElement>(null);
  const scheduleSearchInputRef = useRef<HTMLInputElement>(null);
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('');
  const [savedSchedulePickerOpen, setSavedSchedulePickerOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState(EMPTY_SCHEDULE_SELECT_VALUE);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);

  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState<WeekType>('even');
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

  const resetScheduleControls = () => {
    setCurrentSheetIndex(0);
    setSelectedWeek('even');
    setSelectedGroupIndex(0);
  };

  const applyScheduleData = (schedule: ScheduleData, scheduleId: string = EMPTY_SCHEDULE_SELECT_VALUE) => {
    setScheduleData(schedule);
    setSelectedScheduleId(scheduleId);
    resetScheduleControls();
  };

  const openSavedSchedule = async (scheduleId: number | string) => {
    const numericId = toNumericId(scheduleId);
    if (!numericId) return;

    setScheduleOpening(true);
    setError(null);

    try {
      const response = await fetchWithCsrf(`${SCHEDULE_UPLOADS_URL}/${numericId}`);
      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, `Ошибка открытия расписания: ${response.status}`));
      }

      const result = await response.json() as Record<string, unknown>;
      const schedule = toScheduleData(result.schedule);
      applyScheduleData(schedule, String(result.id || numericId));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setScheduleOpening(false);
    }
  };

  const loadSavedSchedules = async () => {
    setSavedSchedulesLoading(true);
    setError(null);

    try {
      const response = await fetchWithCsrf(SCHEDULE_UPLOADS_URL);
      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, `Ошибка получения списка расписаний: ${response.status}`));
      }

      const result = await response.json() as { schedules?: SavedSchedule[] };
      const schedules = Array.isArray(result.schedules) ? result.schedules : [];
      setSavedSchedules(schedules);

      if (schedules.length > 0) {
        await openSavedSchedule(schedules[0].id);
      } else {
        setScheduleData(null);
        setSelectedScheduleId(EMPTY_SCHEDULE_SELECT_VALUE);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSavedSchedulesLoading(false);
    }
  };

  useEffect(() => {
    void loadSavedSchedules();
  }, []);

  useEffect(() => {
    if (!savedSchedulePickerOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (savedSchedulePickerRef.current?.contains(target)) return;
      setSavedSchedulePickerOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [savedSchedulePickerOpen]);

  useEffect(() => {
    if (!savedSchedulePickerOpen) return;
    scheduleSearchInputRef.current?.focus();
  }, [savedSchedulePickerOpen]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {

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

        throw new Error(await getResponseErrorMessage(response, `Ошибка загрузки: ${response.status}`));
      }

      const result = await response.json() as Record<string, unknown>;
      const schedule = toScheduleData(result.schedule);
      const uploadedSchedule = createSavedScheduleFromUpload(result, schedule);

      applyScheduleData(schedule, uploadedSchedule ? String(uploadedSchedule.id) : EMPTY_SCHEDULE_SELECT_VALUE);

      if (uploadedSchedule) {
        setSavedSchedules(previousSchedules => [
          uploadedSchedule,
          ...previousSchedules.filter(savedSchedule => savedSchedule.id !== uploadedSchedule.id),
        ]);
      } else {
        void loadSavedSchedules();
      }
    } catch (err) {
      setError(toErrorMessage(err));
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
  const isScheduleBusy = loading || savedSchedulesLoading || scheduleOpening;
  const normalizedScheduleSearchQuery = normalizeSearchValue(scheduleSearchQuery);
  const filteredSavedSchedules = savedSchedules.filter(schedule =>
    matchesSavedScheduleSearch(schedule, normalizedScheduleSearchQuery)
  );
  const selectedSavedSchedule = savedSchedules.find(schedule => String(schedule.id) === selectedScheduleId);
  const selectedScheduleLabel = selectedSavedSchedule
    ? formatSavedScheduleOption(selectedSavedSchedule)
    : SCHEDULE_PICKER_DEFAULT_TEXT;

  const toggleSavedSchedulePicker = () => {
    if (isScheduleBusy) return;
    if (!savedSchedulePickerOpen) {
      setScheduleSearchQuery(EMPTY_CELL);
    }
    setSavedSchedulePickerOpen(!savedSchedulePickerOpen);
  };

  const handleSavedScheduleSelect = (scheduleId: number) => {
    setSelectedScheduleId(String(scheduleId));
    setSavedSchedulePickerOpen(false);
    void openSavedSchedule(scheduleId);
  };

  return (


    <div className="schedule-page">
      <section className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">Учебная неделя</span>
          <h2>Расписание занятий</h2>
          <p>Выберите уже загруженное расписание или добавьте новый Excel-файл.</p>
        </div>

        <div className="schedule-hero-actions">
          {savedSchedules.length > 0 && (
            <div className="schedule-saved-picker" ref={savedSchedulePickerRef}>
              <span>Загруженное расписание</span>
              <button
                type="button"
                className={`schedule-picker-button ${savedSchedulePickerOpen ? 'schedule-picker-button--open' : ''}`}
                disabled={isScheduleBusy}
                aria-haspopup="listbox"
                aria-expanded={savedSchedulePickerOpen}
                onClick={toggleSavedSchedulePicker}
              >
                <span>{selectedScheduleLabel}</span>
                <span className="schedule-picker-button__chevron" aria-hidden="true" />
              </button>

              {savedSchedulePickerOpen && (
                <div className="schedule-picker-dropdown">
                  <input
                    ref={scheduleSearchInputRef}
                    className="schedule-search-input"
                    type="search"
                    value={scheduleSearchQuery}
                    placeholder={SCHEDULE_SEARCH_PLACEHOLDER}
                    onChange={(event) => setScheduleSearchQuery(event.target.value)}
                  />

                  <div className="schedule-picker-options" role="listbox" aria-label="Выбор загруженного расписания">
                    {filteredSavedSchedules.length > 0 ? (
                      filteredSavedSchedules.map(schedule => {
                        const isSelected = String(schedule.id) === selectedScheduleId;
                        return (
                          <button
                            key={schedule.id}
                            type="button"
                            className={`schedule-picker-option ${isSelected ? 'schedule-picker-option--selected' : ''}`}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSavedScheduleSelect(schedule.id)}
                          >
                            <span>{formatSavedScheduleOption(schedule)}</span>
                            <small>{formatScheduleDate(schedule.createdAt)}</small>
                          </button>
                        );
                      })
                    ) : (
                      <div className="schedule-picker-empty">{SCHEDULE_PICKER_EMPTY_TEXT}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}



          <button className="schedule-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={isScheduleBusy}>
            {loading ? 'Обрабатываем...' : 'Загрузить Excel'}
          </button>
        </div>
      </section>

      <input
        type="file"
        ref={fileInputRef}
        className="schedule-file-input"
        onChange={handleFileChange}
        accept={SUPPORTED_EXCEL_EXTENSIONS}
      />

      {savedSchedulesLoading && <div className="schedule-alert schedule-alert--loading">Загрузка списка расписаний...</div>}
      {scheduleOpening && <div className="schedule-alert schedule-alert--loading">Открываем выбранное расписание...</div>}
      {loading && <div className="schedule-alert schedule-alert--loading">Загрузка и обработка файла...</div>}
      {error && <div className="schedule-alert schedule-alert--error">{error}</div>}

      {!scheduleData && !isScheduleBusy && (
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
