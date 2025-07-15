/**
 * Regular Tag Create Component
 * 
 * Simple modal for creating regular tags with name and color selection.
 * Works cross-platform (web, iOS, Android).
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { TagsAPI } from '../services/api';
import logger from '../utils/logger';
import { Tag } from '../types';

interface RegularTagCreateProps {
  onTagCreated?: (tag: Tag) => void;
  onCancel?: () => void;
  existingTagNames?: string[];
}

const RegularTagCreate: React.FC<RegularTagCreateProps> = ({
  onTagCreated,
  onCancel,
  existingTagNames = [],
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#007AFF');
  const [isLoading, setIsLoading] = useState(false);

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
   * Handle tag creation
   */
  const handleCreateTag = useCallback(async () => {
    // Validate inputs
    const nameError = validateTagName(tagName);
    if (nameError) {
      Alert.alert('Invalid Name', nameError);
      return;
    }

    setIsLoading(true);

    try {
      // Create tag via API
      const newTag = await TagsAPI.createTag({
        name: tagName.trim(),
        color: selectedColor
      });

      logger.info('Regular tag created:', newTag);
      onTagCreated?.(newTag);
      
      // Clear form
      setTagName('');
      setSelectedColor('#007AFF');
      
    } catch (error) {
      logger.error('Failed to create regular tag:', error);
      Alert.alert(
        'Creation Failed',
        error instanceof Error ? error.message : 'Failed to create tag'
      );
    } finally {
      setIsLoading(false);
    }
  }, [tagName, selectedColor, validateTagName, onTagCreated]);

  const canCreate = tagName.trim() && !isLoading;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Regular Tag</Text>
          <Text style={styles.subtitle}>
            Regular tags help organize your journal entries
          </Text>
        </View>

        {/* Tag Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Tag Name</Text>
          <TextInput
            style={styles.input}
            value={tagName}
            onChangeText={setTagName}
            placeholder="e.g., Work, Personal, Travel"
            placeholderTextColor={theme.colors.textSecondary}
            maxLength={50}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus={true}
          />
        </View>

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
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview */}
        <View style={styles.previewContainer}>
          <Text style={styles.label}>Preview</Text>
          <View style={styles.tagPreview}>
            <View style={[styles.tagColorIndicator, { backgroundColor: selectedColor }]} />
            <Text style={styles.tagPreviewText}>{tagName || 'Your tag name'}</Text>
          </View>
        </View>
      </ScrollView>

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
          style={[
            styles.button, 
            styles.createButton,
            !canCreate && styles.disabledButton
          ]}
          onPress={handleCreateTag}
          disabled={!canCreate}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.createButtonText}>Create Tag</Text>
          )}
        </TouchableOpacity>
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
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamilies.regular,
  },
  inputContainer: {
    marginBottom: theme.spacing.xl,
  },
  label: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.inputBackground,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: theme.colors.text,
    borderWidth: 3,
  },
  previewContainer: {
    marginBottom: theme.spacing.xl,
  },
  tagPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagColorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: theme.spacing.md,
  },
  tagPreviewText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
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
  createButton: {
    backgroundColor: theme.colors.primary,
  },
  createButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.onPrimary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default RegularTagCreate; 