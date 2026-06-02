import React, { useState } from 'react';
import type { CreateCourseRequest, UpdateCourseRequest } from '../../types/course';

interface CourseFormProps {
  initialData?: Partial<CreateCourseRequest>;
  onSubmit: (data: CreateCourseRequest | UpdateCourseRequest) => Promise<void>;
  onCancel: () => void;
  title: string;
}

export const CourseForm: React.FC<CourseFormProps> = ({ initialData, onSubmit, onCancel, title }) => {
  const [form, setForm] = useState<CreateCourseRequest>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    shortName: initialData?.shortName || '',
    category: initialData?.category || '',
    visible: initialData?.visible ?? true,
    enrollmentOpen: initialData?.enrollmentOpen ?? true,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(form);
      onCancel();
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении курса');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div className="modal-content" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%' }}>
        <h3>{title}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название курса *</label>
            <input name="title" value={form.title} onChange={handleChange} required className="form-input" />
          </div>
          <div className="form-group">
            <label>Короткое имя</label>
            <input name="shortName" value={form.shortName} onChange={handleChange} className="form-input" />
          </div>
          <div className="form-group">
            <label>Категория</label>
            <input name="category" value={form.category} onChange={handleChange} className="form-input" />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} className="form-input" />
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" name="visible" checked={form.visible} onChange={handleChange} /> Курс виден студентам
            </label>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" name="enrollmentOpen" checked={form.enrollmentOpen} onChange={handleChange} /> Самостоятельная запись открыта
            </label>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" onClick={onCancel} className="btn btn-outline">Отмена</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Сохранение...' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};