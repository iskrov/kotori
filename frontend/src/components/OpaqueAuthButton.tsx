import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import logger from '../utils/logger';

interface OpaqueAuthButtonProps {
  mode: 'login' | 'register';
  email: string;
  password: string;
  name?: string;
  confirmPassword?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  style?: any;
}

const OpaqueAuthButton: React.FC<OpaqueAuthButtonProps> = ({
  mode,
  email,
  password,
  name,
  confirmPassword,
  onSuccess,
  onError,
  disabled = false,
  style
}) => {
  const { 
    opaqueLogin, 
    opaqueRegister, 
    hasOpaqueSupport,
    isLoading: authLoading 
  } = useAuth();
  
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const [isLoading, setIsLoading] = useState(false);
  const [opaqueSupported, setOpaqueSupported] = useState<boolean | null>(null);
  const [checkingSupport, setCheckingSupport] = useState(true);
  const [supportMessage, setSupportMessage] = useState<string>('Checking Server...');

  // Check OPAQUE support on component mount with 3-attempt retry and progressive messages
  useEffect(() => {
    let isCancelled = false;

    const attemptMessages = ['Checking Server...', 'Please wait...', 'Trying again...'];
    const attemptDelaysMs = [0, 1200, 2500];

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const checkSupportWithRetry = async () => {
      try {
        setCheckingSupport(true);
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (isCancelled) return;

          // Update UI message for this attempt
          setSupportMessage(attemptMessages[attempt]);

          // Optional stagger between attempts (skip delay before first attempt)
          if (attemptDelaysMs[attempt] > 0) {
            await sleep(attemptDelaysMs[attempt]);
            if (isCancelled) return;
          }

          try {
            const supported = await hasOpaqueSupport();
            if (isCancelled) return;
            if (supported) {
              setOpaqueSupported(true);
              setCheckingSupport(false);
              logger.info('Authentication service check completed', { supported });
              return;
            }
          } catch (error) {
            // Log and continue to next attempt
            logger.warn('OPAQUE support attempt failed', { attempt: attempt + 1, error });
          }
        }

        // All attempts failed
        if (!isCancelled) {
          setOpaqueSupported(false);
          setCheckingSupport(false);
          logger.warn('OPAQUE support check failed after retries, assuming not supported');
        }
      } catch (outerError) {
        if (!isCancelled) {
          logger.error('Failed to check authentication service', outerError);
          setOpaqueSupported(false);
          setCheckingSupport(false);
        }
      }
    };

    checkSupportWithRetry();
    return () => {
      isCancelled = true;
    };
  }, [hasOpaqueSupport]);

  const handleAuth = async () => {
    // Email validation regex - comprehensive pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Validate required fields with specific messages
    if (mode === 'register' && !name?.trim()) {
      onError?.('Please enter your name');
      return;
    }
    if (!email?.trim()) {
      onError?.('Please enter your email address');
      return;
    }
    
    // Only apply strict email validation for registration
    if (mode === 'register') {
      const trimmedEmail = email.trim();
      if (!emailRegex.test(trimmedEmail)) {
        onError?.('Please enter a valid email address (e.g., user@example.com)');
        return;
      }
      
      // Additional email validation checks for registration
      if (trimmedEmail.length > 254) {
        onError?.('Email address is too long');
        return;
      }
      if (trimmedEmail.includes('..')) {
        onError?.('Email address cannot contain consecutive dots');
        return;
      }
    }
    if (!password) {
      onError?.('Please enter a password');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      onError?.('Password must be at least 8 characters long');
      return;
    }
    if (mode === 'register') {
      if (password.length > 128) {
        onError?.('Password is too long (maximum 128 characters)');
        return;
      }
      if (!confirmPassword) {
        onError?.('Please confirm your password');
        return;
      }
    }
    if (mode === 'register' && password !== confirmPassword) {
      onError?.('Passwords do not match');
      return;
    }

    if (!opaqueSupported) {
      onError?.('Authentication service is currently unavailable');
      return;
    }

    try {
      setIsLoading(true);
      
      logger.info(`Starting secure ${mode} process`);
      
      if (mode === 'login') {
        await opaqueLogin(email, password);
      } else {
        await opaqueRegister(name!, email, password);
      }
      
      onSuccess?.();
    } catch (error: any) {
      logger.error(`Secure ${mode} failed:`, error);
      
      let errorMsg = `An error occurred during ${mode}. Please try again.`;
      
      if (error.status === 401) {
        errorMsg = 'Invalid email or password. Please try again.';
      } else if (error.status === 422) {
        if (error.message && typeof error.message === 'string') {
          errorMsg = error.message;
        } else if (error.errors && Array.isArray(error.errors)) {
          errorMsg = error.errors.join('\n');
        }
      } else if (error.status === 400 && error.message === 'User already exists') {
        errorMsg = 'An account with this email already exists. Please try signing in instead.';
      } else if (error.status === 409) {
        errorMsg = 'An account with this email already exists.';
      } else if (error.status === 500 && error.message.includes('Database connection error')) {
        errorMsg = 'Cannot connect to the database. Please make sure the database service is running.';
      } else if (error.status === 0) {
        errorMsg = 'Unable to connect to the server. Please check your connection and try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const isButtonDisabled = disabled || authLoading || isLoading || checkingSupport || !opaqueSupported;

  if (checkingSupport) {
    return (
      <View style={[styles.button, styles.checkingButton, style]}>
        <ActivityIndicator size="small" color={theme.colors.white} />
        <Text style={styles.buttonText}>{supportMessage}</Text>
      </View>
    );
  }

  if (!opaqueSupported) {
    return (
      <View style={[styles.button, styles.disabledButton, style]}>
        <Text style={[styles.buttonText, styles.disabledText]}>Server Unavailable</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isButtonDisabled ? styles.disabledButton : styles.enabledButton,
        style
      ]}
      onPress={handleAuth}
      disabled={isButtonDisabled}
    >
      {isLoading || authLoading ? (
        <ActivityIndicator size="small" color={theme.colors.white} />
      ) : (
        <Text style={styles.buttonText}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    minHeight: 56,
  },
  enabledButton: {
    backgroundColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
  },
  checkingButton: {
    backgroundColor: theme.colors.warning,
    ...theme.shadows.sm,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: theme.spacing.sm,
  },
  disabledText: {
    color: theme.colors.textDisabled,
  },
});

export default OpaqueAuthButton; 