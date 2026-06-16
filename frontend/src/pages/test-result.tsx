import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchWithCsrf } from '../utils/csrf';

export default function TestResult() {
  const { courseId, materialId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Если результат передан через state (сразу после отправки)
    if (location.state?.score !== undefined) {
      setScore(location.state.score);
      setLoading(false);
      return;
    }

    // Иначе загружаем с сервера
    const fetchResult = async () => {
      try {
        const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/test-result`);
        if (res.ok) {
          const data = await res.json();
          if (data.completed) {
            setScore(data.scorePercent);
          } else {
            setError('Тест ещё не пройден');
          }
        } else {
          setError('Не удалось загрузить результат');
        }
      } catch (err) {
        setError('Ошибка сети');
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [materialId, location]);

  if (loading) return <div className="test-result-page" style={{textAlign:'center', padding:40}}>Загрузка...</div>;
  if (error) return <div className="test-result-page" style={{textAlign:'center', padding:40, color:'red'}}>{error}</div>;

  const isPassed = score !== null && score >= 60;
  const grade = score !== null
    ? score >= 90 ? 'Отлично' : score >= 70 ? 'Хорошо' : score >= 50 ? 'Удовлетворительно' : 'Неудовлетворительно'
    : '';

  return (
    <div className="test-result-page">
      <button className="btn-back" onClick={() => navigate(`/courses/${courseId}`)} style={{marginBottom:20}}>
        ← Назад к курсу
      </button>

      <div className="result-card">
        <div className="result-header">
          <h1>Результат теста</h1>
          <span className="result-badge">
            {isPassed ? '✅ Тест пройден' : '❌ Тест не пройден'}
          </span>
        </div>

        {score !== null && (
          <>
            <div className="result-score">
              <div className="circle">{score}%</div>
              <div className="grade">{grade}</div>
              <div className="sub">Ваш результат: {score}%</div>
            </div>

            <div className="result-stats">
              <div className="result-stat">
                <div className="value">{score}%</div>
                <div className="label">Баллы</div>
              </div>
              <div className="result-stat">
                <div className="value">{isPassed ? '✅' : '❌'}</div>
                <div className="label">Статус</div>
              </div>
              <div className="result-stat">
                <div className="value">1</div>
                <div className="label">Попытка</div>
              </div>
              <div className="result-stat">
                <div className="value">{new Date().toLocaleDateString('ru-RU')}</div>
                <div className="label">Дата</div>
              </div>
            </div>
          </>
        )}

        <div className="result-footer">
          <span className="date">📅 {new Date().toLocaleString('ru-RU')}</span>
          <div style={{display:'flex', gap:10}}>
            <button className="btn btn-secondary" onClick={() => navigate(`/courses/${courseId}`)}>
              К курсу
            </button>
            <button className="btn btn-primary" onClick={() => navigate(`/courses/${courseId}/materials/${materialId}/test`)}>
              Пройти заново
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}