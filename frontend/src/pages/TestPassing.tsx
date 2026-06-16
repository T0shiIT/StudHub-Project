import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithCsrf } from '../utils/csrf';

interface Question {
  id: number;
  text: string;
  options: { id: number; text: string }[];
}

export default function TestPassing() {
  const { courseId, materialId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(1800); // 30 минут

  useEffect(() => {
    loadQuestions();
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          handleFinishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [materialId]);

  const loadQuestions = async () => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      } else {
        setError('Не удалось загрузить вопросы');
      }
    } catch (err) {
      setError('Ошибка сети');
    }
  };

  const handleAnswer = (questionId: number, optionId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleFinishTest = async () => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      setShowConfirm(true);
      return;
    }
    await submitTest();
  };

  const submitTest = async () => {
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/submit-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/courses/${courseId}/materials/${materialId}/result`, { state: { score: data.scorePercent } });
      } else {
        const err = await res.text();
        alert('Ошибка: ' + err);
      }
    } catch (err) {
      alert('Ошибка сети');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (error) return <div className="test-passing-page" style={{textAlign:'center', padding:40, color:'red'}}>{error}</div>;
  if (questions.length === 0) return <div className="test-passing-page" style={{textAlign:'center', padding:40}}>Загрузка вопросов...</div>;

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isAnswered = answers[currentQuestion?.id] !== undefined;

  return (
    <div className="test-passing-page">
      <div className="header">
        <button className="btn-back" onClick={() => navigate(`/courses/${courseId}`)}>
          ← Назад к курсу
        </button>
        <div className="progress-info">
          <span style={{fontSize:14, color:'#64748b'}}>
            {currentIndex + 1} / {questions.length}
          </span>
          <span className={`timer ${timeRemaining < 300 ? 'warning' : ''}`}>
            ⏱ {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      <div className="test-grid">
        <div className="questions-area">
          <div className="question-block">
            <div className="q-header">
              <span className="q-number">Вопрос {currentIndex + 1}</span>
              {isAnswered && <span className="q-status">✅ Отвечено</span>}
            </div>
            <div className="q-text">{currentQuestion.text}</div>
            <div className="options-grid">
              {currentQuestion.options.map((opt, idx) => {
                const selected = answers[currentQuestion.id] === opt.id;
                return (
                  <label key={opt.id} className={`option-item ${selected ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={`q${currentQuestion.id}`}
                      value={opt.id}
                      checked={selected}
                      onChange={() => handleAnswer(currentQuestion.id, opt.id)}
                    />
                    <span className="letter">{String.fromCharCode(65 + idx)}.</span>
                    <span className="text">{opt.text}</span>
                  </label>
                );
              })}
            </div>

            <div className="question-nav-buttons">
              <button className="btn btn-prev" onClick={handlePrev} disabled={currentIndex === 0}>
                ← Назад
              </button>
              <div style={{display:'flex', gap:10}}>
                {currentIndex < questions.length - 1 ? (
                  <button className="btn btn-next" onClick={handleNext}>
                    Следующий →
                  </button>
                ) : (
                  <button
                    className="btn btn-finish"
                    onClick={handleFinishTest}
                    disabled={submitting}
                  >
                    {submitting ? 'Отправка...' : '🏁 Завершить'}
                  </button>
                )}
              </div>
            </div>

            {currentIndex === questions.length - 1 && answeredCount < questions.length && (
              <div className="warning-box">
                <span style={{fontSize:20}}>⚠️</span>
                <span>
                  Вы ответили только на {answeredCount} из {questions.length} вопросов.
                  {answeredCount < questions.length - 3 && ' Рекомендуем ответить на все.'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar">
          <div className="question-nav">
            <div className="title">
              <span>Прогресс</span>
              <span style={{fontWeight:'normal', color:'#64748b'}}>{answeredCount}/{questions.length}</span>
            </div>
            <div className="dots">
              {questions.map((q, idx) => {
                const isActive = idx === currentIndex;
                const isAnswered = answers[q.id] !== undefined;
                let cls = 'dot';
                if (isActive) cls += ' active';
                if (isAnswered) cls += ' answered';
                return (
                  <button key={q.id} className={cls} onClick={() => setCurrentIndex(idx)}>
                    {isAnswered ? '✓' : idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="legend">
              <span>⬤ Отвечено</span>
              <span>◯ Не отвечено</span>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-icon">⚠️</div>
            <h3>Вы уверены?</h3>
            <p>
              Вы ответили только на {answeredCount} из {questions.length} вопросов.
              Неотвеченные будут засчитаны как неправильные.
            </p>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setShowConfirm(false)}>Продолжить</button>
              <button className="btn btn-confirm" onClick={submitTest}>Отправить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}