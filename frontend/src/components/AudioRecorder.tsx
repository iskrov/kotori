import React, { useCallback } from 'react';
import { useAudioRecorderLogic } from '../hooks/useAudioRecorderLogic';
import AudioRecorderUI from './AudioRecorderUI';

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string, audioUri?: string, detectedLanguage?: string | null, confidence?: number) => void;
  onCancel: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptionComplete,
  onCancel,
}) => {
  // Use the custom hook for all business logic
  const audioRecorderLogic = useAudioRecorderLogic({
    onTranscriptionComplete,
    onCancel,
  });

  // Handler for replacing transcript segments with alternatives
  const handleReplaceWithAlternative = useCallback((alternativeText: string) => {
    // This would need to be implemented in the hook if needed
    // For now, we'll just close the alternatives view
    audioRecorderLogic.setShowAlternatives(false);
  }, [audioRecorderLogic]);

  // Render the UI component with all the state and handlers
  return (
    <AudioRecorderUI
      // State props
      transcriptSegments={audioRecorderLogic.transcriptSegments}
      currentSegmentTranscript={audioRecorderLogic.currentSegmentTranscript}
      isTranscribingSegment={audioRecorderLogic.isTranscribingSegment}
      lastTranscriptionResult={audioRecorderLogic.lastTranscriptionResult}
      showAlternatives={audioRecorderLogic.showAlternatives}
      transcriptionQuality={audioRecorderLogic.transcriptionQuality}
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
      handleAcceptTranscript={audioRecorderLogic.handleAcceptTranscript}
      handleLanguageChange={audioRecorderLogic.handleLanguageChange}
      formatDuration={audioRecorderLogic.formatDuration}
      setShowAlternatives={audioRecorderLogic.setShowAlternatives}
    />
  );
};

export default AudioRecorder; 