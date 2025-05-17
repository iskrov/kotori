import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import speechToTextService from '../services/speechToText';
import logger from '../utils/logger';
import { Audio } from 'expo-av';

// Import shared components
import LanguageSelectorModal from './LanguageSelectorModal';
import RecordingButton from './RecordingButton';
import RecordingStatus from './RecordingStatus';

// Import hooks
import useAudioRecording from '../hooks/useAudioRecording';
import useWebSocketTranscription, { WebSocketStatus } from '../hooks/useWebSocketTranscription';
import { useHiddenMode } from '../contexts/HiddenModeContext';

// Import config
import { getInitialLanguageOptions, LanguageOption, MAX_LANGUAGE_SELECTION } from '../config/languageConfig';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

// --- Define Secret Phrase (Temporary) ---
const SECRET_PHRASE = "show hidden entries";
// -----------------------------------------

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string, audioUri?: string, detectedLanguage?: string) => void;
  onCancel: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptionComplete,
  onCancel,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { activateHiddenMode } = useHiddenMode();

  const {
    isRecording,
    recordingDuration,
    audioUri,
    startRecording,
    stopRecording,
    cleanupRecordingFile,
    permissionGranted,
    error: recordingError
  } = useAudioRecording({
    requestPermissionOnMount: true
  });

  // State management
  const [currentFullTranscript, setCurrentFullTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(getInitialLanguageOptions());
  const [processedUris, setProcessedUris] = useState<Set<string>>(new Set());
  const [hasTranscribedAudio, setHasTranscribedAudio] = useState(false);
  
  // Refs to track component state
  const isMountedRef = useRef(true);
  const callbackCalledRef = useRef(false);

  // --- Check for Secret Phrase ---
  const checkAndHandleSecretPhrase = useCallback((transcript: string) => {
    const normalizedTranscript = transcript
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:]/g, '');

    const normalizedSecret = SECRET_PHRASE
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:]/g, '');

    if (normalizedTranscript === normalizedSecret) {
      logger.info(`[AudioRecorder] Secret phrase "${SECRET_PHRASE}" detected! Activating hidden mode.`);
      activateHiddenMode();
      return true;
    }
    return false;
  }, [activateHiddenMode]);
  // -------------------------------

  // WebSocket handlers
  const handleWebSocketError = useCallback((errorMessage: string) => {
    logger.error('WebSocket Transcription Error:', errorMessage);
    if (isMountedRef.current) setIsProcessing(false);
  }, []);

  const handleInterimTranscript = useCallback((text: string) => {
    logger.debug('Interim transcript received (component):', text);
    if (isMountedRef.current) {
      // Avoid adding the secret phrase to the preview if it's the only thing
      // This is a soft check, batch processing is the definitive one.
      if (!checkAndHandleSecretPhrase(text.trim())) { // Check here too
        setCurrentFullTranscript(prev => prev + text + ' ');
      }
    }
  }, [checkAndHandleSecretPhrase]);

  const handleFinalTranscript = useCallback((text: string, detectedLanguage?: string) => {
    logger.info(`Final transcript (component): ${text}, lang: ${detectedLanguage}`);
    if (isMountedRef.current) {
      // We mainly rely on the batch transcript for calling onTranscriptionComplete.
      // This primarily updates the UI preview.
      // If the final transcript segment IS the secret phrase, we might not want to add it.
      // However, checkAndHandleSecretPhrase is already called by the batch processor later.
      // For the UI, let's ensure it reflects what will likely be processed.

      // If this final WS transcript *is* the secret phrase, don't append it to the running transcript visually
      // as it will be consumed by the batch processor.
      // The batch processor will be the source of truth for onTranscriptionComplete.
      const isSecret = checkAndHandleSecretPhrase(text);
      if (!isSecret) {
         setCurrentFullTranscript(prev => prev + text + ' ');
      } else {
        // If it was secret, maybe clear the current full transcript if it only contained that.
        // This is tricky because WS can send multiple final transcripts.
        // For now, let's assume batch handles consumption.
        logger.info('[AudioRecorder] WS final transcript matched secret phrase. UI will be updated by batch logic or if only phrase was said.');
      }
    }
  }, [checkAndHandleSecretPhrase]);

  // WebSocket hook
  const {
    wsStatus,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    sendMessage: sendWsMessage,
  } = useWebSocketTranscription({
    onInterimTranscript: handleInterimTranscript,
    onFinalTranscript: handleFinalTranscript,
    onTranscriptionError: handleWebSocketError,
    onOpen: () => logger.info('AudioRecorder: WebSocket connection opened.'),
    onClose: (event) => logger.info('AudioRecorder: WebSocket connection closed.', event),
  });

  // Effect 1: Mount/Unmount and Audio Mode Setup
  useEffect(() => {
    isMountedRef.current = true;
    logger.info('AudioRecorder: Component did mount.');

    callbackCalledRef.current = false;
    setHasTranscribedAudio(false);

    return () => {
      logger.info('AudioRecorder: Component will unmount. Performing final cleanup.');
      isMountedRef.current = false;
      disconnectWebSocket();
      
      if (audioUri && !hasTranscribedAudio) { 
         logger.info(`[AudioRecorder Cleanup on Unmount] Attempting to clean up URI: ${audioUri}`);
         cleanupRecordingFile(audioUri).catch(err =>
           logger.error('Error cleaning up recording file during unmount', err)
         );
       }
    };
  }, [cleanupRecordingFile, disconnectWebSocket]);

  // Effect to set audio mode *after* permission is granted via the hook's request
  useEffect(() => {
    if (permissionGranted) {
      const setMode = async () => {
        logger.info('[AudioRecorder] Permission is granted, ensuring audio mode is set.');
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          logger.info('[AudioRecorder] Audio mode set successfully (on permissionGranted change).');
        } catch (err) {
          logger.error('[AudioRecorder] Failed to set audio mode (on permissionGranted change):', err);
        }
      };
      setMode();
    }
  }, [permissionGranted]);

  // Simplified function to safely handle the done/cancel action
  const handleDone = useCallback(() => {
    logger.info('AudioRecorder: handleDone called, closing recorder');
    if (isMountedRef.current) {
      if (isRecording) {
        stopRecording().catch(err => 
          logger.error('Error stopping recording during handleDone', err)
        );
        // Let the useEffect for audioUri handle the transcription
      } else if (audioUri && !hasTranscribedAudio && !callbackCalledRef.current && !isProcessing) {
        logger.info('handleDone: audioUri present, but not yet processed. Relying on useEffect to process.');
        // This case should ideally not call onCancel immediately if processing is expected.
        // However, current flow: onCancel will be called.
      } else if (!audioUri && !isProcessing && currentFullTranscript.trim()) {
          // This case is for when WS might have provided the full transcript,
          // and no batch processing (audioUri) is pending/expected.
          const transcriptToProcess = currentFullTranscript.trim();
          const isSecretOnly = checkAndHandleSecretPhrase(transcriptToProcess);

          if (!callbackCalledRef.current) {
            callbackCalledRef.current = true; // Mark callback attempted
            setHasTranscribedAudio(true); // Mark as "processed"
            if (!isSecretOnly) {
                logger.info('[AudioRecorder] Done pressed. WS transcript to process (not secret).');
                onTranscriptionComplete(transcriptToProcess, undefined, languageOptions.find(l => l.selected)?.code || languageOptions[0]?.code);
            } else {
                logger.info('[AudioRecorder] Done pressed. WS transcript was ONLY secret phrase. Not calling onTranscriptionComplete.');
                // If it was only the secret phrase, we don't pass anything up.
            }
          }
      }
      // Always call onCancel to ensure the UI closes.
      // If transcription is pending via audioUri, it will proceed in the background.
      onCancel();
    }
  }, [isRecording, stopRecording, onCancel, audioUri, hasTranscribedAudio, isProcessing, currentFullTranscript, languageOptions, onTranscriptionComplete, checkAndHandleSecretPhrase]);

  // Handle recording actions
  const handleStartRecording = async () => {
    if (!permissionGranted) {
      logger.warn('[AudioRecorder] Start recording called, but permissions not granted.');
      Alert.alert(
        "Permission Required", 
        "Microphone permission is needed to record. Please ensure it\'s granted in your device settings. The app should have prompted you."
      );
      return;
    }
    if (!isMountedRef.current) return;

    logger.info('[AudioRecorder] Resetting state for new recording.');
    setCurrentFullTranscript('');
    callbackCalledRef.current = false;
    setHasTranscribedAudio(false);
    setProcessedUris(new Set()); 
    
    logger.info('[AudioRecorder] Starting recording...');
    await startRecording();
  };

  const handleStopRecording = async () => {
    if (!isMountedRef.current) return;
    logger.info('[AudioRecorder] Stopping recording...');
    await stopRecording();
  };

  // Process the recording once audioUri is available
  useEffect(() => {
    if (!audioUri || isProcessing || callbackCalledRef.current || !isMountedRef.current || processedUris.has(audioUri)) {
      return;
    }
    
    const processAndCallback = async () => {
      if (!isMountedRef.current) return;
      
      setIsProcessing(true);
      setProcessedUris(prev => new Set(prev).add(audioUri!));
      
      try {
        const selectedLanguageCodes = languageOptions.filter(l => l.selected).map(l => l.code);
        if (selectedLanguageCodes.length === 0) selectedLanguageCodes.push('en-US');

        logger.info(`Processing recording from URI: ${audioUri} with languages: ${selectedLanguageCodes.join(', ')}`);
        const result = await speechToTextService.transcribeAudio(audioUri!, { languageCode: selectedLanguageCodes[0] });

        if (!isMountedRef.current) {
          logger.warn('Component unmounted during transcription processing');
          return;
        }

        // Ensure callbackCalledRef is only set once for this audioUri
        if (callbackCalledRef.current && processedUris.has(audioUri!)) {
            logger.warn(`[AudioRecorder] processAndCallback: callback already called for URI ${audioUri}. Aborting duplicate.`);
            setIsProcessing(false);
            return;
        }
        callbackCalledRef.current = true;
        setHasTranscribedAudio(true);


        if (result && result.transcript) {
          const isSecret = checkAndHandleSecretPhrase(result.transcript);
          if (isSecret) {
            logger.info('[AudioRecorder] Secret phrase matched in batch transcript. Consuming it. Not calling onTranscriptionComplete.');
            setCurrentFullTranscript(''); // Clear preview if only secret phrase
          } else {
            logger.info('Batch transcription successful (not secret). Calling onTranscriptionComplete.');
            onTranscriptionComplete(result.transcript, audioUri, result.detected_language_code);
            setCurrentFullTranscript(result.transcript); // Update preview with batch result
          }
        } else {
          logger.warn('Batch transcription returned no results or failed. Calling onTranscriptionComplete with empty string.');
          onTranscriptionComplete('', audioUri); 
          setCurrentFullTranscript("Transcription failed or no speech detected."); // Update preview with error
        }
      } catch (error: any) {
        if (!isMountedRef.current) return;
        // Ensure callbackCalledRef is checked/set here too in case of error before success
        if (!callbackCalledRef.current) {
            callbackCalledRef.current = true;
            setHasTranscribedAudio(true);
        }
        logger.error('Failed to transcribe audio (batch)', { message: error?.message, uri: audioUri });
        Alert.alert('Transcription Error', `Failed to transcribe the recording: ${error?.message || 'Unknown error'}`);
        onTranscriptionComplete('', audioUri); // Call with empty on error
        setCurrentFullTranscript("Transcription error."); // Update preview with error
      } finally {
        if (isMountedRef.current) {
          setIsProcessing(false);
        }
      }
    };

    processAndCallback();
  }, [audioUri, isProcessing, languageOptions, onTranscriptionComplete, processedUris, checkAndHandleSecretPhrase, cleanupRecordingFile]);

  // Language selection handler
  const toggleLanguageSelection = (code: string) => {
    if (!isMountedRef.current) return;
    
    setLanguageOptions(prev =>
      prev.map(lang =>
        lang.code === code
          ? { ...lang, selected: !lang.selected }
          : lang
      )
    );
  };

  // Get selected language names for display
  const selectedLanguageNames = languageOptions
    .filter(l => l.selected)
    .map(l => l.name.split(' ')[0])
    .join(', ');

  // Render debug info for timer
  const renderDebugInfo = () => {
    if (process.env.NODE_ENV === 'development') {
      const errorMsg = recordingError ? (recordingError instanceof Error ? recordingError.message : String(recordingError)) : 'none';
      return (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Duration: {recordingDuration}s, isRecording: {isRecording ? 'yes' : 'no'}
          </Text>
          <Text style={styles.debugText}>
            Perm: {permissionGranted ? 'yes' : 'no'}, Error: {errorMsg}
          </Text>
          <Text style={styles.debugText}>
            URI: {audioUri ? 'yes' : 'no'}, Processing: {isProcessing ? 'yes' : 'no'}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onCancel} style={styles.headerSideButton} accessibilityLabel="Close recorder">
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Recorder</Text>
        <TouchableOpacity onPress={handleDone} style={styles.headerSideButton} accessibilityLabel="Done" disabled={isProcessing && !hasTranscribedAudio}>
          <Text style={[styles.doneButtonText, (isProcessing && !hasTranscribedAudio) && styles.disabledText]}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Timer and Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.timerText}>{recordingDuration}s</Text>
          <Text style={styles.statusText}>
            {isRecording ? 'Recording...' : 'Tap the mic to start recording'}
          </Text>
        </View>

        {/* Central Mic Button */}
        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPress={() => {
            if (isRecording) {
              handleStopRecording();
            } else {
              handleStartRecording();
            }
          }}
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
          disabled={isProcessing}
        >
          <Ionicons name="mic" size={48} color={theme.colors.white} />
        </TouchableOpacity>

        {/* Language Selector */}
        <TouchableOpacity onPress={() => setShowLanguageSelector(true)} style={styles.languagePill} accessibilityLabel="Select language">
          <Ionicons name="language-outline" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.languagePillText}>{selectedLanguageNames || 'Select Language'} ({languageOptions.filter(l => l.selected).length})</Text>
        </TouchableOpacity>

        {/* Transcript Preview */}
        <View style={styles.transcriptPreviewContainer}>
          <Text style={styles.transcriptLabel}>Transcript Preview:</Text>
          <ScrollView style={styles.transcriptScroll} contentContainerStyle={styles.transcriptContentContainer}>
            <Text style={styles.transcriptText}>
              {isRecording
                ? "Recording... Transcript will appear after processing."
                : isProcessing 
                  ? "Processing transcript..."
                  : currentFullTranscript || "Your transcribed text will appear here..."}
            </Text>
          </ScrollView>
        </View>

        {/* Debug Info (dev only) */}
        {renderDebugInfo()}
      </View>

      {/* Language Selector Modal */}
      <LanguageSelectorModal
        visible={showLanguageSelector}
        languageOptions={languageOptions}
        onToggleLanguage={toggleLanguageSelection}
        onDone={() => setShowLanguageSelector(false)}
        onClose={() => setShowLanguageSelector(false)}
        maxSelection={MAX_LANGUAGE_SELECTION}
      />
      
      {/* Processing Overlay */}
      {(isProcessing) && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'flex-start',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  headerSideButton: {
    padding: theme.spacing.sm,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  doneButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  disabledText: {
    color: theme.colors.disabled,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.lg,
    width: '100%',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  timerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  statusText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 4,
    borderColor: theme.colors.primary,
    transitionProperty: 'background-color',
    transitionDuration: '0.2s',
  },
  micButtonActive: {
    backgroundColor: theme.colors.error,
    borderColor: theme.colors.error,
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
    marginBottom: theme.spacing.lg,
    marginTop: -theme.spacing.sm,
    minHeight: 36,
  },
  languagePillText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  transcriptPreviewContainer: {
    minHeight: 60,
    maxHeight: 120,
    width: '100%',
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.isDarkMode ? theme.colors.gray800 : theme.colors.white,
  },
  transcriptLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContentContainer: {
    paddingBottom: theme.spacing.sm,
  },
  transcriptText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)', 
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  processingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  debugContainer: {
    marginVertical: 5,
    padding: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  debugText: {
    fontSize: 10,
    color: '#666',
  },
});

export default AudioRecorder; 