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
      onSaveError: (error) => {
        if (!mountedRef.current) return;
        logger.error('[RecordScreen] Save failed', error);
        Alert.alert('Save Failed', 'Could not save the journal entry. Please try again.');
        isNavigatingRef.current = false; 
      },
    }
  );

  // Effect to handle the startRecording navigation parameter
  useEffect(() => {
    if (route.params?.startRecording && !initialStartRecordingChecked.current) {
      initialStartRecordingChecked.current = true;
      logger.info('RecordScreen: Detected startRecording param, showing recorder.');
      setShowRecorder(true);
    }
  }, [route.params?.startRecording]);

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
    if (!mountedRef.current || isNavigatingRef.current) return;
    logger.info('[RecordScreen] handleSavePress: Initiating manual save.');
    isNavigatingRef.current = true; 
    cancelAutoSave(); 
    saveEntry(); 
  }, [saveEntry, cancelAutoSave]);
  
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
      } catch (err) { logger.error('[RecordScreen] Error processing transcription', err); }
    }
  }, [_updateJournalFieldsFromTranscription, isHiddenModeActive]);
  
  // Called by AudioRecorder's onCancel prop
  const handleRecorderCancelOrDone = useCallback(() => {
    logger.info('[RecordScreen] handleRecorderCancelOrDone called.');
    if (mountedRef.current) {
      setShowRecorder(false);
      setIsLoading(false);
    }
  }, []);
  
  // --- Rendering ---
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{journalId ? 'Edit Journal' : 'New Journal Entry'}</Text>
        </View>
        
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
            {isSaving ? 'Saving...' : isAutoSaving ? 'Auto-saving...' : 'Loading...'}
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
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  headerTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamilies.bold,
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