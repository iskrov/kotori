import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Animated, Platform } from 'react-native';
import { Audio } from 'expo-av';
import speechToTextService from '../services/speechToText';
import logger from '../utils/logger';

// Import hooks
import useAudioRecording from './useAudioRecording';
import useWebSocketTranscription, { WebSocketStatus } from './useWebSocketTranscription';

// Import simplified config
import { 
  getDefaultLanguageCode, 
  validateLanguageCode
} from '../config/languageConfig';

// Enhanced transcription result interface
export interface TranscriptionResult {
  transcript: string;
  detected_language_code?: string;
  confidence: number;
  alternatives: Array<{
    transcript: string;
    confidence: number;
  }>;
  word_confidence: Array<{
    word: string;
    confidence: number;
    start_time: number;
    end_time: number;
  }>;
  language_confidence: number;
  quality_metrics: {
    average_confidence: number;
    low_confidence_words: number;
    total_words: number;
  };
  hidden_mode_activated?: boolean;
}

interface UseAudioRecorderLogicProps {
  onTranscriptionComplete: (text: string, audioUri?: string, detectedLanguage?: string | null, confidence?: number) => void;
  onCancel: () => void;
}

export const useAudioRecorderLogic = ({ onTranscriptionComplete, onCancel }: UseAudioRecorderLogicProps) => {
  // Enhanced states for transcription
  const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
  const [currentSegmentTranscript, setCurrentSegmentTranscript] = useState('');
  const [isTranscribingSegment, setIsTranscribingSegment] = useState(false);
  const [lastTranscriptionResult, setLastTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [transcriptionQuality, setTranscriptionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | null>(null);

  // Simplified language selection
  const [selectedLanguage, setSelectedLanguage] = useState<string>(getDefaultLanguageCode());

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

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

  // Enhanced state management
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedUris, setProcessedUris] = useState<Set<string>>(new Set());
  const [hasTranscribedAudio, setHasTranscribedAudio] = useState(false);
  
  // Refs to track component state
  const isMountedRef = useRef(true);
  const callbackCalledRef = useRef(false);

  // Animation effects
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        ])
      ).start();
      Animated.loop(
        Animated.stagger(300, [
          Animated.sequence([
            Animated.timing(waveAnim1, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(waveAnim1, { toValue: 0, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.sequence([
            Animated.timing(waveAnim2, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(waveAnim2, { toValue: 0, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
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

  // WebSocket handlers
  const handleWebSocketError = useCallback((errorMessage: string) => {
    logger.error('WebSocket Transcription Error:', errorMessage);
    if (isMountedRef.current) {
      setIsProcessing(false);
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

    // Reset states for enhanced recording when component mounts
    setTranscriptSegments([]);
    setCurrentSegmentTranscript('');
    setIsTranscribingSegment(false);
    setLastTranscriptionResult(null);
    setShowAlternatives(false);
    setTranscriptionQuality(null);

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
  }, [cleanupRecordingFile, disconnectWebSocket, audioUri, hasTranscribedAudio]);

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
          logger.error('Error stopping recording during handleDone:', err)
        );
      }
      onCancel();
    }
  }, [isRecording, stopRecording, onCancel]);

  // Enhanced function to accept transcript with quality metrics
  const handleAcceptTranscript = useCallback(() => {
    if (!isMountedRef.current || callbackCalledRef.current) return;

    const fullTranscript = transcriptSegments.join(' ').trim();
    if (!fullTranscript) {
      logger.warn('No transcript to accept.');
      return;
    }

    callbackCalledRef.current = true;
    setHasTranscribedAudio(true);

    const confidence = lastTranscriptionResult?.confidence || 0;
    const detectedLanguage = lastTranscriptionResult?.detected_language_code as string | undefined;

    logger.info(
      `Accepting enhanced transcript: "${fullTranscript.substring(0, 50)}...", ` +
      `confidence: ${confidence.toFixed(2)}, language: ${detectedLanguage || 'unknown'}`
    );

    onTranscriptionComplete(fullTranscript, audioUri, detectedLanguage, confidence);
  }, [transcriptSegments, lastTranscriptionResult, audioUri, onTranscriptionComplete]);

  // Simplified segment processing with single language support
  const processSegment = async (uri: string, languageCode: string) => {
    if (!isMountedRef.current || processedUris.has(uri)) {
      logger.info(`[processSegment] Skipping ${uri} - component unmounted or already processed.`);
      return;
    }

    setProcessedUris(prev => new Set(prev).add(uri));
    setIsTranscribingSegment(true);
    setCurrentSegmentTranscript('Processing...');

    try {
      logger.info(`[processSegment] Starting transcription for ${uri} with language: ${languageCode}`);
      
      // Use speech service with single language code (or auto-detect)
      const languageCodes = languageCode === 'auto' ? undefined : [languageCode];
      const result = await speechToTextService.transcribeAudio(uri, {
        languageCodes,
        maxAlternatives: 3,
        enableWordConfidence: true
      });

      if (!isMountedRef.current) {
        logger.info('[processSegment] Component unmounted during transcription, ignoring result.');
        return;
      }

      // Store enhanced transcription result
      setLastTranscriptionResult(result);
      
      // Get quality assessment
      const qualityAssessment = speechToTextService.getQualityAssessment(result);
      setTranscriptionQuality(qualityAssessment.overall);

      const transcript = result.transcript?.trim();
      if (transcript) {
        setTranscriptSegments(prev => [...prev, transcript]);
        setCurrentSegmentTranscript('');
        
        logger.info(
          `[processSegment] Transcription completed - ` +
          `Text: "${transcript.substring(0, 50)}...", ` +
          `Confidence: ${result.confidence.toFixed(2)}, ` +
          `Language: ${result.detected_language_code || languageCode}, ` +
          `Quality: ${qualityAssessment.overall}, ` +
          `Alternatives: ${result.alternatives.length}`
        );

        // Show quality recommendations if needed
        if (qualityAssessment.recommendations.length > 0) {
          logger.info(`Quality recommendations: ${qualityAssessment.recommendations.join(', ')}`);
        }
      } else {
        setCurrentSegmentTranscript('No speech detected in this segment.');
        logger.warn('[processSegment] No transcript received from service.');
      }
    } catch (error: any) {
      logger.error('[processSegment] Transcription failed:', error);
      if (isMountedRef.current) {
        setCurrentSegmentTranscript(`Error: ${error.message || 'Transcription failed'}`);
        setTranscriptionQuality('poor');
      }
    } finally {
      if (isMountedRef.current) {
        setIsTranscribingSegment(false);
      }
      
      // Clean up the audio file
      try {
        await cleanupRecordingFile(uri);
        logger.info(`[processSegment] Cleaned up audio file: ${uri}`);
      } catch (cleanupError) {
        logger.error(`[processSegment] Failed to clean up audio file ${uri}:`, cleanupError);
      }
    }
  };

  // Simplified effect to process audio with selected language
  useEffect(() => {
    if (audioUri && !isRecording && !processedUris.has(audioUri) && permissionGranted) {
      // Validate language code
      if (selectedLanguage !== 'auto' && !validateLanguageCode(selectedLanguage)) {
        logger.error(`Invalid language selection: ${selectedLanguage}`);
        Alert.alert('Language Selection Error', 'Invalid language selected. Using auto-detect.');
        setSelectedLanguage('auto');
        return;
      }

      logger.info(
        `[AudioRecorder] useEffect detected new audioUri: ${audioUri} ` +
        `for language: ${selectedLanguage}. Starting processSegment.`
      );
      
      processSegment(audioUri, selectedLanguage);
    }
  }, [audioUri, isRecording, processedUris, permissionGranted, selectedLanguage]);

  const handleMicPress = async () => {
    if (!permissionGranted) {
      Alert.alert('Permissions Required', 'Audio recording permission is needed to record.');
      logger.warn('Mic pressed but permission not granted.');
      return;
    }

    if (isRecording) {
      logger.info('[AudioRecorder] Mic press: Stopping current recording segment.');
      try {
        await stopRecording();
      } catch (error) {
        logger.error('[AudioRecorder] Error stopping recording segment:', error);
      }
    } else { // Not recording
      if (isTranscribingSegment) {
        logger.info('[AudioRecorder] Mic press: Still transcribing previous segment. Please wait.');
        Alert.alert('Processing', 'Still processing the previous audio. Please wait a moment.');
        return;
      }
      
      // Reset callback flag for new recording session
      callbackCalledRef.current = false;
      
      logger.info('[AudioRecorder] Mic press: Starting new recording segment.');
      try {
        await startRecording();
      } catch (error) {
        logger.error('[AudioRecorder] Error starting new recording segment:', error);
        Alert.alert('Error Starting Recording', 'Could not start a new recording. Please try again.');
      }
    }
  };

  // Language selection handler
  const handleLanguageChange = (languageCode: string) => {
    if (validateLanguageCode(languageCode) || languageCode === 'auto') {
      setSelectedLanguage(languageCode);
      logger.info(`Language changed to: ${languageCode}`);
    } else {
      logger.error(`Invalid language code: ${languageCode}`);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to sanitize/clean transcript text
  const sanitizeText = (text: string): string => {
    return text.replace(/^[\(\[\•\-\*]+\s*/g, '').trim();
  };

  const canAcceptTranscript = !isRecording && !isTranscribingSegment && transcriptSegments.length > 0;

  return {
    // State
    transcriptSegments,
    currentSegmentTranscript,
    isTranscribingSegment,
    lastTranscriptionResult,
    showAlternatives,
    setShowAlternatives,
    transcriptionQuality,
    selectedLanguage,
    isProcessing,
    hasTranscribedAudio,
    canAcceptTranscript,
    
    // Animation refs
    pulseAnim,
    waveAnim1,
    waveAnim2,
    
    // Audio recording state
    isRecording,
    recordingDuration,
    audioUri,
    permissionGranted,
    recordingError,
    
    // Handlers
    handleMicPress,
    handleAcceptTranscript,
    handleDone,
    handleLanguageChange,
    formatDuration,
    sanitizeText,
  };
}; 