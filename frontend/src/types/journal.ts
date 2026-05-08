export interface Student {
  id: number;
  firstName: string;
  lastName: string;
}

export interface JournalData {
  students: Student[];
  dates: string[]; // формат "гггг-мм-дд"
  grades: {
    [studentId: number]: {
      [date: string]: number | null; // оценка да 2-5 или ничего
    };
  };
}

export type UserRole = 'admin' | 'teacher' | 'student';

export interface UserData {
  role: UserRole;
}