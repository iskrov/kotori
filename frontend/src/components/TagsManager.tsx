/**
 * Tags Manager Component
 * 
 * Manages all tags in a unified interface with toggle between regular and secret tag modes.
 * Handles both many-to-many regular tags and one-to-many secret tags seamlessly.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { TagsAPI } from '../services/api';
import { Tag } from '../types';
import { SecretTag, secretTagManager } from '../services/secretTagManager';
import { 
  SecurityMode, 
  NetworkStatus, 
  CacheStatus, 
  secretTagManagerHybrid 
} from '../services/secretTagManagerHybrid';
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

interface SecretTagWithStats extends SecretTag {
  entryCount: number;
  lastUsed?: string;
}

const TagsManager: React.FC<TagsManagerProps> = ({ onRefresh }) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  // State management
  const [activeTagType, setActiveTagType] = useState<TagType>('regular');
  const [regularTags, setRegularTags] = useState<RegularTagWithStats[]>([]);
  const [secretTags, setSecretTags] = useState<SecretTagWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('name');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<RegularTagWithStats | SecretTagWithStats | null>(null);

  // Hybrid manager state
  const [securityMode, setSecurityMode] = useState<SecurityMode>('balanced');
  const [borderCrossingMode, setBorderCrossingMode] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('unknown');
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    enabled: true,
    entryCount: 0,
    storageSize: 0,
    integrity: 'unknown'
  });
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // Create/Edit form state
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#007AFF');
  const [activationPhrase, setActivationPhrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Predefined color options
  const colorOptions = [
    '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#FF2D92',
    '#5AC8FA', '#FFCC00', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  ];

  /**
   * Load regular tags from API
   */
  const loadRegularTags = useCallback(async () => {
    try {
      const response = await TagsAPI.getTags();
      const tags = response.data;
      
      // TODO: Add API endpoint to get tag usage statistics
      const tagsWithStats: RegularTagWithStats[] = tags.map((tag: Tag) => ({
        ...tag,
        entryCount: Math.floor(Math.random() * 20), // Mock usage
        lastUsed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      }));
      
      setRegularTags(tagsWithStats);
    } catch (error) {
      logger.error('Failed to load regular tags:', error);
      Alert.alert('Error', 'Failed to load tags');
    }
  }, []);

  /**
   * Load secret tags from hybrid manager
   */
  const loadSecretTags = useCallback(async () => {
    try {
      const tags = await secretTagManagerHybrid.getAllSecretTags();
      
      // TODO: Add method to get secret tag usage statistics
      const tagsWithStats: SecretTagWithStats[] = tags.map((tag) => ({
        ...tag,
        // Convert V2 format to compatible format
        phrase: '', // Not available in V2 format
        phraseHash: '', // Not available in V2 format
        phraseSalt: '', // Not available in V2 format
        serverTagHash: '', // Not available in V2 format
        createdAt: new Date(tag.createdAt).getTime(), // Convert to timestamp
        entryCount: Math.floor(Math.random() * 15), // Mock usage
        lastUsed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      }));
      
      setSecretTags(tagsWithStats);
    } catch (error) {
      logger.error('Failed to load secret tags:', error);
      Alert.alert('Error', 'Failed to load secret tags');
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
   * Load hybrid manager status
   */
  const loadHybridStatus = useCallback(async () => {
    try {
      const config = secretTagManagerHybrid.getConfig();
      const networkStatus = secretTagManagerHybrid.getNetworkStatus();
      const cacheStatus = await secretTagManagerHybrid.getCacheStatus();

      setSecurityMode(config.securityMode);
      setBorderCrossingMode(config.borderCrossingMode);
      setNetworkStatus(networkStatus);
      setCacheStatus(cacheStatus);
    } catch (error) {
      logger.error('Failed to load hybrid status:', error);
    }
  }, []);

  /**
   * Initialize component
   */
  useEffect(() => {
    const initializeManager = async () => {
      setIsLoading(true);
      await secretTagManagerHybrid.initialize();
      await loadAllTags();
      await loadHybridStatus();
      setIsLoading(false);
    };

    initializeManager();
  }, [loadAllTags, loadHybridStatus]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAllTags();
    await loadHybridStatus();
    onRefresh?.();
    setIsRefreshing(false);
  }, [loadAllTags, loadHybridStatus, onRefresh]);

  /**
   * Handle security mode change
   */
  const handleSecurityModeChange = useCallback(async (mode: SecurityMode) => {
    try {
      await secretTagManagerHybrid.setSecurityMode(mode);
      await loadHybridStatus();
      await loadSecretTags(); // Reload secret tags as they may change
    } catch (error) {
      logger.error('Failed to change security mode:', error);
      Alert.alert('Error', 'Failed to change security mode');
    }
  }, [loadHybridStatus, loadSecretTags]);

  /**
   * Handle border crossing mode toggle
   */
  const handleBorderCrossingToggle = useCallback(async (enabled: boolean) => {
    try {
      await secretTagManagerHybrid.setBorderCrossingMode(enabled);
      await loadHybridStatus();
      await loadSecretTags(); // Reload secret tags as cache may be cleared
    } catch (error) {
      logger.error('Failed to toggle border crossing mode:', error);
      Alert.alert('Error', 'Failed to toggle border crossing mode');
    }
  }, [loadHybridStatus, loadSecretTags]);

  /**
   * Handle clear cache
   */
  const handleClearCache = useCallback(async () => {
    try {
      await secretTagManagerHybrid.clearCache();
      await loadHybridStatus();
      await loadSecretTags(); // Reload secret tags after cache clear
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      Alert.alert('Error', 'Failed to clear cache');
    }
  }, [loadHybridStatus, loadSecretTags]);

  /**
   * Handle sync with server
   */
  const handleSync = useCallback(async () => {
    try {
      await secretTagManagerHybrid.syncWithServer();
      await loadHybridStatus();
      await loadSecretTags(); // Reload secret tags after sync
    } catch (error) {
      logger.error('Failed to sync with server:', error);
      Alert.alert('Sync Failed', 'Could not sync with server');
    }
  }, [loadHybridStatus, loadSecretTags]);

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
          await secretTagManagerHybrid.createSecretTag(tagName, activationPhrase, tagColor);
          await loadSecretTags();
        } else {
          // TODO: Implement regular tag creation API
          Alert.alert('Coming Soon', 'Regular tag creation will be available in a future update.');
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
  }, [tagName, activationPhrase, tagColor, activeTagType, editingTag, validateTagName, validateActivationPhrase, loadSecretTags]);

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
                  await secretTagManagerHybrid.deleteSecretTag(String(tag.id));
                  await loadSecretTags();
                } else {
                  // TODO: Implement regular tag deletion API
                  Alert.alert('Coming Soon', 'Regular tag deletion will be available in a future update.');
                }
              } catch (error) {
              logger.error('Failed to delete tag:', error);
              Alert.alert('Error', 'Failed to delete tag');
            }
          }
        }
      ]
    );
  }, [activeTagType, loadSecretTags]);

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
          Regular
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
          Secret
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
            {activeTagType === 'regular' ? 'Regular' : 'Secret'} Tags
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

  /**
   * Render create/edit modal
   */
  const renderTagModal = () => (
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
              {editingTag ? 'Edit' : 'Create'} {activeTagType === 'secret' ? 'Secret' : 'Regular'} Tag
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
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading tags...</Text>
      </View>
    );
  }

  const displayedTags = filteredAndSortedTags();

  return (
    <View style={styles.container}>
      {/* Tag Type Toggle */}
      {renderTagTypeToggle()}

      {/* Statistics */}
      {renderTagStats()}

      {/* Security Components for Secret Tags */}
      {activeTagType === 'secret' && (
        <View style={styles.securitySection}>
          <TouchableOpacity
            style={styles.securityHeader}
            onPress={() => setShowSecurityModal(!showSecurityModal)}
          >
            <View style={styles.securityHeaderContent}>
              <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
              <Text style={styles.securityHeaderTitle}>Security Settings</Text>
              <Text style={styles.securityHeaderSubtitle}>
                {securityMode.charAt(0).toUpperCase() + securityMode.slice(1)} Mode
              </Text>
            </View>
            <Ionicons 
              name={showSecurityModal ? 'chevron-up' : 'chevron-down'} 
              size={16} 
              color={theme.colors.textSecondary} 
            />
          </TouchableOpacity>

          {showSecurityModal && (
            <View style={styles.securityContent}>
              <SecurityModeSelector
                currentMode={securityMode}
                borderCrossingMode={borderCrossingMode}
                onModeChange={handleSecurityModeChange}
                onBorderCrossingToggle={handleBorderCrossingToggle}
                disabled={isLoading || isRefreshing}
              />
              
              <View style={styles.securityDivider} />
              
              <CacheStatusIndicator
                cacheStatus={cacheStatus}
                networkStatus={networkStatus}
                onRefresh={loadHybridStatus}
                onClearCache={handleClearCache}
                onSync={handleSync}
                disabled={isLoading || isRefreshing}
              />
            </View>
          )}
        </View>
      )}

      {/* Search and Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search tags..."
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={20} color={theme.colors.background} />
          <Text style={styles.createButtonText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        {(['name', 'usage', 'recent'] as const).map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.sortOption,
              sortBy === option && styles.activeSortOption
            ]}
            onPress={() => setSortBy(option)}
          >
            <Text style={[
              styles.sortOptionText,
              sortBy === option && styles.activeSortOptionText
            ]}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tags List */}
      <ScrollView
        style={styles.tagsContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {displayedTags.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons 
              name={activeTagType === 'secret' ? 'shield-outline' : 'pricetag-outline'} 
              size={64} 
              color={theme.colors.textSecondary} 
            />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching tags' : `No ${activeTagType} tags yet`}
            </Text>
            <Text style={styles.emptyDescription}>
              {searchQuery 
                ? 'Try adjusting your search criteria'
                : `Create your first ${activeTagType} tag to organize your journal entries`
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add-circle" size={20} color={theme.colors.background} />
                <Text style={styles.emptyActionButtonText}>
                  Create First {activeTagType === 'secret' ? 'Secret' : 'Regular'} Tag
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          displayedTags.map(renderTagCard)
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      {renderTagModal()}
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
  
  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: theme.spacing.xs,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: 6,
    gap: theme.spacing.xs,
  },
  activeToggleButton: {
    backgroundColor: theme.colors.primary,
  },
  toggleButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  activeToggleButtonText: {
    color: theme.colors.background,
  },
  
  // Statistics
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: 12,
    ...theme.shadows.sm,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  statLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.xs,
  },
  
  // Controls
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    gap: theme.spacing.xs,
  },
  createButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  
  // Sort Options
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sortLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  sortOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
  },
  activeSortOption: {
    backgroundColor: theme.colors.primary,
  },
  sortOptionText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  activeSortOptionText: {
    color: theme.colors.background,
  },
  
  // Tags
  tagsContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  tagCard: {
    backgroundColor: theme.colors.card,
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
    gap: theme.spacing.xs,
  },
  tagName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  tagActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    padding: theme.spacing.sm,
    borderRadius: 6,
    backgroundColor: theme.colors.background,
  },
  tagStats: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  tagStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  tagStatText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
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
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
    gap: theme.spacing.xs,
  },
  emptyActionButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  modalCloseButton: {
    padding: theme.spacing.sm,
  },
  
  // Form
  formContainer: {
    maxHeight: 400,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    backgroundColor: theme.colors.card,
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
  
  // Color Selection
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
  
  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
  },
  submitButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  disabledButton: {
    opacity: 0.5,
  },
  
  // Security Components
  securitySection: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    ...theme.shadows.sm,
  },
  securityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  securityHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  securityHeaderTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  securityHeaderSubtitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginLeft: 'auto',
  },
  securityContent: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  securityDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
});

export default TagsManager; 