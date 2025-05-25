/**
 * Hidden Mode Unlock Component
 * 
 * Handles unlocking hidden mode with user secret and manages session state.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useHiddenMode } from '../contexts/HiddenModeContext';
import logger from '../utils/logger';

interface HiddenModeUnlockProps {
  onUnlockSuccess?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

const HiddenModeUnlock: React.FC<HiddenModeUnlockProps> = ({
  onUnlockSuccess,
  onCancel,
  autoFocus = true
}) => {
  const { 
    unlockHiddenMode, 
    isUnlocked, 
    sessionTimeoutMinutes,
    getRemainingSessionTime,
    extendSession 
  } = useHiddenMode();
  
  const [userSecret, setUserSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);

  // Maximum unlock attempts before temporary lockout
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_TIME = 60; // seconds

  // Update remaining session time
  useEffect(() => {
    if (isUnlocked) {
      const timer = setInterval(() => {
        const remaining = getRemainingSessionTime();
        setRemainingTime(remaining);
        
        if (remaining <= 0) {
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isUnlocked, getRemainingSessionTime]);

  /**
   * Handle unlock attempt
   */
  const handleUnlock = useCallback(async () => {
    if (!userSecret.trim()) {
      Alert.alert('Error', 'Please enter your secret phrase');
      return;
    }

    if (attemptCount >= MAX_ATTEMPTS) {
      Alert.alert(
        'Too Many Attempts',
        `Please wait ${LOCKOUT_TIME} seconds before trying again`
      );
      return;
    }

    setIsLoading(true);

    try {
      const success = await unlockHiddenMode(userSecret);
      
      if (success) {
        logger.info('Hidden mode unlocked successfully');
        setUserSecret(''); // Clear secret from memory
        setAttemptCount(0);
        onUnlockSuccess?.();
      } else {
        setAttemptCount(prev => prev + 1);
        const remainingAttempts = MAX_ATTEMPTS - attemptCount - 1;
        
        if (remainingAttempts > 0) {
          Alert.alert(
            'Incorrect Secret',
            `Invalid secret phrase. ${remainingAttempts} attempts remaining.`
          );
        } else {
          Alert.alert(
            'Access Locked',
            `Too many failed attempts. Please wait ${LOCKOUT_TIME} seconds before trying again.`
          );
          
          // Reset attempt count after lockout period
          setTimeout(() => {
            setAttemptCount(0);
          }, LOCKOUT_TIME * 1000);
        }
        
        setUserSecret('');
      }
    } catch (error) {
      logger.error('Hidden mode unlock error:', error);
      Alert.alert(
        'Unlock Failed',
        'An error occurred while unlocking hidden mode'
      );
    } finally {
      setIsLoading(false);
    }
  }, [userSecret, attemptCount, unlockHiddenMode, onUnlockSuccess]);

  /**
   * Handle session extension
   */
  const handleExtendSession = useCallback(() => {
    extendSession();
    Alert.alert(
      'Session Extended',
      `Your hidden mode session has been extended for ${sessionTimeoutMinutes} minutes.`
    );
  }, [extendSession, sessionTimeoutMinutes]);

  /**
   * Format remaining time for display
   */
  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // If already unlocked, show session status
  if (isUnlocked) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>🔓 Hidden Mode Active</Text>
          
          <Text style={styles.description}>
            Your hidden entries are now accessible. Session will expire in:
          </Text>
          
          <Text style={styles.timeRemaining}>
            {formatTime(remainingTime)}
          </Text>
          
          {remainingTime <= 60 && remainingTime > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Session expires soon! Extend or save your work.
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.extendButton}
            onPress={handleExtendSession}
          >
            <Text style={styles.extendButtonText}>
              Extend Session (+{sessionTimeoutMinutes}min)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Unlock interface
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>🔒 Unlock Hidden Mode</Text>
        
        <Text style={styles.description}>
          Enter your secret phrase to access your encrypted hidden entries.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Secret Phrase</Text>
          <TextInput
            style={styles.input}
            value={userSecret}
            onChangeText={setUserSecret}
            placeholder="Enter your secret phrase"
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={autoFocus}
            editable={!isLoading && attemptCount < MAX_ATTEMPTS}
            onSubmitEditing={handleUnlock}
          />
        </View>

        {attemptCount > 0 && attemptCount < MAX_ATTEMPTS && (
          <View style={styles.attemptsWarning}>
            <Text style={styles.attemptsText}>
              {MAX_ATTEMPTS - attemptCount} attempts remaining
            </Text>
          </View>
        )}

        {attemptCount >= MAX_ATTEMPTS && (
          <View style={styles.lockoutWarning}>
            <Text style={styles.lockoutText}>
              Too many failed attempts. Please wait before trying again.
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.button, 
              styles.unlockButton,
              (attemptCount >= MAX_ATTEMPTS || !userSecret.trim()) && styles.disabledButton
            ]}
            onPress={handleUnlock}
            disabled={isLoading || !userSecret.trim() || attemptCount >= MAX_ATTEMPTS}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Unlock</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.securityInfo}>
          <Text style={styles.securityText}>
            🔐 Zero-knowledge encryption protects your data
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  attemptsWarning: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  attemptsText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  lockoutWarning: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  lockoutText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  timeRemaining: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#007AFF',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  extendButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  extendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  unlockButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
  },
  securityInfo: {
    alignItems: 'center',
  },
  securityText: {
    color: '#28a745',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default HiddenModeUnlock; 