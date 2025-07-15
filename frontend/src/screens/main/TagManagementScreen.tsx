/**
 * Tag Management Screen
 * 
 * Provides an interface for managing both regular tags and secret tags.
 * Integrates with the OPAQUE-based secret tag system.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { MainStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { tagManager } from '../../services/tagManager';
import SecretTagSetup from '../../components/SecretTagSetup';
import RegularTagCreate from '../../components/RegularTagCreate';
import SecretTagCard from '../../components/SecretTagCard';
import ScreenHeader from '../../components/ScreenHeader';
import { Tag } from '../../types';
import { OpaqueSecretTag } from '../../types/opaqueTypes';
import logger from '../../utils/logger';

type TagManagementNavigationProp = StackNavigationProp<MainStackParamList, 'TagManagement'>;

interface TagManagementScreenProps {}

const TagManagementScreen: React.FC<TagManagementScreenProps> = () => {
  const navigation = useNavigation<TagManagementNavigationProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  // State
  const [regularTags, setRegularTags] = useState<Tag[]>([]);
  const [secretTags, setSecretTags] = useState<OpaqueSecretTag[]>([]);
  const [activeSecretTags, setActiveSecretTags] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSecretTagSetup, setShowSecretTagSetup] = useState(false);
  const [showRegularTagCreate, setShowRegularTagCreate] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'regular' | 'secret'>('regular');

  /**
   * Load secret tags from server
   */
  const loadSecretTags = useCallback(async () => {
    try {
      logger.info('Loading secret tags from server');
      
      // Use the working OPAQUE API endpoint
      const response = await fetch('/api/opaque/secret-tags', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const tags = await response.json();
        setSecretTags(tags.map((tag: any) => ({
          ...tag,
          id: tag.tag_id, // Convert tag_id to id for consistency
          auth_method: 'opaque' as const,
          security_level: 'standard' as const,
          authentication_count: 0
        })));
        logger.info(`Loaded ${tags.length} secret tags`);
      } else {
        logger.error('Failed to load secret tags:', response.statusText);
        setSecretTags([]);
      }
    } catch (error) {
      logger.error('Error loading secret tags:', error);
      setSecretTags([]);
    }
  }, []);

  /**
   * Load all tags (regular and secret)
   */
  const loadTags = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load regular tags
      const tags = await tagManager.getAllTags();
      setRegularTags(tags);
      
      // Load secret tags
      await loadSecretTags();
      
    } catch (error) {
      logger.error('Failed to load tags:', error);
      Alert.alert('Error', 'Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  }, [loadSecretTags]);

  /**
   * Refresh tags
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadTags();
    setIsRefreshing(false);
  }, [loadTags]);

  /**
   * Handle regular tag creation
   */
  const handleRegularTagCreate = useCallback(() => {
    setShowRegularTagCreate(true);
  }, []);

  /**
   * Handle regular tag created callback
   */
  const handleRegularTagCreated = useCallback((newTag: Tag) => {
    setRegularTags(prev => [...prev, newTag]);
    setShowRegularTagCreate(false);
    logger.info('Regular tag created:', newTag);
  }, []);

  /**
   * Handle regular tag create cancelled
   */
  const handleRegularTagCreateCancelled = useCallback(() => {
    setShowRegularTagCreate(false);
  }, []);

  /**
   * Handle secret tag activation
   */
  const handleSecretTagActivate = useCallback(async (tagId: string) => {
    try {
      // Use the speech API for activation (this is client-side managed)
      const response = await fetch('/api/speech/secret-tag/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tag_id: tagId,
          action: 'activate'
        })
      });

      if (response.ok) {
        setActiveSecretTags(prev => new Set([...prev, tagId]));
        logger.info('Secret tag activated:', tagId);
      } else {
        throw new Error('Failed to activate secret tag');
      }
    } catch (error) {
      logger.error('Failed to activate secret tag:', error);
      throw error;
    }
  }, []);

  /**
   * Handle secret tag deactivation
   */
  const handleSecretTagDeactivate = useCallback(async (tagId: string) => {
    try {
      // Use the speech API for deactivation (this is client-side managed)
      const response = await fetch('/api/speech/secret-tag/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tag_id: tagId,
          action: 'deactivate'
        })
      });

      if (response.ok) {
        setActiveSecretTags(prev => {
          const newSet = new Set(prev);
          newSet.delete(tagId);
          return newSet;
        });
        logger.info('Secret tag deactivated:', tagId);
      } else {
        throw new Error('Failed to deactivate secret tag');
      }
    } catch (error) {
      logger.error('Failed to deactivate secret tag:', error);
      throw error;
    }
  }, []);

  /**
   * Handle secret tag editing
   */
  const handleSecretTagEdit = useCallback((tag: OpaqueSecretTag) => {
    // For now, show an alert. In a full implementation, this would open an edit modal
    Alert.alert('Edit Tag', `Editing "${tag.tag_name}" is not yet implemented.`);
  }, []);

  /**
   * Handle secret tag deletion
   */
  const handleSecretTagDelete = useCallback(async (tagId: string) => {
    try {
      // Use the working OPAQUE API endpoint for deletion
      const response = await fetch(`/api/opaque/secret-tags/${tagId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setSecretTags(prev => prev.filter(tag => tag.id !== tagId));
        setActiveSecretTags(prev => {
          const newSet = new Set(prev);
          newSet.delete(tagId);
          return newSet;
        });
        logger.info('Secret tag deleted:', tagId);
      } else {
        throw new Error('Failed to delete secret tag');
      }
    } catch (error) {
      logger.error('Failed to delete secret tag:', error);
      throw error;
    }
  }, []);

  /**
   * Handle secret tag creation
   */
  const handleSecretTagCreated = useCallback((tagId: string) => {
    setShowSecretTagSetup(false);
    loadTags(); // Refresh the tags list
  }, [loadTags]);

  /**
   * Handle FAB press
   */
  const handleFABPress = useCallback(() => {
    if (selectedTab === 'regular') {
      handleRegularTagCreate();
    } else {
      setShowSecretTagSetup(true);
    }
  }, [selectedTab, handleRegularTagCreate]);

  // Load tags on mount
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  /**
   * Render regular tag item
   */
  const renderRegularTag = useCallback(({ item }: { item: Tag }) => (
    <View style={styles.regularTagCard}>
      <View style={styles.tagInfo}>
        <View style={[styles.tagColorIndicator, { backgroundColor: item.color }]} />
        <Text style={styles.tagName}>{item.name}</Text>
      </View>
      <TouchableOpacity
        style={styles.tagDeleteButton}
        onPress={() => {
          Alert.alert(
            'Delete Tag',
            `Are you sure you want to delete "${item.name}"?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await tagManager.deleteTag(String(item.id));
                    setRegularTags(prev => prev.filter(tag => tag.id !== item.id));
                  } catch (error) {
                    Alert.alert('Error', 'Failed to delete tag');
                  }
                },
              },
            ]
          );
        }}
      >
        <Ionicons name="trash" size={18} color={theme.colors.error} />
      </TouchableOpacity>
    </View>
  ), [styles, theme.colors.error]);

  /**
   * Render secret tag item
   */
  const renderSecretTag = useCallback(({ item }: { item: OpaqueSecretTag }) => (
    <SecretTagCard
      tag={item}
      isActive={activeSecretTags.has(item.id)}
      onActivate={handleSecretTagActivate}
      onDeactivate={handleSecretTagDeactivate}
      onEdit={handleSecretTagEdit}
      onDelete={handleSecretTagDelete}
    />
  ), [activeSecretTags, handleSecretTagActivate, handleSecretTagDeactivate, handleSecretTagEdit, handleSecretTagDelete]);

  // If showing regular tag creation modal
  if (showRegularTagCreate) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Create Regular Tag" />
        <RegularTagCreate
          onTagCreated={handleRegularTagCreated}
          onCancel={handleRegularTagCreateCancelled}
          existingTagNames={regularTags.map(tag => tag.name)}
        />
      </View>
    );
  }

  // If showing secret tag setup modal
  if (showSecretTagSetup) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Create Secret Tag" />
        <SecretTagSetup
          onTagCreated={handleSecretTagCreated}
          onCancel={() => setShowSecretTagSetup(false)}
          existingTagNames={secretTags.map(tag => tag.tag_name)}
          enableOpaqueAuth={true}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Tag Management" />
      
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'regular' && styles.activeTab]}
          onPress={() => setSelectedTab('regular')}
        >
          <Ionicons 
            name="pricetag" 
            size={20} 
            color={selectedTab === 'regular' ? theme.colors.primary : theme.colors.textSecondary} 
          />
          <Text style={[styles.tabText, selectedTab === 'regular' && styles.activeTabText]}>
            Regular Tags
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'secret' && styles.activeTab]}
          onPress={() => setSelectedTab('secret')}
        >
          <Ionicons 
            name="shield" 
            size={20} 
            color={selectedTab === 'secret' ? theme.colors.primary : theme.colors.textSecondary} 
          />
          <Text style={[styles.tabText, selectedTab === 'secret' && styles.activeTabText]}>
            Secret Tags
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading tags...</Text>
          </View>
        ) : (
          <>
            {selectedTab === 'regular' ? (
              <FlatList
                data={regularTags}
                renderItem={renderRegularTag}
                keyExtractor={(item) => String(item.id)}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    colors={[theme.colors.primary]}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="pricetag-outline" size={64} color={theme.colors.textSecondary} />
                    <Text style={styles.emptyText}>No regular tags yet</Text>
                    <Text style={styles.emptySubtext}>
                      Tap the + button to create your first tag
                    </Text>
                  </View>
                }
              />
            ) : (
              <FlatList
                data={secretTags}
                renderItem={renderSecretTag}
                keyExtractor={(item) => item.id}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    colors={[theme.colors.primary]}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="shield-outline" size={64} color={theme.colors.textSecondary} />
                    <Text style={styles.emptyText}>No secret tags yet</Text>
                    <Text style={styles.emptySubtext}>
                      Tap the + button to create your first secret tag
                    </Text>
                  </View>
                }
              />
            )}
          </>
        )}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleFABPress}
      >
        <Ionicons name="add" size={24} color={theme.colors.onPrimary} />
      </TouchableOpacity>

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  regularTagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tagColorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: theme.spacing.md,
  },
  tagName: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  tagDeleteButton: {
    padding: theme.spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  backButton: {
    position: 'absolute',
    top: theme.spacing.xl,
    left: theme.spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});

export default TagManagementScreen; 