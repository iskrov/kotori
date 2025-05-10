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

// Import shared components
import LanguageSelectorModal from './LanguageSelectorModal';
import RecordingButton from './RecordingButton';
import RecordingStatus from './RecordingStatus';

// Import hooks
import useAudioRecording from '../hooks/useAudioRecording';
import useWebSocketTranscription, { WebSocketStatus } from '../hooks/useWebSocketTranscription';

// Import config
import { getInitialLanguageOptions, LanguageOption, MAX_LANGUAGE_SELECTION } from '../config/languageConfig';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

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

  // Audio recording hook
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
  const webSocketEffectHasRun = useRef(false);

  // WebSocket handlers
  const handleWebSocketError = useCallback((errorMessage: string) => {
    logger.error('WebSocket Transcription Error:', errorMessage);
    if (isMountedRef.current) setIsProcessing(false);
  }, []);

  const handleInterimTranscript = useCallback((text: string) => {
    logger.debug('Interim transcript received (component):', text);
    if (isMountedRef.current) {
      setCurrentFullTranscript(prev => prev + text + ' ');
    }
  }, []);

  const handleFinalTranscript = useCallback((text: string, detectedLanguage?: string) => {
    logger.info(`Final transcript (component): ${text}, lang: ${detectedLanguage}`);
    if (isMountedRef.current) {
      setCurrentFullTranscript(prev => prev + text + ' ');
    }
  }, []);

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

  // Effect 1: Runs only once on mount and cleans up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    logger.info('AudioRecorder: Component did mount.');

    // Reset state refs/flags needed for fresh instance
    callbackCalledRef.current = false;
    setHasTranscribedAudio(false); // Reset transcription flag

    return () => {
      logger.info('AudioRecorder: Component will unmount. Performing final cleanup.');
      isMountedRef.current = false;
      disconnectWebSocket();
      
      // More careful cleanup of audioUri on unmount
      // Access the latest audioUri via a ref if necessary, or ensure useAudioRecording handles its own primary cleanup.
      // For now, this relies on the audioUri state at the time of unmount, which might not be the one we want to clean.
      // A better approach might be for useAudioRecording to expose a specific cleanup for its *current* recording if unmounted mid-op.
      if (audioUri && !hasTranscribedAudio) { 
         logger.info(`[AudioRecorder Cleanup on Unmount] Attempting to clean up URI: ${audioUri}`);
         cleanupRecordingFile(audioUri).catch(err =>
           logger.error('Error cleaning up recording file during unmount', err)
         );
       }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- EMPTY DEPENDENCY ARRAY FOR TRUE MOUNT/UNMOUNT BEHAVIOR

  // Effect 2: Handle WebSocket connection based on permission (runs when permissionGranted changes)
  useEffect(() => {
    if (permissionGranted && !webSocketEffectHasRun.current) {
      logger.info('AudioRecorder: Permissions granted, WebSocket ready to connect when needed.');
      // Consider actually connecting here if using WebSocket streaming later
      webSocketEffectHasRun.current = true;
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
      } else if (audioUri && !hasTranscribedAudio && !callbackCalledRef.current && !isProcessing) {
        // If stopped, URI exists, but not yet processed (e.g., user clicks done quickly after stop)
        // trigger processing. The useEffect on audioUri will handle it.
        // However, if already processing, let it finish.
        logger.info('handleDone: audioUri present, but not yet processed. Relying on useEffect to process.');
      } else if (!audioUri && !isProcessing && currentFullTranscript.trim()) {
          // If using WebSocket and got transcript but no URI (e.g. continuous streaming without explicit stop/start file saving)
          // and user clicks done, pass the transcript.
          if (!callbackCalledRef.current) {
            callbackCalledRef.current = true;
            setHasTranscribedAudio(true); // Mark as done
            onTranscriptionComplete(currentFullTranscript.trim(), undefined, languageOptions.find(l => l.selected)?.code || languageOptions[0]?.code);
          }
      }
      onCancel(); // Always call onCancel to close the modal
    }
  }, [isRecording, stopRecording, onCancel, audioUri, hasTranscribedAudio, isProcessing, currentFullTranscript, languageOptions, onTranscriptionComplete]);

  // Handle recording actions
  const handleStartRecording = async () => {
    if (!permissionGranted) {
      Alert.alert("Permission Required", "Audio recording permission is needed.");
      return;
    }
    if (!isMountedRef.current) return;

    // Explicitly reset state for a new recording attempt
    logger.info('[AudioRecorder] Resetting state for new recording.');
    setCurrentFullTranscript('');
    callbackCalledRef.current = false;
    setHasTranscribedAudio(false);
    // Resetting processedUris ensures that if the same URI appears again (e.g., error case), it can be reprocessed.
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
    // Skip if no URI, already processing, callback already called, or not mounted
    if (!audioUri || isProcessing || callbackCalledRef.current || !isMountedRef.current || processedUris.has(audioUri)) {
      return;
    }
    
    const processAndCallback = async () => {
      if (!isMountedRef.current) return;
      
      setIsProcessing(true);
      setProcessedUris(prev => new Set(prev).add(audioUri!)); // Mark URI as processed
      
      try {
        const selectedLanguageCodes = languageOptions.filter(l => l.selected).map(l => l.code);
        if (selectedLanguageCodes.length === 0) selectedLanguageCodes.push('en-US');

        logger.info(`Processing recording from URI: ${audioUri} with languages: ${selectedLanguageCodes.join(', ')}`);
        const result = await speechToTextService.transcribeAudio(audioUri!, { languageCode: selectedLanguageCodes[0] });

        if (!isMountedRef.current) {
          logger.warn('Component unmounted during transcription processing');
          return;
        }

        if (result && result.transcript) {
          logger.info('Batch transcription successful');
          if (!callbackCalledRef.current) {
            callbackCalledRef.current = true;
            setHasTranscribedAudio(true);
            onTranscriptionComplete(result.transcript, audioUri, result.detected_language_code);
          }
        } else {
          logger.warn('Batch transcription returned no results or failed.');
          Alert.alert('No Transcription Results', 'The recording could not be transcribed. Please try again.');
          if (!callbackCalledRef.current) {
            callbackCalledRef.current = true; // Still mark callback as called to prevent loops
            setHasTranscribedAudio(true); // Mark as done even if failed
            onTranscriptionComplete('', audioUri);
          }
        }
      } catch (error: any) {
        if (!isMountedRef.current) return;
        logger.error('Failed to transcribe audio (batch)', { message: error?.message, uri: audioUri });
        Alert.alert('Transcription Error', `Failed to transcribe the recording: ${error?.message || 'Unknown error'}`);
        if (!callbackCalledRef.current) {
          callbackCalledRef.current = true;
          setHasTranscribedAudio(true); // Mark as done on error
          onTranscriptionComplete('', audioUri);
        }
      } finally {
        if (isMountedRef.current) {
          setIsProcessing(false);
        }
      }
    };

    processAndCallback();
  // Depend only on audioUri - the effect reads other necessary values via props/state/refs.
  // This prevents the effect from running unnecessarily due to changes in languageOptions, etc.
  }, [audioUri, isProcessing, languageOptions, onTranscriptionComplete, processedUris]); 

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
      return (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Duration: {recordingDuration}s, isRecording: {isRecording ? 'yes' : 'no'}
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
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButtonContainer}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Recorder</Text>
        <TouchableOpacity onPress={handleDone} style={styles.doneButtonContainer} disabled={isProcessing && !hasTranscribedAudio}>
          <Text style={[styles.doneButtonText, (isProcessing && !hasTranscribedAudio) && styles.disabledText]}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        <RecordingStatus 
          isRecording={isRecording} 
          duration={recordingDuration} 
          hasTranscript={currentFullTranscript.trim().length > 0}
          transcriptPreview={currentFullTranscript}
        />

        <View style={styles.transcriptPreviewContainer}>
          <Text style={styles.transcriptLabel}>Transcript Preview:</Text>
          <ScrollView style={styles.transcriptScroll} contentContainerStyle={styles.transcriptContentContainer}>
            <Text style={styles.transcriptText}>{currentFullTranscript || "Your transcribed text will appear here..."}</Text>
          </ScrollView>
        </View>

        <RecordingButton
          isRecording={isRecording}
          onPress={() => {
            if (isRecording) {
              handleStopRecording();
            } else {
              handleStartRecording();
            }
          }}
          disabled={isProcessing}
        />
      </View>

      <View style={styles.footerControls}>
        <TouchableOpacity onPress={() => setShowLanguageSelector(true)} style={styles.languageButton}>
          <Ionicons name="language-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.languageButtonText}>{selectedLanguageNames || 'Select Language'} ({languageOptions.filter(l => l.selected).length})</Text>
        </TouchableOpacity>
      </View>

      <LanguageSelectorModal
        visible={showLanguageSelector}
        languageOptions={languageOptions}
        onToggleLanguage={toggleLanguageSelection}
        onDone={() => setShowLanguageSelector(false)}
        onClose={() => setShowLanguageSelector(false)}
        maxSelection={MAX_LANGUAGE_SELECTION}
      />
      
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
    justifyContent: 'space-between',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  cancelButtonContainer: {
    padding: theme.spacing.sm,
  },
  doneButtonContainer: {
    padding: theme.spacing.sm,
  },
  doneButtonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  disabledText: {
    color: theme.colors.disabled,
  },
  headerTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  transcriptPreviewContainer: {
    height: 150,
    width: '100%',
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
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
  footerControls: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: 8,
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
  },
  languageButtonText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
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