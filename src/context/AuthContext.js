import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeAuth = () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          console.log('Initializing auth with user:', parsedUser);
          setUser(parsedUser);
        } catch (err) {
          console.error('Error parsing user data:', err);
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
      console.log('Login attempt with credentials:', credentials);

      // Check for admin credentials
      if (credentials.doctorId === 'admin' && credentials.password === 'admin123') {
        console.log('Admin login detected');
        const adminUser = {
          _id: 'admin',
          name: 'Administrator',
          role: 'admin',
          doctorId: 'admin',
          permissions: {
            canManageUsers: true,
            canManageSettings: true,
            canViewReports: true,
            canManageStorage: true
          }
        };
        
        console.log('Setting admin user data');
        localStorage.setItem('token', 'admin-token');
        localStorage.setItem('user', JSON.stringify(adminUser));
        setUser(adminUser);
        console.log('Admin login successful, user set:', adminUser);
        return adminUser;
      }

      console.log('Attempting regular doctor login');
      // Regular doctor login
      const response = await authAPI.login(credentials);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      return user;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Login failed');
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
      setUser(user);
      return user;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log('Logging out user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    setUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 