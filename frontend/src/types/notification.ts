export interface Notification {
  id: number;
  message: string;
  createdAt: string | null; // ISO 8601, например "2026-05-30T22:57:00Z"
  type?: string; // например "SCHEDULE_CHANGE"
  read?: boolean;
}

export interface NotificationsResponse {
  notifications?: Notification[];
  [key: string]: unknown; // на случай, если бэкенд вернёт обёртку
}