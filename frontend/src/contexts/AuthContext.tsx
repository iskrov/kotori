import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '../services/api';
import { User } from '../types';
import logger from '../utils/logger';
import { opaqueAuth, OpaqueSessionResult, OpaqueLoginResult } from '../services/opaqueAuth';
import { opaqueKeyManager } from '../services/opaqueKeyManager';

// OPAQUE-only Authentication Context
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialLoading: boolean;
  user: User | null;
  logout: () => Promise<void>;
  updateUser: (updatedUserData: Partial<User>) => Promise<void>;
  // OPAQUE zero-knowledge authentication methods
  opaqueLogin: (email: string, password: string) => Promise<void>;
  opaqueRegister: (name: string, email: string, password: string) => Promise<void>;
  hasOpaqueSupport: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  // Check for existing OPAQUE session on startup
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        logger.info('Checking OPAQUE authentication status');
        
        const token = await AsyncStorage.getItem('access_token');
        const storedUser = await AsyncStorage.getItem('user');
        
        if (token) {
          logger.info('OPAQUE session token found. Verifying...');
          // Set authorization header for API requests
          api.defaults.headers.common.Authorization = `Bearer ${token}`;
          // Mark as authenticated
          setIsAuthenticated(true);
          
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              setUser(userData);
              logger.info('Loaded user data from OPAQUE session:', { userId: userData.id });
            } catch (parseError) {
              logger.error('Failed to parse stored user data', parseError);
              setUser(null);
            }
          } else {
             setUser(null);
          }
          
        } else {
          // No token found, ensure logged out state
          setIsAuthenticated(false);
          setUser(null);
          delete api.defaults.headers.common.Authorization;
          logger.info('No OPAQUE session token found');
        }
      } catch (error) {
        logger.error('OPAQUE authentication check failed:', error);
        // Clear tokens on error
        try {
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem('user');
          delete api.defaults.headers.common.Authorization;
          await opaqueAuth.clearOpaqueData();
          opaqueKeyManager.clear();
        } catch (e) {
          logger.error('Failed to clear auth data:', e);
        }
      } finally {
        setIsLoading(false);
        setIsInitialLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Logout - Clear all OPAQUE data
  const logout = async () => {
    try {
      logger.info('Logging out OPAQUE user', { userId: user?.id });
      setIsLoading(true);
      
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
      logger.info('OPAQUE logout successful - all auth data cleared');
    } catch (error: any) {
      logger.error('OPAQUE logout failed:', { 
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
      logger.info('OPAQUE logout successful - all auth data cleared (fallback)');
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
    }
  };

  // OPAQUE login with zero-knowledge authentication
  const opaqueLogin = async (email: string, password: string) => {
    try {
      logger.info(`OPAQUE login attempt for ${email}`);
      setIsLoading(true);
      
      // Perform OPAQUE authentication - this now returns the login response with JWT token
      const loginResponse: OpaqueLoginResult = await opaqueAuth.login(email, password);
      
      // Initialize key manager with OPAQUE session keys
      // Note: We don't need the finishLoginRequest here as it's already been used
      opaqueKeyManager.initialize({
        sessionKey: loginResponse.sessionKey,
        exportKey: loginResponse.exportKey,
        finishLoginRequest: '' // Not needed for key manager initialization
      });
      
      // Use JWT token for API authentication
      api.defaults.headers.common.Authorization = `Bearer ${loginResponse.token}`;
      
      logger.info('OPAQUE login successful', { userId: loginResponse.user.id });
      
      // Ensure user data has proper date fields (convert null to empty string if needed)
      const userData = {
        ...loginResponse.user,
        created_at: loginResponse.user.created_at || new Date().toISOString(),
        updated_at: loginResponse.user.updated_at || new Date().toISOString()
      };
      
      // Store JWT token and user data
      await AsyncStorage.setItem('access_token', loginResponse.token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
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
      
      // Perform OPAQUE registration only - don't auto-login
      await opaqueAuth.register(name, email, password);
      
      logger.info('OPAQUE registration successful');
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
      const response = await api.get('/api/auth/opaque/status');
      return response.data.opaque_enabled === true;
    } catch (error) {
      logger.warn('OPAQUE support check failed, assuming not supported', error);
      return false;
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    isInitialLoading,
    user,
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