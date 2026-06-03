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
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuestions();
    checkAlreadyPassed();
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

  const checkAlreadyPassed = async () => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/test-result`);
      if (res.ok) {
        const data = await res.json();
        if (data.completed) {
          setResult(data.scorePercent);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnswer = (questionId: number, optionId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const submitTest = async () => {
    if (Object.keys(answers).length !== questions.length) {
      alert('Ответьте на все вопросы');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/submit-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.scorePercent);
      } else {
        const err = await res.text();
        alert('Ошибка: ' + err);
      }
    } catch (err) {
      alert('Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  if (result !== null) {
    return (
      <div className="test-result-page">
        <div className="test-result-card">
          <h2>Результат теста</h2>
          <div className="score">{result}%</div>
          <button className="btn-primary" onClick={() => navigate(`/courses/${courseId}`)}>
            Вернуться к курсу
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (questions.length === 0) {
    return <div className="loading">Загрузка вопросов...</div>;
  }

  return (
    <div className="test-passing-page">
      <h1>Прохождение теста</h1>
      {questions.map((q, idx) => (
        <div key={q.id} className="test-question-block">
          <p className="question-text">{idx + 1}. {q.text}</p>
          <div className="options">
            {q.options.map(opt => (
              <label key={opt.id} className="option">
                <input
                  type="radio"
                  name={`q${q.id}`}
                  value={opt.id}
                  onChange={() => handleAnswer(q.id, opt.id)}
                />
                {opt.text}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button className="btn-primary" onClick={submitTest} disabled={submitting}>
        {submitting ? 'Отправка...' : 'Завершить тест'}
      </button>
    </div>
  );
}