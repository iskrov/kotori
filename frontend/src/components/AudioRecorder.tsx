import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAudioRecorderLogic } from '../hooks/useAudioRecorderLogic';
import AudioRecorderUI from './AudioRecorderUI';
import { tagManager } from '../services/tagManager';
import { TagDetectionResult } from '../services/secretTagOnlineManager';
import logger from '../utils/logger';
import speechToTextService from '../services/speechToText';


const analyzeTranscriptionQuality = (result: any): { recommendations: string[] } => {
  const recommendations = [];
  if (result.confidence < 0.85) {
    recommendations.push('Low transcription confidence.');
  }
  if (result.secret_tag_detected) {
    recommendations.push(`Secret tag detected: ${result.secret_tag_details?.tagName}`);
  }
  return { recommendations };
};

const cleanupAudioFile = (uri: string) => {
  logger.info(`[cleanupAudioFile] Cleaned up audio file: ${uri}`);
};

interface AudioRecorderProps {
  onSave?: (transcript: string) => void;
  onManualSave?: (transcript: string, audioUri?: string) => void;
  onTranscriptionComplete?: (transcript: string) => void;
  onCancel?: () => void;
  onAutoSave?: (transcript: string) => void;
  onStateChange?: (newState: string) => void;
  onCommandDetected?: () => void;
  isEditingInitialContent?: boolean;
  saveButtonState?: { text: string; disabled: boolean; isSaving: boolean };
  startRecordingOnMount?: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onSave,
  onManualSave,
  onTranscriptionComplete,
  onCancel,
  onAutoSave,
  onStateChange,
  onCommandDetected,
  isEditingInitialContent = false,
  saveButtonState,
  startRecordingOnMount = true,
}) => {
  const handleTranscriptionComplete = (text: string, audioUri?: string, detectedLanguage?: string | null, confidence?: number) => {
    logger.info('[AudioRecorder] onTranscriptionComplete triggered.');
    onTranscriptionComplete?.(text);
    onSave?.(text);
  };
  
  const handleCancel = () => {
    logger.info('[AudioRecorder] onCancel called.');
    onCancel?.();
  };

  const handleAutoSave = (text: string) => {
    logger.info('[AudioRecorder] onAutoSave called.');
    onAutoSave?.(text);
  };
  
  const processSegment = useCallback(
    async (audioUri: string, language: string): Promise<{ text: string } | null> => {
      try {
        const result = await speechToTextService.transcribeAudio(audioUri, { languageCodes: [language] });
        if (!result) {
          cleanupAudioFile(audioUri);
          return null;
        }
        const { transcript } = result;
        const detectionResult: TagDetectionResult = await tagManager.checkForSecretTagPhrases(transcript);
        if (detectionResult.found) {
          logger.info(`Secret tag phrase detected: ${detectionResult.tagName} (${detectionResult.action})`);
          // Handle secret tag activation/deactivation
          if (detectionResult.action === 'activate' && detectionResult.tagId) {
            await tagManager.activateSecretTag(detectionResult.tagId);
          } else if (detectionResult.action === 'deactivate' && detectionResult.tagId) {
            await tagManager.deactivateSecretTag(detectionResult.tagId);
          }
          // Treat secret tag phrases as commands (don't add to transcript)
          logger.info('[processSegment] Transcript was a secret tag command. Halting processing.');
          cleanupAudioFile(audioUri);
          onCommandDetected?.();
          return null;
        }
        analyzeTranscriptionQuality(result);
        cleanupAudioFile(audioUri);
        return { text: transcript };
      } catch (error) {
        logger.error("Error during transcription processSegment", error);
        cleanupAudioFile(audioUri);
        return null;
      }
    },
    [onCommandDetected]
  );

  const logic = useAudioRecorderLogic({
    onTranscriptionComplete: handleTranscriptionComplete,
    onCancel: handleCancel,
    onAutoSave: handleAutoSave,
    autoStart: startRecordingOnMount && !isEditingInitialContent,
  });

  useEffect(() => {
    onStateChange?.(logic.isRecording ? 'recording' : 'idle');
  }, [logic.isRecording, onStateChange]);

  const handleManualSave = useCallback(() => {
    const fullTranscript = logic.transcriptSegments.join('\n').trim();
    if (fullTranscript) {
      onManualSave?.(fullTranscript);
      onSave?.(fullTranscript);
    }
  }, [logic.transcriptSegments, onManualSave, onSave]);

  return (
    <View style={styles.container}>
      <AudioRecorderUI
        isRecording={logic.isRecording}
        transcriptSegments={logic.transcriptSegments}
        setTranscriptSegments={logic.setTranscriptSegments}
        currentSegmentTranscript={logic.currentSegmentTranscript}
        isTranscribingSegment={logic.isTranscribingSegment}
        lastTranscriptionResult={logic.lastTranscriptionResult}
        showAlternatives={logic.showAlternatives}
        setShowAlternatives={logic.setShowAlternatives}
        selectedLanguage={logic.selectedLanguage}
        isProcessing={logic.isProcessing}
        canAcceptTranscript={logic.canAcceptTranscript}
        pulseAnim={logic.pulseAnim}
        waveAnim1={logic.waveAnim1}
        waveAnim2={logic.waveAnim2}
        recordingDuration={logic.recordingDuration}
        permissionGranted={logic.permissionGranted}
        handleMicPress={logic.handleMicPress}
        handleAcceptTranscript={handleManualSave}
        handleLanguageChange={logic.handleLanguageChange}
        formatDuration={logic.formatDuration}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AudioRecorder; 