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

// Hooks
import useJournalEntry from '../../hooks/useJournalEntry'; // Removed JournalData import as it's implicitly used
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
type RecordScreenRouteProp = RouteProp<MainStackParamList, 'Record'>;
type RecordScreenNavigationProp = StackNavigationProp<MainStackParamList, 'Record'>;

const RecordScreen: React.FC = () => {
  logger.info('RecordScreen instance created/rendered.');
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<RecordScreenNavigationProp>();
  const route = useRoute<RecordScreenRouteProp>();
  const { isHiddenMode } = useHiddenMode();
  
  const startRecordingOnMount = route.params?.startRecording ?? false;
  const selectedDate = route.params?.selectedDate; // Get selectedDate from route params
  
  // Log if using a custom date
  useEffect(() => {
    if (selectedDate) {
      logger.info(`[RecordScreen] Using selected date from calendar: ${selectedDate}`);
    } else {
      logger.info('[RecordScreen] Using current date for new entry');
    }
  }, [selectedDate]);

  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(true); // Start with recorder visible
  const [hasStartedSaving, setHasStartedSaving] = useState(false);
  
  // Data states for saving the entry
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>(['journal']);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  
  const mountedRef = useRef(true);

  const {
    isSaving,
    isAutoSaving,
    autoSave,
    cancelAutoSave,
    saveEntry,
  } = useJournalEntry(
    useMemo(() => {
      let currentTags = tags;
      if (isHiddenMode && !currentTags.includes(HIDDEN_ENTRY_TAG)) {
        currentTags = [...currentTags, HIDDEN_ENTRY_TAG];
      } else if (!isHiddenMode && currentTags.includes(HIDDEN_ENTRY_TAG)) {
        currentTags = currentTags.filter(t => t !== HIDDEN_ENTRY_TAG);
      }
      return {
        id: null, // Always create new entries
        title,
        content,
        tags: currentTags,
        audioUri,
      };
    }, [title, content, tags, audioUri, isHiddenMode]),
    {
      autoSaveDelay: 500,
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
        
        // Navigate back to the previous screen (e.g., Home)
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
      cancelAutoSave();
    };
  }, [cancelAutoSave]);

  const handleTranscriptionComplete = useCallback((transcript: string, transcribedAudioUri?: string, detectedLanguage?: string | null, confidence?: number) => {
    if (!mountedRef.current) {
      logger.debug('[RecordScreen] handleTranscriptionComplete: Aborted (unmounted).');
      return;
    }
    logger.info('[RecordScreen] Transcription completed. Preparing to save...');

    setContent(transcript);
    if (transcribedAudioUri) {
      setAudioUri(transcribedAudioUri);
    }
    if (transcript) {
      const words = transcript.split(' ');
      const generatedTitle = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
      setTitle(generatedTitle);
    }

    logger.info('[RecordScreen] Data set for saving, triggering autoSave.');
    setHasStartedSaving(true);
    autoSave(); 
    setIsLoading(true);

  }, [setContent, setAudioUri, setTitle, autoSave]);

  // Handle manual save from AudioRecorder
  const handleManualSave = useCallback(async () => {
    if (!mountedRef.current) {
      logger.debug('[RecordScreen] handleManualSave: Aborted (unmounted).');
      return;
    }
    
    logger.info('[RecordScreen] Manual save triggered.');
    setHasStartedSaving(true);
    
    try {
      const savedId = await saveEntry();
      if (savedId) {
        logger.info(`[RecordScreen] Manual save successful (ID: ${savedId}).`);
      }
    } catch (error) {
      logger.error('[RecordScreen] Manual save failed:', error);
    }
  }, [saveEntry]);

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
    cancelAutoSave(); // Cancel any pending auto-save
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, cancelAutoSave]);

  // Determine save button state
  const getSaveButtonState = useCallback(() => {
    if (isSaving || isAutoSaving) {
      return { text: 'Saving...', disabled: true, isSaving: true };
    }
    if (hasStartedSaving && !isSaving && !isAutoSaving) {
      return { text: 'Saved', disabled: true, isSaving: false };
    }
    return { text: 'Save', disabled: false, isSaving: false };
  }, [isSaving, isAutoSaving, hasStartedSaving]);

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
      {/* Modal overlay background */}
      <View style={styles.modalOverlay} />
      
      {showRecorder ? (
        <View style={styles.recorderContainer}>
          {/* Modal Header with Drag Handle and Close Button */}
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

          {/* Audio Recorder Content */}
          <View style={styles.recorderContent}>
            <AudioRecorder
              startRecordingOnMount={startRecordingOnMount}
              onTranscriptionComplete={handleTranscriptionComplete}
              onCancel={handleRecorderCancel}
              onManualSave={handleManualSave}
              saveButtonState={getSaveButtonState()}
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

      {(isSaving || isAutoSaving) && (
        <View style={styles.savingOverlay}> 
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>
            {isSaving ? 'Saving Entry...' : 'Saving Entry...'}
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
  recorderContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.colors.background,
    zIndex: 2,
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
});

export default RecordScreen; 