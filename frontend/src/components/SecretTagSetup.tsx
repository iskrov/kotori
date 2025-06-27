/**
 * Secret Tag Setup Component
 * 
 * Allows users to create new secret tags with custom names, phrases, and colors.
 * Enhanced to support both legacy and OPAQUE-based authentication methods.
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
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { opaqueTagManager } from '../services/OpaqueTagManager';
import { sessionStorageManager } from '../services/SessionStorageManager';
import OpaqueTagIndicator from './OpaqueTagIndicator';
import logger from '../utils/logger';
import { OpaqueSecretTag } from '../types/opaqueTypes';

interface SecretTagSetupProps {
  onTagCreated?: (tagId: string) => void;
  onCancel?: () => void;
  existingTagNames?: string[];
  enableOpaqueAuth?: boolean; // Feature flag for OPAQUE authentication
}

const SecretTagSetup: React.FC<SecretTagSetupProps> = ({
  onTagCreated,
  onCancel,
  existingTagNames = [],
  enableOpaqueAuth = true,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const [tagName, setTagName] = useState('');
  const [activationPhrase, setActivationPhrase] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [selectedColor, setSelectedColor] = useState('#007AFF');
  const [isLoading, setIsLoading] = useState(false);
  const [useOpaqueAuth, setUseOpaqueAuth] = useState(true);
  const [securityLevel, setSecurityLevel] = useState<'standard' | 'enhanced'>('standard');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [justCreated, setJustCreated] = useState<{ 
    tagName: string; 
    phrase: string; 
    isOpaque: boolean;
    tag?: OpaqueSecretTag;
  } | null>(null);

  // Predefined color options
  const colorOptions = [
    '#007AFF', // Blue
    '#34C759', // Green
    '#FF9500', // Orange
    '#FF3B30', // Red
    '#AF52DE', // Purple
    '#FF2D92', // Pink
    '#5AC8FA', // Light Blue
    '#FFCC00', // Yellow
    '#FF6B6B', // Light Red
    '#4ECDC4', // Teal
    '#45B7D1', // Sky Blue
    '#96CEB4', // Mint Green
  ];

  /**
   * Validate tag name
   */
  const validateTagName = useCallback((name: string): string | null => {
    if (!name.trim()) {
      return 'Tag name cannot be empty';
    }
    
    if (name.length < 2) {
      return 'Tag name must be at least 2 characters';
    }
    
    if (name.length > 50) {
      return 'Tag name must be less than 50 characters';
    }
    
    if (existingTagNames.some(existing => existing.toLowerCase() === name.toLowerCase())) {
      return 'A tag with this name already exists';
    }
    
    return null;
  }, [existingTagNames]);

  /**
   * Validate activation phrase
   */
  const validatePhrase = useCallback((phrase: string): string | null => {
    if (!phrase.trim()) {
      return 'Activation phrase cannot be empty';
    }
    
    if (phrase.length < 3) {
      return 'Activation phrase must be at least 3 characters';
    }
    
    if (phrase.length > 100) {
      return 'Activation phrase must be less than 100 characters';
    }
    
    // Check for common words that might be accidentally triggered
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    if (commonWords.includes(phrase.toLowerCase().trim())) {
      return 'Please choose a more unique phrase to avoid accidental activation';
    }
    
    return null;
  }, []);

  /**
   * Validate phrase confirmation
   */
  const validateConfirmation = useCallback((phrase: string, confirmation: string): string | null => {
    if (!confirmation.trim()) {
      return 'Please confirm your activation phrase';
    }
    
    if (phrase !== confirmation) {
      return 'Phrases do not match';
    }
    
    return null;
  }, []);

  /**
   * Handle tag creation
   */
  const handleCreateTag = useCallback(async () => {
    // Validate inputs
    const nameError = validateTagName(tagName);
    if (nameError) {
      Alert.alert('Invalid Name', nameError);
      return;
    }

    const phraseError = validatePhrase(activationPhrase);
    if (phraseError) {
      Alert.alert('Invalid Phrase', phraseError);
      return;
    }

    // Validate confirmation phrase (required for OPAQUE tags)
    const confirmError = validateConfirmation(activationPhrase, confirmationPhrase);
    if (confirmError) {
      Alert.alert('Invalid Confirmation', confirmError);
      return;
    }

    setIsLoading(true);

    try {
      let tagId: string;
      let createdTag: OpaqueSecretTag | undefined;

      // Create OPAQUE-based secret tag (only option now)
      const deviceFingerprint = sessionStorageManager.getDeviceFingerprint();
      if (!deviceFingerprint) {
        throw new Error('Device fingerprinting required for OPAQUE tags');
      }

      const response = await opaqueTagManager.createOpaqueTag({
        tag_name: tagName.trim(),
        activation_phrase: activationPhrase.trim(),
        color_code: selectedColor,
        device_fingerprint: deviceFingerprint.hash,
        security_level: securityLevel
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create OPAQUE tag');
      }

      tagId = response.tag.id;
      createdTag = response.tag;
      
      // Set success state with created tag info
      setJustCreated({
        tagName: tagName.trim(),
        phrase: activationPhrase.trim(),
        isOpaque: true, // Always OPAQUE now
        tag: createdTag
      });

      // Clear form
      setTagName('');
      setActivationPhrase('');
      setConfirmationPhrase('');
      setSelectedColor('#007AFF');
      setShowConfirmation(false);

      // Call the callback after a short delay to let user see the success message
      setTimeout(() => {
        onTagCreated?.(tagId);
      }, 3000);
      
    } catch (error) {
      logger.error('Failed to create secret tag:', error);
      Alert.alert(
        'Creation Failed',
        error instanceof Error ? error.message : 'Failed to create secret tag'
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    tagName, 
    activationPhrase, 
    confirmationPhrase,
    selectedColor, 
    useOpaqueAuth,
    enableOpaqueAuth,
    securityLevel,
    validateTagName, 
    validatePhrase, 
    validateConfirmation,
    onTagCreated
  ]);

  // Show success message if tag was just created
  if (justCreated) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons 
              name={justCreated.isOpaque ? "shield-checkmark" : "checkmark-circle"} 
              size={64} 
              color={justCreated.isOpaque ? '#00C851' : (theme.colors.success || '#34C759')} 
            />
          </View>
          
          <Text style={styles.successTitle}>
            {justCreated.isOpaque ? 'OPAQUE Secret Tag Created!' : 'Secret Tag Created!'}
          </Text>

          {/* Show OPAQUE tag indicator if applicable */}
          {justCreated.isOpaque && justCreated.tag && (
            <View style={styles.opaqueIndicatorContainer}>
              <OpaqueTagIndicator 
                tag={justCreated.tag}
                showSession={false}
                showSecurityLevel={true}
                size="large"
              />
            </View>
          )}
          
          <View style={styles.successDetails}>
            <Text style={styles.successLabel}>Tag Name:</Text>
            <Text style={styles.successValue}>{justCreated.tagName}</Text>
            
            <Text style={styles.successLabel}>Activation Phrase:</Text>
            <Text style={styles.successValue}>"{justCreated.phrase}"</Text>

            {justCreated.isOpaque && (
              <>
                <Text style={styles.successLabel}>Authentication:</Text>
                <Text style={styles.successValue}>Zero-Knowledge OPAQUE</Text>
              </>
            )}
          </View>

          <View style={styles.successInstructions}>
            <Text style={styles.successInstructionText}>
              {justCreated.isOpaque 
                ? 'Your tag is protected with OPAQUE zero-knowledge authentication. You can now use this phrase during voice recording to automatically create encrypted entries.'
                : 'You can now use this phrase during voice recording to automatically tag your entries.'
              }
            </Text>
          </View>

          {justCreated.isOpaque && (
            <View style={styles.securityNotice}>
              <View style={styles.securityNoticeIcon}>
                <Ionicons name="warning" size={20} color="#FF9500" />
              </View>
              <Text style={styles.securityNoticeText}>
                <Text style={styles.securityNoticeTextBold}>Important:</Text> This phrase cannot be recovered if forgotten. 
                Your entries will be permanently inaccessible without it.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.continueButton}
            onPress={() => {
              setJustCreated(null);
              onTagCreated?.(justCreated.tagName);
            }}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create Secret Tag</Text>
        
        <Text style={styles.description}>
          Secret tags provide independent privacy levels for your journal entries.
          Each tag has its own encryption key and activation phrase.
        </Text>

        {/* Security Level Selection */}
        <View style={styles.securityLevelContainer}>
          <Text style={styles.securityLevelTitle}>Security Level</Text>
          <Text style={styles.securityLevelDescription}>
            All tags now use OPAQUE zero-knowledge authentication with device binding
          </Text>
          <View style={styles.securityLevelOptions}>
            <TouchableOpacity
              style={[
                styles.securityLevelOption,
                securityLevel === 'standard' && styles.securityLevelOptionSelected
              ]}
              onPress={() => setSecurityLevel('standard')}
            >
              <Ionicons 
                name="shield" 
                size={20} 
                color={securityLevel === 'standard' ? '#007AFF' : '#8E8E93'} 
              />
              <Text style={[
                styles.securityLevelOptionText,
                securityLevel === 'standard' && styles.securityLevelOptionTextSelected
              ]}>
                Standard
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.securityLevelOption,
                      securityLevel === 'enhanced' && styles.securityLevelOptionSelected
                    ]}
                    onPress={() => setSecurityLevel('enhanced')}
                  >
                    <Ionicons 
                      name="shield-checkmark" 
                      size={20} 
                      color={securityLevel === 'enhanced' ? '#00C851' : '#8E8E93'} 
                    />
                    <Text style={[
                      styles.securityLevelOptionText,
                      securityLevel === 'enhanced' && styles.securityLevelOptionTextSelected
                    ]}>
                      Enhanced
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Critical Warning Section */}
        <View style={styles.warningContainer}>
          <View style={styles.warningHeader}>
            <Ionicons name="warning" size={20} color={theme.colors.error} />
            <Text style={styles.warningTitle}>
              {useOpaqueAuth && enableOpaqueAuth 
                ? 'IMPORTANT: OPAQUE Zero-Knowledge Privacy'
                : 'IMPORTANT: Zero-Knowledge Privacy'
              }
            </Text>
          </View>
          
          <Text style={styles.warningText}>
            {useOpaqueAuth && enableOpaqueAuth
              ? 'This tag uses OPAQUE zero-knowledge authentication. Neither we nor anyone else can see or recover your secret tags or entries.'
              : 'This app uses zero-knowledge encryption. We (the developers) cannot see or recover your secret tags or entries.'
            }
          </Text>
          
          <Text style={styles.warningTextBold}>
            If you forget your activation phrase, all entries with this tag will be permanently lost. There is no recovery method.
          </Text>
          
          {useOpaqueAuth && enableOpaqueAuth && (
            <Text style={styles.warningTextBold}>
              OPAQUE tags are also bound to this device. You'll need to re-authenticate on new devices.
            </Text>
          )}
          
          <View style={styles.warningTips}>
            <Text style={styles.warningTipTitle}>Tips for remembering phrases:</Text>
            <View style={styles.warningTipItem}>
              <View style={styles.warningBullet} />
              <Text style={styles.warningTip}>Use phrases that are meaningful to you</Text>
            </View>
            <View style={styles.warningTipItem}>
              <View style={styles.warningBullet} />
              <Text style={styles.warningTip}>Consider writing them down in a secure location</Text>
            </View>
            <View style={styles.warningTipItem}>
              <View style={styles.warningBullet} />
              <Text style={styles.warningTip}>Test your phrases after creation</Text>
            </View>
            {useOpaqueAuth && enableOpaqueAuth && (
              <View style={styles.warningTipItem}>
                <View style={styles.warningBullet} />
                <Text style={styles.warningTip}>Ensure this device remains accessible for future use</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tag Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Tag Name</Text>
          <TextInput
            style={[
              styles.input,
              tagName && validateTagName(tagName) ? styles.inputError : styles.inputValid
            ]}
            value={tagName}
            onChangeText={setTagName}
            placeholder="e.g., Work Private, Personal Thoughts"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={50}
          />
          <View style={[
            styles.validationContainer,
            tagName && validateTagName(tagName) ? styles.validationError : styles.validationSuccess
          ]}>
            <Text style={[
              styles.validationText,
              tagName && validateTagName(tagName) ? styles.validationTextError : styles.validationTextSuccess
            ]}>
              {tagName && validateTagName(tagName) ? validateTagName(tagName) : tagName ? '✓ Tag name looks good' : 'Enter a unique tag name'}
            </Text>
          </View>
        </View>

        {/* Activation Phrase Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Activation Phrase</Text>
          <TextInput
            style={[
              styles.input,
              activationPhrase && validatePhrase(activationPhrase) ? styles.inputError : styles.inputValid
            ]}
            value={activationPhrase}
            onChangeText={setActivationPhrase}
            placeholder="e.g., activate work mode, private thoughts"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
          />
          <View style={[
            styles.validationContainer,
            activationPhrase && validatePhrase(activationPhrase) ? styles.validationError : styles.validationSuccess
          ]}>
            <Text style={[
              styles.validationText,
              activationPhrase && validatePhrase(activationPhrase) ? styles.validationTextError : styles.validationTextSuccess
            ]}>
              {activationPhrase && validatePhrase(activationPhrase) ? validatePhrase(activationPhrase) : activationPhrase ? '✓ Activation phrase looks good' : 'Enter a unique activation phrase'}
            </Text>
          </View>
        </View>

        {/* Confirmation Phrase Input - Only for OPAQUE */}
        {useOpaqueAuth && enableOpaqueAuth && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Activation Phrase</Text>
            <TextInput
              style={[
                styles.input,
                confirmationPhrase && validateConfirmation(activationPhrase, confirmationPhrase) ? styles.inputError : styles.inputValid
              ]}
              value={confirmationPhrase}
              onChangeText={setConfirmationPhrase}
              placeholder="Re-enter your activation phrase"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={100}
            />
            <View style={[
              styles.validationContainer,
              confirmationPhrase && validateConfirmation(activationPhrase, confirmationPhrase) ? styles.validationError : styles.validationSuccess
            ]}>
              <Text style={[
                styles.validationText,
                confirmationPhrase && validateConfirmation(activationPhrase, confirmationPhrase) ? styles.validationTextError : styles.validationTextSuccess
              ]}>
                {confirmationPhrase && validateConfirmation(activationPhrase, confirmationPhrase) 
                  ? validateConfirmation(activationPhrase, confirmationPhrase) 
                  : confirmationPhrase && activationPhrase === confirmationPhrase 
                    ? '✓ Phrases match' 
                    : 'Confirm your activation phrase'
                }
              </Text>
            </View>
          </View>
        )}

        {/* Color Selection */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Tag Color</Text>
          <View style={styles.colorGrid}>
            {colorOptions.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.selectedColorOption,
                ]}
                onPress={() => setSelectedColor(color)}
              >
                {selectedColor === color && (
                  <Ionicons name="checkmark" size={16} color={theme.colors.background} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.createButton]}
            onPress={handleCreateTag}
            disabled={isLoading || !tagName || !activationPhrase}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create Secret Tag</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  card: {
    backgroundColor: theme.colors.card,
    margin: theme.spacing.lg,
    padding: theme.spacing.xl,
    borderRadius: 12,
    ...theme.shadows.sm,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  description: {
    fontSize: theme.typography.fontSizes.md,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },

  // Warning Section Styles
  warningContainer: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEAA7',
    borderWidth: 1,
    borderRadius: 8,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  warningTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: 'bold',
    color: theme.colors.error,
    marginLeft: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  warningText: {
    fontSize: theme.typography.fontSizes.sm,
    color: '#856404',
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  warningTextBold: {
    fontSize: theme.typography.fontSizes.sm,
    color: '#721C24',
    lineHeight: 20,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  warningTips: {
    marginTop: theme.spacing.sm,
  },
  warningTipTitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    color: '#856404',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  warningTip: {
    fontSize: theme.typography.fontSizes.sm,
    color: '#856404',
    lineHeight: 18,
    fontFamily: theme.typography.fontFamilies.regular,
    flex: 1,
  },
  warningTipItem: {
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#856404',
    marginTop: 7,
    marginRight: theme.spacing.xs,
  },

  // Success Screen Styles
  successContainer: {
    flex: 1,
    backgroundColor: theme.colors.card,
    margin: theme.spacing.lg,
    padding: theme.spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  successIcon: {
    marginBottom: theme.spacing.xl,
  },
  successTitle: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.success || '#34C759',
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  successDetails: {
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  successLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  successValue: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.text,
    fontWeight: 'bold',
    marginBottom: theme.spacing.lg,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  successInstructions: {
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  successInstructionText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: 8,
    minWidth: 120,
  },
  continueButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },

  // OPAQUE-specific styles
  opaqueIndicatorContainer: {
    marginVertical: theme.spacing.md,
    alignItems: 'center',
  },
  securityNotice: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    padding: theme.spacing.md,
    borderRadius: 8,
    marginTop: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  securityNoticeIcon: {
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.sm,
    color: '#8B4513',
    lineHeight: 20,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  securityNoticeTextBold: {
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },

  // Authentication Method styles
  authMethodContainer: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 8,
  },
  authMethodTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  authMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authMethodInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  authMethodLabel: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  authMethodDescription: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontFamily: theme.typography.fontFamilies.regular,
  },

  // Security Level styles
  securityLevelContainer: {
    marginTop: theme.spacing.md,
  },
  securityLevelTitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  securityLevelOptions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  securityLevelOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  securityLevelOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  securityLevelOptionText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  securityLevelOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '500',
  },

  // Form Input Styles
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  inputValid: {
    borderColor: '#34C759', // Green border for valid input
  },
  inputError: {
    borderColor: theme.colors.error, // Red border for invalid input
  },
  validationContainer: {
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 4,
    borderRadius: 4,
    minHeight: 20,
  },
  validationSuccess: {
    backgroundColor: '#E8F5E8', // Light green background
  },
  validationError: {
    backgroundColor: '#FFF2F2', // Light red background
  },
  validationText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: 16,
  },
  validationTextSuccess: {
    color: '#22C55E', // Green text for success
  },
  validationTextError: {
    color: theme.colors.error, // Red text for errors
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: theme.colors.text,
    borderWidth: 3,
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  button: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: theme.spacing.sm,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
});

export default SecretTagSetup; 