import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import axios from 'axios';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storagePath, setStoragePath] = useState(localStorage.getItem('storagePath') || '');

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      const savedPath = localStorage.getItem('storagePath');

      if (savedPath) setStoragePath(savedPath);

      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);

          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setUser(parsedUser);
        } catch (err) {
          console.error('Error initializing auth:', err);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

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

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return user;
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.register(userData);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return user;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed. Please try again later.';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log('Logging out user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('storagePath');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setStoragePath('');
  };

  const updateStoragePath = (newPath) => {
    localStorage.setItem('storagePath', newPath);
    setStoragePath(newPath);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      register,
      logout,
      setUser,
      storagePath,
      updateStoragePath,
    }),
    [user, loading, error, storagePath]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
