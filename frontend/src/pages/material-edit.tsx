import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';

interface Material {
  id: number;
  title: string;
  description: string;
  materialType: string;
  dueDate?: string;
  filePath?: string;
  externalUrl?: string;
}

interface Question {
  text: string;
  options: string[];
  correctOptionIndex: number;
}

export default function MaterialEditPage() {
  const { courseId, materialId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    text: '',
    options: ['', ''],
    correctOptionIndex: 0
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    loadMaterial();
  }, [materialId]);

  const loadMaterial = async () => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}`);
      if (res.ok) {
        const data = await res.json();
        setMaterial(data);
        setTitle(data.title);
        setDescription(data.description || '');
        setDueDate(data.dueDate ? data.dueDate.slice(0, 16) : '');
        setExternalUrl(data.externalUrl || '');
        if (data.materialType === 'TEST') {
          await loadQuestions();
        }
      } else {
        alert('Материал не найден');
        navigate(`/courses/${courseId}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/questions`);
      if (res.ok) {
        const data = await res.json();
        const qs: Question[] = data.map((q: any) => ({
          text: q.text,
          options: q.options.map((opt: any) => opt.text),
          correctOptionIndex: q.options.findIndex((opt: any) => opt.id === q.correctOptionId)
        }));
        setQuestions(qs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Введите название');
      return;
    }
    setSaving(true);
    try {
      // 1. Обновляем метаданные
      const metaRes = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          externalUrl
        })
      });
      if (!metaRes.ok) throw new Error('Ошибка обновления метаданных');

      // 2. Если тип TEST – обновляем вопросы
      if (material?.materialType === 'TEST') {
        const questionsRes = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/questions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(questions)
        });
        if (!questionsRes.ok) throw new Error('Ошибка обновления вопросов');
      }

      // 3. Если выбран новый файл (для FILE или ASSIGNMENT)
      if (selectedFile && (material?.materialType === 'FILE' || material?.materialType === 'ASSIGNMENT')) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const fileRes = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/replace-file`, {
          method: 'POST',
          body: formData,
        });
        if (!fileRes.ok) {
          const errorText = await fileRes.text();
          console.error('Replace file error:', errorText);
          alert(`Ошибка замены файла: ${errorText}`);
          throw new Error('Ошибка замены файла');
        }
        const result = await fileRes.json();
        console.log('File replaced, new path:', result.filePath);
        // Обновляем локальный материал (чтобы в следующем шаге был актуальный путь)
        setMaterial(prev => prev ? { ...prev, filePath: result.filePath } : prev);
      }

      alert('Материал обновлён');
      // Переход с последующей перезагрузкой страницы материала
      navigate(`/courses/${courseId}/materials/${materialId}`);
      // Небольшая задержка, чтобы сервер успел обработать запрос
      setTimeout(() => window.location.reload(), 100);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Функции для управления вопросами (без изменений)
  const startEdit = (index: number) => {
    setEditingIndex(index);
    setCurrentQuestion({ ...questions[index] });
  };

  const saveEditedQuestion = () => {
    if (!currentQuestion.text.trim()) {
      alert('Введите текст вопроса');
      return;
    }
    if (currentQuestion.options.some(opt => !opt.trim())) {
      alert('Заполните все варианты ответов');
      return;
    }
    const updated = [...questions];
    updated[editingIndex!] = { ...currentQuestion };
    setQuestions(updated);
    setEditingIndex(null);
    setCurrentQuestion({ text: '', options: ['', ''], correctOptionIndex: 0 });
  };

  const addQuestion = () => {
    if (!currentQuestion.text.trim()) {
      alert('Введите текст вопроса');
      return;
    }
    if (currentQuestion.options.some(opt => !opt.trim())) {
      alert('Заполните все варианты ответов');
      return;
    }
    setQuestions([...questions, { ...currentQuestion }]);
    setCurrentQuestion({ text: '', options: ['', ''], correctOptionIndex: 0 });
  };

  const removeQuestion = (idx: number) => {
    const newQs = [...questions];
    newQs.splice(idx, 1);
    setQuestions(newQs);
  };

  const updateOption = (idx: number, value: string) => {
    const newOpts = [...currentQuestion.options];
    newOpts[idx] = value;
    setCurrentQuestion({ ...currentQuestion, options: newOpts });
  };

  const addOption = () => {
    setCurrentQuestion({
      ...currentQuestion,
      options: [...currentQuestion.options, '']
    });
  };

  const removeOption = (idx: number) => {
    const newOpts = [...currentQuestion.options];
    newOpts.splice(idx, 1);
    setCurrentQuestion({ ...currentQuestion, options: newOpts });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setCurrentQuestion({ text: '', options: ['', ''], correctOptionIndex: 0 });
  };

  if (loading) return <div>Загрузка...</div>;
  if (!material) return <div>Материал не найден</div>;

  return (
    <div className="material-edit-page">
      <button className="btn-back" onClick={() => navigate(`/courses/${courseId}/materials/${materialId}`)}>
        ← Назад к материалу
      </button>
      <h1>Редактирование материала</h1>

      <div className="edit-form">
        <div className="form-group">
          <label>Название *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Описание</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        {material.materialType === 'LINK' && (
          <div className="form-group">
            <label>URL ссылки</label>
            <input type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
          </div>
        )}

        {material.materialType === 'ASSIGNMENT' && (
          <div className="form-group">
            <label>Срок сдачи</label>
            <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        )}

        {(material.materialType === 'FILE' || material.materialType === 'ASSIGNMENT') && (
          <div className="form-group">
            <label>Заменить файл (необязательно)</label>
            <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            {material.filePath && <p>Текущий файл: {material.filePath.split('/').pop()}</p>}
          </div>
        )}

        {material.materialType === 'TEST' && (
          <div className="test-builder">
            <h3>Вопросы теста</h3>
            {questions.map((q, idx) => (
              <div key={idx} className="added-question">
                <span>{idx+1}. {q.text}</span>
                <div>
                  <button type="button" onClick={() => startEdit(idx)}>✏️</button>
                  <button type="button" onClick={() => removeQuestion(idx)}>🗑️</button>
                </div>
              </div>
            ))}
            <div className="new-question">
              <input
                type="text"
                placeholder={editingIndex !== null ? "Редактирование вопроса" : "Текст нового вопроса"}
                value={currentQuestion.text}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
              />
              {currentQuestion.options.map((opt, i) => (
                <div key={i} className="option-row">
                  <input
                    type="text"
                    placeholder={`Вариант ${i+1}`}
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                  />
                  <label>
                    <input
                      type="radio"
                      name="correctOption"
                      checked={currentQuestion.correctOptionIndex === i}
                      onChange={() => setCurrentQuestion({ ...currentQuestion, correctOptionIndex: i })}
                    />
                    Правильный
                  </label>
                  {currentQuestion.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)}>✖</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addOption}>+ Добавить вариант</button>
              {editingIndex !== null ? (
                <>
                  <button type="button" onClick={saveEditedQuestion}>💾 Сохранить изменения</button>
                  <button type="button" onClick={cancelEdit}>❌ Отменить</button>
                </>
              ) : (
                <button type="button" onClick={addQuestion}>➕ Добавить вопрос</button>
              )}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button className="btn-secondary" onClick={() => navigate(`/courses/${courseId}/materials/${materialId}`)}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}