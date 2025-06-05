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

  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(true); // Start with recorder visible
  
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
    autoSave(); 
    setIsLoading(true);

  }, [setContent, setAudioUri, setTitle, autoSave]);

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

  if (isLoading && !showRecorder) { // Show loading only if recorder isn't active yet
    return (
      <View style={styles.container}>
        <View style={styles.modalOverlay} />
        <View style={styles.recorderContainer}>
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
          <AudioRecorder
            startRecordingOnMount={startRecordingOnMount}
            onTranscriptionComplete={handleTranscriptionComplete}
            onCancel={handleRecorderCancel}
          />
        </View>
      ) : (
        <View style={styles.recorderContainer}>
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
    justifyContent: 'flex-end', // Align to bottom
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 88 : 75, // Leave space for tab bar
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Lighter overlay
    zIndex: 1,
  },
  recorderContainer: {
    width: '100%',
    height: '80%', // Take only 80% of screen height
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    zIndex: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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