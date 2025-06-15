/**
 * Secret Tag Card Component
 * 
 * Displays an individual secret tag with management actions like edit, delete, and activation status.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { SecretTagV2 } from '../services/secretTagOnlineManager';
import logger from '../utils/logger';

interface SecretTagCardProps {
  tag: SecretTagV2;
  isActive: boolean;
  onActivate: (tagId: string) => Promise<void>;
  onDeactivate: (tagId: string) => Promise<void>;
  onEdit: (tag: SecretTagV2) => void;
  onDelete: (tagId: string) => Promise<void>;
}

const SecretTagCard: React.FC<SecretTagCardProps> = ({
  tag,
  isActive,
  onActivate,
  onDeactivate,
  onEdit,
  onDelete,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle tag activation/deactivation
   */
  const handleToggleActivation = async () => {
    setIsLoading(true);
    try {
      if (isActive) {
        await onDeactivate(tag.id);
      } else {
        await onActivate(tag.id);
      }
    } catch (error) {
      logger.error('Failed to toggle tag activation:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to toggle tag activation'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle tag deletion with confirmation
   */
  const handleDelete = () => {
    console.log(`Delete button clicked for tag: ${tag.name}, isActive: ${isActive}`);
    
    // Check if tag is active before allowing deletion
    if (!isActive) {
      // Use browser-compatible alert for web
      if (Platform.OS === 'web') {
        window.alert('Secret tags can only be deleted when they are active. Please activate the tag first, then try deleting it.');
      } else {
        Alert.alert(
          'Cannot Delete Tag',
          'Secret tags can only be deleted when they are active. Please activate the tag first, then try deleting it.',
          [{ text: 'OK', style: 'default' }]
        );
      }
      return;
    }

    // Use browser-compatible confirm for web
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${tag.name}"? This action cannot be undone.\n\nNote: Only active tags can be deleted for security reasons.`
      );
      
      if (confirmed) {
        handleDeleteConfirmed();
      }
    } else {
      Alert.alert(
        'Delete Secret Tag',
        `Are you sure you want to delete "${tag.name}"? This action cannot be undone.\n\nNote: Only active tags can be deleted for security reasons.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: handleDeleteConfirmed,
          },
        ]
      );
    }
  };

  /**
   * Handle the actual deletion after confirmation
   */
  const handleDeleteConfirmed = async () => {
    try {
      console.log(`Proceeding with deletion of tag: ${tag.name}`);
      await onDelete(tag.id);
      
      // Show success message
      if (Platform.OS === 'web') {
        window.alert('The secret tag has been permanently deleted.');
      } else {
        Alert.alert('Tag Deleted', 'The secret tag has been permanently deleted.');
      }
    } catch (error) {
      logger.error('Failed to delete tag:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete tag';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  /**
   * Format creation date
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={[styles.container, isActive && styles.activeContainer]}>
      {/* Tag Header */}
      <View style={styles.header}>
        <View style={styles.tagInfo}>
          <View style={[styles.colorIndicator, { backgroundColor: tag.colorCode }]} />
          <View style={styles.tagDetails}>
            <Text style={styles.tagName}>{tag.name}</Text>
            <Text style={styles.tagDate}>Created {formatDate(tag.createdAt)}</Text>
          </View>
        </View>
        
        {/* Status Badge */}
        <View style={[styles.statusBadge, isActive && styles.activeStatusBadge]}>
          <Text style={[styles.statusText, isActive && styles.activeStatusText]}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Tag Actions */}
      <View style={styles.actions}>
        {/* Activation Toggle */}
        <TouchableOpacity
          style={[styles.actionButton, styles.toggleButton, isActive && styles.activeToggleButton]}
          onPress={handleToggleActivation}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isActive ? theme.colors.background : theme.colors.primary} />
          ) : (
            <>
              <Ionicons
                name={isActive ? 'eye-off' : 'eye'}
                size={16}
                color={isActive ? theme.colors.background : theme.colors.primary}
              />
              <Text style={[styles.actionButtonText, isActive && styles.activeActionButtonText]}>
                {isActive ? 'Deactivate' : 'Activate'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Edit Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => onEdit(tag)}
          disabled={isLoading}
        >
          <Ionicons name="pencil" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.secondaryActionButtonText}>Edit</Text>
        </TouchableOpacity>

        {/* Delete Button */}
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.deleteButton,
            !isActive && styles.disabledButton
          ]}
          onPress={handleDelete}
          disabled={isLoading || !isActive}
        >
          <Ionicons 
            name="trash" 
            size={16} 
            color={!isActive ? theme.colors.textSecondary : theme.colors.error} 
          />
          <Text style={[
            styles.secondaryActionButtonText, 
            { color: !isActive ? theme.colors.textSecondary : theme.colors.error }
          ]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Tag Info */}
      {isActive && (
        <View style={styles.activeInfo}>
          <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
          <Text style={styles.activeInfoText}>
            This tag is currently active. New entries will be encrypted with this tag. You can delete this tag while it's active.
          </Text>
        </View>
      )}

      {/* Inactive Tag Info */}
      {!isActive && (
        <View style={styles.inactiveInfo}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.inactiveInfoText}>
            Activate this tag to enable deletion and encryption features.
          </Text>
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  activeContainer: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  tagInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  tagDetails: {
    flex: 1,
  },
  tagName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: 2,
  },
  tagDate: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
  },
  activeStatusBadge: {
    backgroundColor: theme.colors.primary,
  },
  statusText: {
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  activeStatusText: {
    color: theme.colors.background,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 2,
    justifyContent: 'center',
  },
  toggleButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  activeToggleButton: {
    backgroundColor: theme.colors.primary,
  },
  editButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: 4,
  },
  activeActionButtonText: {
    color: theme.colors.background,
  },
  secondaryActionButtonText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: 4,
  },
  activeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight || theme.colors.primary + '20',
    padding: theme.spacing.sm,
    borderRadius: 8,
    marginTop: theme.spacing.sm,
  },
  activeInfoText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginLeft: theme.spacing.xs,
    flex: 1,
  },
  inactiveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    borderRadius: 8,
    marginTop: theme.spacing.sm,
  },
  inactiveInfoText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginLeft: theme.spacing.xs,
    flex: 1,
  },
  disabledButton: {
    opacity: 0.5,
    borderColor: theme.colors.border,
  },
});

export default SecretTagCard; 