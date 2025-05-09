import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { JournalEntryCreate, JournalEntryUpdate, User } from '../types';
import logger from '../utils/logger';

// Define environment-based API URL
const getApiUrl = () => {
  const ENV = process.env.NODE_ENV || 'development';
  
  if (ENV === 'production') {
    return 'https://vibes-api.example.com';
  } else if (ENV === 'staging') {
    return 'https://staging-vibes-api.example.com';
  } else {
    // Local development - use local IP for the backend
    const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8001';
    logger.info(`Using API URL: ${apiUrl}`);
    return apiUrl;
  }
};

// Create axios instance
export const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  // Temporarily force withCredentials to false for debugging CORS
  withCredentials: false, 
});

// Add request interceptor for authorization headers
api.interceptors.request.use(
  async (config) => {
    try {
      // Get the access token from storage
      const token = await AsyncStorage.getItem('access_token');
      
      // If token exists, add to headers
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      } else {
        logger.debug(`Unauthenticated API Request: ${config.method?.toUpperCase()} ${config.url}`);
      }
      
      // If sending FormData, remove the default Content-Type header
      // to let the browser/axios set the correct multipart/form-data with boundary
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
        logger.debug(`Removed Content-Type header for FormData request to ${config.url}`);
      }
      
      return config;
    } catch (error) {
      logger.error('API Interceptor Error', error);
      return config;
    }
  },
  (error) => {
    logger.error('API Request Error', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for handling token refresh and errors
api.interceptors.response.use(
  (response) => {
    logger.debug(`API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle CORS errors
    if (error.message && (
        error.message.includes('Network Error') || 
        error.message.includes('CORS') || 
        error.message.includes('blocked by CORS policy'))) {
      logger.error('CORS or Network Error', { 
        message: error.message,
        url: originalRequest?.url,
        method: originalRequest?.method
      });
      return Promise.reject({
        message: 'Network or CORS error. Check that the backend server is running and properly configured.',
        status: 0,
        originalError: error.message
      });
    }
    
    // Handle network errors
    if (!error.response) {
      logger.error('Network Error', { 
        url: originalRequest?.url,
        method: originalRequest?.method
      });
      return Promise.reject({
        message: 'Network error. Please check your connection and try again.',
        status: 0
      });
    }
    
    logger.error('API Error Response', {
      status: error.response?.status,
      url: originalRequest.url,
      method: originalRequest.method,
      data: error.response?.data
    });
    
    // Handle 401 (Unauthorized) errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        logger.info('Attempting token refresh');
        // Get refresh token
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          // No refresh token available, logout user
          logger.warn('No refresh token available, logging out user');
          await logout();
          return Promise.reject({
            message: 'Session expired. Please login again.',
            status: 401
          });
        }
        
        // Call token refresh endpoint
        const response = await axios.post(`${getApiUrl()}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });
        
        if (response.data.access_token) {
          logger.info('Token refresh successful');
          // Save new tokens
          await AsyncStorage.setItem('access_token', response.data.access_token);
          
          if (response.data.refresh_token) {
            await AsyncStorage.setItem('refresh_token', response.data.refresh_token);
          }
          
          // Update header for the instance defaults and the original request
          const newAccessToken = response.data.access_token;
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          
          // Create a new config for the retry based on the original request
          const retryConfig = {
            ...originalRequest,
            headers: {
              ...originalRequest.headers,
              Authorization: `Bearer ${newAccessToken}`,
            },
          };

          // Retry the original request using the base axios with the new config
          return axios(retryConfig);
        }
      } catch (refreshError) {
        // If refresh fails, logout user
        logger.error('Token refresh failed', refreshError);
        await logout();
        return Promise.reject({
          message: 'Session expired. Please login again.',
          status: 401
        });
      }
    }
    
    // Handle validation errors (422 Unprocessable Entity)
    if (error.response?.status === 422) {
      const responseData = error.response.data;
      
      if (responseData.errors && Array.isArray(responseData.errors)) {
        logger.warn('Validation Error', {
          errors: responseData.errors,
          url: originalRequest.url
        });
        return Promise.reject({
          message: responseData.detail || 'Validation error',
          errors: responseData.errors,
          status: 422
        });
      }
    }
    
    // Handle database connection errors
    if (error.response?.status === 500 && 
        error.response?.data?.detail && 
        typeof error.response.data.detail === 'string' &&
        error.response.data.detail.includes('connection to server')) {
      logger.error('Database Connection Error', {
        detail: error.response.data.detail,
        url: originalRequest.url
      });
      return Promise.reject({
        message: 'Database connection error. Please try again later.',
        originalError: error.response.data.detail,
        status: 500
      });
    }
    
    // Handle other errors with meaningful messages
    const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'An error occurred. Please try again.';
    logger.error('API Error', {
      message: errorMessage,
      url: originalRequest.url,
      status: error.response?.status
    });
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status
    });
  }
);

