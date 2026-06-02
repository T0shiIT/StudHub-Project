export type CourseStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';

export interface CourseEnrollment {
  userId: number;
  userFullName: string;
  userEmail: string;
  userLogin: string;
  courseRole: 'STUDENT' | 'TEACHER' | 'OWNER';
  enrolledAt: string;
}

export interface Assignment {
  id: number;
  courseId: number;
  title: string;
  description?: string;
  type: 'ASSIGNMENT' | 'QUIZ';
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  maxScore: number;
  dueDate?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: number;
  title: string;
  description?: string;
  shortName?: string;
  category?: string;
  status: CourseStatus;
  visible: boolean;
  enrollmentOpen: boolean;
  ownerId: number;
  ownerName: string;
  createdAt: string;
  updatedAt?: string;
  enrollments?: CourseEnrollment[];
  assignments?: Assignment[];
  myRole?: 'OWNER' | 'TEACHER' | 'STUDENT' | null;
}

export interface CreateCourseRequest {
  title: string;
  description?: string;
  shortName?: string;
  category?: string;
  visible?: boolean;
  enrollmentOpen?: boolean;
}

export interface UpdateCourseRequest {
  title?: string;
  description?: string;
  shortName?: string;
  category?: string;
  visible?: boolean;
  enrollmentOpen?: boolean;
}

export interface AddMemberRequest {
  userId: number;
  courseRole?: 'STUDENT' | 'TEACHER';
}