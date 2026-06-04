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

export default function MaterialDetailPage() {
  const { courseId, materialId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<string>('Загрузка...');
  const [testCompleted, setTestCompleted] = useState(false);
  const [testScore, setTestScore] = useState<number | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const loadMaterial = async () => {
    setLoading(true);
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}`);
      if (res.ok) {
        const data = await res.json();
        setMaterial(data);

        if (data.materialType === 'ASSIGNMENT') {
          await checkSubmissionStatus(data.id);
        } else if (data.materialType === 'TEST') {
          await checkTestResult(data.id);
        }
      } else {
        console.error('Material not found');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const checkSubmissionStatus = async (materialId: number) => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/status`);
      if (res.ok) {
        const data = await res.json();
        setSubmitted(data.completed);
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to check status', error);
    }
  };

  const checkTestResult = async (materialId: number) => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/test-result`);
      if (res.ok) {
        const data = await res.json();
        setTestCompleted(data.completed);
        if (data.completed) setTestScore(data.scorePercent);
      }
    } catch (error) {
      console.error('Failed to check test result', error);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Выберите файл');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/submit`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setSubmitted(true);
        setStatus('Выполнено');
        setSelectedFile(null);
        setFileInputKey(k => k + 1);
        alert('Файл успешно загружен!');
        setTimeout(() => loadMaterial(), 500);
      } else {
        const err = await res.text();
        alert('Ошибка загрузки файла: ' + err);
      }
    } catch (error) {
      console.error(error);
      alert('Ошибка сети');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    loadMaterial();
  }, [materialId]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) loadMaterial();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  if (loading) return <div className="material-detail-page">Загрузка...</div>;
  if (!material) return <div className="material-detail-page">Материал не найден</div>;

  return (
    <div className="material-detail-page">
      <button className="btn-back" onClick={() => navigate(`/courses/${courseId}`)}>
        ← Назад к курсу
      </button>

      <div className="material-card">
        <h1>{material.title}</h1>

        {material.description && (
          <div className="material-description">
            <h3>Описание</h3>
            <p>{material.description}</p>
          </div>
        )}

        {material.dueDate && (
          <div className="material-info">
            <strong>📅 Срок сдачи:</strong>
            <span>{new Date(material.dueDate).toLocaleString('ru-RU')}</span>
          </div>
        )}

        {material.materialType === 'ASSIGNMENT' && (
          <div className="assignment-section">
            <div className="status-block">
              <strong>Статус:</strong>
              <span className={`status ${submitted ? 'done' : 'todo'}`}>
                {submitted ? '✅ Выполнено' : '❌ ' + status}
              </span>
            </div>

            {material.filePath && (
              <div className="download-section">
                <a href={`http://localhost:8080/api/materials/download/${material.id}`} className="btn-secondary">
                  📄 Скачать файл задания
                </a>
              </div>
            )}

            {!submitted ? (
              <div className="submit-section">
                <h3>Загрузить решение</h3>
                <input
                  key={fileInputKey}
                  type="file"
                  className="file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                />
                <button
                  className="btn-primary"
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? 'Загрузка...' : 'Отправить работу'}
                </button>
              </div>
            ) : (
              <div className="submitted-block">
                <p className="success">✓ Работа отправлена</p>
              </div>
            )}
          </div>
        )}

        {material.materialType === 'TEST' && (
          <div className="test-section">
            {!testCompleted ? (
              <button
                className="btn-primary"
                onClick={() => navigate(`/courses/${courseId}/materials/${materialId}/test`)}
              >
                🧪 Пройти тест
              </button>
            ) : (
              <div className="test-result-block">
                <p className="success">✓ Тест пройден</p>
                <p>Ваш результат: <strong>{testScore}%</strong></p>
              </div>
            )}
          </div>
        )}

        {material.materialType === 'FILE' && material.filePath && (
          <div className="download-section">
            <a href={`http://localhost:8080/api/materials/download/${material.id}`} className="btn-primary">
              📄 Скачать файл
            </a>
          </div>
        )}

        {material.materialType === 'LINK' && material.externalUrl && (
          <div className="link-section">
            <a href={material.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
              🔗 Перейти по ссылке
            </a>
          </div>
        )}
      </div>
    </div>
  );
}