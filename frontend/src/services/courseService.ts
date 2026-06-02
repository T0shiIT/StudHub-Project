import { fetchWithCsrf } from '../utils/csrf';
import type { Course, CreateCourseRequest, UpdateCourseRequest, AddMemberRequest, CourseEnrollment } from '../types/course';

const BASE_URL = '/api/courses';

export const courseService = {
  async getCourses(): Promise<Course[]> {
    const res = await fetchWithCsrf(BASE_URL);
    if (!res.ok) throw new Error('Failed to fetch courses');
    return res.json();
  },

  async getMyCourses(): Promise<Course[]> {
    const res = await fetchWithCsrf(`${BASE_URL}/my`);
    if (!res.ok) throw new Error('Failed to fetch my courses');
    return res.json();
  },

  async getCourse(id: number): Promise<Course> {
    const res = await fetchWithCsrf(`${BASE_URL}/${id}`);
    if (!res.ok) throw new Error('Failed to fetch course');
    return res.json();
  },

  async createCourse(data: CreateCourseRequest): Promise<Course> {
    const res = await fetchWithCsrf(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create course');
    return res.json();
  },

  async updateCourse(id: number, data: UpdateCourseRequest): Promise<Course> {
    const res = await fetchWithCsrf(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update course');
    return res.json();
  },

  async deleteCourse(id: number): Promise<void> {
    const res = await fetchWithCsrf(`${BASE_URL}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete course');
  },

  async archiveCourse(id: number): Promise<void> {
    const res = await fetchWithCsrf(`${BASE_URL}/${id}/archive`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to archive course');
  },

  async enroll(courseId: number): Promise<CourseEnrollment> {
    const res = await fetchWithCsrf(`${BASE_URL}/${courseId}/enroll`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to enroll');
    return res.json();
  },

  async unenroll(courseId: number): Promise<void> {
    const res = await fetchWithCsrf(`${BASE_URL}/${courseId}/enroll`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to unenroll');
  },

  async addMember(courseId: number, data: AddMemberRequest): Promise<CourseEnrollment> {
    const res = await fetchWithCsrf(`${BASE_URL}/${courseId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add member');
    return res.json();
  },

  async removeMember(courseId: number, userId: number): Promise<void> {
    const res = await fetchWithCsrf(`${BASE_URL}/${courseId}/members/${userId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to remove member');
  },
};