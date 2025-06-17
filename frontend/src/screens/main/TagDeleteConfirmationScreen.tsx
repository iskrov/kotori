import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { MainStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { tagManager } from '../../services/tagManager';
import logger from '../../utils/logger';

type TagDeleteConfirmationRouteProp = RouteProp<MainStackParamList, 'TagDeleteConfirmation'>;
type TagDeleteConfirmationNavigationProp = StackNavigationProp<MainStackParamList, 'TagDeleteConfirmation'>;

const TagDeleteConfirmationScreen = () => {
  const navigation = useNavigation<TagDeleteConfirmationNavigationProp>();
  const route = useRoute<TagDeleteConfirmationRouteProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { tagId, tagName, tagType } = route.params;

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleConfirmDelete = async () => {
    try {
      logger.info(`[TagDeleteConfirmation] Deleting ${tagType} tag: ${tagName} (ID: ${tagId})`);
      
      if (tagType === 'secret') {
        await tagManager.deleteSecretTag(tagId);
      } else {
        await tagManager.deleteRegularTag(tagId);
      }
      
      logger.info(`[TagDeleteConfirmation] ${tagType} tag deleted successfully`);
      
      // Navigate back to the tag management screen
      navigation.goBack();
    } catch (error) {
      logger.error(`[TagDeleteConfirmation] Error deleting ${tagType} tag:`, error);
      // Navigate back on error - the TagsManager will handle showing error messages
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name="pricetag-outline" 
            size={theme.spacing.xxl * 2} 
            color={theme.colors.error} 
          />
        </View>
        
        <Text style={styles.title}>Delete Tag</Text>
        
        <Text style={styles.message}>
          Are you sure you want to delete the tag "{tagName}"? This action cannot be undone.
          {tagType === 'secret' && '\n\nThis will also remove the tag from all associated journal entries.'}
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.deleteButton]}
            onPress={handleConfirmDelete}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  iconContainer: {
    width: theme.spacing.xxl * 3,
    height: theme.spacing.xxl * 3,
    borderRadius: theme.spacing.xxl * 1.5,
    backgroundColor: theme.colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamilies.bold,
  },
  message: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.md,
    marginBottom: theme.spacing.xxl,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
  },
  cancelButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  deleteButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.white,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
});

export default TagDeleteConfirmationScreen; 