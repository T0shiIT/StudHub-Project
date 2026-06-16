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
  const [status, setStatus] = useState<string>('Надо сделать');
  const [testCompleted, setTestCompleted] = useState(false);
  const [testScore, setTestScore] = useState<number | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
        setStatus(data.status || (data.completed ? 'Выполнено' : 'Надо сделать'));
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

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
        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 3000);
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

  const getStatusBadgeClass = () => {
    if (material?.materialType === 'TEST') {
      return testCompleted ? 'status-badge--done' : 'status-badge--todo';
    } else {
      return submitted ? 'status-badge--done' : 'status-badge--todo';
    }
  };

  const getStatusLabel = () => {
    if (material?.materialType === 'TEST') {
      return testCompleted ? 'Пройден' : 'Не пройден';
    } else {
      return submitted ? 'Выполнено' : (status || 'Надо сделать');
    }
  };

  if (loading) return <div className="material-detail-page" style={{padding:40,textAlign:'center'}}>Загрузка...</div>;
  if (!material) return <div className="material-detail-page" style={{padding:40,textAlign:'center'}}>Материал не найден</div>;

  return (
    <div className="material-detail-page">
      <button className="btn-back" onClick={() => navigate(`/courses/${courseId}`)} style={{marginBottom:20}}>
        ← Назад к курсу
      </button>

      <div className="material-card">
        <div className="material-header">
          <div>
            <h1>{material.title}</h1>
            {material.description && <p style={{color:'#64748b', marginTop:6}}>{material.description}</p>}
          </div>
          <div className="meta">
            <span className={`status-badge ${getStatusBadgeClass()}`}>
              {getStatusLabel()}
            </span>
            {material.dueDate && (
              <span style={{fontSize:13, color:'#94a3b8'}}>
                📅 {new Date(material.dueDate).toLocaleDateString('ru-RU')}
              </span>
            )}
          </div>
        </div>

        <div className="material-body">
          {material.materialType === 'ASSIGNMENT' && (
            <>
              {material.filePath && (
                <div style={{marginBottom:16}}>
                  <a href={`http://localhost:8080/api/materials/download/${material.id}`} className="btn-secondary">
                    📄 Скачать файл задания
                  </a>
                </div>
              )}

              {!submitted ? (
                <>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
                    <span style={{fontWeight:600}}>Загрузить решение</span>
                  </div>

                  <label className="upload-area" htmlFor="file-upload">
                    <span className="icon">📤</span>
                    <span className="title">Выберите файл</span>
                    <span className="hint">или перетащите его сюда</span>
                    <span className="hint" style={{fontSize:11}}>PDF, DOC, DOCX, ZIP, RAR (макс. 20 МБ)</span>
                    <input
                      key={fileInputKey}
                      type="file"
                      id="file-upload"
                      style={{display:'none'}}
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.zip,.rar"
                    />
                  </label>

                  {selectedFile && (
                    <div className="file-preview" style={{marginTop:12}}>
                      <span style={{fontSize:20}}>📄</span>
                      <span className="name">{selectedFile.name}</span>
                      <span className="size">{(selectedFile.size / 1024).toFixed(1)} КБ</span>
                      <button className="remove" onClick={() => setSelectedFile(null)}>✕</button>
                    </div>
                  )}

                  <button
                    className="btn-submit"
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                    style={{marginTop:16}}
                  >
                    {uploading ? (
                      <>
                        <span className="spinner"></span> Отправка...
                      </>
                    ) : 'Отправить работу'}
                  </button>

                  {submitSuccess && (
                    <div className="submit-success" style={{marginTop:12}}>
                      ✅ Работа успешно отправлена!
                    </div>
                  )}
                </>
              ) : (
                <div className="submit-success">
                  ✅ Работа сдана
                </div>
              )}
            </>
          )}

          {material.materialType === 'TEST' && (
            <>
              {testCompleted ? (
                <div style={{textAlign:'center', padding:'20px 0'}}>
                  <div style={{fontSize:48, marginBottom:8}}>✅</div>
                  <p style={{fontSize:20, fontWeight:600, color:'#065f46'}}>Тест пройден</p>
                  <p style={{fontSize:32, fontWeight:700, color:'#065f46'}}>{testScore}%</p>
                  <button
                    className="btn-primary"
                    onClick={() => navigate(`/courses/${courseId}/materials/${materialId}/result`)}
                    style={{marginTop:12}}
                  >
                    Посмотреть результат
                  </button>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => navigate(`/courses/${courseId}/materials/${materialId}/test`)}
                  style={{padding:'12px 32px', fontSize:16}}
                >
                  🧪 Пройти тест
                </button>
              )}
            </>
          )}

          {material.materialType === 'FILE' && material.filePath && (
            <div style={{textAlign:'center', padding:16}}>
              <a href={`http://localhost:8080/api/materials/download/${material.id}`} className="btn-primary">
                📄 Скачать файл
              </a>
            </div>
          )}

          {material.materialType === 'LINK' && material.externalUrl && (
            <div style={{textAlign:'center', padding:16}}>
              <a href={material.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                🔗 Перейти по ссылке
              </a>
            </div>
          )}

          <div className="info-grid">
            <div className="info-card">
              <span className="label">Тип</span>
              <span className="value">{material.materialType.toLowerCase()}</span>
            </div>
            <div className="info-card">
              <span className="label">Статус</span>
              <span className="value">{getStatusLabel()}</span>
            </div>
            {material.dueDate && (
              <div className="info-card">
                <span className="label">Дедлайн</span>
                <span className="value">{new Date(material.dueDate).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}