import React, { useState, useEffect } from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  View 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    login, 
    register, 
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

    try {
      setIsLoading(true);
      
      if (opaqueSupported) {
        logger.info(`Using OPAQUE ${mode} for enhanced security`);
        
        if (mode === 'login') {
          await opaqueLogin(email, password);
        } else {
          await opaqueRegister(name!, email, password);
        }
      } else {
        logger.info(`Using traditional ${mode} (OPAQUE not supported)`);
        
        if (mode === 'login') {
          await login(email, password);
        } else {
          await register(name!, email, password);
        }
      }
      
      onSuccess?.();
    } catch (error: any) {
      logger.error(`${mode} failed:`, error);
      
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

  const getButtonText = () => {
    if (checkingSupport) return 'Checking Security...';
    if (isLoading || authLoading) return mode === 'login' ? 'Signing In...' : 'Creating Account...';
    
    const authType = opaqueSupported ? 'Zero-Knowledge' : 'Standard';
    return mode === 'login' 
      ? `Sign In (${authType})` 
      : `Create Account (${authType})`;
  };

  const getIcon = () => {
    if (checkingSupport || isLoading || authLoading) {
      return <ActivityIndicator color="#fff" size="small" />;
    }
    
    return (
      <Ionicons 
        name={opaqueSupported ? 'shield-checkmark' : 'log-in'} 
        size={20} 
        color="#fff" 
      />
    );
  };

  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        opaqueSupported ? styles.opaqueButton : styles.standardButton,
        disabled && styles.disabledButton,
        style
      ]}
      onPress={handleAuth}
      disabled={disabled || isLoading || authLoading || checkingSupport}
    >
      <View style={styles.buttonContent}>
        {getIcon()}
        <Text style={styles.buttonText}>{getButtonText()}</Text>
      </View>
      
      {opaqueSupported && !checkingSupport && (
        <Text style={styles.securityBadge}>Enhanced Security</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  opaqueButton: {
    backgroundColor: '#2E7D32', // Green for enhanced security
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  standardButton: {
    backgroundColor: '#1976D2', // Blue for standard auth
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  securityBadge: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    opacity: 0.9,
  },
});

export default OpaqueAuthButton; 