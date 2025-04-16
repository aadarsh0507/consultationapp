import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/doctor-login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      return response;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  },

  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return response;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return response;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to get user data');
    }
  }
};

// Consultation API
export const consultationAPI = {
  create: async (consultationData) => {
    try {
      const response = await api.post('/consultations', consultationData);
      return response;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to create consultation');
    }
  },

  getAll: async () => {
    try {
      const response = await api.get('/consultations');
      return response;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to get consultations');
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/consultations/${id}`);
      return response;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to get consultation');
    }
  },

  update: async (id, consultationData) => {
    try {
      const response = await api.put(`/consultations/${id}`, consultationData);
      return response;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update consultation');
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/consultations/${id}`);
      return response;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete consultation');
    }
  },

  uploadVideo: async (formData) => {
    try {
      const response = await api.post('/consultations/upload-video', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload progress: ${percentCompleted}%`);
        }
      });
      return response;
    } catch (error) {
      console.error('Video upload error:', error);
      throw new Error(error.response?.data?.message || 'Failed to upload video');
    }
  },

  getVideoUrl: async (videoPath) => {
    try {
      const response = await api.get(`/consultations/video/${videoPath}`);
      return response.data.url;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to get video URL');
    }
  }
};

export default api; 