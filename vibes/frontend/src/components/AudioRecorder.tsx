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

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string, audioUri?: string, detectedLanguage?: string) => void;
  onCancel: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptionComplete,
  onCancel,
}) => {
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
      logger.info('AudioRecorder: Component will unmount. Cleaning up.');
      isMountedRef.current = false;
      disconnectWebSocket();
      // Access audioUri directly from state for cleanup
      // NOTE: Using audioUri directly in cleanup is tricky because it captures the value at the time the effect runs.
      // It's better if cleanupRecordingFile can handle null or if useAudioRecording handles its own cleanup.
      // For now, assume cleanupRecordingFile is robust.
      if (audioUri) { // This accesses the state value when cleanup runs
         logger.info(`[AudioRecorder Cleanup] Attempting to clean up URI: ${audioUri}`);
         cleanupRecordingFile(audioUri).catch(err =>
           logger.error('Error cleaning up recording file during unmount', err)
         );
       }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array: runs only once

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
      }
      // Use the passed onCancel prop to signal closure
      onCancel(); 
    }
  }, [isRecording, stopRecording, onCancel]);

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
    if (!audioUri || isProcessing || callbackCalledRef.current || !isMountedRef.current) {
      return;
    }
    
    if (processedUris.has(audioUri)) {
      logger.info(`URI ${audioUri} has already been processed. Skipping.`);
      return;
    }
    
    const processAndCallback = async () => {
      if (!isMountedRef.current) return;
      
      setIsProcessing(true);
      setProcessedUris(prev => new Set(prev).add(audioUri)); // Mark URI as processed
      
      try {
        const selectedLanguageCodes = languageOptions.filter(l => l.selected).map(l => l.code);
        if (selectedLanguageCodes.length === 0) selectedLanguageCodes.push('en-US');

        logger.info(`Processing recording from URI: ${audioUri} with languages: ${selectedLanguageCodes.join(', ')}`);
        const result = await speechToTextService.transcribeAudio(audioUri, { languageCode: selectedLanguageCodes[0] });

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
  }, [audioUri]); 

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
      <View style={styles.header}>
        <Text style={styles.title}>Voice Recording</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleDone} disabled={isProcessing}>
          <Ionicons name="close" size={24} color={isProcessing ? '#ccc' : '#333'} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#7D4CDB" />
            <Text style={styles.processingText}>Processing your recording...</Text>
          </View>
        ) : (
          <>
            <RecordingStatus 
              isRecording={isRecording}
              duration={recordingDuration}
              hasTranscript={!!currentFullTranscript}
              transcriptPreview={currentFullTranscript}
            />

            {renderDebugInfo()}

            <RecordingButton
              isRecording={isRecording}
              onPress={isRecording ? handleStopRecording : handleStartRecording}
              disabled={!permissionGranted || isProcessing || (hasTranscribedAudio && !isRecording)}
              size="medium"
            />
            
            {!permissionGranted && <Text style={styles.permissionText}>Microphone permission needed.</Text>}

            <TouchableOpacity
              style={[styles.languageButton, (isProcessing || hasTranscribedAudio) ? styles.disabledButton : {}]}
              onPress={() => setShowLanguageSelector(true)}
              disabled={isProcessing || hasTranscribedAudio}
            >
              <Ionicons name="language" size={20} color={(isProcessing || hasTranscribedAudio) ? '#ccc' : '#7D4CDB'} />
              <Text style={[styles.languageButtonText, (isProcessing || hasTranscribedAudio) ? styles.disabledButtonText : {}]}>
                {selectedLanguageNames || 'Select Language'} ({languageOptions.filter(l => l.selected).length})
              </Text>
            </TouchableOpacity>

            {hasTranscribedAudio && (
              <TouchableOpacity 
                style={styles.doneButton}
                onPress={handleDone}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <LanguageSelectorModal
        visible={showLanguageSelector}
        languageOptions={languageOptions}
        onToggleLanguage={toggleLanguageSelection}
        onDone={() => setShowLanguageSelector(false)}
        onClose={() => setShowLanguageSelector(false)}
        maxSelection={MAX_LANGUAGE_SELECTION}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginHorizontal: Platform.select({web: 32, default: 16}),
    marginVertical: Platform.select({web: 32, default: 24}),
    maxHeight: Dimensions.get('window').height * Platform.select({web: 0.8, default: 0.7}),
    minHeight: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  processingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#555',
  },
  permissionText: {
    fontSize: 12,
    color: '#dc3545',
    marginBottom: 10,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0e9ff',
    borderRadius: 20,
    marginBottom: 10,
  },
  languageButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#7D4CDB',
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#e9ecef',
  },
  disabledButtonText: {
    color: '#adb5bd',
  },
  wsStatusText: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 5,
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
  doneButton: {
    marginTop: 16,
    backgroundColor: '#7D4CDB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default AudioRecorder; 