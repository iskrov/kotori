import React, { useCallback } from 'react';
import { useAudioRecorderLogic } from '../hooks/useAudioRecorderLogic';
import AudioRecorderUI from './AudioRecorderUI';

interface SaveButtonState {
  text: string;
  disabled: boolean;
  isSaving: boolean;
}

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string, audioUri?: string, detectedLanguage?: string | null, confidence?: number) => void;
  onCancel: () => void;
  startRecordingOnMount?: boolean;
  onManualSave?: () => Promise<void>;
  saveButtonState?: SaveButtonState;
  onAutoSave: (currentTranscript: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptionComplete,
  onCancel,
  startRecordingOnMount = false,
  onManualSave,
  saveButtonState,
  onAutoSave,
}) => {
  // Use the custom hook for all business logic
  const audioRecorderLogic = useAudioRecorderLogic({
    onTranscriptionComplete,
    onCancel,
    autoStart: startRecordingOnMount,
    onAutoSave,
  });

  // Handler for replacing transcript segments with alternatives
  const handleReplaceWithAlternative = useCallback((alternativeText: string) => {
    // This would need to be implemented in the hook if needed
    // For now, we'll just close the alternatives view
    audioRecorderLogic.setShowAlternatives(false);
  }, [audioRecorderLogic]);

  // Custom save handler that passes transcript data to RecordScreen first
  const handleSave = useCallback(async () => {
    if (onManualSave) {
      // First, pass the transcript data to RecordScreen via onTranscriptionComplete
      const fullTranscript = audioRecorderLogic.transcriptSegments.join('\n').trim();
      if (fullTranscript) {
        const confidence = audioRecorderLogic.lastTranscriptionResult?.confidence || 0;
        const detectedLanguage = audioRecorderLogic.lastTranscriptionResult?.detected_language_code as string | undefined;
        
        // Pass the transcript data to RecordScreen
        onTranscriptionComplete(fullTranscript, undefined, detectedLanguage, confidence);
        
        // Small delay to ensure state update happens before save
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now trigger the manual save
        await onManualSave();
      }
    } else {
      // Fallback to the original accept transcript logic
      audioRecorderLogic.handleAcceptTranscript();
    }
  }, [onManualSave, audioRecorderLogic, onTranscriptionComplete]);

  // Render the UI component with all the state and handlers
  return (
    <AudioRecorderUI
      // State props
      transcriptSegments={audioRecorderLogic.transcriptSegments}
      setTranscriptSegments={audioRecorderLogic.setTranscriptSegments}
      currentSegmentTranscript={audioRecorderLogic.currentSegmentTranscript}
      isTranscribingSegment={audioRecorderLogic.isTranscribingSegment}
      lastTranscriptionResult={audioRecorderLogic.lastTranscriptionResult}
      showAlternatives={audioRecorderLogic.showAlternatives}
      selectedLanguage={audioRecorderLogic.selectedLanguage}
      isProcessing={audioRecorderLogic.isProcessing}
      canAcceptTranscript={audioRecorderLogic.canAcceptTranscript}
      
      // Animation refs
      pulseAnim={audioRecorderLogic.pulseAnim}
      waveAnim1={audioRecorderLogic.waveAnim1}
      waveAnim2={audioRecorderLogic.waveAnim2}
      
      // Audio recording state
      isRecording={audioRecorderLogic.isRecording}
      recordingDuration={audioRecorderLogic.recordingDuration}
      permissionGranted={audioRecorderLogic.permissionGranted}
      
      // Handlers
      handleMicPress={audioRecorderLogic.handleMicPress}
      handleAcceptTranscript={handleSave}
      handleLanguageChange={audioRecorderLogic.handleLanguageChange}
      formatDuration={audioRecorderLogic.formatDuration}
      setShowAlternatives={audioRecorderLogic.setShowAlternatives}
      
      // Save button state
      saveButtonState={saveButtonState}
    />
  );
};

export default AudioRecorder; 