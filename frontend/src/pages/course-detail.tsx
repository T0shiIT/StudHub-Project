import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf } from '../utils/csrf';

interface Course {
  id: number;
  title: string;
  description: string;
  teacherId: number;
  teacherName?: string;
  coverImage?: string;
  status?: string;
}

interface Section {
  id: number;
  title: string;
  position: number;
}

interface Material {
  id: number;
  title: string;
  description: string;
  materialType: string;
  dueDate?: string;
  filePath?: string;
  externalUrl?: string;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [materials, setMaterials] = useState<Record<number, Material[]>>({});
  const [openedSections, setOpenedSections] = useState<Record<number, boolean>>({});
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    description: '',
    materialType: 'FILE',
    dueDate: '',
    externalUrl: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMaterialForm, setShowMaterialForm] = useState<number | null>(null);
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    text: '',
    options: ['', ''],
    correctIndex: 0
  });
  const [progress, setProgress] = useState<{ percent: number; hasGradedMaterials: boolean } | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const isTeacher = user && course && (user.id === course.teacherId || user.role === 'ADMIN');
  const canViewGrades = user && (user.role === 'ADMIN' || user.role === 'TEACHER' || (user.role === 'STUDENT' && course?.enrolled));

  if (!id) {
    navigate('/courses');
    return null;
  }

  const loadSections = async () => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/course/${id}/sections`);
      if (!res.ok) return;
      const sectionsData = await res.json();
      setSections(sectionsData);
      const initiallyOpened: Record<number, boolean> = {};
      sectionsData.forEach((section: Section) => { initiallyOpened[section.id] = true; });
      setOpenedSections(initiallyOpened);
      const materialsMap: Record<number, Material[]> = {};
      await Promise.all(
        sectionsData.map(async (section: Section) => {
          const materialsRes = await fetchWithCsrf(`http://localhost:8080/api/materials/section/${section.id}`);
          if (materialsRes.ok) materialsMap[section.id] = await materialsRes.json();
          else materialsMap[section.id] = [];
        })
      );
      setMaterials(materialsMap);
    } catch (error) {
      console.error('Failed to load sections', error);
    }
  };

  const loadCourse = async () => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/courses/${id}`);
      if (!res.ok) {
        navigate('/courses');
        return;
      }
      const data = await res.json();
      const teacherRes = await fetchWithCsrf(`http://localhost:8080/api/internal/user/${data.teacherId}`);
      const teacherData = teacherRes.ok ? await teacherRes.json() : null;
      setCourse({
        ...data,
        teacherName: teacherData ? `${teacherData.firstName} ${teacherData.lastName}` : 'Преподаватель',
        status: data.status || 'ACTIVE',
      });
      await loadSections();
    } catch (error) {
      console.error(error);
      navigate('/courses');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!user || !course) return;
    setLoadingProgress(true);
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/courses/${course.id}/progress`);
      if (res.ok) {
        const data = await res.json();
        setProgress({ percent: data.percent, hasGradedMaterials: data.hasGradedMaterials });
      } else {
        setProgress(null);
      }
    } catch (error) {
      console.error('Failed to load progress', error);
      setProgress(null);
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    loadCourse();
  }, [id]);

  useEffect(() => {
    if (course && user) {
      loadProgress();
    }
  }, [course, user]);

  if (!loading && course && user?.role === 'STUDENT' && course.status === 'INACTIVE') {
    return (
      <div className="course-detail-page">
        <div className="course-header">
          <button className="btn-back" onClick={() => navigate('/courses')}>← Назад к курсам</button>
        </div>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <h2>Курс временно недоступен</h2>
          <p>Преподаватель закрыл доступ к этому курсу.</p>
        </div>
      </div>
    );
  }

  const createSection = async () => {
    if (!newSectionTitle.trim()) return;
    try {
      const res = await fetchWithCsrf('http://localhost:8080/api/materials/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: Number(id), title: newSectionTitle }),
      });
      if (res.ok) {
        setNewSectionTitle('');
        await loadSections();
      }
    } catch (error) { console.error(error); }
  };

  const deleteSection = async (sectionId: number) => {
    if (!confirm('Удалить раздел и все материалы в нём?')) return;
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/sections/${sectionId}`, { method: 'DELETE' });
      if (res.ok) await loadSections();
    } catch (error) { console.error(error); }
  };

  const addQuestion = () => {
    if (!currentQuestion.text.trim()) { alert('Введите текст вопроса'); return; }
    if (currentQuestion.options.some(opt => !opt.trim())) { alert('Заполните все варианты ответов'); return; }
    setTestQuestions([...testQuestions, { ...currentQuestion }]);
    setCurrentQuestion({ text: '', options: ['', ''], correctIndex: 0 });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = [...testQuestions];
    newQuestions.splice(index, 1);
    setTestQuestions(newQuestions);
  };

  const updateOption = (idx: number, value: string) => {
    const newOptions = [...currentQuestion.options];
    newOptions[idx] = value;
    setCurrentQuestion({ ...currentQuestion, options: newOptions });
  };

  const addOption = () => {
    setCurrentQuestion({ ...currentQuestion, options: [...currentQuestion.options, ''] });
  };

  const removeOption = (idx: number) => {
    const newOptions = [...currentQuestion.options];
    newOptions.splice(idx, 1);
    setCurrentQuestion({ ...currentQuestion, options: newOptions });
  };

  const createMaterial = async (sectionId: number) => {
    if (!newMaterial.title.trim()) { alert('Введите название материала'); return; }
    try {
      const res = await fetchWithCsrf('http://localhost:8080/api/materials/material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          title: newMaterial.title,
          description: newMaterial.description,
          materialType: newMaterial.materialType,
          dueDate: newMaterial.dueDate ? new Date(newMaterial.dueDate).toISOString() : null,
          externalUrl: newMaterial.externalUrl || null,
        }),
      });
      if (!res.ok) { const errorText = await res.text(); alert(`Ошибка создания материала: ${errorText}`); return; }
      const createdMaterial = await res.json();

      if (newMaterial.materialType === 'TEST' && testQuestions.length > 0) {
        for (const q of testQuestions) {
          await fetchWithCsrf(`http://localhost:8080/api/materials/${createdMaterial.id}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: q.text, options: q.options, correctOptionIndex: q.correctIndex }),
          });
        }
        alert('Тест создан с вопросами');
      } else if (selectedFile && (newMaterial.materialType === 'FILE' || newMaterial.materialType === 'ASSIGNMENT')) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await fetchWithCsrf(`http://localhost:8080/api/materials/material/${createdMaterial.id}/upload-file`, { method: 'POST', body: formData });
        if (!uploadRes.ok) alert(`Материал создан, но файл не загружен. Ошибка: ${await uploadRes.text()}`);
        else alert('Материал и файл успешно созданы');
      } else {
        alert('Материал успешно создан');
      }

      setNewMaterial({ title: '', description: '', materialType: 'FILE', dueDate: '', externalUrl: '' });
      setSelectedFile(null);
      setShowMaterialForm(null);
      setTestQuestions([]);
      await loadSections();
      await loadProgress();
    } catch (error) { console.error(error); alert('Произошла ошибка при создании материала'); }
  };

  const deleteMaterial = async (materialId: number) => {
    if (!confirm('Удалить материал?')) return;
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}`, { method: 'DELETE' });
      if (res.ok) {
        await loadSections();
        await loadProgress();
      }
    } catch (error) { console.error(error); }
  };

  const toggleSection = (sectionId: number) => {
    setOpenedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const getSubmissionStatus = async (materialId: number): Promise<string> => {
    try {
      const res = await fetchWithCsrf(`http://localhost:8080/api/materials/${materialId}/status`);
      if (res.ok) { const data = await res.json(); return data.status; }
    } catch (error) { console.error('Failed to load status', error); }
    return 'Надо сделать';
  };

  if (loading) return <div className="course-detail-page">Загрузка...</div>;
  if (!course) return <div className="course-detail-page">Курс не найден</div>;

  return (
    <div className="course-detail-page">
      {course.coverImage && <div className="detail-cover" style={{ backgroundImage: `url(${course.coverImage})` }} />}
      <div className="course-header">
        <button className="btn-back" onClick={() => navigate('/courses')}>← Назад к курсам</button>
        <div className="course-title-section">
          <h1>{course.title}</h1>
          <p className="course-teacher">👨‍🏫 {course.teacherName}</p>
        </div>
        <div>
          {isTeacher && (
            <button className="btn-edit" onClick={() => navigate(`/courses/${id}/edit`)}>Редактировать курс</button>
          )}
          {canViewGrades && (
            <button
              onClick={() => navigate(`/courses/${id}/grades`)}
              style={{ marginLeft: '8px', background: '#8b5cf6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}
            >
              📊 Журнал
            </button>
          )}
        </div>
      </div>
      <div className="course-content">
        <div className="course-description">
          <h2>О курсе</h2>
          <p>{course.description || 'Описание отсутствует'}</p>
        </div>
        {progress && progress.hasGradedMaterials && (
          <div className="course-progress-bar">
            <span>Ваш прогресс: {progress.percent}%</span>
            <div className="progress-bg"><div className="progress-fill" style={{ width: `${progress.percent}%` }} /></div>
          </div>
        )}
        <div className="moodle-sections">
          {isTeacher && (
            <div className="create-section">
              <input type="text" placeholder="Название новой темы" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} />
              <button className="btn-primary" onClick={createSection}>+ Создать тему</button>
            </div>
          )}
          {sections.length === 0 && <div className="empty">Тем пока нет</div>}
          {sections.map((section) => (
            <div key={section.id} className="moodle-section">
              <div className="section-header" onClick={() => toggleSection(section.id)}>
                <span>{openedSections[section.id] ? '▼' : '▶'}</span>
                <h3>{section.title}</h3>
                {isTeacher && (
                  <>
                    <button className="btn-small" onClick={(e) => { e.stopPropagation(); setShowMaterialForm(showMaterialForm === section.id ? null : section.id); }}>+ Материал</button>
                    <button className="btn-small btn-danger-small" onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}>🗑️</button>
                  </>
                )}
              </div>
              {openedSections[section.id] && (
                <div className="section-materials">
                  {showMaterialForm === section.id && (
                    <div className="material-form">
                      <input type="text" placeholder="Название материала" value={newMaterial.title} onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })} />
                      <textarea placeholder="Описание" value={newMaterial.description} onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })} />
                      <select value={newMaterial.materialType} onChange={(e) => setNewMaterial({ ...newMaterial, materialType: e.target.value })}>
                        <option value="FILE">Файл</option>
                        <option value="ASSIGNMENT">Задание</option>
                        <option value="LINK">Ссылка</option>
                        <option value="TEXT">Текст</option>
                        <option value="TEST">Тест</option>
                      </select>
                      {(newMaterial.materialType === 'FILE' || newMaterial.materialType === 'ASSIGNMENT') && (
                        <div className="file-upload-section">
                          <label>📎 Прикрепить файл:</label>
                          <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="file-input" />
                        </div>
                      )}
                      {newMaterial.materialType === 'LINK' && (
                        <input type="url" placeholder="https://example.com" value={newMaterial.externalUrl || ''} onChange={(e) => setNewMaterial({ ...newMaterial, externalUrl: e.target.value })} />
                      )}
                      {newMaterial.materialType === 'ASSIGNMENT' && (
                        <input type="datetime-local" value={newMaterial.dueDate} onChange={(e) => setNewMaterial({ ...newMaterial, dueDate: e.target.value })} />
                      )}
                      {newMaterial.materialType === 'TEST' && (
                        <div className="test-builder">
                          <hr />
                          <h4>Конструктор теста</h4>
                          {testQuestions.length > 0 && (
                            <div className="added-questions">
                              <strong>Добавленные вопросы:</strong>
                              {testQuestions.map((q, idx) => (
                                <div key={idx} className="added-question">
                                  <span>{idx+1}. {q.text}</span>
                                  <button type="button" onClick={() => removeQuestion(idx)}>🗑️</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="new-question">
                            <input type="text" placeholder="Текст вопроса" value={currentQuestion.text} onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })} />
                            <div className="options-list">
                              {currentQuestion.options.map((opt, idx) => (
                                <div key={idx} className="option-row">
                                  <input type="text" placeholder={`Вариант ${idx+1}`} value={opt} onChange={(e) => updateOption(idx, e.target.value)} />
                                  <label><input type="radio" name="correctOption" checked={currentQuestion.correctIndex === idx} onChange={() => setCurrentQuestion({ ...currentQuestion, correctIndex: idx })} /> Правильный</label>
                                  {currentQuestion.options.length > 2 && <button type="button" onClick={() => removeOption(idx)}>✖</button>}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={addOption}>+ Добавить вариант</button>
                            <button type="button" onClick={addQuestion}>➕ Добавить вопрос</button>
                          </div>
                          <hr />
                        </div>
                      )}
                      <div className="form-actions">
                        <button className="btn-primary" onClick={() => createMaterial(section.id)}>Создать</button>
                        <button className="btn-secondary" onClick={() => { setShowMaterialForm(null); setSelectedFile(null); setTestQuestions([]); setCurrentQuestion({ text: '', options: ['', ''], correctIndex: 0 }); }}>Отмена</button>
                      </div>
                    </div>
                  )}
                  {!materials[section.id] || materials[section.id].length === 0 ? (
                    <p className="empty">Материалов пока нет</p>
                  ) : (
                    materials[section.id].map((material) => (
                      <MaterialItem key={material.id} material={material} courseId={id!} isTeacher={isTeacher} getSubmissionStatus={getSubmissionStatus} onDelete={deleteMaterial} />
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MaterialItem({ material, courseId, isTeacher, getSubmissionStatus, onDelete }: {
  material: Material;
  courseId: string;
  isTeacher: boolean;
  getSubmissionStatus: (id: number) => Promise<string>;
  onDelete: (id: number) => void;
}) {
  const [status, setStatus] = useState<string>('Загрузка...');
  const navigate = useNavigate();

  useEffect(() => {
    if (material.materialType === 'ASSIGNMENT') getSubmissionStatus(material.id).then(setStatus);
  }, [material]);

  const icon = material.materialType === 'ASSIGNMENT' ? '📝' : material.materialType === 'FILE' ? '📄' : material.materialType === 'LINK' ? '🔗' : material.materialType === 'TEST' ? '📊' : '📝';

  return (
    <div className="material-item">
      <div className="material-left">
        <span>{icon}</span>
        <button className="material-link" onClick={() => navigate(`/courses/${courseId}/materials/${material.id}`)}>{material.title}</button>
      </div>
      <div className="material-right">
        {material.materialType === 'ASSIGNMENT' && <span className={`status ${status === 'Выполнено' ? 'done' : 'todo'}`}>{status}</span>}
        {isTeacher && (
          <>
            <button className="btn-small" onClick={() => navigate(`/courses/${courseId}/materials/${material.id}/edit`)} style={{ background: '#f59e0b', marginRight: '6px' }}>✏️</button>
            <button className="btn-small btn-danger-small" onClick={() => onDelete(material.id)}>🗑️</button>
          </>
        )}
      </div>
    </div>
  );
}