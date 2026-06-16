import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';
import {
  buildMatrix,
  getWeekSegments,
  getAvailableWeeks,
  getActiveWeek,
  getSegmentByWeek,
  getGroupOptions,
  buildDaySchedules,
  toScheduleData,
  normalizeGroupName,
  type ScheduleData,
  type WeekType,
  type DaySchedule,
} from '../utils/scheduleParser';

interface Course {
  id: number;
  title: string;
  description: string;
  progress?: { percent: number } | null;
}

interface Announcement {
  id: string;
  content: string;
  createdAt: string;
}

export default function Welcome() {
  const { user } = useAuth();
  const [todayLessons, setTodayLessons] = useState<DaySchedule['lessons']>([]);
  const [nextLessonTime, setNextLessonTime] = useState<string>('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notificationsCount, setNotificationsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string>('');

  const getCurrentDayKey = (): string | null => {
    const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const now = new Date();
    return days[now.getDay()];
  };

  const guessCurrentWeekType = (): WeekType => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 8, 1);
    const diffDays = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7) + 1;
    return weekNumber % 2 === 0 ? 'even' : 'odd';
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // 1. Расписание
        const schedulesRes = await fetchWithCsrf('/api/schedule/uploads');
        const schedulesData = await schedulesRes.json();
        const schedules = schedulesData.schedules || [];
        let todayLessonsData: DaySchedule['lessons'] = [];
        let nextTime = '';
        let hasScheduleData = false;
        let msg = '';

        if (schedules.length > 0) {
          const lastSchedule = schedules[schedules.length - 1];
          const detailRes = await fetchWithCsrf(`/api/schedule/uploads/${lastSchedule.id}`);
          const detailData = await detailRes.json();
          const schedule = toScheduleData(detailData.schedule);
          const sheet = schedule.sheets[0];
          const matrix = buildMatrix(sheet);
          const weekSegments = getWeekSegments(matrix);
          const availableWeeks = getAvailableWeeks(weekSegments);
          const currentWeek = guessCurrentWeekType();
          const activeWeek = getActiveWeek(currentWeek, availableWeeks);
          const activeSegment = getSegmentByWeek(weekSegments, activeWeek);
          const groupOptions = activeSegment ? getGroupOptions(matrix, activeSegment) : [];

          let selectedGroup = null;
          let groupNotFound = false;

          if (user?.group && groupOptions.length > 0) {
            const userGroupNormalized = normalizeGroupName(user.group);
            const found = groupOptions.find(opt => 
              normalizeGroupName(opt.label) === userGroupNormalized
            );
            if (found) {
              selectedGroup = found;
            } else {
              groupNotFound = true;
            }
          }

          if (groupNotFound) {
            msg = 'Расписание для вашей группы не найдено. Загрузите подходящий файл на странице расписания.';
            hasScheduleData = false;
          } else if (!selectedGroup) {
            msg = 'У вас не указана группа. Укажите её в профиле.';
            hasScheduleData = false;
          } else if (selectedGroup && activeSegment) {
            const daySchedules = buildDaySchedules(matrix, activeSegment, selectedGroup);
            const todayKey = getCurrentDayKey();
            if (todayKey) {
              const todaySchedule = daySchedules.find(day => day.key === todayKey);
              if (todaySchedule) {
                todayLessonsData = todaySchedule.lessons;
                hasScheduleData = true;
                // Следующая пара
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                let nextStart = Infinity;
                for (const lesson of todayLessonsData) {
                  const match = lesson.pair.match(/(\d{2}):(\d{2})/);
                  if (match) {
                    const hours = parseInt(match[1], 10);
                    const minutes = parseInt(match[2], 10);
                    const lessonStart = hours * 60 + minutes;
                    if (lessonStart > currentTime && lessonStart < nextStart) {
                      nextStart = lessonStart;
                    }
                  }
                }
                if (nextStart !== Infinity) {
                  const h = Math.floor(nextStart / 60);
                  const m = nextStart % 60;
                  nextTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }
              } else {
                hasScheduleData = true;
                msg = 'На сегодня пар нет';
              }
            }
          }
        } else {
          msg = 'Расписание не загружено. Загрузите файл на странице расписания.';
        }

        setTodayLessons(todayLessonsData);
        setNextLessonTime(nextTime);
        setHasSchedule(hasScheduleData);
        setScheduleMessage(msg);

        // 2. Курсы
        const coursesRes = await fetchWithCsrf('/api/courses');
        if (coursesRes.ok) {
          let coursesData = await coursesRes.json();
          if (user?.role === 'STUDENT') {
            coursesData = coursesData.filter((c: any) => c.enrolled);
          } else if (user?.role === 'TEACHER') {
            coursesData = coursesData.filter((c: any) => c.teacherId === user.id);
          }
          const withProgress = await Promise.all(
            coursesData.map(async (course: any) => {
              try {
                const progRes = await fetchWithCsrf(`/api/courses/${course.id}/progress`);
                if (progRes.ok) {
                  const prog = await progRes.json();
                  return { ...course, progress: prog };
                }
              } catch (e) { /* ignore */ }
              return { ...course, progress: null };
            })
          );
          setCourses(withProgress);
        }

        // 3. Объявления
        const annRes = await fetchWithCsrf('/api/announcements');
        if (annRes.ok) {
          const annData = await annRes.json();
          setAnnouncements(annData.slice(0, 3));
        }

        // 4. Уведомления – пока не реализовано, ставим null (нет данных)
        // Если будет API – замените на реальный запрос
        setNotificationsCount(null);

      } catch (error) {
        console.error('Ошибка загрузки данных для дашборда:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  // Данные для статистики
  const totalPairs = todayLessons.length;
  const averageGrade = null; // нет API
  const activeCourses = courses.length;
  const notifCount = notificationsCount; // null или число

  if (loading) {
    return <div className="dashboard-loading">Загрузка дашборда...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <h1>Добро пожаловать, {user?.firstName || user?.login || 'Студент'}!</h1>
        <p>Сегодня отличный день для новых достижений.</p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-info">
            <span className="stat-value">{totalPairs}</span>
            <span className="stat-label">пары</span>
            {nextLessonTime && <span className="stat-sub">Следующая в {nextLessonTime}</span>}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-info">
            <span className="stat-value">{averageGrade !== null ? averageGrade : '—'}</span>
            <span className="stat-label">Средний балл</span>
            <span className="stat-sub">{averageGrade !== null ? 'Отличный результат' : 'Нет данных'}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📖</div>
          <div className="stat-info">
            <span className="stat-value">{activeCourses}</span>
            <span className="stat-label">Активных курсов</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔔</div>
          <div className="stat-info">
            <span className="stat-value">{notifCount !== null ? notifCount : '—'}</span>
            <span className="stat-label">Новых уведомлений</span>
            <span className="stat-sub">
              {notifCount === 0 ? 'Нет новых' : notifCount !== null ? 'Есть новые' : 'Нет данных'}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-column">
          <section className="dashboard-section schedule-today">
            <div className="section-header">
              <h2>Расписание на сегодня</h2>
              <Link to="/schedule" className="section-link">Полное расписание</Link>
            </div>
            {!hasSchedule ? (
              <p className="empty-message">{scheduleMessage || 'Расписание не загружено'}</p>
            ) : todayLessons.length === 0 ? (
              <p className="empty-message">На сегодня пар нет</p>
            ) : (
              <ul className="lesson-list">
                {todayLessons.map((lesson, idx) => (
                  <li key={idx} className="lesson-item">
                    <span className="lesson-time">{lesson.pair}</span>
                    <div className="lesson-details">
                      <span className="lesson-title">{lesson.title}</span>
                      <span className="lesson-teacher">{lesson.teacher}</span>
                      <span className="lesson-room">{lesson.room}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-section announcements-latest">
            <div className="section-header">
              <h2>Последние объявления</h2>
              <Link to="/announcements" className="section-link">Смотреть все</Link>
            </div>
            {announcements.length === 0 ? (
              <p className="empty-message">Нет объявлений</p>
            ) : (
              <ul className="announcement-list">
                {announcements.map((ann) => (
                  <li key={ann.id} className="announcement-item">
                    <h4>{ann.content.slice(0, 60)}...</h4>
                    <span className="announcement-date">
                      {new Date(ann.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="dashboard-column">
          <section className="dashboard-section my-courses">
            <div className="section-header">
              <h2>Мои курсы</h2>
              <Link to="/courses" className="section-link">Все курсы</Link>
            </div>
            {courses.length === 0 ? (
              <p className="empty-message">Вы не записаны ни на один курс</p>
            ) : (
              <ul className="course-list">
                {courses.slice(0, 5).map((course) => (
                  <li key={course.id} className="course-item">
                    <div className="course-info">
                      <span className="course-title">{course.title}</span>
                      <span className="course-desc">{course.description || 'Без описания'}</span>
                    </div>
                    <div className="course-progress-wrapper">
                      <span className="progress-label">{course.progress?.percent ?? 0}%</span>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${course.progress?.percent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="dashboard-footer">
        <p>Учись эффективно вместе с StudHub</p>
        <span>Планируй, отслеживай и достигай большего!</span>
      </div>
    </div>
  );
}