import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchWithCsrf } from '../utils/csrf';
import {
  buildMatrix,
  getWeekSegments,
  getAvailableWeeks,
  getActiveWeek,
  getSegmentByWeek,
  getGroupOptions,
  buildDaySchedules,
  formatWeekType,
  EMPTY_CELL,
  toScheduleData,
  isScheduleData,
  normalizeGroupName,
  type ScheduleData,
  type WeekType,
  type GroupOption,
  type DaySchedule,
  type LessonCard,
} from '../utils/scheduleParser';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = '';
const SCHEDULE_UPLOAD_URL = `${API_BASE_URL}/api/schedule/upload`;
const SCHEDULE_UPLOADS_URL = `${API_BASE_URL}/api/schedule/uploads`;
const SUPPORTED_EXCEL_EXTENSIONS = '.xlsx,.xls,.xlsm,.xlsb';
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

interface SavedSchedule {
  id: number;
  fileName: string;
  fileType: string;
  uploadedBy: string;
  createdAt: string | null;
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
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [savedSchedulesLoading, setSavedSchedulesLoading] = useState(true);
  const [scheduleOpening, setScheduleOpening] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(null);
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

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
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

      const stillExists = schedules.some(s => String(s.id) === selectedScheduleId);
      if (selectedScheduleId !== EMPTY_SCHEDULE_SELECT_VALUE && !stillExists) {
        setScheduleData(null);
        setSelectedScheduleId(EMPTY_SCHEDULE_SELECT_VALUE);
      } else if (schedules.length > 0 && selectedScheduleId === EMPTY_SCHEDULE_SELECT_VALUE) {
        await openSavedSchedule(schedules[0].id);
      } else if (schedules.length === 0) {
        setScheduleData(null);
        setSelectedScheduleId(EMPTY_SCHEDULE_SELECT_VALUE);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSavedSchedulesLoading(false);
    }
  };

  const deleteSchedule = async (id: number, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить это расписание?')) return;

    setDeletingScheduleId(id);
    setError(null);
    try {
      const response = await fetchWithCsrf(`${SCHEDULE_UPLOADS_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, `Ошибка удаления: ${response.status}`));
      }
      await loadSavedSchedules();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setDeletingScheduleId(null);
    }
  };

  // ===== ХУКИ (useEffect) — ВСЕ ДО ПРОВЕРКИ =====
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

  useEffect(() => {
    if (!scheduleData || !user?.group) return;

    const sheet = scheduleData.sheets[currentSheetIndex];
    if (!sheet) return;
    const matrix = buildMatrix(sheet);
    const weekSegments = getWeekSegments(matrix);
    const availableWeeks = getAvailableWeeks(weekSegments);
    const activeWeek = getActiveWeek(selectedWeek, availableWeeks);
    const activeSegment = getSegmentByWeek(weekSegments, activeWeek);
    if (!activeSegment) return;
    const options = getGroupOptions(matrix, activeSegment);
    if (options.length === 0) return;

    const userGroupNormalized = normalizeGroupName(user.group);
    const foundIndex = options.findIndex(opt => 
      normalizeGroupName(opt.label) === userGroupNormalized
    );
    if (foundIndex !== -1 && foundIndex !== selectedGroupIndex) {
      setSelectedGroupIndex(foundIndex);
    }
  }, [scheduleData, currentSheetIndex, selectedWeek, user?.group]);

  // ===== ЗАЩИТА МАРШРУТА (ПОСЛЕ ВСЕХ ХУКОВ) =====
  if (authLoading) {
    return <div className="dashboard-loading">Загрузка...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ===== ОБРАБОТЧИК ЗАГРУЗКИ ФАЙЛА =====
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
        setSavedSchedules(prev => [
          uploadedSchedule,
          ...prev.filter(s => s.id !== uploadedSchedule.id),
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

  // ===== ВЫЧИСЛЯЕМЫЕ ДАННЫЕ =====
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
    : [];
  const isScheduleBusy = loading || savedSchedulesLoading || scheduleOpening;
  const normalizedScheduleSearchQuery = normalizeSearchValue(scheduleSearchQuery);
  const filteredSavedSchedules = savedSchedules.filter(s =>
    matchesSavedScheduleSearch(s, normalizedScheduleSearchQuery)
  );
  const selectedSavedSchedule = savedSchedules.find(s => String(s.id) === selectedScheduleId);
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

  // ===== РЕНДЕР =====
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
                    onChange={(e) => setScheduleSearchQuery(e.target.value)}
                  />
                  <div className="schedule-picker-options" role="listbox" aria-label="Выбор загруженного расписания">
                    {filteredSavedSchedules.length > 0 ? (
                      filteredSavedSchedules.map(schedule => {
                        const isSelected = String(schedule.id) === selectedScheduleId;
                        return (
                          <div key={schedule.id} className="schedule-picker-option-wrapper">
                            <button
                              type="button"
                              className={`schedule-picker-option ${isSelected ? 'schedule-picker-option--selected' : ''}`}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSavedScheduleSelect(schedule.id)}
                            >
                              <div className="schedule-picker-option__info">
                                <span>{formatSavedScheduleOption(schedule)}</span>
                                <small>{formatScheduleDate(schedule.createdAt)}</small>
                              </div>
                            </button>
                            <button
                              type="button"
                              className="schedule-picker-option__delete"
                              onClick={(e) => deleteSchedule(schedule.id, e)}
                              disabled={deletingScheduleId === schedule.id}
                              title="Удалить расписание"
                            >
                              {deletingScheduleId === schedule.id ? '...' : '🗑'}
                            </button>
                          </div>
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
                    <option key={sheet.sheetName} value={idx}>{sheet.sheetName}</option>
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
                      <option key={`${group.label}-${group.columnIndex}`} value={idx}>{group.label}</option>
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
                        <div key={`${day.key}-${lesson.pair}-${lesson.title}`} className="schedule-lesson-item">
                          <span className="schedule-lesson-time">{lesson.pair}</span>
                          <div className="schedule-lesson-details">
                            <span className="schedule-lesson-title">{lesson.title}</span>
                            {lesson.type && <span className="schedule-lesson-type">{lesson.type}</span>}
                            {lesson.teacher && <span className="schedule-lesson-teacher">{lesson.teacher}</span>}
                            {lesson.room && <span className="schedule-lesson-room">{lesson.room}</span>}
                          </div>
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