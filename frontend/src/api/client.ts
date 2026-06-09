import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8080',
  withCredentials: true,
});

export default apiClient;

// Добавленная функция для получения прогресса
export const getCourseProgress = (courseId: number): Promise<{ percent: number }> => {
  return apiClient.get(`/api/courses/${courseId}/progress`).then(res => res.data);
};