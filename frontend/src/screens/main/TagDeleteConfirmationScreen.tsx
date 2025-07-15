/**
 * Tag Delete Confirmation Screen
 * 
 * Provides a secure confirmation dialog for deleting tags, with special handling
 * for secret tags that require additional security verification.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { MainStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { tagManager } from '../../services/tagManager';
import { opaqueTagManager } from '../../services/OpaqueTagManager';
import ScreenHeader from '../../components/ScreenHeader';
import logger from '../../utils/logger';

type TagDeleteConfirmationRouteProp = RouteProp<MainStackParamList, 'TagDeleteConfirmation'>;
type TagDeleteConfirmationNavigationProp = StackNavigationProp<MainStackParamList, 'TagDeleteConfirmation'>;

const TagDeleteConfirmationScreen: React.FC = () => {
  const navigation = useNavigation<TagDeleteConfirmationNavigationProp>();
  const route = useRoute<TagDeleteConfirmationRouteProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  const { tagId, tagName, tagType } = route.params;

  // State
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [showConfirmationInput, setShowConfirmationInput] = useState(false);

  // For secret tags, require typing the tag name to confirm
  const isSecretTag = tagType === 'secret';
  const requiresConfirmation = isSecretTag;
  const confirmationRequired = requiresConfirmation ? tagName : 'DELETE';

  useEffect(() => {
    if (requiresConfirmation) {
      setShowConfirmationInput(true);
    }
  }, [requiresConfirmation]);

  /**
   * Handle tag deletion
   */
  const handleDelete = async () => {
    if (requiresConfirmation && confirmationText !== confirmationRequired) {
      Alert.alert(
        'Confirmation Required',
        `Please type "${confirmationRequired}" to confirm deletion.`
      );
      return;
    }

    setIsDeleting(true);
    
    try {
      if (isSecretTag) {
        await opaqueTagManager.deleteTag(tagId);
        logger.info('Secret tag deleted:', { tagId, tagName });
      } else {
        await tagManager.deleteTag(tagId);
        logger.info('Regular tag deleted:', { tagId, tagName });
      }

      Alert.alert(
        'Tag Deleted',
        `"${tagName}" has been permanently deleted.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      logger.error('Failed to delete tag:', error);
      Alert.alert(
        'Delete Failed',
        error instanceof Error ? error.message : 'Failed to delete tag. Please try again.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle cancellation
   */
  const handleCancel = () => {
    navigation.goBack();
  };

  const canDelete = !requiresConfirmation || confirmationText === confirmationRequired;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Delete Tag" />
      
      <View style={styles.content}>
        {/* Warning Icon */}
        <View style={styles.warningContainer}>
          <Ionicons 
            name={isSecretTag ? "shield-outline" : "warning-outline"} 
            size={64} 
            color={theme.colors.error} 
          />
        </View>

        {/* Warning Text */}
        <Text style={styles.warningTitle}>
          {isSecretTag ? 'Delete Secret Tag?' : 'Delete Tag?'}
        </Text>
        
        <Text style={styles.warningMessage}>
          Are you sure you want to permanently delete "{tagName}"?
        </Text>

        {isSecretTag && (
          <Text style={styles.secretTagWarning}>
            This is a secret tag with encrypted data. Once deleted, all associated 
            encrypted entries will become permanently inaccessible.
          </Text>
        )}

        <Text style={styles.warningSubtext}>
          This action cannot be undone.
        </Text>

        {/* Confirmation Input */}
        {showConfirmationInput && (
          <View style={styles.confirmationContainer}>
            <Text style={styles.confirmationLabel}>
              Type "{confirmationRequired}" to confirm:
            </Text>
            <TextInput
              style={styles.confirmationInput}
              value={confirmationText}
              onChangeText={setConfirmationText}
              placeholder={confirmationRequired}
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={isDeleting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.deleteButton,
              (!canDelete || isDeleting) && styles.disabledButton,
            ]}
            onPress={handleDelete}
            disabled={!canDelete || isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={theme.colors.onError} />
            ) : (
              <Text style={styles.deleteButtonText}>Delete</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security Notice */}
        {isSecretTag && (
          <View style={styles.securityNotice}>
            <Ionicons name="information-circle" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.securityNoticeText}>
              Secret tags can only be deleted when they are active for security reasons.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    justifyContent: 'center',
  },
  warningContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  warningTitle: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  warningMessage: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  secretTagWarning: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamilies.medium,
    backgroundColor: theme.colors.errorLight || theme.colors.error + '20',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.error + '40',
  },
  warningSubtext: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  confirmationContainer: {
    marginBottom: theme.spacing.xl,
  },
  confirmationLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  confirmationInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.inputBackground,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
  },
  deleteButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.onError || theme.colors.white,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  disabledButton: {
    opacity: 0.5,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  securityNoticeText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    flex: 1,
    fontFamily: theme.typography.fontFamilies.regular,
  },
});

export default TagDeleteConfirmationScreen; 