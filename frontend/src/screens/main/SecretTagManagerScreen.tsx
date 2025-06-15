/**
 * Secret Tag Manager Screen
 * 
 * Main screen for managing secret tags - view, create, edit, delete, and activate tags.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { MainStackParamList } from '../../navigation/types';
import { tagManager } from '../../services/tagManager';
import { SecretTagV2 } from '../../services/secretTagOnlineManager';
import SecretTagCard from '../../components/SecretTagCard';
import SecretTagIndicator from '../../components/SecretTagIndicator';
import SecretTagSetup from '../../components/SecretTagSetup';
import logger from '../../utils/logger';

type SecretTagManagerScreenNavigationProp = StackNavigationProp<MainStackParamList, 'SecretTagManager'>;

const SecretTagManagerScreen: React.FC = () => {
  const navigation = useNavigation<SecretTagManagerScreenNavigationProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  const [secretTags, setSecretTags] = useState<SecretTagV2[]>([]);
  const [activeTags, setActiveTags] = useState<SecretTagV2[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState<SecretTagV2 | null>(null);

  /**
   * Load secret tags from storage
   */
  const loadSecretTags = useCallback(async () => {
    try {
      const [allTags, activeTagsList] = await Promise.all([
        tagManager.getSecretTags(),
        tagManager.getActiveSecretTags(),
      ]);
      
      setSecretTags(allTags);
      setActiveTags(activeTagsList);
    } catch (error) {
      logger.error('Failed to load secret tags:', error);
      Alert.alert('Error', 'Failed to load secret tags');
    }
  }, []);

  /**
   * Initialize screen
   */
  useEffect(() => {
    const initializeScreen = async () => {
      setIsLoading(true);
      await secretTagManager.initialize();
      await loadSecretTags();
      setIsLoading(false);
    };

    initializeScreen();
  }, [loadSecretTags]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSecretTags();
    setIsRefreshing(false);
  }, [loadSecretTags]);

  /**
   * Handle tag activation
   */
  const handleActivateTag = useCallback(async (tagId: string) => {
    try {
      await secretTagManager.activateSecretTag(tagId);
      await loadSecretTags();
      
      const tag = secretTags.find(t => t.id === tagId);
      if (tag) {
        Alert.alert(
          'Tag Activated',
          `"${tag.name}" is now active. New journal entries will be encrypted with this tag.`
        );
      }
    } catch (error) {
      logger.error('Failed to activate tag:', error);
      throw error;
    }
  }, [secretTags, loadSecretTags]);

  /**
   * Handle tag deactivation
   */
  const handleDeactivateTag = useCallback(async (tagId: string) => {
    try {
      await secretTagManager.deactivateSecretTag(tagId);
      await loadSecretTags();
      
      const tag = secretTags.find(t => t.id === tagId);
      if (tag) {
        Alert.alert(
          'Tag Deactivated',
          `"${tag.name}" is now inactive. New entries will be public unless another tag is active.`
        );
      }
    } catch (error) {
      logger.error('Failed to deactivate tag:', error);
      throw error;
    }
  }, [secretTags, loadSecretTags]);

  /**
   * Handle tag deletion
   */
  const handleDeleteTag = useCallback(async (tagId: string) => {
    try {
      await secretTagManager.deleteSecretTag(tagId);
      await loadSecretTags();
      
      Alert.alert('Tag Deleted', 'The secret tag has been permanently deleted.');
    } catch (error) {
      logger.error('Failed to delete tag:', error);
      throw error;
    }
  }, [loadSecretTags]);

  /**
   * Handle tag creation
   */
  const handleTagCreated = useCallback(async (tagId: string) => {
    setShowCreateForm(false);
    await loadSecretTags();
  }, [loadSecretTags]);

  /**
   * Handle edit tag
   */
  const handleEditTag = useCallback((tag: SecretTag) => {
    setEditingTag(tag);
    // TODO: Implement edit modal/screen
    Alert.alert('Coming Soon', 'Tag editing will be available in a future update.');
  }, []);

  /**
   * Deactivate all tags
   */
  const handleDeactivateAll = useCallback(async () => {
    Alert.alert(
      'Deactivate All Tags',
      'Are you sure you want to deactivate all secret tags? New entries will be public.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate All',
          style: 'destructive',
          onPress: async () => {
            try {
              await secretTagManager.deactivateAllSecretTags();
              await loadSecretTags();
              Alert.alert('All Tags Deactivated', 'All secret tags have been deactivated.');
            } catch (error) {
              logger.error('Failed to deactivate all tags:', error);
              Alert.alert('Error', 'Failed to deactivate tags');
            }
          },
        },
      ]
    );
  }, [loadSecretTags]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading secret tags...</Text>
      </View>
    );
  }

  if (showCreateForm) {
    return (
      <SecretTagSetup
        onTagCreated={handleTagCreated}
        onCancel={() => setShowCreateForm(false)}
        existingTagNames={secretTags.map(tag => tag.name)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Secret Tags</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowCreateForm(true)}
        >
          <Ionicons name="add" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Active Tags Indicator */}
        {activeTags.length > 0 && (
          <View style={styles.section}>
            <SecretTagIndicator
              activeTags={activeTags}
              onPress={() => {
                if (activeTags.length > 1) {
                  Alert.alert(
                    'Multiple Active Tags',
                    `You have ${activeTags.length} active tags:\n${activeTags.map(tag => `• ${tag.name}`).join('\n')}`
                  );
                }
              }}
            />
            
            {activeTags.length > 1 && (
              <TouchableOpacity
                style={styles.deactivateAllButton}
                onPress={handleDeactivateAll}
              >
                <Ionicons name="power" size={16} color={theme.colors.error} />
                <Text style={styles.deactivateAllText}>Deactivate All</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tags List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Your Secret Tags ({secretTags.length})
          </Text>
          
          {secretTags.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Secret Tags</Text>
              <Text style={styles.emptyDescription}>
                Create your first secret tag to start organizing your private journal entries.
              </Text>
              <TouchableOpacity
                style={styles.createFirstButton}
                onPress={() => setShowCreateForm(true)}
              >
                <Ionicons name="add-circle" size={20} color={theme.colors.background} />
                <Text style={styles.createFirstButtonText}>Create First Tag</Text>
              </TouchableOpacity>
            </View>
          ) : (
            secretTags.map((tag) => (
              <SecretTagCard
                key={tag.id}
                tag={tag}
                isActive={activeTags.some(activeTag => activeTag.id === tag.id)}
                onActivate={handleActivateTag}
                onDeactivate={handleDeactivateTag}
                onEdit={handleEditTag}
                onDelete={handleDeleteTag}
              />
            ))
          )}
        </View>

        {/* Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Secret Tags Work</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <Ionicons name="mic" size={20} color={theme.colors.primary} />
              <Text style={styles.infoText}>
                Speak your activation phrase during recording to activate a tag
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="lock-closed" size={20} color={theme.colors.primary} />
              <Text style={styles.infoText}>
                Each tag has its own encryption key for maximum security
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="eye-off" size={20} color={theme.colors.primary} />
              <Text style={styles.infoText}>
                Server never sees your tag names or activation phrases
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="layers" size={20} color={theme.colors.primary} />
              <Text style={styles.infoText}>
                Multiple tags can be active simultaneously
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.md,
  },
  deactivateAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: 8,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  deactivateAllText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptyDescription: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
  },
  createFirstButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: theme.spacing.xs,
  },
  infoCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: 20,
    marginLeft: theme.spacing.sm,
  },
  bottomSpacing: {
    height: theme.spacing.xxxl,
  },
});

export default SecretTagManagerScreen; 