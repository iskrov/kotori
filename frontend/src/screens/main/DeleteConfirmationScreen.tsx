import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { JournalAPI } from '../../services/api';
import { MainStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import hapticService from '../../services/hapticService';

type DeleteConfirmationRouteProp = RouteProp<MainStackParamList, 'DeleteConfirmation'>;
type DeleteConfirmationNavigationProp = StackNavigationProp<MainStackParamList, 'DeleteConfirmation'>;

const DeleteConfirmationScreen = () => {
  const navigation = useNavigation<DeleteConfirmationNavigationProp>();
  const route = useRoute<DeleteConfirmationRouteProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { entryId } = route.params;
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCancel = () => {
    hapticService.light();
    navigation.goBack();
  };

  const handleConfirmDelete = async () => {
    if (isDeleting) return; // Prevent double-clicking
    
    try {
      setIsDeleting(true);
      hapticService.medium(); // Strong feedback for destructive action
      console.log(`[DeleteConfirmation] Deleting entry with ID: ${entryId}`);
      await JournalAPI.deleteEntry(parseInt(entryId));
      console.log('[DeleteConfirmation] Delete successful');
      
      hapticService.success(); // Success feedback
      // Navigate back to the main tabs and then to Journal tab
      navigation.navigate('MainTabs', {
        screen: 'Journal',
        params: { screen: 'JournalList' }
      });
    } catch (error) {
      console.error('[DeleteConfirmation] Error deleting entry:', error);
      // If entry was already deleted (404), treat as success
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        console.log('[DeleteConfirmation] Entry already deleted, treating as success');
        hapticService.success(); // Success feedback for already deleted
        navigation.navigate('MainTabs', {
          screen: 'Journal',
          params: { screen: 'JournalList' }
        });
      } else {
        hapticService.error(); // Error feedback
        // For other errors, go back to previous screen
        navigation.goBack();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name="trash-outline" 
            size={theme.spacing.xxl * 2} 
            color={theme.colors.error} 
          />
        </View>
        
        <Text style={styles.title}>Delete Journal Entry</Text>
        
        <Text style={styles.message}>
          Are you sure you want to delete this journal entry? This action cannot be undone.
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton, isDeleting && { opacity: 0.5 }]}
            onPress={handleCancel}
            disabled={isDeleting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.deleteButton, isDeleting && { opacity: 0.7 }]}
            onPress={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={styles.deleteButtonText}>Delete</Text>
            )}
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

export default DeleteConfirmationScreen; 