// Helper function to handle user logout
const logout = async () => {
  try {
    logger.info('Performing API logout');
    // Clear tokens from storage
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('user');
    
    // Clear authorization header
    delete api.defaults.headers.common.Authorization;
    
    // You might want to trigger navigation to login screen or auth context update
    // This would typically be done via an auth context
  } catch (error) {
    logger.error('Logout Error', error);
  }
};

// API endpoint functions

// Auth
export const AuthAPI = {
  login: (email: string, password: string) => 
    api.post('/api/auth/login/json', { email, password }),
  
  register: (name: string, email: string, password: string) => 
    api.post('/api/auth/register', { name, email, password }),
  
  googleAuth: (idToken: string) => 
    api.post('/api/auth/google', { id_token: idToken }),
  
  logout: () => api.post('/api/auth/logout'),
};

// User profile
export const UserAPI = {
  // Get current user profile
  getProfile: () => api.get('/api/users/me'),
  
  // Update user profile
  updateProfile: (data: {
    full_name?: string;
    email?: string;
    profile_picture?: string;
  }) => api.put('/api/users/me', data),
  
  // Update user password
  updatePassword: (data: {
    current_password: string;
    new_password: string;
  }) => api.put('/api/users/me/password', data),
  
  // Upload profile picture
  uploadProfilePicture: (imageFile: any) => {
    const formData = new FormData();
    formData.append('profile_picture', imageFile);
    
    return api.post('/api/users/me/profile-picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Journal entries
export const JournalAPI = {
  getEntries: (params?: { page?: number, limit?: number, tags?: string[] }) => 
    api.get('/api/journals', { params }),
  
  getEntry: (id: string) => 
    api.get(`/api/journals/${id}`),
  
  createEntry: (data: JournalEntryCreate) => api.post('/api/journals', data),
  
  updateEntry: (id: string, data: JournalEntryUpdate) => api.put(`/api/journals/${id}`, data),
  
  deleteEntry: (id: string) => 
    api.delete(`/api/journals/${id}`),
  
  searchEntries: (query: string) => api.get(`/api/journals/search?q=${query}`),
};

// Reminders
export const ReminderAPI = {
  getReminders: (params?: { page?: number, limit?: number, is_active?: boolean }) => 
    api.get('/api/reminders', { params }),
  
  getReminder: (id: string) => 
    api.get(`/api/reminders/${id}`),
  
  createReminder: (data: { title: string, note?: string, reminder_time: string, is_active: boolean }) => 
    api.post('/api/reminders', data),
  
  updateReminder: (id: string, data: { title?: string, note?: string, reminder_time?: string, is_active?: boolean }) => 
    api.put(`/api/reminders/${id}`, data),
  
  deleteReminder: (id: string) => 
    api.delete(`/api/reminders/${id}`),
};

// Tags
export const TagsAPI = {
  getTags: () => api.get('/api/journals/tags/'),
  
  getEntriesByTag: (tagName: string) => api.get(`/api/journals/tags/${tagName}/entries`),
};

// Audio transcription
export const TranscriptionAPI = {
  transcribeAudio: (audioFile: any) => {
    // Create form data for file upload
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    
    return api.post('/api/transcriptions', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default {
  auth: AuthAPI,
  user: UserAPI,
  journal: JournalAPI,
  tags: TagsAPI,
  transcription: TranscriptionAPI,
  reminder: ReminderAPI,
};