import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  SafeAreaView,
  Animated,
  Dimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

import { JournalAPI } from '../../services/api';
import AudioRecorder from '../../components/AudioRecorder';
import logger from '../../utils/logger';
import TagInput from '../../components/TagInput';
import SafeScrollView from '../../components/SafeScrollView';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { Tag } from '../../types';
import hapticService from '../../services/hapticService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JournalEntryFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { journalId } = route.params as { journalId?: string };
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [entryDate, setEntryDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingEntry, setIsFetchingEntry] = useState(false);
  
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalTags, setOriginalTags] = useState<Tag[]>([]);
  const [originalEntryDate, setOriginalEntryDate] = useState<string>('');
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // This ref will hold stable versions of the handler functions.
  const handlersRef = useRef({
    handleSave: async () => {},
    handleDiscard: () => {},
    handleBackPress: () => navigation.goBack(),
  });

  // Animation on load
  useEffect(() => {
    // Set initial values immediately to ensure content is visible
    fadeAnim.setValue(1);
    slideAnim.setValue(0);
    
    // Then run the animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // This `useEffect` runs only ONCE to set up stable navigation options.
  useEffect(() => {
    navigation.setOptions({
      title: journalId ? 'Edit Entry' : 'New Entry',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            hapticService.light();
            handlersRef.current.handleBackPress();
          }}
          style={{ marginLeft: 16, padding: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [journalId, navigation, theme.colors.text]);

  // This `useEffect` updates the handler functions in the ref whenever state changes.
  useEffect(() => {
    const handleSave = async () => {
      if (!content.trim()) {
        hapticService.error();
        Alert.alert('Error', 'Please enter some content for your journal entry');
        return;
      }
      try {
        setIsLoading(true);
        hapticService.light();
        const entryData: any = {
          title: title || `Entry ${new Date().toLocaleDateString()}`,
          content,
          tags: tags.map(tag => tag.name), // Convert Tag objects to string array
          entry_date: entryDate || new Date().toISOString(),
        };

        if (journalId) {
          await JournalAPI.updateEntry(parseInt(journalId, 10), entryData);
          setOriginalTitle(entryData.title);
          setOriginalContent(entryData.content);
          setOriginalTags(tags); // Keep the current Tag objects, not the string array
          setOriginalEntryDate(entryData.entry_date);
          setHasUnsavedChanges(false);
          hapticService.success();
          Alert.alert('Success', 'Journal entry updated', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          await JournalAPI.createEntry(entryData);
          hapticService.success();
          Alert.alert('Success', 'Journal entry created', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      } catch (error) {
        hapticService.error();
        logger.error('Error saving journal entry', { journalId, error });
        Alert.alert('Error', 'Failed to save journal entry');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDiscard = () => {
      hapticService.warning();
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard all changes?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              hapticService.light();
              if (journalId) {
                setTitle(originalTitle);
                setContent(originalContent);
                setTags(originalTags);
                setEntryDate(originalEntryDate);
              } else {
                setTitle('');
                setContent('');
                setTags([]);
                setEntryDate(new Date().toISOString());
              }
              setHasUnsavedChanges(false);
              navigation.goBack();
            },
          },
        ]
      );
    };

    const handleBackPress = () => {
      if (hasUnsavedChanges) {
        hapticService.warning();
        Alert.alert(
          'Unsaved Changes',
          'You have unsaved changes. What would you like to do?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Save Changes', style: 'default', onPress: handleSave },
            { text: 'Discard', style: 'destructive', onPress: handleDiscard },
          ]
        );
      } else {
        hapticService.light();
        navigation.goBack();
      }
    };

    handlersRef.current = { handleSave, handleDiscard, handleBackPress };
  }, [
    title, content, tags, entryDate, hasUnsavedChanges,
    originalTitle, originalContent, originalTags, originalEntryDate,
    journalId, navigation
  ]);

  useEffect(() => {
    const fetchEntryData = async () => {
      if (!journalId) return;
      try {
        setIsFetchingEntry(true);
        logger.info('JournalEntryFormScreen: Fetching entry data', { journalId });
        const response = await JournalAPI.getEntry(parseInt(journalId, 10));
        const entry = response.data;
        logger.info('JournalEntryFormScreen: Entry data loaded', { entry });
        setTitle(entry.title || '');
        setContent(entry.content || '');
        setTags(entry.tags || []);
        setEntryDate(entry.entry_date || new Date().toISOString());
        setOriginalTitle(entry.title || '');
        setOriginalContent(entry.content || '');
        setOriginalTags(entry.tags || []);
        setOriginalEntryDate(entry.entry_date || new Date().toISOString());
        setHasUnsavedChanges(false);
      } catch (error) {
        logger.error('Error fetching entry data', { journalId, error });
        Alert.alert('Error', 'Failed to load journal entry data');
      } finally {
        setIsFetchingEntry(false);
      }
    };

    if (journalId) {
      logger.info('JournalEntryFormScreen: Edit mode, fetching entry', { journalId });
      fetchEntryData();
    } else {
      logger.info('JournalEntryFormScreen: New entry mode');
      setEntryDate(new Date().toISOString());
    }
  }, [journalId]);

  useEffect(() => {
    if (isFetchingEntry) return;
    const hasChanges =
      title !== originalTitle ||
      content !== originalContent ||
      JSON.stringify(tags) !== JSON.stringify(originalTags) ||
      entryDate !== originalEntryDate;
    setHasUnsavedChanges(hasChanges);
  }, [
    title,
    content,
    tags,
    entryDate,
    originalTitle,
    originalContent,
    originalTags,
    originalEntryDate,
    isFetchingEntry,
  ]);

  const handleShowRecorder = async () => {
    try {
      const { granted } = await Audio.getPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Microphone Permission Needed',
          'Please grant microphone access in your device settings to record.',
          [{ text: 'OK' }]
        );
        return;
      }

      hapticService.light();
      setShowRecorder(true);
      logger.info('JournalEntryFormScreen: Showing AudioRecorder modal');
    } catch (error) {
      logger.error('Error showing recorder', error);
      Alert.alert('Error', 'Could not prepare for recording');
    }
  };
  
  const handleTranscriptionComplete = (transcribedText: string, detectedLanguage?: string) => {
    setShowRecorder(false);
    
    if (transcribedText) {
      hapticService.success();
      // For edit mode, append new transcription to existing content with proper formatting
      setContent(prevContent => {
        if (!prevContent.trim()) {
          // If no existing content, just use the new transcription
          return transcribedText;
        } else {
          // If there's existing content, add the new transcription on a new line
          return prevContent + '\n' + transcribedText;
        }
      });
      
      if (detectedLanguage) {
        logger.info(`Detected language: ${detectedLanguage}`);
      }
    }
  };

  const handleAutoSave = (currentTranscript: string) => {
    if (currentTranscript && currentTranscript.trim()) {
      const newContent = content.trim() ? content + '\n' + currentTranscript : currentTranscript;
      setContent(newContent);
      logger.info('JournalEntryFormScreen: Content updated locally (no auto-save to backend)');
    }
  };

  const handleTagsChange = useCallback((newTags: Tag[]) => {
    setTags(newTags);
  }, []);

  // Stable suggestions array to prevent TagInput infinite loops
  const tagSuggestions = useMemo(() => [], []);

  // Get formatted date display
  const getFormattedDate = () => {
    if (!entryDate) return 'No date set';
    try {
      const date = new Date(entryDate);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Debug logging removed

  // Debug logging
  logger.info('JournalEntryFormScreen: Render state', { 
    isFetchingEntry, 
    journalId, 
    hasTitle: !!title, 
    hasContent: !!content
  });

  if (isFetchingEntry) {
    logger.info('JournalEntryFormScreen: Showing loading screen');
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your entry...</Text>
        </View>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <SafeScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.headerContent}>
              <Text style={styles.screenTitle}>
                {journalId ? 'Edit Your Entry' : 'New Journal Entry'}
              </Text>
              <Text style={styles.screenSubtitle}>
                {journalId ? 'Make changes to your journal entry' : 'Capture your thoughts and experiences'}
              </Text>
              {hasUnsavedChanges && (
                <View style={styles.unsavedBadge}>
                  <Ionicons name="radio-button-on" size={12} color={theme.colors.warning} />
                  <Text style={styles.unsavedText}>Unsaved changes</Text>
                </View>
              )}
            </View>
            {journalId && (
              <View style={styles.editIndicator}>
                <Ionicons name="create" size={24} color={theme.colors.primary} />
              </View>
            )}
          </View>

          {/* Date Section */}
          <View style={styles.dateSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Entry Date</Text>
            </View>
            <View style={styles.dateDisplay}>
              <Text style={styles.dateText}>{getFormattedDate()}</Text>
                             <Text style={styles.dateSubtext}>
                 {new Date(entryDate || new Date()).toLocaleTimeString('en-US', { 
                   hour: 'numeric', 
                   minute: '2-digit', 
                   hour12: true 
                 })}
               </Text>
            </View>
          </View>

          {/* Title Section */}
          <View style={styles.inputSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="text" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Title</Text>
              <Text style={styles.optionalText}>(Optional)</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Give your entry a memorable title..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                maxLength={100}
              />
              {title.length > 0 && (
                <Text style={styles.characterCount}>{title.length}/100</Text>
              )}
            </View>
          </View>

          {/* Content Section */}
          <View style={styles.inputSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Your Entry</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  style={styles.recordButton} 
                  onPress={handleShowRecorder} 
                  disabled={isRecording || isLoading || isTranscribing}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={isRecording ? "mic" : "mic-outline"} 
                    size={18} 
                    color={theme.colors.accent} 
                  />
                  <Text style={styles.recordButtonText}>Record</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.contentContainer}>
              <TextInput
                style={styles.contentInput}
                multiline
                placeholder="What's on your mind? Share your thoughts, experiences, or reflections..."
                value={content}
                onChangeText={setContent}
                textAlignVertical="top"
                placeholderTextColor={theme.colors.textSecondary}
              />
              {content.length > 0 && (
                <View style={styles.contentStats}>
                  <Text style={styles.statsText}>
                    {content.length} characters • {content.split(' ').filter(word => word.length > 0).length} words
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Tags Section */}
          <View style={styles.inputSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetags" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Tags</Text>
              {tags.length > 0 && (
                <View style={styles.tagCount}>
                  <Text style={styles.tagCountText}>{tags.length}</Text>
                </View>
              )}
            </View>
            <View style={styles.tagsContainer}>
              <TagInput 
                tags={tags} 
                onChangeTags={handleTagsChange}
                suggestions={tagSuggestions}
              />
            </View>
                     </View>
         </Animated.View>

        {showRecorder && (
          <Modal
            animationType="slide"
            transparent={false}
            visible={showRecorder}
            onRequestClose={() => {
              if (!isRecording) {
                setShowRecorder(false);
              }
            }}
          >
            <AudioRecorder 
              onTranscriptionComplete={handleTranscriptionComplete}
              onCancel={() => setShowRecorder(false)}
              onAutoSave={handleAutoSave} // Auto-save transcriptions to content
            />
          </Modal>
        )}
      </SafeScrollView>

      {/* Floating Action Buttons */}
      <Animated.View 
        style={[
          styles.floatingActions,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <TouchableOpacity
          style={[styles.fab, styles.cancelFab]}
          onPress={() => {
            hapticService.light();
            hasUnsavedChanges ? handlersRef.current.handleDiscard() : navigation.goBack();
          }}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={hasUnsavedChanges ? "close" : "arrow-back"} 
            size={24} 
            color={theme.colors.white} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.fab,
            styles.saveFab,
            (!hasUnsavedChanges || isLoading) && styles.disabledFab,
          ]}
          onPress={() => {
            hapticService.medium();
            handlersRef.current.handleSave();
          }}
          disabled={isLoading || !hasUnsavedChanges}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Ionicons 
              name={journalId ? "checkmark" : "add"} 
              size={24} 
              color={theme.colors.white} 
            />
          )}
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  loadingText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.lg,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Space for FABs
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  headerSection: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    ...theme.shadows.lg,
    borderWidth: theme.isDarkMode ? 1 : 0,
    borderColor: theme.colors.border,
  },
  headerContent: {
    flex: 1,
  },
  screenTitle: {
    fontSize: theme.typography.fontSizes.xxxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.bold,
    letterSpacing: -1,
  },
  screenSubtitle: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.medium,
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.lg,
  },
  unsavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warningLight + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.warning + '30',
  },
  unsavedText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.warning,
    fontWeight: '600',
    marginLeft: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  editIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary + '30',
  },
  dateSection: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.md,
    borderWidth: theme.isDarkMode ? 1 : 0,
    borderColor: theme.colors.border,
  },
  inputSection: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.md,
    borderWidth: theme.isDarkMode ? 1 : 0,
    borderColor: theme.colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    flex: 1,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  optionalText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    fontFamily: theme.typography.fontFamilies.regular,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentLight + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.accent + '30',
  },
  recordButtonText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.accent,
    fontWeight: '600',
    marginLeft: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  tagCount: {
    backgroundColor: theme.colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagCountText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.white,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamilies.bold,
  },
  dateDisplay: {
    alignItems: 'flex-start',
  },
  dateText: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  dateSubtext: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  inputContainer: {
    position: 'relative',
  },
  titleInput: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    padding: 0,
    margin: 0,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  characterCount: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  contentContainer: {
    position: 'relative',
  },
  contentInput: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    padding: 0,
    margin: 0,
    minHeight: 200,
    textAlignVertical: 'top',
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.lg,
  },
  contentStats: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statsText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  tagsContainer: {
    minHeight: 60,
  },
  floatingActions: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 85,
    right: theme.spacing.lg,
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.xl,
    elevation: 8,
  },
  cancelFab: {
    backgroundColor: theme.colors.textSecondary,
  },
  saveFab: {
    backgroundColor: theme.colors.primary,
  },
  disabledFab: {
    backgroundColor: theme.colors.disabled,
    opacity: 0.6,
  },
});

export default JournalEntryFormScreen; 