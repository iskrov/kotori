/**
 * Tag Management Screen
 * 
 * Main screen for managing all tags - regular and secret.
 * Accessed from Settings and provides unified tag management interface.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { MainStackParamList } from '../../navigation/types';
import TagsManager from '../../components/TagsManager';
import logger from '../../utils/logger';

type TagManagementScreenNavigationProp = StackNavigationProp<MainStackParamList, 'TagManagement'>;

const TagManagementScreen: React.FC = () => {
  const navigation = useNavigation<TagManagementScreenNavigationProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  const [showOverview, setShowOverview] = useState(false);

  /**
   * Handle refresh from TagsManager
   */
  const handleRefresh = useCallback(() => {
    logger.info('Tags refreshed from TagManagementScreen');
  }, []);

  /**
   * Handle back navigation
   */
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  /**
   * Show app info/help
   */
  const handleShowInfo = useCallback(() => {
    Alert.alert(
      'About Tags',
      'Organize your journal entries with tags:\n\n' +
      '• Regular tags work with multiple entries\n' +
      '• Secret tags provide privacy with voice activation\n' +
      '• Use search and filters to find entries quickly\n\n' +
      'Tip: You can switch between tag types using the toggle at the top.',
      [{ text: 'Got it', style: 'default' }]
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={handleBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Tags</Text>
        
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={handleShowInfo}
          accessibilityLabel="Show help"
          accessibilityRole="button"
        >
          <Ionicons name="help-circle-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tags Manager */}
      <TagsManager onRefresh={handleRefresh} />
    </SafeAreaView>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    ...theme.shadows.sm,
  },
  
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  
  headerTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    textAlign: 'center',
    flex: 1,
  },
});

export default TagManagementScreen; 