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

  const isTeacher = user && course && (user.id === course.teacherId || user.role === 'ADMIN');
  const canViewGrades = user && (user.role === 'ADMIN' || user.role === 'TEACHER' || (user.role === 'STUDENT' && course?.enrolled));

  const loadSections = async () => {
    if (!id) return;
    try {
      const res = await fetchWithCsrf(`/api/materials/course/${id}/sections`);
      if (!res.ok) return;
      const sectionsData = await res.json();
      setSections(sectionsData);
      const initiallyOpened: Record<number, boolean> = {};
      sectionsData.forEach((section: Section) => { initiallyOpened[section.id] = true; });
      setOpenedSections(initiallyOpened);
      const materialsMap: Record<number, Material[]> = {};
      await Promise.all(
        sectionsData.map(async (section: Section) => {
          try {
            const materialsRes = await fetchWithCsrf(`/api/materials/section/${section.id}`);
            if (materialsRes.ok) materialsMap[section.id] = await materialsRes.json();
            else materialsMap[section.id] = [];
          } catch (e) {
            materialsMap[section.id] = [];
          }
        })
      );
      setMaterials(materialsMap);
    } catch (error) {
      console.error('Failed to load sections', error);
    }
  };

  const loadCourse = async () => {
    if (!id) {
      navigate('/courses');
      return;
    }
    try {
      const res = await fetchWithCsrf(`/api/courses/${id}`);
      if (!res.ok) {
        navigate('/courses');
        return;
      }
      const data = await res.json();
      let teacherName = 'Преподаватель';
      try {
        const teacherRes = await fetchWithCsrf(`/api/internal/user/${data.teacherId}`);
        if (teacherRes.ok) {
          const teacherData = await teacherRes.json();
          teacherName = `${teacherData.firstName} ${teacherData.lastName}`;
        }
      } catch (e) {
        console.error('Failed to load teacher', e);
      }
      setCourse({
        ...data,
        teacherName,
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
    try {
      const res = await fetchWithCsrf(`/api/courses/${course.id}/progress`);
      if (res.ok) {
        const data = await res.json();
        setProgress({ percent: data.percent, hasGradedMaterials: data.hasGradedMaterials });
      } else {
        setProgress(null);
      }
    } catch (error) {
      console.error('Failed to load progress', error);
      setProgress(null);
    }
  };

  useEffect(() => {
    loadCourse();
  }, [id]);

  useEffect(() => {
    if (course && user) {
      loadProgress();
    }
  }, [course, user]);

  if (!loading && course && user?.role === 'STUDENT' && course.status === 'INACTIVE') {
    return (
      <div className="cd-page">
        <div className="cd-hero">
          <button className="cd-back-btn" onClick={() => navigate('/courses')}>← Назад к курсам</button>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <h2>Курс временно недоступен</h2>
            <p>Преподаватель закрыл доступ к этому курсу.</p>
          </div>
        </div>
      </div>
    );
  }

  const createSection = async () => {
    if (!newSectionTitle.trim()) return;
    try {
      const res = await fetchWithCsrf('/api/materials/sections', {
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
      const res = await fetchWithCsrf(`/api/materials/sections/${sectionId}`, { method: 'DELETE' });
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
      const res = await fetchWithCsrf('/api/materials/material', {
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
          await fetchWithCsrf(`/api/materials/${createdMaterial.id}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: q.text, options: q.options, correctOptionIndex: q.correctIndex }),
          });
        }
        alert('Тест создан с вопросами');
      } else if (selectedFile && (newMaterial.materialType === 'FILE' || newMaterial.materialType === 'ASSIGNMENT')) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await fetchWithCsrf(`/api/materials/material/${createdMaterial.id}/upload-file`, { method: 'POST', body: formData });
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
      const res = await fetchWithCsrf(`/api/materials/${materialId}`, { method: 'DELETE' });
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
      const res = await fetchWithCsrf(`/api/materials/${materialId}/status`);
      if (res.ok) { const data = await res.json(); return data.status; }
    } catch (error) { console.error('Failed to load status', error); }
    return 'Надо сделать';
  };

  if (loading) return <div className="dashboard-loading">Загрузка курса...</div>;
  if (!course) return <div className="dashboard-loading">Курс не найден</div>;

  return (
    <div className="cd-page">
      {/* ── HERO ── */}
      <section className="cd-hero">
        <div className="cd-hero-left">
          <button className="cd-back-btn" onClick={() => navigate('/courses')}>← Назад к курсам</button>
          <span className="cd-eyebrow">Курс</span>
          <h1 className="cd-title">{course.title}</h1>
          <p className="cd-subtitle">👨‍🏫 {course.teacherName}</p>
        </div>

        <div className="cd-hero-right">
          {isTeacher && (
            <button
              className="cd-action-btn cd-action-btn--amber"
              onClick={() => navigate(`/courses/${id}/edit`)}
            >
              Редактировать курс
            </button>
          )}
          {canViewGrades && (
            <button
              className="cd-action-btn cd-action-btn--purple"
              onClick={() => navigate(`/courses/${id}/grades`)}
            >
              📊 Журнал
            </button>
          )}
        </div>

        {course.coverImage && (
          <div
            className="cd-hero-cover"
            style={{ backgroundImage: `url(${course.coverImage})` }}
          />
        )}
      </section>

      {/* ── ABOUT + PROGRESS ── */}
      <section className="cd-card">
        <div className="cd-about">
          <span className="cd-section-eyebrow">О курсе</span>
          <p>{course.description || 'Описание отсутствует'}</p>
        </div>

        {progress && progress.hasGradedMaterials && (
          <div className="cd-progress-block">
            <div className="cd-progress-header">
              <span className="cd-section-eyebrow">Ваш прогресс</span>
              <strong className="cd-progress-value">{progress.percent}%</strong>
            </div>
            <div className="cd-progress-track">
              <div className="cd-progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* ── SECTIONS ── */}
      <section className="cd-card cd-sections-card">
        {isTeacher && (
          <div className="cd-create-section">
            <input
              type="text"
              className="cd-input"
              placeholder="Название новой темы"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createSection()}
            />
            <button className="cd-action-btn cd-action-btn--blue" onClick={createSection}>
              + Создать тему
            </button>
          </div>
        )}

        {sections.length === 0 && (
          <div className="cd-empty">Тем пока нет</div>
        )}

        <div className="cd-sections-list">
          {sections.map((section) => (
            <div key={section.id} className="cd-section">
              {/* Section header */}
              <div className="cd-section-header" onClick={() => toggleSection(section.id)}>
                <span className="cd-section-toggle">
                  {openedSections[section.id] ? '▾' : '▸'}
                </span>
                <h3 className="cd-section-title">{section.title}</h3>
                <div className="cd-section-count">
                  {(materials[section.id]?.length ?? 0)}
                </div>
                {isTeacher && (
                  <div className="cd-section-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="cd-action-btn cd-action-btn--blue cd-action-btn--sm"
                      onClick={() => setShowMaterialForm(showMaterialForm === section.id ? null : section.id)}
                    >
                      + Материал
                    </button>
                    <button
                      className="cd-action-btn cd-action-btn--red cd-action-btn--sm"
                      onClick={() => deleteSection(section.id)}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              {/* Section body */}
              {openedSections[section.id] && (
                <div className="cd-section-body">
                  {/* Material creation form */}
                  {showMaterialForm === section.id && (
                    <div className="cd-material-form">
                      <input
                        type="text"
                        className="cd-input"
                        placeholder="Название материала"
                        value={newMaterial.title}
                        onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                      />
                      <textarea
                        className="cd-input cd-textarea"
                        placeholder="Описание"
                        value={newMaterial.description}
                        onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })}
                      />
                      <select
                        className="cd-input"
                        value={newMaterial.materialType}
                        onChange={(e) => setNewMaterial({ ...newMaterial, materialType: e.target.value })}
                      >
                        <option value="FILE">Файл</option>
                        <option value="ASSIGNMENT">Задание</option>
                        <option value="LINK">Ссылка</option>
                        <option value="TEXT">Текст</option>
                        <option value="TEST">Тест</option>
                      </select>

                      {(newMaterial.materialType === 'FILE' || newMaterial.materialType === 'ASSIGNMENT') && (
                        <div className="cd-file-upload">
                          <label>📎 Прикрепить файл</label>
                          <input
                            type="file"
                            className="cd-input"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          />
                        </div>
                      )}

                      {newMaterial.materialType === 'LINK' && (
                        <input
                          type="url"
                          className="cd-input"
                          placeholder="https://example.com"
                          value={newMaterial.externalUrl || ''}
                          onChange={(e) => setNewMaterial({ ...newMaterial, externalUrl: e.target.value })}
                        />
                      )}

                      {newMaterial.materialType === 'ASSIGNMENT' && (
                        <input
                          type="datetime-local"
                          className="cd-input"
                          value={newMaterial.dueDate}
                          onChange={(e) => setNewMaterial({ ...newMaterial, dueDate: e.target.value })}
                        />
                      )}

                      {newMaterial.materialType === 'TEST' && (
                        <div className="cd-test-builder">
                          <span className="cd-section-eyebrow">Конструктор теста</span>
                          {testQuestions.length > 0 && (
                            <div className="cd-added-questions">
                              {testQuestions.map((q, idx) => (
                                <div key={idx} className="cd-added-question">
                                  <span>{idx + 1}. {q.text}</span>
                                  <button type="button" onClick={() => removeQuestion(idx)} className="cd-icon-btn">🗑️</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <input
                            type="text"
                            className="cd-input"
                            placeholder="Текст вопроса"
                            value={currentQuestion.text}
                            onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
                          />
                          <div className="cd-options-list">
                            {currentQuestion.options.map((opt, idx) => (
                              <div key={idx} className="cd-option-row">
                                <input
                                  type="text"
                                  className="cd-input"
                                  placeholder={`Вариант ${idx + 1}`}
                                  value={opt}
                                  onChange={(e) => updateOption(idx, e.target.value)}
                                />
                                <label className="cd-radio-label">
                                  <input
                                    type="radio"
                                    name="correctOption"
                                    checked={currentQuestion.correctIndex === idx}
                                    onChange={() => setCurrentQuestion({ ...currentQuestion, correctIndex: idx })}
                                  /> Верный
                                </label>
                                {currentQuestion.options.length > 2 && (
                                  <button type="button" onClick={() => removeOption(idx)} className="cd-icon-btn">✖</button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="cd-form-row">
                            <button type="button" className="cd-action-btn cd-action-btn--ghost" onClick={addOption}>
                              + Вариант
                            </button>
                            <button type="button" className="cd-action-btn cd-action-btn--blue" onClick={addQuestion}>
                              ➕ Добавить вопрос
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="cd-form-row">
                        <button className="cd-action-btn cd-action-btn--blue" onClick={() => createMaterial(section.id)}>
                          Создать
                        </button>
                        <button
                          className="cd-action-btn cd-action-btn--ghost"
                          onClick={() => {
                            setShowMaterialForm(null);
                            setSelectedFile(null);
                            setTestQuestions([]);
                            setCurrentQuestion({ text: '', options: ['', ''], correctIndex: 0 });
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Materials list */}
                  {!materials[section.id] || materials[section.id].length === 0 ? (
                    <p className="cd-empty cd-empty--inline">Материалов пока нет</p>
                  ) : (
                    <div className="cd-materials-list">
                      {materials[section.id].map((material) => (
                        <MaterialItem
                          key={material.id}
                          material={material}
                          courseId={id!}
                          isTeacher={!!isTeacher}
                          getSubmissionStatus={getSubmissionStatus}
                          onDelete={deleteMaterial}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
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

  const typeMap: Record<string, { icon: string; label: string; color: string }> = {
    ASSIGNMENT: { icon: '📝', label: 'ПЗ',   color: '#f59e0b' },
    FILE:       { icon: '📄', label: 'Файл', color: '#3b82f6' },
    LINK:       { icon: '🔗', label: 'Ссыл', color: '#6366f1' },
    TEST:       { icon: '📊', label: 'Тест', color: '#8b5cf6' },
    TEXT:       { icon: '📝', label: 'Текст',color: '#10b981' },
  };
  const meta = typeMap[material.materialType] ?? { icon: '📄', label: '', color: '#64748b' };

  return (
    <div className="cd-material-item">
      <span className="cd-material-icon" style={{ color: meta.color }}>{meta.icon}</span>
      <button
        className="cd-material-link"
        onClick={() => navigate(`/courses/${courseId}/materials/${material.id}`)}
      >
        {material.title}
      </button>
      <div className="cd-material-right">
        {material.materialType === 'ASSIGNMENT' && (
          <span className={`cd-status ${status === 'Выполнено' ? 'cd-status--done' : 'cd-status--todo'}`}>
            {status}
          </span>
        )}
        {isTeacher && (
          <>
            <button
              className="cd-action-btn cd-action-btn--amber cd-action-btn--sm"
              onClick={() => navigate(`/courses/${courseId}/materials/${material.id}/edit`)}
            >
              ✏️
            </button>
            <button
              className="cd-action-btn cd-action-btn--red cd-action-btn--sm"
              onClick={() => onDelete(material.id)}
            >
              🗑️
            </button>
          </>
        )}
      </div>
    </div>
  );
}
