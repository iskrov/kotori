import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useIsFocused } from '@react-navigation/native';
import { format } from 'date-fns';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Types
import { RootStackParamList, RecordScreenParams } from '../../navigation/types';

// Components
import AudioRecorder from '../../components/AudioRecorder';
import JournalForm from '../../components/JournalForm';

// Hooks
import useJournalEntry, { JournalData } from '../../hooks/useJournalEntry';
import { getLanguageName } from '../../config/languageConfig';
import { useHiddenMode } from '../../contexts/HiddenModeContext';

// Utils
import logger from '../../utils/logger';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

// --- Special Tag for Hidden Entries (Client-Side) ---
const HIDDEN_ENTRY_TAG = "_hidden_entry";
// ----------------------------------------------------

// Type definitions for navigation and route
type RecordScreenRouteProp = RouteProp<{ Record: RecordScreenParams | undefined }, 'Record'>;
type RecordScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

const RecordScreen = () => {
  logger.info('RecordScreen instance created/rendered.');
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { isHiddenModeActive } = useHiddenMode();
  
  // Navigation and route
  const navigation = useNavigation<RecordScreenNavigationProp>();
  const route = useRoute<RecordScreenRouteProp>();
  const isFocused = useIsFocused();
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [initialRecordingHandled, setInitialRecordingHandled] = useState(false);
  
  // Journal entry form data
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>(['journal']);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  
  // Refs to handle unmount and navigation
  const mountedRef = useRef(true);
  const isNavigatingRef = useRef(false);
  const initialStartRecordingChecked = useRef(false);
  
  // Get journalId from route params only ONCE for initial state
  const initialJournalId = useMemo(() => route.params?.journalId || null, []);

  // Use our journal entry hook
  const {
    journalId,
    isSaving,
    isAutoSaving,
    saveEntry,
    autoSave,
    cancelAutoSave,
    error: saveError
  } = useJournalEntry(
    useMemo(() => {
      let currentTags = tags;
      if (isHiddenModeActive && !currentTags.includes(HIDDEN_ENTRY_TAG)) {
        currentTags = [...currentTags, HIDDEN_ENTRY_TAG];
      } else if (!isHiddenModeActive && currentTags.includes(HIDDEN_ENTRY_TAG)) {
        currentTags = currentTags.filter(t => t !== HIDDEN_ENTRY_TAG);
      }

      return {
        id: initialJournalId,
        title,
        content,
        tags: currentTags,
        audioUri,
      };
    }, [initialJournalId, title, content, tags, audioUri, isHiddenModeActive]),
    {
      autoSaveDelay: 3000,
      onSaveComplete: useCallback((savedId: string | null) => {
        if (!mountedRef.current) {
          logger.debug('[RecordScreen] onSaveComplete: Aborted (unmounted).');
          return;
        } 
        if (isNavigatingRef.current) {
          if (savedId) {
            logger.info(`[RecordScreen] Save successful (ID: ${savedId}). Navigating back.`);
            if (navigation.canGoBack()) navigation.goBack();
          } else {
            logger.info('[RecordScreen] Save completed but no ID. Resetting nav flag.');
            isNavigatingRef.current = false; 
          }
        } else {
            logger.debug('[RecordScreen] onSaveComplete: Save completed (navigation flag false).');
        }
      }, [navigation]), 
      onSaveError: (error: any) => {
        if (!mountedRef.current) return;
        logger.error('[RecordScreen] Save failed', { 
          message: error.message, 
          status: error.status,
          originalError: error.originalError,
          errorObject: error
        });
        Alert.alert(
          'Save Failed',
          `Could not save the journal entry. ${error.message ? error.message : 'Please try again.'}`
        );
        isNavigatingRef.current = false; 
      },
    }
  );

  // Effect to handle the startRecording navigation parameter
  useEffect(() => {
    if (route.params?.startRecording && !initialRecordingHandled) {
      if (!showRecorder) {
        logger.info('[RecordScreen] useEffect: route.params.startRecording is true and initial recording not handled. Setting showRecorder to true.');
        setShowRecorder(true);
        setInitialRecordingHandled(true); // Mark as handled
      }
      // initialStartRecordingChecked.current = true; // This ref can likely be removed or re-evaluated
    } else if (route.params && route.params.hasOwnProperty('startRecording') && !route.params.startRecording) {
      // This case handles if startRecording is explicitly set to false (e.g. after saving)
      if (showRecorder) {
        logger.info('[RecordScreen] useEffect: route.params.startRecording is explicitly false. Setting showRecorder to false.');
        setShowRecorder(false);
      }
      // initialStartRecordingChecked.current = true;
    } else if (!route.params?.journalId && !initialStartRecordingChecked.current && !route.params?.hasOwnProperty('startRecording') && !initialRecordingHandled) {
      // Default to show recorder for a new entry if not started via param and not handled yet
      logger.info('[RecordScreen] useEffect: New entry, startRecording param absent, and initial not handled. Defaulting to show recorder.');
      if (!showRecorder) setShowRecorder(true);
      setInitialRecordingHandled(true); // Mark as handled here too if we default to show
      // initialStartRecordingChecked.current = true;
    }
  }, [route.params, showRecorder, initialRecordingHandled, navigation]); // Removed navigation, added initialRecordingHandled

  // Main mount/unmount and focus effect
  useEffect(() => {
    mountedRef.current = true;
    logger.info(`RecordScreen: Main effect run. Focused: ${isFocused}`);
    if (isFocused) {
      isNavigatingRef.current = false;
    }
    return () => {
      mountedRef.current = false;
      logger.info(`RecordScreen: Unmounting. Hook Journal ID: ${journalId}, IsNavigating: ${isNavigatingRef.current}`);
      cancelAutoSave();
      logger.info('[RecordScreen] Unmount cleanup complete. Auto-save cancelled.');
    };
  }, [journalId, content, title, audioUri, saveEntry, cancelAutoSave, isFocused]);

  const canSave = useMemo(() => title.trim() !== '' || content.trim() !== '' || audioUri !== null, [title, content, audioUri]);

  // Effect for auto-saving content changes
  useEffect(() => {
    if (!isFocused || isNavigatingRef.current || showRecorder || isSaving || isAutoSaving) {
      return;
    }
    if (content.trim() || title.trim() || audioUri) {
      autoSave();
    } else {
      cancelAutoSave();
    }
  }, [content, title, audioUri, isFocused, showRecorder, isSaving, isAutoSaving, autoSave, cancelAutoSave]);
  
  // Manual Save Button Press
  const handleSavePress = useCallback(() => {
    if (!mountedRef.current || isNavigatingRef.current || isSaving) {
      logger.info('[RecordScreen] handleSavePress: Aborted (unmounted, navigating, or already saving).', { isSaving });
      return;
    }
    if (!canSave) {
      Alert.alert("Empty Entry", "Please add a title, content, or a recording before saving.");
      return;
    }
    logger.info('[RecordScreen] handleSavePress: Initiating manual save. Current journalId:', journalId);
    logger.info('[RecordScreen] Data to save:', { title, content, tags, audioUri });
    isNavigatingRef.current = true; 
    cancelAutoSave(); 
    saveEntry(); 
  }, [saveEntry, cancelAutoSave, title, content, audioUri, tags, journalId, canSave, isSaving]);
  
  // Audio Recorder Handlers
  const handleShowRecorder = useCallback(() => {
    if (!mountedRef.current || isNavigatingRef.current) return;
    logger.info('RecordScreen: User requested to show AudioRecorder modal');
    setIsLoading(false);
    setShowRecorder(true); 
  }, []);
  
  const _updateJournalFieldsFromTranscription = useCallback((transcribedText: string, languageCode?: string, forHiddenEntry?: boolean) => {
    if (!mountedRef.current) return;
    
    setContent(prevContent => {
      const separator = prevContent.trim() ? '\n\n' : '';
      return `${prevContent}${separator}${transcribedText}`;
    });
    
    if (languageCode) {
      const languageName = getLanguageName(languageCode);
      setTags(prevTags => {
        let newTags = prevTags;
        if (languageName && !newTags.includes(languageName)) {
          newTags = [...newTags, languageName];
        }
        if (forHiddenEntry && !newTags.includes(HIDDEN_ENTRY_TAG)) {
          newTags = [...newTags, HIDDEN_ENTRY_TAG];
          logger.info(`[RecordScreen] Added ${HIDDEN_ENTRY_TAG} due to active hidden mode for this entry.`);
        }
        return newTags;
      });
    }
    
    setTitle(prevTitle => {
      if (!prevTitle.trim() && transcribedText) { 
        const words = transcribedText.split(' ');
        return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
      }
      return prevTitle;
    });
  }, []);
  
  const handleTranscriptionComplete = useCallback((transcribedText: string, finalAudioUri?: string, detectedLanguage?: string) => {
    logger.info(`[RecordScreen] handleTranscriptionComplete received. URI: ${finalAudioUri}, Lang: ${detectedLanguage}, HiddenMode: ${isHiddenModeActive}`);
    if (!mountedRef.current) return;
    
    if (transcribedText || finalAudioUri) {
      try {
        if (finalAudioUri) setAudioUri(finalAudioUri);
        if (transcribedText) {
          _updateJournalFieldsFromTranscription(transcribedText, detectedLanguage, isHiddenModeActive);
        }

        // Close the recorder to show the form with transcribed text
        setShowRecorder(false);
        
        // Let auto-save handle saving in the background, don't immediately navigate away
        logger.info('[RecordScreen] Transcription complete, closing recorder to show form');
        
      } catch (err) { logger.error('[RecordScreen] Error processing transcription', err); }
    }
  }, [_updateJournalFieldsFromTranscription, isHiddenModeActive]);
  
  // Called by AudioRecorder's onCancel prop
  const handleRecorderCancelOrDone = useCallback(() => {
    logger.info('[RecordScreen] handleRecorderCancelOrDone called.');
    if (mountedRef.current) {
      setShowRecorder(false);
      setIsLoading(false);
      
      // If there's no content yet (user canceled before recording/transcribing),
      // navigate back instead of showing the empty form
      if (!title.trim() && !content.trim() && !audioUri && !initialJournalId) {
        logger.info('[RecordScreen] No content after recording canceled, navigating back.');
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }
    }
  }, [title, content, audioUri, navigation, initialJournalId]);
  
  // --- Rendering ---
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButtonLeft} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{journalId ? 'Edit Voice Entry' : 'New Voice Entry'}</Text>
        <TouchableOpacity 
          onPress={handleSavePress} 
          style={styles.headerButtonRight} 
          disabled={!canSave || isSaving || isAutoSaving}
          accessibilityLabel="Save entry"
        >
          <Ionicons name="checkmark-done-outline" size={28} color={(!canSave || isSaving || isAutoSaving) ? theme.colors.disabled : theme.colors.primary} />
          <Text style={[styles.headerButtonText, (!canSave || isSaving || isAutoSaving) && styles.disabledText]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <JournalForm
          title={title}
          content={content}
          tags={tags}
          audioUri={audioUri}
          onChangeTitle={setTitle}
          onChangeContent={setContent}
          onChangeTags={setTags}
          onSave={handleSavePress}
          onShowRecorder={handleShowRecorder}
          isSaving={isSaving}
          isAutoSaving={isAutoSaving}
          isLoading={isLoading}
        />
      </ScrollView>
      
      {/* TEST: Render AudioRecorder in an overlay View instead of a Modal */}
      {showRecorder && (
        <View style={styles.audioRecorderOverlay}>
          <AudioRecorder
            onTranscriptionComplete={handleTranscriptionComplete}
            onCancel={handleRecorderCancelOrDone}
          />
        </View>
      )}
      
      {(isSaving || isAutoSaving || isLoading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.white} />
          <Text style={styles.loadingText}>
            {isSaving ? 'Saving...' : isAutoSaving ? 'Auto-saving...' : isLoading ? 'Processing...' : 'Loading...'}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

// Function to generate styles based on the theme
const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.lg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    height: Platform.OS === 'ios' ? 50 : 60,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  headerButtonLeft: {
    padding: theme.spacing.sm,
  },
  headerButtonRight: {
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  headerButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.bold,
    marginLeft: theme.spacing.xs,
  },
  disabledText: {
    color: theme.colors.disabled,
  },
  audioRecorderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    zIndex: 1000,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamilies.regular,
  },
});

export default RecordScreen; 