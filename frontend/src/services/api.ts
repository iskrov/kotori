import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { JournalEntryCreate, JournalEntryUpdate, User, Tag } from '../types';
import logger from '../utils/logger';
import { OPAQUE_AUTH_API_URL } from '../../constants/opaque';

const getApiUrl = (): string => {
  const hostname = typeof window !== 'undefined' && window.location.hostname;

  // Always use HTTPS for production domains
  if (hostname && (hostname === 'app.kotori.io' || hostname === 'kotori.io' || hostname === 'www.kotori.io')) {
    return 'https://api.kotori.io';
  }
  
  // Check if we're on the Cloud Run URL
  if (hostname && hostname.includes('run.app')) {
    return 'https://api.kotori.io';
  }
  
  // For local development, allow environment variable override, but default to localhost
  return (Constants.expoConfig?.extra?.apiUrl as string | undefined) || 'http://localhost:8001';
};

export const getWebSocketUrl = (): string => {
    const hostname = typeof window !== 'undefined' && window.location.hostname;

    // Always use WSS for production domains
    if (hostname && (hostname === 'app.kotori.io' || hostname === 'kotori.io' || hostname === 'www.kotori.io')) {
        return 'wss://api.kotori.io';
    }
    
    // Check if we're on the Cloud Run URL
    if (hostname && hostname.includes('run.app')) {
        return 'wss://api.kotori.io';
    }

    // Local development
    let apiUrl = getApiUrl();
    // Replace http with ws for websocket connection
    return apiUrl.replace(/^http/, 'ws');
};


// Create axios instance - always use HTTPS for production
const initialApiUrl = getApiUrl();
// API instance created with baseURL: ${initialApiUrl}

