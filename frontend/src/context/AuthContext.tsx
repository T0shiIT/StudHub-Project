import React, { createContext, useContext, useEffect, useState } from 'react';
import { ensureCsrfToken, fetchWithCsrf } from '../utils/csrf';

interface User {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  group?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      await ensureCsrfToken();
      const response = await fetchWithCsrf('http://localhost:8080/api/user/me');
      if (response.ok) {
        const data = await response.json();
        if (data && !data.error) {
          setUser(data);
          localStorage.setItem('isAuthenticated', 'true');
          return;
        }
      }
      setUser(null);
      localStorage.removeItem('isAuthenticated');
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};