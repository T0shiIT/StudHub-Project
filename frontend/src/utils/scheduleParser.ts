export const EMPTY_CELL = '';
export const TABLE_HEADER_ROWS_COUNT = 4;
export const DAY_NAMES = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
export const WEEK_TYPES = ['even', 'odd'] as const;

export type WeekType = 'even' | 'odd';
export type ScheduleCellValue = string | number | boolean | null | undefined;

export interface Cell {
  columnIndex: number;
  columnName: string;
  value: ScheduleCellValue;
}

export interface Row {
  cells: Cell[];
  rowIndex: number;
}

export interface Sheet {
  sheetName: string;
  rows: Row[];
  rowsCount: number;
  columnsCount: number;
}

export interface ScheduleData {
  fileName: string;
  sheets: Sheet[];
  sheetsCount: number;
}

export interface GroupOption {
  label: string;
  columnIndex: number;
  typeColumnIndex: number;
}

export interface LessonCard {
  pair: string;
  type: string;
  title: string;
  teacher: string;
  room: string;
  details: string[];
}

export interface DaySchedule {
  key: string;
  title: string;
  lessons: LessonCard[];
}

// --- вспомогательные функции ---
export function normalizeCellValue(value: ScheduleCellValue): string {
  if (value === null || value === undefined) return EMPTY_CELL;
  return String(value).trim();
}

export function isFilledCell(value: ScheduleCellValue): boolean {
  return normalizeCellValue(value).length > 0;
}

export function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

export function getMaxColumns(sheet: Sheet): number {
  let max = 0;
  (sheet.rows || []).forEach(row => {
    (row.cells || []).forEach(cell => {
      if (cell.columnIndex > max) max = cell.columnIndex;
    });
  });
  return max + 1;
}

export function buildMatrix(sheet: Sheet): string[][] {
  const maxCols = getMaxColumns(sheet);
  const rows = sheet.rows || [];
  const matrix = rows.map(row => {
    const rowCells: string[] = new Array(maxCols).fill(EMPTY_CELL);
    (row.cells || []).forEach(cell => {
      rowCells[cell.columnIndex] = normalizeCellValue(cell.value);
    });
    return rowCells;
  });

  const visibleColumnIndexes = Array.from({ length: maxCols }, (_, i) => i)
    .filter(colIndex => matrix.some(row => isFilledCell(row[colIndex])));

  return matrix
    .map(row => visibleColumnIndexes.map(colIndex => row[colIndex]))
    .filter(row => row.some(isFilledCell));
}

export function resolveWeekType(value: string): WeekType | null {
  const odd = /неч[её]тн/i.test(value);
  const even = /(?<!не)ч[её]тн/i.test(value);
  if (odd) return 'odd';
  if (even) return 'even';
  return null;
}

export function formatWeekType(week: WeekType): string {
  return week === 'even' ? 'Чётная неделя' : 'Нечётная неделя';
}

export interface WeekSegment {
  type: WeekType;
  start: number;
  end: number;
}

export function getWeekSegments(matrix: string[][]): WeekSegment[] {
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

export function getAvailableWeeks(segments: WeekSegment[]): WeekType[] {
  return WEEK_TYPES.filter(week => segments.some(segment => segment.type === week));
}

export function getActiveWeek(selectedWeek: WeekType, availableWeeks: WeekType[]): WeekType {
  return availableWeeks.includes(selectedWeek) ? selectedWeek : availableWeeks[0] ?? 'even';
}

export function getSegmentByWeek(segments: WeekSegment[], week: WeekType): WeekSegment | null {
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
    if (headerIncludes(matrix, colIdx, 'вид занятий')) return colIdx;
  }
  return findColumnByHeader(matrix, segment, 'вид занятий', 2);
}

export function getGroupOptions(matrix: string[][], segment: WeekSegment): GroupOption[] {
  const groupHeaderRow = matrix[3] ?? [];
  const fallbackHeaderRow = matrix[2] ?? [];
  const options: GroupOption[] = [];

  for (let colIdx = segment.start; colIdx < segment.end; colIdx += 1) {
    const label = normalizeCellValue(groupHeaderRow[colIdx] || fallbackHeaderRow[colIdx]);
    const lowerLabel = label.toLowerCase();

    if (!label) continue;
    if (resolveWeekType(label)) continue;
    if (lowerLabel.includes('дни недели')) continue;
    if (lowerLabel === 'пара') continue;
    if (lowerLabel.includes('вид занятий')) continue;

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
  if (!/понедельник|вторник|среда|четверг|пятница|суббота|воскресенье/i.test(lowerValue)) return null;
  return DAY_NAMES.find(day => lowerValue.includes(day)) ?? null;
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

function createEmptyDaySchedules(): DaySchedule[] {
  return DAY_NAMES.map(day => ({
    key: day,
    title: capitalize(day),
    lessons: [],
  }));
}

export function buildDaySchedules(matrix: string[][], segment: WeekSegment, group: GroupOption): DaySchedule[] {
  const dayColumnIndex = findColumnByHeader(matrix, segment, 'дни недели', 0);
  const pairColumnIndex = findColumnByHeader(matrix, segment, 'пара', 1);
  const daySchedules = createEmptyDaySchedules();
  const dayMap = new Map(daySchedules.map(day => [day.key, day]));
  const lessonMap = new Map<string, LessonCard>();

  for (let rowIdx = TABLE_HEADER_ROWS_COUNT; rowIdx < matrix.length; rowIdx += 1) {
    const row = matrix[rowIdx] ?? [];
    const dayKey = getDayKey(normalizeCellValue(row[dayColumnIndex]));
    const pair = normalizeCellValue(row[pairColumnIndex]);
    const lessonValue = normalizeCellValue(row[group.columnIndex]);

    if (!dayKey || !/^\d+/.test(pair) || !lessonValue) continue;

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

// --- утилиты для работы с API ---
export function isScheduleData(value: unknown): value is ScheduleData {
  if (!value || typeof value !== 'object') return false;
  const s = value as ScheduleData;
  return typeof s.fileName === 'string' && Array.isArray(s.sheets);
}

export function toScheduleData(value: unknown): ScheduleData {
  if (!isScheduleData(value)) {
    throw new Error('Ответ сервера не содержит корректное расписание');
  }
  return value;
}

// --- нормализация названия группы для сравнения ---
export function normalizeGroupName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';

  // Извлекаем специальность (буквы в начале)
  const specMatch = trimmed.match(/^([а-яёa-z]+)/i);
  const spec = specMatch ? specMatch[1].toLowerCase() : '';

  // Извлекаем номер группы (цифры перед скобкой или последние цифры)
  let groupNum = '';
  const numMatch = trimmed.match(/(\d+)\s*\(/);
  if (numMatch) {
    groupNum = numMatch[1];
  } else {
    const lastNum = trimmed.match(/(\d+)$/);
    if (lastNum) groupNum = lastNum[1];
  }

  // Извлекаем подгруппу (цифры в скобках)
  const subMatch = trimmed.match(/\((\d+)\)/);
  const sub = subMatch ? subMatch[1] : '';

  // Собираем ключ: специальность-номер-подгруппа (если подгруппа есть)
  return `${spec}-${groupNum}${sub ? '-' + sub : ''}`;
}