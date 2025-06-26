import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { AuthAPI, api } from '../services/api';
import { User } from '../types';
import logger from '../utils/logger';
import { opaqueAuth, OpaqueSessionResult } from '../services/opaqueAuth';
import { opaqueKeyManager } from '../services/opaqueKeyManager';

// Security: Remove debug storage function - not safe for production

// Ensure web browser redirect results are handled
WebBrowser.maybeCompleteAuthSession();

// User interface
// interface User {
//   id: string;
//   name: string;
//   email: string;
//   avatar_url?: string;
// }

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  handleGoogleAuth: (idToken: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUserData: Partial<User>) => Promise<void>;
  // OPAQUE-specific methods
  opaqueLogin: (email: string, password: string) => Promise<void>;
  opaqueRegister: (name: string, email: string, password: string) => Promise<void>;
  hasOpaqueSupport: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Google OAuth configuration
const googleClientId = Constants.expoConfig?.extra?.googleClientId || '';
const googleIosClientId = Constants.expoConfig?.extra?.googleIosClientId || '';
const googleAndroidClientId = Constants.expoConfig?.extra?.googleAndroidClientId || '';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Google OAuth setup
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: googleClientId,
    iosClientId: googleIosClientId,
    androidClientId: googleAndroidClientId,
    webClientId: googleClientId,
  });
  
  // Check for existing token on startup
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        logger.info('Checking authentication status');
        
        const token = await AsyncStorage.getItem('access_token');
        const storedUser = await AsyncStorage.getItem('user');
        
        if (token) {
          logger.info('Access token found. Assuming authenticated for now.');
          // Set authorization header for API requests
          api.defaults.headers.common.Authorization = `Bearer ${token}`;
          // Mark as authenticated. We can add profile fetching later.
          setIsAuthenticated(true);
          // Optionally load stored user data if available
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              setUser(userData);
              logger.info('Loaded user data from storage:', { userId: userData.id });
            } catch (parseError) {
              logger.error('Failed to parse stored user data', parseError);
              setUser(null); // Clear user if parsing fails
            }
          } else {
             setUser(null); // No stored user data
          }
          
        } else {
          // No token found, ensure logged out state
          setIsAuthenticated(false);
          setUser(null);
          delete api.defaults.headers.common.Authorization;
          logger.info('No authentication token found');
        }
      } catch (error) {
        logger.error('Authentication check failed:', error);
        // Clear tokens on error
        try {
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem('user');
          delete api.defaults.headers.common.Authorization;
        } catch (e) {
          logger.error('Failed to clear auth data:', e);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Handle Google authentication response
  useEffect(() => {
    if (response?.type === 'success') {
      logger.info('Google auth response received', { type: response.type });
      const { authentication } = response;
      if (authentication?.idToken) {
        logger.info('Google auth token received, processing');
        handleGoogleAuth(authentication.idToken);
      } else {
        logger.warn('Google auth response missing ID token');
      }
    } else if (response?.type === 'error') {
      logger.error('Google auth error', { error: response.error });
    }
  }, [response]);
  
  // Login with email and password
  const login = async (email: string, password: string) => {
    try {
      logger.info(`Login attempt for ${email}`);
      setIsLoading(true);
      const response = await AuthAPI.login(email, password);
      
      logger.info('Login successful', { userId: response.data.user?.id });
      await AsyncStorage.setItem('access_token', response.data.access_token);
      await AsyncStorage.setItem('refresh_token', response.data.refresh_token);
      
      // Set authorization header for API requests
      api.defaults.headers.common.Authorization = `Bearer ${response.data.access_token}`;
      
      setUser(response.data.user);
      setIsAuthenticated(true);
      // Save user data to storage
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    } catch (error: any) {
      logger.error('Login failed:', { 
        email,
        status: error.status,
        message: error.message,
        response: error.response?.data
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Google login - Trigger Google auth flow
  const googleLogin = async () => {
    try {
      logger.info('Starting Google login flow');
      await promptAsync();
    } catch (error) {
      logger.error('Google auth prompt failed:', error);
      throw error;
    }
  };

  // Handle Google auth
  const handleGoogleAuth = async (idToken: string) => {
    try {
      logger.info('Processing Google authentication with token');
      setIsLoading(true);
      const response = await AuthAPI.googleAuth(idToken);
      
      logger.info('Google login successful', { userId: response.data.user?.id });
      await AsyncStorage.setItem('access_token', response.data.access_token);
      await AsyncStorage.setItem('refresh_token', response.data.refresh_token);
      
      // Set authorization header for API requests
      api.defaults.headers.common.Authorization = `Bearer ${response.data.access_token}`;
      
      setUser(response.data.user);
      setIsAuthenticated(true);
      // Save user data to storage
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    } catch (error: any) {
      logger.error('Google login failed:', { 
        status: error.status,
        message: error.message,
        response: error.response?.data
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register new user
  const register = async (name: string, email: string, password: string) => {
    try {
      logger.info(`Registration attempt for ${email}`);
      setIsLoading(true);
      const response = await AuthAPI.register(name, email, password);
      
      logger.info('Registration successful', { userId: response.data.user?.id });
      await AsyncStorage.setItem('access_token', response.data.access_token);
      await AsyncStorage.setItem('refresh_token', response.data.refresh_token);
      
      // Set authorization header for API requests
      api.defaults.headers.common.Authorization = `Bearer ${response.data.access_token}`;
      
      setUser(response.data.user);
      setIsAuthenticated(true);
      // Save user data to storage
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    } catch (error: any) {
      logger.error('Registration failed:', { 
        email,
        status: error.status,
        message: error.message,
        response: error.response?.data
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      logger.info('Logging out user', { userId: user?.id });
      setIsLoading(true);
      
      await AuthAPI.logout();
      
      // Clear all authentication data from storage
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('user');
      
      // Clear OPAQUE data
      await opaqueAuth.clearOpaqueData();
      opaqueKeyManager.clear();
      
      // Clear API authorization header
      delete api.defaults.headers.common.Authorization;
      logger.info('API authorization header cleared');
      
      setUser(null);
      setIsAuthenticated(false);
      logger.info('Logout successful - all auth data cleared');
    } catch (error: any) {
      logger.error('Logout failed:', { 
        userId: user?.id,
        status: error.status,
        message: error.message
      });
      
      // Even if server logout fails, remove all auth data
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('user');
      
      // Clear OPAQUE data
      await opaqueAuth.clearOpaqueData();
      opaqueKeyManager.clear();
      
      // Clear API authorization header
      delete api.defaults.headers.common.Authorization;
      
      setUser(null);
      setIsAuthenticated(false);
      logger.info('Logout successful - all auth data cleared (fallback)');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to update local user state and storage
  const updateUser = async (updatedUserData: Partial<User>) => {
    if (!user) return; // Only update if a user is currently logged in
    
    try {
      const newUser = { ...user, ...updatedUserData };
      setUser(newUser);
      // Update user data in storage as well
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      logger.info('Local user state updated', newUser);
    } catch (error) {
      logger.error('Failed to update local user state or storage', error);
      // Optionally re-throw or handle the error
    }
  };

  // OPAQUE login with zero-knowledge authentication
  const opaqueLogin = async (email: string, password: string) => {
    try {
      logger.info(`OPAQUE login attempt for ${email}`);
      setIsLoading(true);
      
      // Perform OPAQUE authentication
      const sessionResult: OpaqueSessionResult = await opaqueAuth.login(email, password);
      
      // Initialize key manager with derived keys
      opaqueKeyManager.initialize(sessionResult);
      
      // Use session key for API authentication
      const sessionKeyBase64 = btoa(String.fromCharCode(...sessionResult.sessionKey));
      
      // Set authorization header with session key
      api.defaults.headers.common.Authorization = `Bearer ${sessionKeyBase64}`;
      
      // Get user data from server (using session key for auth)
      const userResponse = await api.get('/api/auth/me');
      
      logger.info('OPAQUE login successful', { userId: userResponse.data.id });
      
      // Store session key as access token for compatibility
      await AsyncStorage.setItem('access_token', sessionKeyBase64);
      await AsyncStorage.setItem('user', JSON.stringify(userResponse.data));
      
      setUser(userResponse.data);
      setIsAuthenticated(true);
    } catch (error: any) {
      logger.error('OPAQUE login failed:', { 
        email,
        status: error.status,
        message: error.message,
        response: error.response?.data
      });
      // Clear key manager on failure
      opaqueKeyManager.clear();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // OPAQUE registration with zero-knowledge authentication
  const opaqueRegister = async (name: string, email: string, password: string) => {
    try {
      logger.info(`OPAQUE registration attempt for ${email}`);
      setIsLoading(true);
      
      // Perform OPAQUE registration
      await opaqueAuth.register(name, email, password);
      
      // After successful registration, perform login to get session keys
      await opaqueLogin(email, password);
      
      logger.info('OPAQUE registration and login successful');
    } catch (error: any) {
      logger.error('OPAQUE registration failed:', { 
        email,
        status: error.status,
        message: error.message,
        response: error.response?.data
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if OPAQUE is supported and available
  const hasOpaqueSupport = async (): Promise<boolean> => {
    try {
      // Check if server supports OPAQUE endpoints
      const response = await api.get('/api/auth/opaque/support');
      return response.data.supported === true;
    } catch (error) {
      logger.warn('OPAQUE support check failed, assuming not supported', error);
      return false;
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    login,
    googleLogin,
    handleGoogleAuth,
    register,
    logout,
    updateUser,
    opaqueLogin,
    opaqueRegister,
    hasOpaqueSupport,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;