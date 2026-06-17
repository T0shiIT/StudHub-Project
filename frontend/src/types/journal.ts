export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface Student {
  id: number;
  firstName: string;
  lastName: string;
}

export interface JournalData {
  students: Student[];
  dates: string[];
  grades: {
    [studentId: number]: {
      [date: string]: string | null;
    };
  };
}
