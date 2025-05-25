/**
 * Hidden Mode Setup Component
 * 
 * Guides users through setting up zero-knowledge encrypted hidden mode
 * with secure client-side key derivation.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { useHiddenMode } from '../contexts/HiddenModeContext';
import clientEncryption from '../services/clientEncryption';
import logger from '../utils/logger';

interface HiddenModeSetupProps {
  onSetupComplete?: () => void;
  onCancel?: () => void;
}

const HiddenModeSetup: React.FC<HiddenModeSetupProps> = ({
  onSetupComplete,
  onCancel
}) => {
  const { setupHiddenMode } = useHiddenMode();
  
  const [userSecret, setUserSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [encryptionSupported, setEncryptionSupported] = useState(true);

  // Check encryption support on component mount
  React.useEffect(() => {
    const checkSupport = async () => {
      try {
        const supported = await clientEncryption.testEncryption();
        setEncryptionSupported(supported);
        if (!supported) {
          Alert.alert(
            'Encryption Not Supported',
            'Your device or browser does not support the required encryption features for hidden mode.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        logger.error('Failed to test encryption support:', error);
        setEncryptionSupported(false);
      }
    };
    
    checkSupport();
  }, []);

  /**
   * Generate a strong random secret for the user
   */
  const generateRandomSecret = useCallback(() => {
    try {
      const randomSecret = clientEncryption.generateRandomSecret(24);
      setUserSecret(randomSecret);
      setConfirmSecret(randomSecret);
      
      Alert.alert(
        'Secret Generated',
        'A strong random secret has been generated for you. Please save it securely - you will need it to access your hidden entries.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      logger.error('Failed to generate random secret:', error);
      Alert.alert('Error', 'Failed to generate random secret');
    }
  }, []);

  /**
   * Validate the user secret
   */
  const validateSecret = useCallback((secret: string): string | null => {
    if (!secret) {
      return 'Secret cannot be empty';
    }
    
    if (secret.length < 8) {
      return 'Secret must be at least 8 characters long';
    }
    
    if (secret.length < 12) {
      return 'For better security, consider using at least 12 characters';
    }
    
    return null;
  }, []);

  /**
   * Handle setup submission
   */
  const handleSetup = useCallback(async () => {
    if (!encryptionSupported) {
      Alert.alert('Error', 'Encryption not supported on this device');
      return;
    }

    // Validate secrets
    const secretError = validateSecret(userSecret);
    if (secretError) {
      Alert.alert('Invalid Secret', secretError);
      return;
    }

    if (userSecret !== confirmSecret) {
      Alert.alert('Error', 'Secrets do not match');
      return;
    }

    setIsLoading(true);

    try {
      await setupHiddenMode(userSecret);
      
      Alert.alert(
        'Hidden Mode Setup Complete',
        'Your hidden mode has been set up successfully. Remember your secret phrase - it cannot be recovered if lost!',
        [
          {
            text: 'OK',
            onPress: () => {
              onSetupComplete?.();
            }
          }
        ]
      );
    } catch (error) {
      logger.error('Hidden mode setup failed:', error);
      Alert.alert(
        'Setup Failed',
        error instanceof Error ? error.message : 'Failed to set up hidden mode'
      );
    } finally {
      setIsLoading(false);
    }
  }, [userSecret, confirmSecret, encryptionSupported, setupHiddenMode, validateSecret, onSetupComplete]);

  /**
   * Clear form data
   */
  const clearForm = useCallback(() => {
    setUserSecret('');
    setConfirmSecret('');
  }, []);

  if (!encryptionSupported) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Hidden Mode Not Available</Text>
          <Text style={styles.description}>
            Your device or browser does not support the required encryption features for hidden mode.
          </Text>
          <TouchableOpacity style={styles.button} onPress={onCancel}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Set Up Hidden Mode</Text>
        
        <Text style={styles.description}>
          Hidden mode uses zero-knowledge encryption to protect your sensitive journal entries.
          Only you will have access to the encryption key - even the server cannot decrypt your hidden entries.
        </Text>

        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Important</Text>
          <Text style={styles.warningText}>
            Your secret phrase cannot be recovered if lost. Make sure to store it safely.
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Secret Phrase</Text>
          <TextInput
            style={styles.input}
            value={userSecret}
            onChangeText={setUserSecret}
            placeholder="Enter a secure secret phrase (minimum 8 characters)"
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TouchableOpacity 
            style={styles.generateButton}
            onPress={generateRandomSecret}
          >
            <Text style={styles.generateButtonText}>Generate Random Secret</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Secret Phrase</Text>
          <TextInput
            style={styles.input}
            value={confirmSecret}
            onChangeText={setConfirmSecret}
            placeholder="Confirm your secret phrase"
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {userSecret && validateSecret(userSecret) && (
          <Text style={styles.validationText}>
            {validateSecret(userSecret)}
          </Text>
        )}

        <TouchableOpacity 
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text style={styles.advancedToggleText}>
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </Text>
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.advancedTitle}>Security Information</Text>
            <Text style={styles.advancedText}>
              • Uses AES-256-GCM encryption
            </Text>
            <Text style={styles.advancedText}>
              • PBKDF2 key derivation with 100,000 iterations
            </Text>
            <Text style={styles.advancedText}>
              • Client-side encryption only - server never sees your key
            </Text>
            <Text style={styles.advancedText}>
              • Secure storage on device (iOS Keychain / Android Keystore)
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
            style={[styles.button, styles.setupButton]}
            onPress={handleSetup}
            disabled={isLoading || !userSecret || !confirmSecret}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Set Up Hidden Mode</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.clearButton}
          onPress={clearForm}
        >
          <Text style={styles.clearButtonText}>Clear Form</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  warningBox: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
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
  generateButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  validationText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  advancedToggle: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  advancedToggleText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  advancedSection: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  advancedTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  advancedText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
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
  setupButton: {
    backgroundColor: '#28a745',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6c757d',
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
  clearButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  clearButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HiddenModeSetup; 