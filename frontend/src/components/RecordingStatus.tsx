import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import logger from '../utils/logger';

interface RecordingStatusProps {
  isRecording: boolean;
  duration: number; // in seconds
  hasTranscript?: boolean;
  transcriptPreview?: string;
}

const RecordingStatus: React.FC<RecordingStatusProps> = ({
  isRecording,
  duration,
  hasTranscript = false,
  transcriptPreview,
}) => {
  // Add debugging for duration props
  useEffect(() => {
    logger.info(`[RecordingStatus] Received duration: ${duration}s, isRecording: ${isRecording}`);
  }, [duration, isRecording]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    logger.debug(`[RecordingStatus] Formatting ${seconds}s as ${formattedTime}`);
    return formattedTime;
  };

  return (
    <View style={styles.container}>
      {isRecording ? (
        <View style={styles.recordingView}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
          </View>
          <Text style={styles.recordingDurationText}>
            {formatDuration(duration)}
          </Text>
        </View>
      ) : (
        <Text style={styles.tapToRecordText}>
          {hasTranscript 
            ? "Recording complete. Tap mic to re-record." 
            : "Tap the button below to start recording"}
        </Text>
      )}
      
      {hasTranscript && transcriptPreview && !isRecording && (
        <Text style={styles.transcriptPreviewText} numberOfLines={2}>
          {`Transcript: ${transcriptPreview}`}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordingView: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc3545',
  },
  recordingDurationText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  tapToRecordText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  transcriptPreviewText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
  },
});

export default RecordingStatus; 