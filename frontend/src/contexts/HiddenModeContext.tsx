/**
 * Hidden Mode Context with Zero-Knowledge Encryption
 * 
 * This context manages hidden mode state and handles client-side encryption
 * using user-controlled secrets that never leave the device.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import clientEncryption from '../services/clientEncryption';
import logger from '../utils/logger';

interface HiddenModeContextValue {
  // State
  isHiddenMode: boolean;
  isSetupRequired: boolean;
  isUnlocked: boolean;
  
  // Actions
  setupHiddenMode: (userSecret: string) => Promise<void>;
  unlockHiddenMode: (userSecret: string) => Promise<boolean>;
  lockHiddenMode: () => void;
  clearHiddenMode: () => Promise<void>;
  
  // Encryption utilities
  encryptContent: (content: string) => Promise<{ encryptedContent: string; iv: string; salt: string }>;
  decryptContent: (encryptedContent: string, iv: string, salt?: string) => Promise<string>;
  
  // Session management
  sessionTimeoutMinutes: number;
  setSessionTimeout: (minutes: number) => void;
  extendSession: () => void;
  getRemainingSessionTime: () => number;
}

const HiddenModeContext = createContext<HiddenModeContextValue | undefined>(undefined);

interface HiddenModeProviderProps {
  children: React.ReactNode;
}

export const HiddenModeProvider: React.FC<HiddenModeProviderProps> = ({ children }) => {
  const [isHiddenMode, setIsHiddenMode] = useState(false);
  const [isSetupRequired, setIsSetupRequired] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [userSecret, setUserSecret] = useState<string | null>(null);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(2);
  const [sessionEndTime, setSessionEndTime] = useState<number | null>(null);
  const [sessionTimer, setSessionTimer] = useState<NodeJS.Timeout | null>(null);

  // Storage keys
  const HIDDEN_MODE_SETUP_KEY = 'hidden_mode_setup_completed';
  const VERIFICATION_DATA_KEY = 'hidden_mode_verification';
  const SESSION_TIMEOUT_KEY = 'hidden_mode_session_timeout';

  /**
   * Check if hidden mode has been set up
   */
  const checkSetupStatus = useCallback(async () => {
    try {
      const setupCompleted = await AsyncStorage.getItem(HIDDEN_MODE_SETUP_KEY);
      const verificationData = await AsyncStorage.getItem(VERIFICATION_DATA_KEY);
      
      setIsSetupRequired(!(setupCompleted === 'true' && verificationData));
      
      // Load session timeout preference
      const storedTimeout = await AsyncStorage.getItem(SESSION_TIMEOUT_KEY);
      if (storedTimeout) {
        setSessionTimeoutMinutes(parseInt(storedTimeout, 10));
      }
    } catch (error) {
      logger.error('Failed to check hidden mode setup status:', error);
      setIsSetupRequired(true);
    }
  }, []);

  /**
   * Set up hidden mode with user secret
   */
  const setupHiddenMode = useCallback(async (secret: string): Promise<void> => {
    try {
      if (!secret || secret.length < 8) {
        throw new Error('Secret must be at least 8 characters long');
      }

      // Test encryption with the user secret
      const testSuccess = await clientEncryption.testEncryption();
      if (!testSuccess) {
        throw new Error('Encryption test failed - device may not support required security features');
      }

      // Create verification data by encrypting a known test string
      const verificationText = 'HIDDEN_MODE_VERIFICATION_SUCCESS';
      const verificationData = await clientEncryption.encryptContent(verificationText, secret);

      // Store setup completion and verification data
      await AsyncStorage.setItem(HIDDEN_MODE_SETUP_KEY, 'true');
      await AsyncStorage.setItem(VERIFICATION_DATA_KEY, JSON.stringify(verificationData));

      setIsSetupRequired(false);
      setUserSecret(secret);
      setIsUnlocked(true);
      setIsHiddenMode(true);

      // Start session timer
      startSessionTimer();

      logger.info('Hidden mode setup completed successfully');
    } catch (error) {
      logger.error('Hidden mode setup failed:', error);
      throw error;
    }
  }, []);

  /**
   * Unlock hidden mode with user secret
   */
  const unlockHiddenMode = useCallback(async (secret: string): Promise<boolean> => {
    try {
      if (!secret) {
        return false;
      }

      // Get verification data
      const verificationDataJson = await AsyncStorage.getItem(VERIFICATION_DATA_KEY);
      if (!verificationDataJson) {
        logger.error('No verification data found - hidden mode not set up');
        return false;
      }

      const verificationData = JSON.parse(verificationDataJson);
      
      // Try to decrypt verification data with provided secret
      const decryptedText = await clientEncryption.decryptContent(
        verificationData.encryptedContent,
        verificationData.iv,
        secret,
        verificationData.salt
      );

      // Check if decryption was successful
      if (decryptedText === 'HIDDEN_MODE_VERIFICATION_SUCCESS') {
        setUserSecret(secret);
        setIsUnlocked(true);
        setIsHiddenMode(true);
        startSessionTimer();
        
        logger.info('Hidden mode unlocked successfully');
        return true;
      } else {
        logger.warn('Hidden mode unlock failed - incorrect secret');
        return false;
      }
    } catch (error) {
      logger.error('Hidden mode unlock error:', error);
      return false;
    }
  }, []);

  /**
   * Lock hidden mode and clear sensitive data
   */
  const lockHiddenMode = useCallback(() => {
    setUserSecret(null);
    setIsUnlocked(false);
    setIsHiddenMode(false);
    setSessionEndTime(null);
    
    if (sessionTimer) {
      clearTimeout(sessionTimer);
      setSessionTimer(null);
    }
    
    logger.info('Hidden mode locked');
  }, [sessionTimer]);

  /**
   * Clear all hidden mode data (reset/delete)
   */
  const clearHiddenMode = useCallback(async (): Promise<void> => {
    try {
      // Clear stored data
      await AsyncStorage.removeItem(HIDDEN_MODE_SETUP_KEY);
      await AsyncStorage.removeItem(VERIFICATION_DATA_KEY);
      await AsyncStorage.removeItem(SESSION_TIMEOUT_KEY);
      
      // Clear encryption data
      await clientEncryption.clearEncryptionData();
      
      // Reset state
      lockHiddenMode();
      setIsSetupRequired(true);
      
      logger.info('Hidden mode data cleared');
    } catch (error) {
      logger.error('Failed to clear hidden mode data:', error);
      throw error;
    }
  }, [lockHiddenMode]);

  /**
   * Start session timer
   */
  const startSessionTimer = useCallback(() => {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
    }

    const endTime = Date.now() + (sessionTimeoutMinutes * 60 * 1000);
    setSessionEndTime(endTime);

    const timer = setTimeout(() => {
      logger.info('Hidden mode session timed out');
      lockHiddenMode();
    }, sessionTimeoutMinutes * 60 * 1000);

    setSessionTimer(timer);
  }, [sessionTimeoutMinutes, sessionTimer, lockHiddenMode]);

  /**
   * Extend current session
   */
  const extendSession = useCallback(() => {
    if (isUnlocked) {
      startSessionTimer();
      logger.info('Hidden mode session extended');
    }
  }, [isUnlocked, startSessionTimer]);

  /**
   * Get remaining session time in seconds
   */
  const getRemainingSessionTime = useCallback((): number => {
    if (!sessionEndTime || !isUnlocked) {
      return 0;
    }
    
    const remaining = Math.max(0, Math.floor((sessionEndTime - Date.now()) / 1000));
    return remaining;
  }, [sessionEndTime, isUnlocked]);

  /**
   * Set session timeout and persist preference
   */
  const setSessionTimeoutWithPersistence = useCallback(async (minutes: number) => {
    setSessionTimeoutMinutes(minutes);
    try {
      await AsyncStorage.setItem(SESSION_TIMEOUT_KEY, minutes.toString());
    } catch (error) {
      logger.error('Failed to save session timeout preference:', error);
    }
  }, []);

  /**
   * Encrypt content using current user secret
   */
  const encryptContent = useCallback(async (content: string) => {
    if (!userSecret) {
      throw new Error('Hidden mode not unlocked - cannot encrypt');
    }
    
    return await clientEncryption.encryptContent(content, userSecret);
  }, [userSecret]);

  /**
   * Decrypt content using current user secret
   */
  const decryptContent = useCallback(async (encryptedContent: string, iv: string, salt?: string) => {
    if (!userSecret) {
      throw new Error('Hidden mode not unlocked - cannot decrypt');
    }
    
    return await clientEncryption.decryptContent(encryptedContent, iv, userSecret, salt);
  }, [userSecret]);

  // Initialize setup status on mount
  useEffect(() => {
    checkSetupStatus();
  }, [checkSetupStatus]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, [sessionTimer]);

  const value: HiddenModeContextValue = {
    // State
    isHiddenMode,
    isSetupRequired,
    isUnlocked,
    
    // Actions
    setupHiddenMode,
    unlockHiddenMode,
    lockHiddenMode,
    clearHiddenMode,
    
    // Encryption utilities
    encryptContent,
    decryptContent,
    
    // Session management
    sessionTimeoutMinutes,
    setSessionTimeout: setSessionTimeoutWithPersistence,
    extendSession,
    getRemainingSessionTime,
  };

  return (
    <HiddenModeContext.Provider value={value}>
      {children}
    </HiddenModeContext.Provider>
  );
};

/**
 * Hook to use hidden mode context
 */
export const useHiddenMode = (): HiddenModeContextValue => {
  const context = useContext(HiddenModeContext);
  if (!context) {
    throw new Error('useHiddenMode must be used within a HiddenModeProvider');
  }
  return context;
};

export default HiddenModeProvider; 