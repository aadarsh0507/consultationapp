import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// Request interceptor
// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Get the stored user data (e.g. after login)
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Only add token if user is not admin
    if (user?.role && user.role !== 'admin') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`; // Attach token for non-admin users
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error); // Forward any errors in the request
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response, // Pass response directly if no error
  (error) => {
    if (error.response?.status === 401) { // Unauthorized error
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Only clear the auth data if the user is not admin
      if (user?.role && user.role !== 'admin') {
        // Remove token and user data from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect to login page
        window.location.href = '/doctor-login'; 
      }
    }
    return Promise.reject(error); // Reject the error so it can be handled in your components
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

  getAll: async (filters = {}) => {
    try {
      const response = await api.get('/consultations', { params: filters });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message || 'Consultations fetched successfully'
      };
    } catch (error) {
      console.error('Error fetching consultations:', error.response || error);
      return {
        success: false,
        message: error.response?.data?.message || 'Unable to fetch consultations. Please try again later.',
        data: []
      };
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