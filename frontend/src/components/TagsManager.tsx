/**
 * Tags Manager Component
 * 
 * Unified interface for managing both regular and secret tags
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { Tag } from '../types';
import { SecretTagV2 } from '../services/secretTagOnlineManager';
import { 
  SecurityMode, 
  NetworkStatus, 
  CacheStatus, 
  tagManager 
} from '../services/tagManager';
import SecurityModeSelector from './SecurityModeSelector';
import CacheStatusIndicator from './CacheStatusIndicator';
import logger from '../utils/logger';

type TagType = 'regular' | 'secret';

interface TagsManagerProps {
  onRefresh?: () => void;
}

interface TagStats {
  entryCount: number;
  lastUsed?: string;
}

interface RegularTagWithStats extends Tag {
  entryCount: number;
  lastUsed?: string;
}

interface SecretTagWithStats extends SecretTagV2 {
  entryCount: number;
  lastUsed?: string;
}

const TagsManager: React.FC<TagsManagerProps> = ({ onRefresh }) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  // UI state
  const [activeTagType, setActiveTagType] = useState<TagType>('regular');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('name');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tag data
  const [regularTags, setRegularTags] = useState<RegularTagWithStats[]>([]);
  const [secretTags, setSecretTags] = useState<SecretTagWithStats[]>([]);

  // Form state
  const [tagName, setTagName] = useState('');
  const [activationPhrase, setActivationPhrase] = useState('');
  const [tagColor, setTagColor] = useState('#007AFF');
  const [editingTag, setEditingTag] = useState<RegularTagWithStats | SecretTagWithStats | null>(null);

  // Tag manager state
  const [securityMode, setSecurityMode] = useState<SecurityMode>('offline');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('unknown');
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    enabled: false,
    entryCount: 0,
    storageSize: 0,
    integrity: 'unknown'
  });

  const colorOptions = [
    '#007AFF', '#FF3B30', '#FF9500', '#FFCC02',
    '#34C759', '#00C7BE', '#32D74B', '#AF52DE',
    '#FF2D92', '#A2845E', '#8E8E93', '#000000'
  ];

  /**
   * Load regular tags
   */
  const loadRegularTags = useCallback(async () => {
    try {
      const tags = await tagManager.getRegularTags();
      
      // TODO: Get actual usage statistics from API
      const tagsWithStats: RegularTagWithStats[] = tags.map(tag => ({
        ...tag,
        entryCount: 0,
        lastUsed: undefined
      }));
      
      setRegularTags(tagsWithStats);
    } catch (error) {
      logger.error('Failed to load regular tags:', error);
    }
  }, []);

  /**
   * Load secret tags
   */
  const loadSecretTags = useCallback(async () => {
    try {
      const tags = await tagManager.getSecretTags();
      
      // TODO: Get actual usage statistics 
      const tagsWithStats: SecretTagWithStats[] = tags.map(tag => ({
        ...tag,
        entryCount: 0,
        lastUsed: undefined
      }));
      
      setSecretTags(tagsWithStats);
    } catch (error) {
      logger.error('Failed to load secret tags:', error);
    }
  }, []);

  /**
   * Load all tags
   */
  const loadAllTags = useCallback(async () => {
    await Promise.all([
      loadRegularTags(),
      loadSecretTags()
    ]);
  }, [loadRegularTags, loadSecretTags]);

  /**
   * Load tag manager status
   */
  const loadTagStatus = useCallback(async () => {
    try {
      const config = tagManager.getConfig();
      const networkStatus = tagManager.getNetworkStatus();
      const cacheStatus = await tagManager.getCacheStatus();

      setSecurityMode(config.securityMode);
      setNetworkStatus(networkStatus);
      setCacheStatus(cacheStatus);
    } catch (error) {
      logger.error('Failed to load tag status:', error);
    }
  }, []);

  /**
   * Initialize component
   */
  useEffect(() => {
    const initializeManager = async () => {
      setIsLoading(true);
      await tagManager.initialize();
      await loadAllTags();
      await loadTagStatus();
      setIsLoading(false);
    };

    initializeManager();
  }, [loadAllTags, loadTagStatus]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAllTags();
    await loadTagStatus();
    onRefresh?.();
    setIsRefreshing(false);
  }, [loadAllTags, loadTagStatus, onRefresh]);

  /**
   * Handle security mode change
   */
  const handleSecurityModeChange = useCallback(async (mode: SecurityMode) => {
    try {
      await tagManager.setSecurityMode(mode);
      await loadTagStatus();
      await loadSecretTags(); // Reload secret tags as they may change
    } catch (error) {
      logger.error('Failed to change security mode:', error);
      Alert.alert('Error', 'Failed to change security mode');
    }
  }, [loadTagStatus, loadSecretTags]);

  /**
   * Handle clear cache
   */
  const handleClearCache = useCallback(async () => {
    try {
      await tagManager.clearSecretCache();
      await loadTagStatus();
      await loadSecretTags(); // Reload secret tags after cache clear
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      Alert.alert('Error', 'Failed to clear cache');
    }
  }, [loadTagStatus, loadSecretTags]);

  /**
   * Handle sync with server
   */
  const handleSync = useCallback(async () => {
    try {
      await tagManager.syncWithServer();
      await loadTagStatus();
      await loadSecretTags(); // Reload secret tags after sync
    } catch (error) {
      logger.error('Failed to sync with server:', error);
      Alert.alert('Sync Failed', 'Could not sync with server');
    }
  }, [loadTagStatus, loadSecretTags]);

  /**
   * Get current tags based on active type
   */
  const getCurrentTags = useCallback((): (RegularTagWithStats | SecretTagWithStats)[] => {
    return activeTagType === 'regular' ? regularTags : secretTags;
  }, [activeTagType, regularTags, secretTags]);

  /**
   * Filter and sort current tags
   */
  const filteredAndSortedTags = useCallback(() => {
    let filtered = getCurrentTags();

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tag => 
        tag.name.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return b.entryCount - a.entryCount;
        case 'recent':
          if (!a.lastUsed && !b.lastUsed) return 0;
          if (!a.lastUsed) return 1;
          if (!b.lastUsed) return -1;
          return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [getCurrentTags, searchQuery, sortBy]);

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
    
    const currentTags = getCurrentTags();
    const existingTag = currentTags.find(tag => 
      tag.name.toLowerCase() === name.toLowerCase() && 
      (!editingTag || tag.id !== editingTag.id)
    );
    
    if (existingTag) {
      return 'A tag with this name already exists';
    }
    
    return null;
  }, [getCurrentTags, editingTag]);

  /**
   * Validate activation phrase for secret tags
   */
  const validateActivationPhrase = useCallback((phrase: string): string | null => {
    if (activeTagType !== 'secret') return null;
    
    if (!phrase.trim()) {
      return 'Activation phrase cannot be empty';
    }
    
    if (phrase.length < 3) {
      return 'Activation phrase must be at least 3 characters';
    }
    
    if (phrase.length > 100) {
      return 'Activation phrase must be less than 100 characters';
    }
    
    return null;
  }, [activeTagType]);

  /**
   * Handle create/edit tag
   */
  const handleSubmitTag = useCallback(async () => {
    const nameValidation = validateTagName(tagName);
    if (nameValidation) {
      Alert.alert('Invalid Tag Name', nameValidation);
      return;
    }

    if (activeTagType === 'secret') {
      const phraseValidation = validateActivationPhrase(activationPhrase);
      if (phraseValidation) {
        Alert.alert('Invalid Activation Phrase', phraseValidation);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingTag) {
        Alert.alert('Coming Soon', 'Tag editing will be available in a future update.');
      } else {
        if (activeTagType === 'secret') {
          // Create secret tag
          await tagManager.createSecretTag(tagName, activationPhrase, tagColor);
          await loadSecretTags();
        } else {
          // Create regular tag
          await tagManager.createRegularTag(tagName, tagColor);
          await loadRegularTags();
        }
      }
      
      // Reset form
      setTagName('');
      setActivationPhrase('');
      setTagColor('#007AFF');
      setShowCreateModal(false);
      setEditingTag(null);
    } catch (error) {
      logger.error('Failed to save tag:', error);
      Alert.alert('Error', 'Failed to save tag');
    } finally {
      setIsSubmitting(false);
    }
  }, [tagName, activationPhrase, tagColor, activeTagType, editingTag, validateTagName, validateActivationPhrase, loadSecretTags, loadRegularTags]);

  /**
   * Handle delete tag
   */
  const handleDeleteTag = useCallback(async (tag: RegularTagWithStats | SecretTagWithStats) => {
    Alert.alert(
      'Delete Tag',
      `Are you sure you want to delete "${tag.name}"? This will remove it from ${tag.entryCount} journal entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeTagType === 'secret') {
                await tagManager.deleteSecretTag(String(tag.id));
                await loadSecretTags();
              } else {
                await tagManager.deleteRegularTag(String(tag.id));
                await loadRegularTags();
              }
            } catch (error) {
              logger.error('Failed to delete tag:', error);
              Alert.alert('Error', 'Failed to delete tag');
            }
          }
        }
      ]
    );
  }, [activeTagType, loadSecretTags, loadRegularTags]);

  /**
   * Handle edit tag
   */
  const handleEditTag = useCallback((tag: RegularTagWithStats | SecretTagWithStats) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tagColor); // TODO: Get actual color from tag
    if (activeTagType === 'secret') {
      // TODO: Get activation phrase from secret tag (if editable)
      setActivationPhrase('');
    }
    setShowCreateModal(true);
  }, [activeTagType, tagColor]);

  /**
   * Render tag type toggle
   */
  const renderTagTypeToggle = () => (
    <View style={styles.toggleContainer}>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          activeTagType === 'regular' && styles.activeToggleButton
        ]}
        onPress={() => setActiveTagType('regular')}
      >
        <Ionicons 
          name="pricetag" 
          size={16} 
          color={activeTagType === 'regular' ? theme.colors.background : theme.colors.textSecondary} 
        />
        <Text style={[
          styles.toggleButtonText,
          activeTagType === 'regular' && styles.activeToggleButtonText
        ]}>
          Tags
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.toggleButton,
          activeTagType === 'secret' && styles.activeToggleButton
        ]}
        onPress={() => setActiveTagType('secret')}
      >
        <Ionicons 
          name="shield" 
          size={16} 
          color={activeTagType === 'secret' ? theme.colors.background : theme.colors.textSecondary} 
        />
        <Text style={[
          styles.toggleButtonText,
          activeTagType === 'secret' && styles.activeToggleButtonText
        ]}>
          Secret Tags
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render statistics
   */
  const renderTagStats = () => {
    const currentTags = getCurrentTags();
    const totalTags = currentTags.length;
    const totalUsage = currentTags.reduce((sum, tag) => sum + tag.entryCount, 0);
    const averageUsage = totalTags > 0 ? totalUsage / totalTags : 0;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalTags}</Text>
          <Text style={styles.statLabel}>
            {activeTagType === 'regular' ? 'Tags' : 'Secret Tags'}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalUsage}</Text>
          <Text style={styles.statLabel}>Total Usage</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{averageUsage.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Avg Usage</Text>
        </View>
      </View>
    );
  };

  /**
   * Render tag card
   */
  const renderTagCard = (tag: RegularTagWithStats | SecretTagWithStats) => (
    <View key={tag.id} style={styles.tagCard}>
      <View style={styles.tagInfo}>
        <View style={styles.tagHeader}>
          <View style={styles.tagTitleContainer}>
            {activeTagType === 'secret' && (
              <Ionicons name="shield" size={16} color={theme.colors.primary} />
            )}
            <Text style={styles.tagName}>#{tag.name}</Text>
          </View>
          <View style={styles.tagActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditTag(tag)}
            >
              <Ionicons name="pencil" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteTag(tag)}
            >
              <Ionicons name="trash" size={16} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.tagStats}>
          <View style={styles.tagStat}>
            <Ionicons name="document-text" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.tagStatText}>{tag.entryCount} entries</Text>
          </View>
          {tag.lastUsed && (
            <View style={styles.tagStat}>
              <Ionicons name="time" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.tagStatText}>
                {new Date(tag.lastUsed).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading tags...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with toggle */}
      {renderTagTypeToggle()}

      {/* Secret tags security controls */}
      {activeTagType === 'secret' && (
        <View style={styles.securitySection}>
          <SecurityModeSelector
            currentMode={securityMode}
            onModeChange={handleSecurityModeChange}
            disabled={isLoading || isRefreshing}
          />
          
          <CacheStatusIndicator
            cacheStatus={cacheStatus}
            networkStatus={networkStatus}
            onRefresh={loadTagStatus}
            onClearCache={handleClearCache}
            onSync={handleSync}
            disabled={isLoading || isRefreshing}
          />
        </View>
      )}

      {/* Statistics */}
      {renderTagStats()}

      {/* Search and sort controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeTagType} tags...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {(['name', 'usage', 'recent'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.sortButton,
                sortBy === option && styles.activeSortButton
              ]}
              onPress={() => setSortBy(option)}
            >
              <Text style={[
                styles.sortButtonText,
                sortBy === option && styles.activeSortButtonText
              ]}>
                {option === 'name' ? 'Name' : option === 'usage' ? 'Usage' : 'Recent'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tags list */}
      <ScrollView
        style={styles.tagsList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {filteredAndSortedTags().map(renderTagCard)}
        
        {filteredAndSortedTags().length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTagType === 'secret' ? 'shield-outline' : 'pricetag-outline'}
              size={48}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyStateTitle}>
              No {activeTagType} tags {searchQuery ? 'found' : 'yet'}
            </Text>
            <Text style={styles.emptyStateMessage}>
              {searchQuery 
                ? `No tags match "${searchQuery}"`
                : `Create your first ${activeTagType} tag to get started`
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Create button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={24} color={theme.colors.background} />
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCreateModal(false);
          setEditingTag(null);
          setTagName('');
          setActivationPhrase('');
          setTagColor('#007AFF');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTag ? 'Edit' : 'Create'} {activeTagType === 'secret' ? 'Secret' : ''} Tag
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setEditingTag(null);
                  setTagName('');
                  setActivationPhrase('');
                  setTagColor('#007AFF');
                }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Tag Name</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    tagName && validateTagName(tagName) ? styles.textInputError : null
                  ]}
                  value={tagName}
                  onChangeText={setTagName}
                  placeholder="e.g., work, personal, ideas"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={50}
                />
                {tagName && validateTagName(tagName) && (
                  <Text style={styles.errorText}>{validateTagName(tagName)}</Text>
                )}
              </View>

              {activeTagType === 'secret' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Activation Phrase</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      activationPhrase && validateActivationPhrase(activationPhrase) ? styles.textInputError : null
                    ]}
                    value={activationPhrase}
                    onChangeText={setActivationPhrase}
                    placeholder="e.g., activate work mode, private thoughts"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={100}
                  />
                  {activationPhrase && validateActivationPhrase(activationPhrase) && (
                    <Text style={styles.errorText}>{validateActivationPhrase(activationPhrase)}</Text>
                  )}
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Color</Text>
                <View style={styles.colorGrid}>
                  {colorOptions.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        tagColor === color && styles.selectedColorOption,
                      ]}
                      onPress={() => setTagColor(color)}
                    >
                      {tagColor === color && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowCreateModal(false);
                    setEditingTag(null);
                    setTagName('');
                    setActivationPhrase('');
                    setTagColor('#007AFF');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.submitButton,
                    ((!tagName.trim() || 
                     !!validateTagName(tagName) || 
                     (activeTagType === 'secret' && !!validateActivationPhrase(activationPhrase)) ||
                     isSubmitting) ? styles.disabledButton : null)
                  ]}
                  onPress={handleSubmitTag}
                  disabled={
                    !tagName.trim() || 
                    !!validateTagName(tagName) || 
                    (activeTagType === 'secret' && !!validateActivationPhrase(activationPhrase)) ||
                    isSubmitting
                  }
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={theme.colors.background} />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {editingTag ? 'Update' : 'Create'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },

  // Tag type toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderRadius: 12,
    padding: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 8,
  },
  activeToggleButton: {
    backgroundColor: theme.colors.primary,
  },
  toggleButtonText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  activeToggleButtonText: {
    color: theme.colors.background,
  },

  // Security section
  securitySection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },

  // Statistics
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderRadius: 12,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  statLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },

  // Controls
  controlsContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
    marginRight: theme.spacing.sm,
  },
  sortButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 6,
    marginRight: theme.spacing.xs,
  },
  activeSortButton: {
    backgroundColor: theme.colors.primary + '20',
  },
  sortButtonText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  activeSortButtonText: {
    color: theme.colors.primary,
  },

  // Tags list
  tagsList: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  tagCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  tagInfo: {
    flex: 1,
  },
  tagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  tagTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tagName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: theme.spacing.xs,
  },
  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  tagStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  tagStatText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginLeft: theme.spacing.xs,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyStateTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },

  // Create button
  createButton: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lg,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  modalCloseButton: {
    padding: theme.spacing.sm,
  },
  formContainer: {
    padding: theme.spacing.lg,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.medium,
    marginBottom: theme.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    backgroundColor: theme.colors.background,
  },
  textInputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.xs,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: theme.colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
  },
  disabledButton: {
    backgroundColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  submitButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.background,
    fontFamily: theme.typography.fontFamilies.medium,
  },
});

export default TagsManager; 