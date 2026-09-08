import React, { createContext, useContext, useState, useEffect } from 'react';

// Simple mock user type since we are using local auth
export interface User {
  uid: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email?: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session (mock)
    const storedUser = localStorage.getItem('visa_manager_user');
    const storedToken = localStorage.getItem('visa_manager_token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    } else {
      localStorage.removeItem('visa_manager_user');
      localStorage.removeItem('visa_manager_token');
      setUser(null);
    }
    setLoading(false);
  }, []);

  const signIn = async (email?: string, password?: string) => {
    try {
      if (email === 'admin@visamanager.pro' && password === 'admin123') {
        const mockUser = { uid: 'admin-1', email, displayName: 'Administrateur' };
        localStorage.setItem('visa_manager_token', 'mock-token-for-supabase-migration');
        localStorage.setItem('visa_manager_user', JSON.stringify(mockUser));
        setUser(mockUser);
      } else {
        throw new Error('Identifiants incorrects');
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('visa_manager_token');
    localStorage.removeItem('visa_manager_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