// Create the axios instance
export const api = axios.create({
  withCredentials: true, // Important for cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Set the baseURL dynamically based on the current hostname
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (hostname === 'app.kotori.io' || hostname === 'kotori.io' || hostname === 'www.kotori.io' || hostname.includes('run.app')) {
    api.defaults.baseURL = 'https://api.kotori.io';

  } else {
    api.defaults.baseURL = initialApiUrl;

  }
} else {
  api.defaults.baseURL = initialApiUrl;
}

// Interceptor to always enforce HTTPS for the production API.
// This is a safety net for any case where the baseURL might be http.
api.interceptors.request.use((config) => {
    // If we're on a production domain, ALWAYS force HTTPS
    const hostname = typeof window !== 'undefined' && window.location.hostname;
    if (hostname && (hostname === 'app.kotori.io' || hostname === 'kotori.io' || hostname === 'www.kotori.io' || hostname.includes('run.app'))) {
      config.baseURL = 'https://api.kotori.io';
    }
    
    // Ensure no HTTP URLs slip through anywhere
    if (config.baseURL && config.baseURL.includes('api.kotori.io')) {
      config.baseURL = config.baseURL.replace('http://', 'https://');
    }
    if (typeof config.url === 'string' && config.url.includes('http://api.kotori.io')) {
      config.url = config.url.replace('http://', 'https://');
    }
    
    // Final safety check for constructed URLs
    const constructedUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
    if (constructedUrl && constructedUrl.startsWith('http://api.kotori.io')) {
      config.baseURL = 'https://api.kotori.io';
      if (config.url && config.url.includes('api.kotori.io')) {
        config.url = config.url.replace(/^https?:\/\/[^\/]+/, '');
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
      logger.info(`API Response: 401 Unauthorized for ${originalRequest.url}. Checking authentication type.`);
      
      try {
        // Check if we have OPAQUE authentication (no refresh token)
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        const accessToken = await AsyncStorage.getItem('access_token');
        
        if (!refreshToken && accessToken) {
          // OPAQUE authentication - no refresh tokens available
          logger.warn('OPAQUE authentication detected (no refresh token). User needs to re-authenticate.');
          await logout();
          return Promise.reject({
            message: 'Session expired. Please login again.',
            status: 401
          });
        }
        
        if (!refreshToken) {
          // No refresh token available, logout user
          logger.warn('No refresh token available, logging out user');
          await logout();
          return Promise.reject({
            message: 'Session expired. No refresh token. Please login again.',
            status: 401
          });
        }
        
        // Traditional authentication - attempt token refresh
        logger.info('Attempting token refresh');
        logger.info(`Calling /api/v1/auth/refresh with refresh token: ${refreshToken ? refreshToken.substring(0, 10) + '...' : 'null'}`);
        const response = await axios.post(`${getApiUrl()}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });
        
        if (response.data.access_token) {
          logger.info('Token refresh successful. New access token received.');
          // Save new tokens
          await AsyncStorage.setItem('access_token', response.data.access_token);
          
          if (response.data.refresh_token) {
            await AsyncStorage.setItem('refresh_token', response.data.refresh_token);
            logger.info('New refresh token also received and stored.');
          }
          
          // Update header for the instance defaults and the original request
          const newAccessToken = response.data.access_token;
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          logger.info(`Retrying original request to ${originalRequest.url} with new token.`);
          
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
      } catch (refreshError: any) {
        // If refresh fails, logout user
        logger.error('Token refresh failed', { 
          message: refreshError.message, 
          status: refreshError.response?.status,
          data: refreshError.response?.data 
        });
        await logout();
        return Promise.reject({
          message: 'Session expired. Token refresh failed. Please login again.',
          status: 401,
          originalError: refreshError.message
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

// Auth - Dual Authentication System (OAuth + OPAQUE)
export const AuthAPI = {
  // Legacy password login - deprecated, use OPAQUE instead
  login: (email: string, password: string) => 
    api.post('/api/auth/login/json', { email, password }),
  
  // Legacy password register - deprecated, use OPAQUE instead  
  register: (name: string, email: string, password: string) => 
    api.post('/api/auth/register', { name, email, password }),
  
  // OAuth Google Authentication (V1)
  googleAuth: (idToken: string) => 
    api.post('/api/v1/auth/google', { id_token: idToken }),
  
  // Logout (V1)
  logout: () => api.post('/api/v1/auth/logout'),
};

// User profile
export const UserAPI = {
  // Get current user profile
  getProfile: () => api.get('/api/users/me'),
  
  // Update user profile
  updateProfile: (data: {
    full_name?: string;
    email?: string;
    avatar_url?: string;
  }) => api.put('/api/users/me', data),
  
  // Update user password
  updatePassword: (data: {
    current_password: string;
    new_password: string;
  }) => api.put('/api/users/me/password', data),
  
  // Upload avatar
  uploadAvatar: (imageFile: any) => {
    const formData = new FormData();
    formData.append('avatar', imageFile);
    
    return api.post('/api/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  updateMe: (data: Partial<User>) =>
    api.put('/api/users/me', data),
};

// Journal entries
export const JournalAPI = {
  getEntries: (params: any) => 
    api.get('/api/v1/journals/', { params }),
  
  getEntry: (id: string) => 
    api.get(`/api/v1/journals/${id}`),
  
  // Use trailing slash for POST to avoid 405 due to strict slash matching
  createEntry: (data: JournalEntryCreate) => 
    api.post('/api/v1/journals/', data),

  // Enhanced method for creating encrypted secret tag entries (legacy secret tags)
  createEncryptedEntry: (data: {
    title?: string;
    encrypted_content: string;    // Base64 encrypted content
    encrypted_key: string;        // Base64 wrapped entry key
    iv: string;                   // Base64 IV
    salt: string;                 // Base64 salt
    algorithm: string;            // Encryption algorithm
    wrapIv: string;               // Base64 IV used for key wrapping
    entry_date?: string;
    audio_url?: string;
    tags?: string[];
    secret_tag_id?: string;       // Secret tag ID
    secret_tag_hash?: string;     // Secret tag hash for server filtering
  }) => api.post('/api/journals', {
    title: data.title || '',
    content: "",  // No plaintext content for secret tag entries
    encrypted_content: data.encrypted_content,
    encryption_iv: data.iv,
    encryption_salt: data.salt,
    encrypted_key: data.encrypted_key,
    key_derivation_iterations: 100000,  // Default iterations (legacy)
    encryption_algorithm: data.algorithm,
    encryption_wrap_iv: data.wrapIv,
    entry_date: data.entry_date || new Date().toISOString(),
    audio_url: data.audio_url,
    tags: data.tags || [],
    secret_tag_id: data.secret_tag_id,
    secret_tag_hash: data.secret_tag_hash,
  }),
  
  updateEntry: (id: string, data: JournalEntryUpdate) => 
    api.put(`/api/v1/journals/${id}`, data),
  
  deleteEntry: (id: string) => 
    api.delete(`/api/v1/journals/${id}`),
  
  searchEntries: (query: string) => 
    api.get('/api/v1/journals/search', { params: { q: query } }),

  // Get entries by secret tag (for specific tag filtering)
  getEntriesBySecretTag: (secretTagHash: string, params?: { skip?: number, limit?: number }) =>
    api.get(`/api/journals/secret-tag/${secretTagHash}`, { params }),
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
  getTags: () => api.get('/api/tags'),
  
  getRecentTags: (limit: number = 5) => api.get('/api/tags/recent', { params: { limit } }),
  
  getEntriesByTag: (tagName: string) => api.get(`/api/tags/${tagName}/entries`),
  
  createTag: async (tag: { name: string; color?: string }) => {
    const response = await api.post('/api/tags', tag);
    return response.data;
  },
  
  updateTag: async (id: string, updates: Partial<Tag>) => {
    const response = await api.put(`/api/tags/${id}`, updates);
    return response.data;
  },
  
  deleteTag: async (id: string) => {
    logger.info(`API: Attempting to delete tag with ID: ${id}`);
    logger.info(`API: DELETE request to: /api/tags/${id}`);
    const response = await api.delete(`/api/tags/${id}`);
    logger.info(`API: Delete tag response:`, response.data);
    return response.data;
  },
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

export const SecretTagAPI = {
  delete: (tagId: string) => {
    logger.info(`Sending API request to delete secret tag: ${tagId}`);
    return api.delete(`/api/v1/secret-tags/${tagId}`);
  },
};

export default {
  auth: AuthAPI,
  user: UserAPI,
  journal: JournalAPI,
  tags: TagsAPI,
  transcription: TranscriptionAPI,
  reminder: ReminderAPI,
  secretTag: SecretTagAPI,
};