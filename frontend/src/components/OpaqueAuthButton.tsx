import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

interface OpaqueAuthButtonProps {
  mode: 'login' | 'register';
  email: string;
  password: string;
  name?: string;
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
  
  const [isLoading, setIsLoading] = useState(false);
  const [opaqueSupported, setOpaqueSupported] = useState<boolean | null>(null);
  const [checkingSupport, setCheckingSupport] = useState(true);

  // Check OPAQUE support on component mount
  useEffect(() => {
    const checkSupport = async () => {
      try {
        setCheckingSupport(true);
        const supported = await hasOpaqueSupport();
        setOpaqueSupported(supported);
        logger.info('OPAQUE support check completed', { supported });
      } catch (error) {
        logger.error('Failed to check OPAQUE support', error);
        setOpaqueSupported(false);
      } finally {
        setCheckingSupport(false);
      }
    };

    checkSupport();
  }, [hasOpaqueSupport]);

  const handleAuth = async () => {
    if (!email || !password || (mode === 'register' && !name)) {
      onError?.('Please fill in all required fields');
      return;
    }

    if (!opaqueSupported) {
      onError?.('OPAQUE authentication is not supported on this server');
      return;
    }

    try {
      setIsLoading(true);
      
      logger.info(`Using OPAQUE ${mode} for zero-knowledge authentication`);
      
      if (mode === 'login') {
        await opaqueLogin(email, password);
      } else {
        await opaqueRegister(name!, email, password);
      }
      
      onSuccess?.();
    } catch (error: any) {
      logger.error(`OPAQUE ${mode} failed:`, error);
      
      let errorMsg = `An error occurred during ${mode}. Please try again.`;
      
      if (error.status === 401) {
        errorMsg = 'Invalid email or password. Please try again.';
      } else if (error.status === 422) {
        if (error.message && typeof error.message === 'string') {
          errorMsg = error.message;
        } else if (error.errors && Array.isArray(error.errors)) {
          errorMsg = error.errors.join('\n');
        }
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
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.buttonText}>Checking OPAQUE Support...</Text>
      </View>
    );
  }

  if (!opaqueSupported) {
    return (
      <View style={[styles.button, styles.disabledButton, style]}>
        <Text style={styles.buttonText}>OPAQUE Not Supported</Text>
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
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonText}>
          {mode === 'login' ? 'OPAQUE Login' : 'OPAQUE Register'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minHeight: 48,
  },
  enabledButton: {
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  checkingButton: {
    backgroundColor: '#FFA500',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default OpaqueAuthButton; 