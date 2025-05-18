import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import speechToTextService from '../services/speechToText';
import logger from '../utils/logger';
import { Audio } from 'expo-av';

// Import shared components
import LanguageSelectorModal from './LanguageSelectorModal';

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

  // States for chunked recording
  const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
  const [currentSegmentTranscript, setCurrentSegmentTranscript] = useState('');
  const [isTranscribingSegment, setIsTranscribingSegment] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(getInitialLanguageOptions());
  const [processedUris, setProcessedUris] = useState<Set<string>>(new Set());
  const [hasTranscribedAudio, setHasTranscribedAudio] = useState(false);
  
  // Refs to track component state
  const isMountedRef = useRef(true);
  const callbackCalledRef = useRef(false);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.stagger(300, [
          Animated.sequence([
            Animated.timing(waveAnim1, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(waveAnim1, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(waveAnim2, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(waveAnim2, { toValue: 0, duration: 800, useNativeDriver: true }),
          ])
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      waveAnim1.stopAnimation();
      waveAnim1.setValue(0);
      waveAnim2.stopAnimation();
      waveAnim2.setValue(0);
    }
  }, [isRecording, pulseAnim, waveAnim1, waveAnim2]);

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
    if (isMountedRef.current) {
      setIsProcessing(false); // This might need to be setIsTranscribingSegment
      setCurrentSegmentTranscript("Error with live transcription.");
    }
  }, []);

  const handleInterimTranscript = useCallback((text: string) => {
    logger.debug('Interim transcript received (WS):', text);
    if (isMountedRef.current) {
      setCurrentSegmentTranscript(prev => prev + text);
    }
  }, []);

  const handleFinalTranscript = useCallback((text: string, detectedLanguage?: string) => {
    logger.info(`Final transcript (WS): ${text}, lang: ${detectedLanguage}`);
    if (isMountedRef.current) {
      // For now, WS final transcript also just updates the current segment preview.
      // Batch processing will be the source of truth for appending to accumulatedTranscript.
      setCurrentSegmentTranscript(text + ' '); 
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

  // Effect 1: Mount/Unmount and Audio Mode Setup
  useEffect(() => {
    isMountedRef.current = true;
    logger.info('AudioRecorder: Component did mount.');

    // Reset states for chunked recording when component mounts
    setTranscriptSegments([]);
    setCurrentSegmentTranscript('');
    setIsTranscribingSegment(false);

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

  // Simplified function to safely handle the done/cancel action (X button)
  const handleDone = useCallback(() => {
    logger.info('AudioRecorder: handleDone (X button) called, closing recorder and discarding changes.');
    if (isMountedRef.current) {
      if (isRecording) { // If recording, stop it first
        stopRecording().catch(err => 
          logger.error('Error stopping recording during handleDone (X button)', err)
        );
      }
      onCancel(); // Always call onCancel to close
    }
  }, [isRecording, stopRecording, onCancel]);

  // This is the save action that was previously in handleFinalizeAndClose
  const handleAcceptTranscript = useCallback(() => {
    logger.info('[AudioRecorder] Accept transcript button pressed.');
    
    if (!isMountedRef.current) return;

    if (isRecording) {
      Alert.alert("Still Recording", "Please stop the current recording segment before finalizing.");
      logger.warn('[AudioRecorder] Finalize attempted while still recording.');
      return;
    }
    if (isTranscribingSegment) {
      Alert.alert("Processing Segment", "Please wait for the current audio segment to finish processing before finalizing.");
      logger.warn('[AudioRecorder] Finalize attempted while transcribing a segment.');
      return;
    }

    const combinedTranscript = transcriptSegments.join('\n\n');
    logger.info('[AudioRecorder] Finalizing transcript and closing.', { segmentsCount: transcriptSegments.length });
    const langCode = languageOptions.find(l => l.selected)?.code || languageOptions[0]?.code || 'auto';
    onTranscriptionComplete(combinedTranscript, undefined, langCode);
    onCancel(); // This will trigger unmount and reset states via the mount useEffect return function
  }, [isRecording, isTranscribingSegment, transcriptSegments, languageOptions, onTranscriptionComplete, onCancel, isMountedRef]);



  const processSegment = async (uri: string, selectedLangCode: string) => {
    if (!uri || processedUris.has(uri)) {
      logger.info('[AudioRecorder] processSegment: URI already processed or invalid.', { uri });
      return;
    }

    logger.info('[AudioRecorder] processSegment', { uri: uri, language: selectedLangCode });
    setIsTranscribingSegment(true);
    setCurrentSegmentTranscript('Processing audio segment...'); // Update live preview
    setProcessedUris(prev => new Set(prev).add(uri));
    setHasTranscribedAudio(true); // Mark that some audio has been processed

    try {
      const result = await speechToTextService.transcribeAudio(uri, { languageCode: selectedLangCode });
      if (!isMountedRef.current) return;

      const transcriptText = result.transcript?.trim() || '';
      logger.info('[AudioRecorder] Segment transcribed', { text: transcriptText, detectedLanguage: result.detected_language_code });

      const isSecret = checkAndHandleSecretPhrase(transcriptText);
      if (isSecret) {
        logger.info('[AudioRecorder] Secret phrase detected in segment. Not appending to accumulated transcript.');
        // Potentially give some feedback that a command was recognized?
      } else if (transcriptText) {
        setTranscriptSegments(prev => [...prev, sanitizeText(transcriptText)]);
      }
      setCurrentSegmentTranscript(''); // Clear segment preview
      cleanupRecordingFile(uri); // Clean up the processed segment file

    } catch (error: any) {
      logger.error('[AudioRecorder] Error transcribing audio segment:', error);
      if (isMountedRef.current) {
        setCurrentSegmentTranscript('Error transcribing segment. Try again.');
        // Alert.alert('Transcription Error', error.message || 'Failed to transcribe audio segment.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsTranscribingSegment(false);
      }
    }
  };

  // Effect to process audio URI when it changes (i.e., after a recording segment stops)
  useEffect(() => {
    if (audioUri && !isRecording && !processedUris.has(audioUri) && permissionGranted) {
      const selectedLang = languageOptions.find(l => l.selected) || languageOptions[0];
      const langCode = selectedLang?.code || 'auto'; // Default to auto if something goes wrong
      logger.info(`[AudioRecorder] useEffect detected new audioUri: ${audioUri} for language: ${langCode}. Starting processSegment.`);
      processSegment(audioUri, langCode);
    }
  }, [audioUri, isRecording, processedUris, permissionGranted, languageOptions]);

  const handleMicPress = async () => {
    if (!permissionGranted) {
      Alert.alert('Permissions Required', 'Audio recording permission is needed to record.');
      logger.warn('Mic pressed but permission not granted.');
      return;
    }

    if (isRecording) {
      logger.info('[AudioRecorder] Mic press: Stopping current recording segment.');
      // Intentionally not setting currentSegmentTranscript to 'Finalizing segment...' here yet
      // to keep this step minimal. stopRecording will eventually trigger audioUri effect.
      try {
        await stopRecording();
        // setIsTranscribingSegment(true); // This will be handled by the effect that processes audioUri
      } catch (error) {
        logger.error('[AudioRecorder] Error stopping recording segment:', error);
        // setCurrentSegmentTranscript('Error stopping. Tap mic to try again.'); // Keep UI minimal for now
        // setIsTranscribingSegment(false); // Reset if stop failed
      }
    } else { // Not recording
      if (isTranscribingSegment) {
        logger.info('[AudioRecorder] Mic press: Still transcribing previous segment. Please wait.');
        Alert.alert('Processing', 'Still processing the previous audio. Please wait a moment.');
        return;
      }
      logger.info('[AudioRecorder] Mic press: Starting new recording segment.');
      // setCurrentSegmentTranscript(''); // Keep UI minimal for now
      try {
        await startRecording();
      } catch (error) {
        logger.error('[AudioRecorder] Error starting new recording segment:', error);
        Alert.alert('Error Starting Recording', 'Could not start a new recording. Please try again.');
      }
    }
  };

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to sanitize/clean transcript text
  const sanitizeText = (text: string): string => {
    // Remove any leading special characters like (, [, •, etc.
    return text.replace(/^[\(\[\•\-\*]+\s*/g, '').trim();
  };

  const canAcceptTranscript = !isRecording && !isTranscribingSegment && transcriptSegments.length > 0;

  return (
    <View style={styles.container}>
      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Timer and Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
          <Text style={styles.statusText}>
            {isRecording 
              ? "Tap mic to STOP segment"
              : isTranscribingSegment 
              ? "Processing segment..."
              : permissionGranted
              ? "Tap mic to START new segment"
              : "Waiting for audio permission..."}
          </Text>
          {currentSegmentTranscript.trim() && !isRecording && (
            <Text style={[styles.statusText, styles.segmentStatusText]}>
              Segment: {currentSegmentTranscript}
            </Text>
          )}
        </View>

        {/* Central Mic Button & Sound Waves */}
        <View style={styles.micAreaContainer}>
          <Animated.View style={[styles.soundWave, {transform: [{scale: waveAnim1.interpolate({inputRange: [0,1], outputRange: [1, 1.3]})}] , opacity: waveAnim1.interpolate({inputRange: [0,0.5,1], outputRange: [0,0.5,0]})}]} />
          <Animated.View style={[styles.micButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              style={[styles.micButton, isRecording && styles.micButtonActive, (isProcessing || !permissionGranted) && styles.disabledButton]}
              onPress={handleMicPress}
              accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
              disabled={isProcessing || !permissionGranted}
            >
              <Ionicons name={isRecording ? "mic-off-circle" : "mic-circle"} size={60} color={theme.colors.white} />
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[styles.soundWave, {transform: [{scale: waveAnim2.interpolate({inputRange: [0,1], outputRange: [1, 1.3]})}] , opacity: waveAnim2.interpolate({inputRange: [0,0.5,1], outputRange: [0,0.5,0]})}]} />
        </View>
        
        {/* Language Selector */}
        <TouchableOpacity onPress={() => setShowLanguageSelector(true)} style={styles.languagePill} accessibilityLabel="Select language" disabled={isRecording || isProcessing}>
          <Ionicons name="language-outline" size={20} color={theme.colors.textSecondary} style={{marginRight: theme.spacing.xs}}/>
          <Text style={styles.languagePillText}>{selectedLanguageNames || 'Select Language'} ({languageOptions.filter(l => l.selected).length})</Text>
        </TouchableOpacity>

        {/* Transcript Preview */}
        <View style={styles.transcriptCard}>
          <View style={styles.transcriptHeaderContainer}>
            <Text style={styles.transcriptCardTitle}>📝 Accumulated Transcript</Text>
            <TouchableOpacity 
              style={styles.acceptIconContainer} 
              onPress={handleAcceptTranscript}
              disabled={!canAcceptTranscript}
              accessibilityLabel="Save transcript"
            >
              <View style={styles.saveButtonContent}>
                <Ionicons 
                  name="checkmark-done-outline" 
                  size={20}
                  color={canAcceptTranscript ? theme.colors.primary : theme.colors.disabled}
                />
                <Text style={[styles.saveButtonText, !canAcceptTranscript && styles.disabledText]}>
                  Save
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.transcriptScroll} contentContainerStyle={styles.transcriptContentContainer}>
            {transcriptSegments.length > 0 ? (
              transcriptSegments.map((segment, index) => (
                <View key={index} style={styles.segmentContainer}>
                  <Text style={styles.transcriptText}>{segment}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.transcriptText}>
                {isRecording && !isTranscribingSegment
                  ? "Listening..."
                  : "Start recording. Your transcript will appear here."}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>

      <LanguageSelectorModal
        visible={showLanguageSelector}
        languageOptions={languageOptions}
        onToggleLanguage={toggleLanguageSelection}
        onDone={() => setShowLanguageSelector(false)}
        onClose={() => setShowLanguageSelector(false)}
        maxSelection={MAX_LANGUAGE_SELECTION}
      />
      
      {isProcessing && (
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
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
  },
  segmentStatusText: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  micAreaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.xl,
  },
  micButtonContainer: {
    // For the pulse animation
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    marginHorizontal: 20,
  },
  micButtonActive: {
    backgroundColor: theme.colors.error, 
    shadowColor: theme.colors.error,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
    shadowColor: theme.colors.disabled,
    opacity: 0.7,
  },
  soundWave: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '66', // Softer purple (primary with ~40% opacity)
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 20,
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100, // Subtle background
    marginVertical: theme.spacing.md,
  },
  languagePillText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  transcriptCard: {
    width: '100%',
    minHeight: 120,
    maxHeight: 200,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: theme.spacing.lg,
  },
  transcriptHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  transcriptCardTitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  acceptIconContainer: { // Renamed from editIconContainer
    padding: theme.spacing.xs,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: 4,
  },
  disabledText: {
    color: theme.colors.disabled,
  },
  transcriptScroll: {
    flex: 1,
    paddingTop: theme.spacing.xs,
  },
  transcriptContentContainer: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  transcriptText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: theme.typography.fontSizes.sm * 1.8, // Explicit line height based on font size
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(250, 250, 250, 0.7)', 
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  processingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },

  segmentContainer: {
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.md, // Increased vertical padding
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.isDarkMode ? 'rgba(60, 60, 80, 0.2)' : 'rgba(240, 240, 250, 0.7)', 
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary,
  },
});

export default AudioRecorder; 