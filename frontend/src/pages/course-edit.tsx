import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';

interface Course {
  id: number;
  title: string;
  description: string;
  teacherId: number;
  coverImage?: string;
}

export default function CourseEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCourse = async () => {
      try {
        const res = await fetchWithCsrf(`http://localhost:8080/api/courses/${id}`);
        if (res.ok) {
          const data = await res.json();
          setCourse(data);
          setTitle(data.title);
          setDescription(data.description || '');
          setCoverImage(data.coverImage || '');

          if (user?.role !== 'ADMIN' && data.teacherId !== user.id) {
            navigate(`/courses/${id}`);
          }
        } else {
          navigate('/courses');
        }
      } catch (e) {
        console.error('Failed to load course', e);
        navigate('/courses');
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [id, navigate, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/courses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, coverImage }),
      });

      if (res.ok) {
        navigate(`/courses/${id}`);
      } else {
        setError('Не удалось сохранить изменения');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Вы уверены, что хотите удалить курс "${course?.title}"?`)) return;

    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/courses/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        navigate('/courses');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Не удалось удалить курс');
      }
    } catch {
      alert('Ошибка сети');
    }
  };

  if (loading) return <div className="course-edit-page">Загрузка...</div>;
  if (!course) return <div className="course-edit-page">Курс не найден</div>;

  return (
    <div className="course-edit-page">
      <div className="edit-header">
        <button className="btn-back" onClick={() => navigate(`/courses/${id}`)}>
          ← Назад к курсу
        </button>
        <h1>Редактирование курса</h1>
      </div>

      <form className="edit-form" onSubmit={handleSave}>
        <div className="form-group">
          <label>Название курса</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label>Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label>URL обложки</label>
          <input
            type="url"
            placeholder="https://images.unsplash.com/..."
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            disabled={saving}
          />
          {coverImage && (
            <div className="cover-preview">
              <img src={coverImage} alt="Предпросмотр" />
            </div>
          )}
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(`/courses/${id}`)}>
            Отмена
          </button>
        </div>
      </form>

      <div className="delete-section">
        <h2>Опасная зона</h2>
        <p>После удаления курса все данные будут потеряны</p>
        <button className="btn-danger" onClick={handleDelete}>
          🗑️ Удалить курс
        </button>
      </div>
    </div>
  );
}