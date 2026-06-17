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
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      await ensureCsrfToken();
      const response = await fetchWithCsrf('/api/user/me');
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

  const logout = () => {
    setUser(null);
    localStorage.removeItem('isAuthenticated');
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};