import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { courseService } from '../../services/courseService';
import { CourseForm } from '../../components/courses/CourseForm';
import type { UpdateCourseRequest } from '../../types/course';

export default function CourseEdit() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState<UpdateCourseRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    courseService.getCourse(Number(courseId))
      .then(course => setInitialData(course))
      .catch(err => alert('Ошибка загрузки курса'))
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleUpdate = async (data: UpdateCourseRequest) => {
    await courseService.updateCourse(Number(courseId), data);
    navigate(`/courses/${courseId}`);
  };

  if (loading) return <div className="schedule-alert schedule-alert--loading">Загрузка...</div>;
  if (!initialData) return <div className="schedule-empty-state">Курс не найден</div>;

  return (
    <CourseForm
      initialData={initialData}
      onSubmit={handleUpdate}
      onCancel={() => navigate(`/courses/${courseId}`)}
      title="Редактирование курса"
    />
  );
}