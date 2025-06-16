/**
 * Tags Manager Component
 * 
 * Unified interface for managing both regular and secret tags
 * Refactored to follow consistent app architecture patterns
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

// Import settings components for consistent UI
import SettingsSection from './settings/SettingsSection';
import SettingsRow from './settings/SettingsRow';
import SettingsSelector, { SettingsOption } from './settings/SettingsSelector';
import SecurityModeSelector from './SecurityModeSelector';
import CacheStatusIndicator from './CacheStatusIndicator';
import logger from '../utils/logger';

type TagType = 'regular' | 'secret';

interface TagsManagerProps {
  onRefresh?: () => void;
}

interface RegularTagWithStats extends Tag {
  entryCount: number;
  lastUsed?: string;
  colorCode?: string;
}

interface SecretTagWithStats extends SecretTagV2 {
  entryCount: number;
  lastUsed?: string;
}

const TagsManager: React.FC<TagsManagerProps> = ({ onRefresh }) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  // State
  const [activeTagType, setActiveTagType] = useState<TagType>('regular');
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('name');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regularTags, setRegularTags] = useState<RegularTagWithStats[]>([]);
  const [secretTags, setSecretTags] = useState<SecretTagWithStats[]>([]);
  const [tagName, setTagName] = useState('');
  const [activationPhrase, setActivationPhrase] = useState('');
  const [tagColor, setTagColor] = useState('#007AFF');
  const [editingTag, setEditingTag] = useState<RegularTagWithStats | SecretTagWithStats | null>(null);
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

  // Tag type options for selector
  const tagTypeOptions: SettingsOption[] = [
    { value: 'regular', label: 'Regular Tags', subtitle: 'Standard organization tags' },
    { value: 'secret', label: 'Secret Tags', subtitle: 'Privacy-protected tags' }
  ];

  // Sort options for selector
  const sortOptions: SettingsOption[] = [
    { value: 'name', label: 'Name', subtitle: 'Alphabetical order' },
    { value: 'usage', label: 'Usage', subtitle: 'Most used first' },
    { value: 'recent', label: 'Recent', subtitle: 'Recently used first' }
  ];

  // Data loading functions
  const loadRegularTags = useCallback(async () => {
    try {
      const tags = await tagManager.getRegularTags();
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

  const loadSecretTags = useCallback(async () => {
    try {
      const tags = await tagManager.getSecretTags();
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

  const loadAllTags = useCallback(async () => {
    await Promise.all([
      loadRegularTags(),
      loadSecretTags()
    ]);
  }, [loadRegularTags, loadSecretTags]);

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

  // Initialize
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

  // Event handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAllTags();
    await loadTagStatus();
    onRefresh?.();
    setIsRefreshing(false);
  }, [loadAllTags, loadTagStatus, onRefresh]);

  const handleSecurityModeChange = useCallback(async (mode: SecurityMode) => {
    try {
      await tagManager.setSecurityMode(mode);
      await loadTagStatus();
      await loadSecretTags();
    } catch (error) {
      logger.error('Failed to change security mode:', error);
      Alert.alert('Error', 'Failed to change security mode');
    }
  }, [loadTagStatus, loadSecretTags]);

  const handleClearCache = useCallback(async () => {
    try {
      await tagManager.clearSecretCache();
      await loadTagStatus();
      await loadSecretTags();
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      Alert.alert('Error', 'Failed to clear cache');
    }
  }, [loadTagStatus, loadSecretTags]);

  const handleSync = useCallback(async () => {
    try {
      await tagManager.syncWithServer();
      await loadTagStatus();
      await loadSecretTags();
    } catch (error) {
      logger.error('Failed to sync with server:', error);
      Alert.alert('Sync Failed', 'Could not sync with server');
    }
  }, [loadTagStatus, loadSecretTags]);

  // Get current tags based on active type
  const getCurrentTags = useCallback((): (RegularTagWithStats | SecretTagWithStats)[] => {
    return activeTagType === 'regular' ? regularTags : secretTags;
  }, [activeTagType, regularTags, secretTags]);

  // Filter and sort tags
  const filteredAndSortedTags = useCallback(() => {
    let filtered = getCurrentTags();
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
  }, [getCurrentTags, sortBy]);

  // Validation functions
  const validateTagName = (name: string): string | null => {
    if (!name.trim()) return "Tag name cannot be empty";
    if (name.length < 2) return "Tag name must be at least 2 characters long";
    if (name.length > 50) return "Tag name cannot exceed 50 characters";
    const currentTags = getCurrentTags();
    const existingTag = currentTags.find(tag => 
      tag.name.toLowerCase() === name.toLowerCase() &&
      (!editingTag || tag.id !== editingTag.id)
    );
    if (existingTag) return `Tag "${name}" already exists`;
    return null;
  };

  const validateActivationPhrase = (phrase: string): string | null => {
    if (activeTagType !== 'secret') return null;
    if (!phrase.trim()) return "Activation phrase cannot be empty";
    if (phrase.length < 3) return "Phrase must be at least 3 characters long";
    if (phrase.length > 100) return "Phrase cannot exceed 100 characters";
    return null;
  };

  // Tag operations
  const handleSubmitTag = async () => {
    const nameValidation = validateTagName(tagName);
    if (nameValidation) {
      Alert.alert('Invalid Tag Name', nameValidation);
      return;
    }
  
    const phraseValidation = validateActivationPhrase(activationPhrase);
    if (phraseValidation) {
      Alert.alert('Invalid Activation Phrase', phraseValidation);
      return;
    }
  
    setIsSubmitting(true);
    try {
      if (editingTag) {
        Alert.alert('Coming Soon', 'Tag editing will be available in a future update');
      } else {
        if (activeTagType === 'secret') {
          await tagManager.createSecretTag(tagName, activationPhrase, tagColor);
        } else {
          await tagManager.createRegularTag(tagName, tagColor);
        }
      }
      await loadAllTags();
      setShowCreateModal(false);
      setEditingTag(null);
      setTagName('');
      setActivationPhrase('');
      setTagColor('#007AFF');
    } catch (error) {
      logger.error('Failed to save tag:', error);
      Alert.alert('Error', 'Failed to save tag');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEditTag = (tag: RegularTagWithStats | SecretTagWithStats) => {
    Alert.alert('Coming Soon', 'This feature will be implemented in a future update');
  };

  const handleDeleteTag = (id: string, name: string) => {
    const tagToDelete = getCurrentTags().find(t => String(t.id) === id);
    const entryCount = tagToDelete?.entryCount || 0;
  
    const isWeb = typeof window !== 'undefined' && window.confirm;
  
    if (isWeb) {
      logger.info('Using window.confirm for web environment');
      const confirmed = window.confirm(
        `Are you sure you want to delete "${name}"? This will remove it from ${entryCount} journal entries`
      );
      if (confirmed) {
        logger.info(`User confirmed deletion via window.confirm`);
        (async () => {
          logger.info(`Starting deletion of ${activeTagType} tag: ${name} (ID: ${id})`);
          try {
            if (activeTagType === 'secret') {
              logger.info(`Calling tagManager.deleteSecretTag(${id})`);
              await tagManager.deleteSecretTag(id);
              logger.info(`Secret tag deleted successfully, reloading tags`);
            } else {
              logger.info(`Calling tagManager.deleteRegularTag(${id})`);
              await tagManager.deleteRegularTag(id);
              logger.info(`Regular tag deleted successfully, reloading tags`);
            }
            await loadAllTags();
            logger.info('Tags reloaded after deletion');
          } catch (error) {
            logger.error(`Failed to delete ${activeTagType} tag:`, error);
            Alert.alert('Delete Failed', `Could not delete tag "${name}"`);
          }
        })();
      } else {
        logger.info('User cancelled deletion via window.confirm');
      }
    } else {
      Alert.alert(
        `Delete "${name}"?`,
        `This will remove the tag from ${entryCount} journal entries. This action cannot be undone`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                if (activeTagType === 'secret') {
                  await tagManager.deleteSecretTag(id);
                } else {
                  await tagManager.deleteRegularTag(id);
                }
                await loadAllTags();
              } catch (error) {
                logger.error(`Failed to delete ${activeTagType} tag:`, error);
                Alert.alert('Delete Failed', `Could not delete tag "${name}"`);
              }
            },
          },
        ]
      );
    }
  };

  // Render tag row using SettingsRow pattern
  const renderTagRow = (tag: RegularTagWithStats | SecretTagWithStats) => {
    const usageText = tag.entryCount === 1 ? '1 entry' : `${tag.entryCount} entries`;
    const lastUsedText = tag.lastUsed ? ` | Last used ${new Date(tag.lastUsed).toLocaleDateString().replace(/\./g, '/')}` : '';
    const subtitle = `${usageText}${lastUsedText}`;

    const rightElement = (
      <View style={styles.tagActions}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => handleEditTag(tag)}
        >
          <Ionicons name="pencil" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => handleDeleteTag(String(tag.id), tag.name)}
        >
          <Ionicons name="trash-bin" size={20} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    );

    return (
      <SettingsRow
        key={String(tag.id)}
        title={tag.name}
        subtitle={subtitle}
        leftIcon="pricetag"
        rightElement={rightElement}
        style={{
          ...styles.tagRow,
          borderLeftColor: tag.colorCode || tagColor,
          borderLeftWidth: 4 
        }}
      />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading tags...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Tag Type Selection */}
      <SettingsSection
        title="Tag Type"
        subtitle="Choose between regular and secret tags"
        icon="pricetag"
      >
        <SettingsSelector
          title="Active Tag Type"
          subtitle="Select which type of tags to manage"
          leftIcon="layers"
          options={tagTypeOptions}
          selectedValue={activeTagType}
          onValueChange={(value) => setActiveTagType(value as TagType)}
        />
      </SettingsSection>

      {/* Security Settings (only for secret tags) */}
      {activeTagType === 'secret' && (
        <SettingsSection
          title="Security Settings"
          subtitle="Configure secret tag security and caching"
          icon="shield-checkmark"
        >
          <View style={styles.securityControls}>
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
        </SettingsSection>
      )}

      {/* Sort Options */}
      <SettingsSection
        title="Sort & Display"
        subtitle="Organize how tags are displayed"
        icon="funnel"
      >
        <SettingsSelector
          title="Sort By"
          subtitle="Choose how to order your tags"
          leftIcon="swap-vertical"
          options={sortOptions}
          selectedValue={sortBy}
          onValueChange={(value) => setSortBy(value as 'name' | 'usage' | 'recent')}
        />
      </SettingsSection>

      {/* Tags List */}
      <SettingsSection
        title={`${activeTagType === 'secret' ? 'Secret ' : ''}Tags`}
        subtitle={`${filteredAndSortedTags().length} ${activeTagType} tags`}
        icon={activeTagType === 'secret' ? 'shield' : 'pricetag'}
        headerAction={
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              console.log('Create button pressed!');
              setShowCreateModal(true);
            }}
            activeOpacity={0.7}
            accessibilityLabel="Create new tag"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      >
        {filteredAndSortedTags().length > 0 ? (
          filteredAndSortedTags().map(renderTagRow)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTagType === 'secret' ? 'shield-outline' : 'pricetag-outline'}
              size={48}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyStateTitle}>
              No {activeTagType} tags yet
            </Text>
            <Text style={styles.emptyStateMessage}>
              Create your first {activeTagType} tag to get started
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.emptyStateButtonText}>Create Tag</Text>
            </TouchableOpacity>
          </View>
        )}
      </SettingsSection>

      {/* Create/Edit Tag Modal */}
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
                {editingTag ? 'Edit' : 'Create'} {activeTagType === 'secret' ? 'Secret Tag' : 'Tag'}
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
                  placeholder="work, personal, ideas"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={50}
                />
                {(() => {
                  const tagNameError = tagName ? validateTagName(tagName) : null;
                  return tagNameError ? (
                    <Text style={styles.errorText}>{tagNameError}</Text>
                  ) : null;
                })()}
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
                    placeholder="activate work mode, private thoughts"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={100}
                  />
                  {(() => {
                    const activationPhraseError = activationPhrase ? validateActivationPhrase(activationPhrase) : null;
                    return activationPhraseError ? (
                      <Text style={styles.errorText}>{activationPhraseError}</Text>
                    ) : null;
                  })()}
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
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
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
                  styles.submitButton,
                  (isSubmitting || !tagName.trim() || validateTagName(tagName) || 
                   (activeTagType === 'secret' && (!activationPhrase.trim() || validateActivationPhrase(activationPhrase)))) 
                    ? styles.submitButtonDisabled : null
                ]}
                onPress={handleSubmitTag}
                disabled={
                  isSubmitting || !tagName.trim() || !!validateTagName(tagName) || 
                  (activeTagType === 'secret' && (!activationPhrase.trim() || !!validateActivationPhrase(activationPhrase)))
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
          </View>
        </View>
      </Modal>
    </ScrollView>
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
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },

  securityControls: {
    gap: theme.spacing.sm,
  },

  tagRow: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },

  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  actionButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
  },

  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary + '30',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
    paddingHorizontal: theme.spacing.lg,
  },

  emptyStateTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },

  emptyStateMessage: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },

  emptyStateButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },

  emptyStateButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '80%',
    minHeight: '50%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  modalTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontFamily: theme.typography.fontFamilies.bold,
    color: theme.colors.text,
  },

  modalCloseButton: {
    padding: theme.spacing.sm,
  },

  formContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },

  inputContainer: {
    marginVertical: theme.spacing.md,
  },

  inputLabel: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },

  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
  },

  textInputError: {
    borderColor: theme.colors.error,
  },

  errorText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.regular,
  },

  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.md,
  },

  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },

  cancelButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    color: theme.colors.text,
  },

  submitButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },

  submitButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },

  submitButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    color: theme.colors.background,
  },
});

export default TagsManager;