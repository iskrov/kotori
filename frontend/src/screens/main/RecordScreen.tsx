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

// Utils
import logger from '../../utils/logger';

// Define colors directly in the file instead of importing
const colors = {
  primary: '#7D4CDB',
};

// Type definitions for navigation and route
type RecordScreenRouteProp = RouteProp<{ Record: RecordScreenParams | undefined }, 'Record'>;
type RecordScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

const RecordScreen = () => {
  logger.info('RecordScreen instance created/rendered.');
  
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
  const initialStartRecordingChecked = useRef(false); // To process startRecording param only once
  
  // Get journalId from route params only ONCE for initial state
  const initialJournalId = useMemo(() => route.params?.journalId || null, []);

  // Use our journal entry hook
  const {
    journalId, // Source of truth for the entry ID
    isSaving,
    isAutoSaving,
    saveEntry,
    autoSave,
    cancelAutoSave,
    error: saveError
  } = useJournalEntry(
    // Pass initial data, including initialJournalId.
    // The hook manages the ID internally after the first save.
    useMemo(() => ({
      id: initialJournalId,
      title,
      content,
      tags,
      audioUri,
    }), [initialJournalId, title, content, tags, audioUri]),
    {
      autoSaveDelay: 3000,
      onSaveComplete: useCallback((savedId: string | null) => {
        if (!mountedRef.current) { // Check mounted first
          logger.debug('[RecordScreen] onSaveComplete: Aborted (unmounted).');
          return;
        } 
        // Check navigating flag *after* mounted check
        if (isNavigatingRef.current) {
          if (savedId) {
            logger.info(`[RecordScreen] Save successful (ID: ${savedId}). Navigating back.`);
            if (navigation.canGoBack()) navigation.goBack();
            // Keep isNavigatingRef=true because we are navigating
          } else {
            logger.info('[RecordScreen] Save completed but no ID (likely nothing to save or aborted). Resetting nav flag.');
            isNavigatingRef.current = false; // Reset flag if no navigation occurred
          }
        } else {
            logger.debug('[RecordScreen] onSaveComplete: Save completed but navigation flag was false (maybe auto-save?).');
        }
      }, [navigation]), 
      onSaveError: (error) => {
        if (!mountedRef.current) return;
        logger.error('[RecordScreen] Save failed', error);
        Alert.alert('Save Failed', 'Could not save the journal entry. Please try again.');
        isNavigatingRef.current = false; // Always reset flag on error
      },
    }
  );

  // Effect to handle the startRecording navigation parameter
  useEffect(() => {
    if (route.params?.startRecording && !initialStartRecordingChecked.current) {
      initialStartRecordingChecked.current = true;
      logger.info('RecordScreen: Detected startRecording param, showing recorder.');
      setShowRecorder(true);
      // No setParams needed here, handled by ref check
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
  
  const _updateJournalFieldsFromTranscription = useCallback((text: string, languageCode?: string) => {
    if (!mountedRef.current) return;
    
    setContent(prevContent => {
      const separator = prevContent.trim() ? '\n\n' : '';
      return `${prevContent}${separator}${text}`;
    });
    
    if (languageCode) {
      const languageName = getLanguageName(languageCode);
      setTags(prevTags => {
        if (languageName && !prevTags.includes(languageName)) {
          return [...prevTags, languageName];
        }
        return prevTags;
      });
    }
    
    setTitle(prevTitle => {
      if (!prevTitle.trim() && text) { 
        const words = text.split(' ');
        return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
      }
      return prevTitle;
    });
  }, []);
  
  const handleTranscriptionComplete = useCallback((transcribedText: string, finalAudioUri?: string, detectedLanguage?: string) => {
    logger.info(`[RecordScreen] handleTranscriptionComplete received. URI: ${finalAudioUri}, Lang: ${detectedLanguage}`);
    if (!mountedRef.current) return;
    try {
      if (finalAudioUri) setAudioUri(finalAudioUri);
      if (transcribedText) _updateJournalFieldsFromTranscription(transcribedText, detectedLanguage);
    } catch (err) { logger.error('[RecordScreen] Error processing transcription', err); }
  }, [_updateJournalFieldsFromTranscription]);
  
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
      
      {showRecorder && (
        <Modal
          visible={showRecorder}
          animationType="slide"
          transparent={true}
          onRequestClose={handleRecorderCancelOrDone}
        >
          <View style={styles.recorderModalOverlay}>
            <AudioRecorder 
              onTranscriptionComplete={handleTranscriptionComplete}
              onCancel={handleRecorderCancelOrDone}
            />
          </View>
        </Modal>
      )}
      
      {isSaving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  recorderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RecordScreen; 