import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,  // Timeout after 5 seconds
});

// Request interceptor: read token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Request Config:', config);  // Log request for debugging
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor: on 401, purge token + user and redirect
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and user data from localStorage on 401 error
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/doctor-login';
    }
    if (error.response?.status === 500) {
      // Handle server errors
      alert('Something went wrong, please try again later.');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (creds) => api.post('/auth/login', creds),
  register: (data) => api.post('/auth/register', data),
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Consultation API
export const consultationAPI = {
  create: (data) => api.post('/consultations', data),
  getAll: (filters = {}) => api.get('/consultations', { params: filters }),
  getById: (id) => api.get(`/consultations/${id}`),
  update: (id, data) => api.put(`/consultations/${id}`, data),
  delete: (id) => api.delete(`/consultations/${id}`),
  uploadVideo: (formData, onUploadProgress) =>
    api.post('/consultations/upload-video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
  getVideoUrl: (path) => api.get(`/consultations/video/${path}`),
};

export default api;
