import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Animated, Platform } from 'react-native';
import { Audio } from 'expo-av';
import speechToTextService from '../services/speechToText';
import logger from '../utils/logger';
import hapticService from '../services/hapticService';

// Import hooks
import useAudioRecording from './useAudioRecording';
import useWebSocketTranscription, { WebSocketStatus } from './useWebSocketTranscription';
import { useSettings } from '../contexts/SettingsContext';

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
  secret_tag_detected?: {
    found: boolean;
    tagId?: string;
    tagName?: string;
    action?: 'activate' | 'deactivate' | 'panic';
  };
}

interface UseAudioRecorderLogicProps {
  onTranscriptionComplete: (text: string, audioUri?: string, detectedLanguage?: string | null, confidence?: number) => void;
  onCancel: () => void;
  autoStart?: boolean;
  onAutoSave: (currentTranscript: string) => void;
}

export const useAudioRecorderLogic = ({ 
  onTranscriptionComplete, 
  onCancel,
  autoStart = false,
  onAutoSave,
}: UseAudioRecorderLogicProps) => {
  // Get user settings for default language
  const { settings } = useSettings();
  
  // Enhanced states for transcription
  const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
  const [currentSegmentTranscript, setCurrentSegmentTranscript] = useState('');
  const [isTranscribingSegment, setIsTranscribingSegment] = useState(false);
  const [lastTranscriptionResult, setLastTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);


  // Use user's default language setting
  const [selectedLanguage, setSelectedLanguage] = useState<string>(settings.defaultLanguage);

  // Update selected language when user changes default language setting
  useEffect(() => {
    setSelectedLanguage(settings.defaultLanguage);
    logger.info(`[AudioRecorderLogic] Default language updated to: ${settings.defaultLanguage}`);
  }, [settings.defaultLanguage]);

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
    requestPermissionOnMount: true,
    autoStart: autoStart
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

  // Effect 1: Mount/Unmount setup - should only run once
  useEffect(() => {
    isMountedRef.current = true;
    logger.info('AudioRecorder: Component did mount.');

    // Reset states for enhanced recording when component mounts
    setTranscriptSegments([]);
    setCurrentSegmentTranscript('');
    setIsTranscribingSegment(false);
    setLastTranscriptionResult(null);
    setShowAlternatives(false);

    callbackCalledRef.current = false;
    setHasTranscribedAudio(false);

    return () => {
      logger.info('AudioRecorder: Component will unmount. Performing final cleanup.');
      isMountedRef.current = false;
      disconnectWebSocket();
    };
  }, []); // Empty dependency array - runs only on mount/unmount

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

    const fullTranscript = transcriptSegments.join('\n').trim();
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

    hapticService.success(); // Success haptic feedback for accepting transcript
    onTranscriptionComplete(fullTranscript, audioUri || undefined, detectedLanguage, confidence);
  }, [transcriptSegments, lastTranscriptionResult, audioUri, onTranscriptionComplete]);

  // Function to determine if secret tag detection should be treated as a command or normal content
  const shouldTreatAsSecretTagCommand = (transcript: string, secretTagDetected: any): boolean => {
    if (!secretTagDetected?.tagName) return false;
    
    // Normalize function: lowercase, remove punctuation and spaces, keep only letters and numbers
    const normalize = (text: string): string => {
      return text.toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    
    const normalizedTranscript = normalize(transcript);
    const normalizedPhrase = normalize(secretTagDetected.tagName);
    
    // Secret tag activation requires exact match after normalization
    const isExactMatch = normalizedTranscript === normalizedPhrase;
    
    if (isExactMatch) {
      logger.info(`[shouldTreatAsSecretTagCommand] Exact match found - transcript: "${normalizedTranscript}" matches phrase: "${normalizedPhrase}"`);
    } else {
      logger.info(`[shouldTreatAsSecretTagCommand] No exact match - transcript: "${normalizedTranscript}" vs phrase: "${normalizedPhrase}"`);
    }
    
    return isExactMatch;
  };

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
      
      // Use speech service with single language code (or auto-detect) and secret tag detection
      const languageCodes = languageCode === 'auto' ? undefined : [languageCode];
      const result = await speechToTextService.transcribeAudio(uri, {
        languageCodes,
        maxAlternatives: 3,
        enableWordConfidence: true,
        enableSecretTagDetection: true
      });

      if (!isMountedRef.current) {
        logger.info('[processSegment] Component unmounted during transcription, ignoring result.');
        return;
      }

      // Store enhanced transcription result
      setLastTranscriptionResult(result);
      
      // Get quality assessment
      const qualityAssessment = speechToTextService.getQualityAssessment(result);

      const transcript = result.transcript?.trim();
      if (transcript) {
        // Check if a secret tag was detected
        if (result.secret_tag_detected?.found) {
          // Determine if this should be treated as a secret tag command or normal content
          const isSecretTagCommand = shouldTreatAsSecretTagCommand(transcript, result.secret_tag_detected);
          
          if (isSecretTagCommand) {
            logger.info(`[processSegment] Secret tag command detected - not adding "${transcript}" to transcript segments`);
            const action = result.secret_tag_detected.action === 'activate' ? 'activated' : 'deactivated';
            setCurrentSegmentTranscript(`Secret tag ${action} successfully`);
            
            // Show brief success message then clear
            setTimeout(() => {
              if (isMountedRef.current) {
                setCurrentSegmentTranscript('');
              }
            }, 2000);
            
            return; // Exit early - don't add to segments or trigger auto-save
          } else {
            logger.info(`[processSegment] Secret tag detected but treating as normal content: "${transcript}"`);
            // Continue with normal processing - this will create an entry
          }
        }
        
        // Capitalize first letter of the transcript segment
        const capitalizedTranscript = transcript.charAt(0).toUpperCase() + transcript.slice(1);
        
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
        
        // Update transcript segments first
        setTranscriptSegments(prev => {
          const newSegments = [...prev, capitalizedTranscript];
          logger.info(`[processSegment] Updated transcript segments: ${newSegments.length} segments, latest: "${capitalizedTranscript}"`);
          
          // Trigger auto-save with the complete transcript INSIDE the state update
          if (settings.autoSaveEnabled && onAutoSave) {
            const newTranscript = newSegments.join('\n');
            logger.info(`[AutoSave] Triggering auto-save due to new segment. Full transcript: "${newTranscript}"`);
            // Use setTimeout to ensure the state update completes first
            setTimeout(() => {
              onAutoSave(newTranscript);
            }, 0);
          }
          
          return newSegments;
        });
        
        setCurrentSegmentTranscript('');
      } else {
        setCurrentSegmentTranscript('No speech detected in this segment.');
        logger.warn('[processSegment] No transcript received from service.');
      }

    } catch (error: any) {
      logger.error('[processSegment] Transcription failed:', error);
      if (isMountedRef.current) {
        setCurrentSegmentTranscript(`Error: ${error.message || 'Transcription failed'}`);
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
      hapticService.medium(); // Medium haptic feedback for stop action
      try {
        await stopRecording();
      } catch (error) {
        logger.error('[AudioRecorder] Error stopping recording segment:', error);
      }
    } else { // Not recording
      if (isTranscribingSegment) {
        logger.info('[AudioRecorder] Mic press: Still transcribing previous segment. Please wait.');
        hapticService.warning(); // Warning haptic for blocked action
        Alert.alert('Processing', 'Still processing the previous audio. Please wait a moment.');
        return;
      }
      
      // Reset callback flag for new recording session
      callbackCalledRef.current = false;
      
      logger.info('[AudioRecorder] Mic press: Starting new recording segment.');
      hapticService.heavy(); // Heavy haptic feedback for start recording action
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
    setTranscriptSegments,
    currentSegmentTranscript,
    isTranscribingSegment,
    lastTranscriptionResult,
    showAlternatives,
    setShowAlternatives,
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