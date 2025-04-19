import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storagePath, setStoragePath] = useState(localStorage.getItem('storagePath') || '');

  // Initialize auth: restore token and fetch user
  useEffect(() => {
    async function initialize() {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        setToken(savedToken);
        try {
          const { data } = await authAPI.getCurrentUser();
          setUser(data.user);
        } catch (err) {
          console.error('Session fetch failed:', err);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      const savedPath = localStorage.getItem('storagePath');
      if (savedPath) setStoragePath(savedPath);
      setLoading(false);
    }
    initialize();
  }, []);

  const login = async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      // Admin override logic
      if (
        credentials.doctorId?.toLowerCase() === 'admin' &&
        credentials.password === 'admin123'
      ) {
        const adminUser = {
          _id: 'admin',
          name: 'Administrator',
          role: 'admin',
          doctorId: 'admin',
          permissions: {
            canManageUsers: true,
            canManageSettings: true,
            canViewReports: true,
            canManageStorage: true,
          },
        };
        localStorage.setItem('user', JSON.stringify(adminUser));
        setUser(adminUser);
        return adminUser;
      }

      const response = await authAPI.login(credentials);
      const { token, user } = response.data;

      // Persist session
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);

      return user;
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.register(userData);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);

      return user;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      console.error('Logout failed:', e);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('storagePath');
    setToken(null);
    setUser(null);
    setStoragePath('');
  };

  const updateStoragePath = useCallback((newPath) => {
    localStorage.setItem('storagePath', newPath);
    setStoragePath(newPath);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, error, login, register, logout, storagePath, updateStoragePath }),
    [user, token, loading, error, storagePath, login, updateStoragePath] // Add dependencies here
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
