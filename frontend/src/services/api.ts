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
  // Enable credentials for CORS
  withCredentials: true, 
});

// Debug axios configuration
console.log('API Config:', {
  baseURL: getApiUrl(),
  withCredentials: true,
  defaultHeaders: api.defaults.headers
});

// Add specific debug configuration for handling PUT requests
api.interceptors.request.use(
  async (config) => {
    // If this is a PUT request, add extra debug info
    if (config.method?.toLowerCase() === 'put') {
      console.log('Making PUT request to:', config.url);
      console.log('PUT request headers:', config.headers);
      console.log('PUT request withCredentials:', config.withCredentials);
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
      logger.info(`API Response: 401 Unauthorized for ${originalRequest.url}. Attempting token refresh.`);
      
      try {
        logger.info('Attempting token refresh');
        // Get refresh token
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          // No refresh token available, logout user
          logger.warn('No refresh token available, logging out user');
          await logout();
          return Promise.reject({
            message: 'Session expired. No refresh token. Please login again.',
            status: 401
          });
        }
        
        // Call token refresh endpoint
        logger.info(`Calling /api/auth/refresh with refresh token: ${refreshToken ? refreshToken.substring(0, 10) + '...' : 'null'}`);
        const response = await axios.post(`${getApiUrl()}/api/auth/refresh`, {
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
  getEntries: (params?: { 
    page?: number, 
    limit?: number, 
    tags?: string[], 
    entry_date?: string,
    include_hidden?: boolean  // Add support for hidden entries
  }) => api.get('/api/journals', { params }),
  
  getEntry: (id: string) => 
    api.get(`/api/journals/${id}`),
  
  createEntry: (data: JournalEntryCreate) => api.post('/api/journals', data),

  // New method for creating encrypted hidden entries
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
  }) => api.post('/api/journals', {
    title: data.title || '',
    content: "",  // No plaintext content for hidden entries
    is_hidden: true,
    encrypted_content: data.encrypted_content,
    encryption_iv: data.iv,
    encryption_salt: data.salt,
    encrypted_key: data.encrypted_key,
    key_derivation_iterations: 100000,  // Default iterations
    encryption_algorithm: data.algorithm,
    encryption_wrap_iv: data.wrapIv,
    entry_date: data.entry_date || new Date().toISOString(),
    audio_url: data.audio_url,
    tags: data.tags || [],
  }),
  
  updateEntry: (id: string, data: JournalEntryUpdate) => {
    console.log('JournalAPI.updateEntry called with data:', JSON.stringify(data));
    // Make a defensive copy of data
    const sanitizedData = { ...data };
    
    // Ensure entry_date is present
    if (!sanitizedData.entry_date) {
      console.error('Warning: Missing entry_date in updateEntry', sanitizedData);
      
      // Fetch the entry to get its entry_date if missing
      return api.get(`/api/journals/${id}`).then(response => {
        const existingEntry = response.data;
        sanitizedData.entry_date = existingEntry.entry_date;
        
        console.log('JournalAPI.updateEntry: Added entry_date from fetched entry:', sanitizedData.entry_date);
        
        // Continue with tags handling and update
        return processUpdateWithTags(id, sanitizedData);
      }).catch(error => {
        console.error('Failed to fetch journal entry for update:', error);
        throw new Error(`Failed to prepare journal entry update: ${error.message}`);
      });
    } else {
      // If entry_date is already present, just process tags and update
      return processUpdateWithTags(id, sanitizedData).catch(error => {
        console.error('Failed to update journal entry with processUpdateWithTags:', error);
        
        // Last resort fallback - try a direct fetch API call
        if (error.message && error.message.includes('CORS')) {
          console.log('Attempting final fallback with fetch API for CORS issues');
          return AsyncStorage.getItem('access_token').then(token => {
            const apiUrl = getApiUrl();
            const url = `${apiUrl}/api/journals/${id}`;
            
            // Process tags one more time to ensure they're strings
            if (sanitizedData.tags && Array.isArray(sanitizedData.tags)) {
              sanitizedData.tags = sanitizedData.tags.map((tag: any) => 
                typeof tag === 'string' ? tag : (tag && typeof tag === 'object' && 'name' in tag) ? tag.name : String(tag)
              );
            }
            
            return fetch(url, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
              },
              credentials: 'include',
              body: JSON.stringify(sanitizedData)
            }).then(response => {
              if (!response.ok) {
                throw new Error(`Fetch API error: ${response.status} ${response.statusText}`);
              }
              return response.json();
            });
          });
        }
        
        throw error; // Re-throw if not a CORS issue or if fetch also fails
      });
    }
  },
  
  deleteEntry: (id: string) => {
    console.log(`[JournalAPI.deleteEntry] Deleting entry with ID: ${id}`);
    const deletePromise = api.delete(`/api/journals/${id}`);
    deletePromise.then(result => {
      console.log(`[JournalAPI.deleteEntry] Delete successful for ID ${id}:`, result);
    }).catch(error => {
      console.error(`[JournalAPI.deleteEntry] Delete failed for ID ${id}:`, error);
    });
    return deletePromise;
  },
  
  searchEntries: (query: string, includeHidden?: boolean) => 
    api.get(`/api/journals/search?q=${query}${includeHidden ? '&include_hidden=true' : ''}`),

  // Get only hidden entries (encrypted content)
  getHiddenEntries: (params?: { skip?: number, limit?: number }) =>
    api.get('/api/journals/hidden', { params }),
};

// Helper function to process tags and send the update
const processUpdateWithTags = (id: string, sanitizedData: JournalEntryUpdate) => {
  // Ensure tags is properly formatted as string[]
  if (sanitizedData.tags) {
    // Make sure tags is an array of strings by extracting tag names
    const stringTags = sanitizedData.tags.map((tag: string | {name: string}) => {
      // If tag is already a string, use it directly
      if (typeof tag === 'string') {
        return tag;
      }
      
      // If tag is an object with name property, extract the name
      if (typeof tag === 'object' && tag !== null && 'name' in tag) {
        return tag.name;
      }
      
      // Fallback to string representation (should not happen)
      console.error('JournalAPI.updateEntry: Unexpected tag format:', tag);
      return String(tag);
    });
    
    sanitizedData.tags = stringTags;
    console.log('JournalAPI.updateEntry: Properly extracted tag names:', JSON.stringify(stringTags));
  }
  
  console.log('JournalAPI.updateEntry: Sending payload for api.put:', JSON.stringify(sanitizedData));
  return api.put(`/api/journals/${id}`, sanitizedData);
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