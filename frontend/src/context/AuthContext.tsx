import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: any;
  loading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/user', {
        credentials: 'include', // ОБЯЗАТЕЛЬНО для передачи куки сессии
      });
      if (response.ok) {
        const data = await response.json();
        if (data && !data.error) {
          setUser(data);
          localStorage.setItem('isAuthenticated', 'true');
        } else {
          setUser(null);
          localStorage.removeItem('isAuthenticated');
        }
      } else {
        setUser(null);
        localStorage.removeItem('isAuthenticated');
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, refresh: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
