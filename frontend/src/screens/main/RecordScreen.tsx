import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Types
import { MainStackParamList, RecordScreenParams } from '../../navigation/types'; // Removed RootStackParamList

// Components
import AudioRecorder from '../../components/AudioRecorder';
import { SecretTagFloatingIndicator } from '../../components/SecretTagIndicator';

// Hooks
import useJournalEntry from '../../hooks/useJournalEntry'; // Removed JournalData import as it's implicitly used
import { getLanguageName } from '../../config/languageConfig';
import { useHiddenMode } from '../../contexts/HiddenModeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { tagManager } from '../../services/tagManager';
import { SecretTagV2 } from '../../services/secretTagOnlineManager';

// Utils
import logger from '../../utils/logger';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { JournalAPI } from '../../services/api';

// --- Special Tag for Hidden Entries (Client-Side) ---
const HIDDEN_ENTRY_TAG = "_hidden_entry";
// ----------------------------------------------------

// Type definitions for navigation and route
type RecordScreenRouteProp = RouteProp<MainStackParamList, 'Record'>;
type RecordScreenNavigationProp = StackNavigationProp<MainStackParamList, 'Record'>;

const RecordScreen: React.FC = () => {
  logger.info('RecordScreen instance created/rendered.');
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<RecordScreenNavigationProp>();
  const route = useRoute<RecordScreenRouteProp>();
  const { isHiddenMode } = useHiddenMode();
  const { settings } = useSettings();
  
  // Use the Auto Recording setting instead of route parameter
  const startRecordingOnMount = settings.autoRecordingEnabled;
  
  // Log the auto-recording behavior
  useEffect(() => {
    if (startRecordingOnMount) {
      logger.info('[RecordScreen] Auto-recording is enabled - recording will start automatically');
    } else {
      logger.info('[RecordScreen] Auto-recording is disabled - user must manually start recording');
    }
  }, [startRecordingOnMount]);
  const selectedDate = route.params?.selectedDate; // Get selectedDate from route params
  const journalId = route.params?.journalId; // Get journalId for appending to existing entry
  const vibeEmoji = route.params?.vibeEmoji; // Get vibe emoji
  const vibeTag = route.params?.vibeTag; // Get vibe tag
  
  // Log if using a custom date or vibe parameters
  useEffect(() => {
    if (selectedDate) {
      logger.info(`[RecordScreen] Using selected date from calendar: ${selectedDate}`);
    } else {
      logger.info('[RecordScreen] Using current date for new entry');
    }
    
    if (journalId) {
      logger.info(`[RecordScreen] Appending to existing entry: ${journalId}`);
    } else {
      logger.info('[RecordScreen] Creating new entry');
    }
    
    if (vibeEmoji && vibeTag) {
      logger.info(`[RecordScreen] Vibe check-in: ${vibeEmoji} (tag: ${vibeTag})`);
    }
  }, [selectedDate, journalId, vibeEmoji, vibeTag]);

  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(true); // Start with recorder visible
  const [hasStartedSaving, setHasStartedSaving] = useState(false);
  const [activeTags, setActiveTags] = useState<SecretTagV2[]>([]);
  const [recorderState, setRecorderState] = useState('idle');
  
  // Data states for saving the entry
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState(''); // Preserve original content for editing mode
  const [tags, setTags] = useState<string[]>(vibeTag ? [vibeTag] : ['journal']);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isLoadingExistingEntry, setIsLoadingExistingEntry] = useState(false);
  
  // Load existing entry data if journalId is provided
  useEffect(() => {
    if (journalId) {
             const loadExistingEntry = async () => {
         try {
           setIsLoadingExistingEntry(true);
           const response = await JournalAPI.getEntry(parseInt(journalId));
           const entry = response.data;
           
           logger.info(`[RecordScreen] Loaded existing entry for appending: ${entry.title}`);
           setTitle(entry.title || '');
           const entryContent = entry.content || '';
           setContent(entryContent);
           setOriginalContent(entryContent); // Store original content separately
           setTags(entry.tags?.map((tag: any) => tag.name) || ['journal']);
           setAudioUri(entry.audio_url);
         } catch (error) {
           logger.error(`[RecordScreen] Failed to load existing entry ${journalId}:`, error);
           // Continue with empty data if loading fails
         } finally {
           setIsLoadingExistingEntry(false);
         }
       };
      
      loadExistingEntry();
    }
  }, [journalId]);
  
  const mountedRef = useRef(true);

  const {
    isSaving,
    save,
  } = useJournalEntry(
    useMemo(() => {
      let currentTags = tags;
      if (isHiddenMode && !currentTags.includes(HIDDEN_ENTRY_TAG)) {
        currentTags = [...currentTags, HIDDEN_ENTRY_TAG];
      } else if (!isHiddenMode && currentTags.includes(HIDDEN_ENTRY_TAG)) {
        currentTags = currentTags.filter(t => t !== HIDDEN_ENTRY_TAG);
      }
      return {
        id: journalId || null, // Use existing entry ID if provided
        title,
        content,
        tags: currentTags,
        audioUri,
      };
    }, [title, content, tags, audioUri, isHiddenMode]),
    {
      selectedDate: selectedDate, // Pass selectedDate from route params
      onSaveComplete: useCallback((savedId: string | null) => {
        if (!mountedRef.current) {
          logger.debug('[RecordScreen] onSaveComplete: Aborted (unmounted).');
          return;
        }
        if (savedId) {
          logger.info(`[RecordScreen] Save successful (ID: ${savedId}). Navigating back.`);
        } else {
          logger.warn('[RecordScreen] Save completed but no ID received. Navigating back anyway.');
        }
        
        // If we were appending to an existing entry, go back to the detail screen
        // Otherwise just go back to the previous screen
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, [navigation]),
      onSaveError: useCallback((error: Error) => {
        if (!mountedRef.current) {
          logger.debug('[RecordScreen] onSaveError: Aborted (unmounted).');
          return;
        }
        logger.error('[RecordScreen] Save failed:', error);
        Alert.alert('Save Failed', 'Could not save the recording. Please try again.', [
          { text: 'OK', onPress: () => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          } }
        ]);
      }, [navigation])
    }
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load active secret tags
  useEffect(() => {
    const loadActiveTags = async () => {
      try {
        const activeTagsList = await tagManager.getActiveSecretTags();
        setActiveTags(activeTagsList);
      } catch (error) {
        logger.error('Failed to load active secret tags:', error);
      }
    };

    loadActiveTags();
  }, []);

  const handleTranscriptionComplete = useCallback((finalTranscript: string) => {
    // This logic is being disabled to prevent race conditions with manual saves.
    // The save operation will now only be triggered by the user pressing the save button.
    logger.info('[RecordScreen] Transcription completed, but auto-save is disabled.');
    // logger.log('[RecordScreen] Transcription completed. Preparing to save...');
    // setSaveData({
    //   content: finalTranscript,
    //   options: { silent: false, navigate: true },
    // });
  }, []);

  // Handle manual save from AudioRecorder
  const handleManualSave = useCallback(async (newTranscript: string, finalAudioUri?: string) => {
    if (!mountedRef.current || isSaving) return;
    
    logger.info('[RecordScreen] Manual save triggered.');
    
    // Combine existing content with new transcript
    const finalContent = journalId && originalContent 
      ? originalContent + '\n\n' + newTranscript 
      : newTranscript;
    
    // Only set title if it's empty (don't override existing titles)
    let finalTitle = title;
    if (newTranscript && !title) {
      const words = newTranscript.split(' ');
      const baseTitle = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
      // Add vibe emoji prefix if this is a vibe check-in
      finalTitle = vibeEmoji ? `${vibeEmoji} ${baseTitle}` : baseTitle;
      setTitle(finalTitle);
    }
    
    // Update content state for UI consistency
    setContent(finalContent);
    if (finalAudioUri) setAudioUri(finalAudioUri);
    
    setHasStartedSaving(true);
    
    try {
      // Pass the content explicitly to save function instead of relying on state
      await save({
        content: finalContent,
        title: finalTitle,
      });
    } catch (error) {
      logger.error('[RecordScreen] Manual save failed:', error);
    }
  }, [save, title, isSaving, journalId, originalContent]);

  // Handle save with complete edited text (for editing mode)
  const handleSaveWithCompleteText = useCallback(async (completeText: string) => {
    if (!mountedRef.current || isSaving) return;
    
    logger.info('[RecordScreen] Save with complete text triggered.');
    
    // Only set title if it's empty (don't override existing titles)
    let finalTitle = title;
    if (completeText && !title) {
      const words = completeText.split(' ');
      const baseTitle = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
      // Add vibe emoji prefix if this is a vibe check-in
      finalTitle = vibeEmoji ? `${vibeEmoji} ${baseTitle}` : baseTitle;
      setTitle(finalTitle);
    }
    
    setHasStartedSaving(true);
    
    try {
      // Pass the complete text directly to save function instead of relying on state
      await save({
        content: completeText,
        title: finalTitle,
      });
    } catch (error) {
      logger.error('[RecordScreen] Save with complete text failed:', error);
    }
  }, [save, title, isSaving]);

  const handleRecorderCancel = useCallback(() => {
    if (!mountedRef.current) {
      logger.debug('[RecordScreen] handleRecorderCancel: Aborted (unmounted).');
      return;
    }
    logger.info('[RecordScreen] Recording cancelled.');
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  // Handle close button press
  const handleClose = useCallback(() => {
    if (!mountedRef.current) {
      logger.debug('[RecordScreen] handleClose: Aborted (unmounted).');
      return;
    }
    logger.info('[RecordScreen] Close button pressed.');
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  // Handle auto-save from AudioRecorder
  const handleAutoSave = useCallback(async (currentTranscript: string) => {
    if (!mountedRef.current) {
      logger.debug('[RecordScreen] handleAutoSave: Aborted (unmounted).');
      return;
    }
    logger.info('[RecordScreen] Auto-save triggered by new segment.');
    
    // Auto-generate title from the first few words if not already set
    let newTitle = title;
    if (!title && currentTranscript) {
      const words = currentTranscript.split(' ');
      const baseTitle = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
      // Add vibe emoji prefix if this is a vibe check-in
      const generatedTitle = vibeEmoji ? `${vibeEmoji} ${baseTitle}` : baseTitle;
      newTitle = generatedTitle;
      setTitle(generatedTitle);
    }
    
    // For auto-save, determine the complete content to save
    let contentToSave;
    if (journalId && originalContent) {
      // For existing entries, combine original content with new transcript
      contentToSave = `${originalContent}\n\n${currentTranscript}`;
    } else {
      // For new entries, just use the current transcript
      contentToSave = currentTranscript;
      // DON'T update content state for new entries to avoid duplication in display
      // The UI will show transcriptSegments, and auto-save works silently
    }
    
    // Prepare data for save
    const saveData = {
      title: newTitle,
      content: contentToSave,
    };
    
    // Use new save function with explicit data and silent mode
    try {
      const savedId = await save(saveData, { 
        silent: true // Silent save - no navigation or error dialogs
      });
      
      if (savedId) {
        logger.info(`[RecordScreen] Auto-save successful. Entry ID: ${savedId}`);
        // For new entries, update the journalId so subsequent saves are updates
        if (!journalId) {
          // This is now an existing entry for future operations
          // But don't set originalContent to avoid affecting the display
        }
      } else {
        logger.warn('[RecordScreen] Auto-save completed but no ID returned.');
      }
    } catch (error) {
      logger.error('[RecordScreen] Auto-save failed:', error);
    }
  }, [save, title, journalId, originalContent]);

  // Determine save button state
  const getSaveButtonState = useCallback(() => {
    if (isSaving) {
      return { text: 'Saving...', disabled: true, isSaving: true };
    }
    if (hasStartedSaving && !isSaving) {
      return { text: 'Saved', disabled: true, isSaving: false };
    }
    return { text: 'Save', disabled: false, isSaving: false };
  }, [isSaving, hasStartedSaving]);

  const handleCommandDetected = useCallback(() => {
    logger.info('[RecordScreen] Secret tag command detected. Navigating back.');
    navigation.goBack();
  }, [navigation]);

  if (isLoading && !showRecorder) { // Show loading only if recorder isn't active yet
    return (
      <View style={styles.container}>
        <View style={styles.modalOverlay} />
        <View style={styles.recorderContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHandle} />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={24}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading Recorder...</Text>
          </View>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}> 
      {/* Modal overlay background - only show if this is a new entry (not appending) */}
      {!journalId && <View style={styles.modalOverlay} />}
      
      <View style={styles.contentContainer}>
        {showRecorder ? (
          <View style={styles.recorderContainer}>
            {/* Modal Header with Drag Handle and Close Button */}
            <View style={styles.modalHeader}>
              {!journalId && <View style={styles.modalHandle} />}
              {journalId && (
                <Text style={styles.headerTitle}>
                  Add to Entry
                </Text>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={journalId ? "arrow-back" : "close"}
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Audio Recorder Content */}
            <View style={styles.recorderContent}>
              <AudioRecorder
                onTranscriptionComplete={handleTranscriptionComplete}
                onCancel={handleRecorderCancel}
                onManualSave={handleManualSave}
                onAutoSave={handleAutoSave}
                saveButtonState={getSaveButtonState()}
                startRecordingOnMount={startRecordingOnMount}
                onCommandDetected={handleCommandDetected}
                existingContent={originalContent || content}
                onSaveWithCompleteText={handleSaveWithCompleteText}
              />
              
              {/* Secret Tag Floating Indicator */}
              <SecretTagFloatingIndicator
                activeTags={activeTags}
                onPress={() => navigation.navigate('TagManagement')}
              />
            </View>
          </View>
        ) : (
          <View style={styles.recorderContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Processing Recording...</Text>
            </View>
          </View>
        )}
      </View>

      {isSaving && (
        <View style={styles.savingOverlay}> 
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>
            Saving Entry...
          </Text>
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    zIndex: 2,
  },
  recorderContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : theme.spacing.xl, // Account for status bar
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : theme.spacing.md,
    left: '50%',
    marginLeft: -20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
    ...theme.shadows.sm,
  },
  recorderContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  headerTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
});

export default RecordScreen; 