import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { TranscriptionResult } from '../hooks/useAudioRecorderLogic';

// Import simple language selector
import LanguageSelector from './LanguageSelector';

interface AudioRecorderUIProps {
  // State props
  transcriptSegments: string[];
  currentSegmentTranscript: string;
  isTranscribingSegment: boolean;
  lastTranscriptionResult: TranscriptionResult | null;
  showAlternatives: boolean;
  transcriptionQuality: 'excellent' | 'good' | 'fair' | 'poor' | null;
  selectedLanguage: string;
  isProcessing: boolean;
  canAcceptTranscript: boolean;
  
  // Animation refs
  pulseAnim: Animated.Value;
  waveAnim1: Animated.Value;
  waveAnim2: Animated.Value;
  
  // Audio recording state
  isRecording: boolean;
  recordingDuration: number;
  permissionGranted: boolean;
  
  // Handlers
  handleMicPress: () => void;
  handleAcceptTranscript: () => void;
  handleLanguageChange: (languageCode: string) => void;
  formatDuration: (seconds: number) => string;
  setShowAlternatives: (show: boolean) => void;
}

export const AudioRecorderUI: React.FC<AudioRecorderUIProps> = ({
  transcriptSegments,
  currentSegmentTranscript,
  isTranscribingSegment,
  lastTranscriptionResult,
  showAlternatives,
  transcriptionQuality,
  selectedLanguage,
  isProcessing,
  canAcceptTranscript,
  pulseAnim,
  waveAnim1,
  waveAnim2,
  isRecording,
  recordingDuration,
  permissionGranted,
  handleMicPress,
  handleAcceptTranscript,
  handleLanguageChange,
  formatDuration,
  setShowAlternatives,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  // Simple quality indicator component
  const renderQualityIndicator = () => {
    if (!lastTranscriptionResult || !transcriptionQuality) return null;

    const getQualityColor = () => {
      switch (transcriptionQuality) {
        case 'excellent': return '#4CAF50';
        case 'good': return '#8BC34A';
        case 'fair': return '#FFC107';
        case 'poor': return '#F44336';
        default: return '#999';
      }
    };
    
    return (
      <View style={styles.qualityContainer}>
        <View style={styles.qualityHeader}>
          <View style={[styles.qualityDot, { backgroundColor: getQualityColor() }]} />
          <Text style={styles.qualityText}>
            {transcriptionQuality} ({(lastTranscriptionResult.confidence * 100).toFixed(0)}%)
          </Text>
          {lastTranscriptionResult.alternatives.length > 0 && (
            <TouchableOpacity 
              onPress={() => setShowAlternatives(!showAlternatives)}
              style={styles.alternativesButton}
            >
              <Text style={styles.alternativesButtonText}>
                {showAlternatives ? 'Hide' : 'Show'} Alternatives
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {showAlternatives && lastTranscriptionResult.alternatives.length > 0 && (
          <View style={styles.alternativesContainer}>
            {lastTranscriptionResult.alternatives.map((alt, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.alternativeItem}
                onPress={() => {
                  // This would need to be passed as a handler from the parent
                  // For now, we'll leave it as a placeholder
                  setShowAlternatives(false);
                }}
              >
                <Text style={styles.alternativeText}>{alt.transcript}</Text>
                <Text style={styles.alternativeConfidence}>
                  {(alt.confidence * 100).toFixed(0)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

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
          {currentSegmentTranscript.trim() && !isRecording ? (
            <Text style={[styles.statusText, styles.segmentStatusText]}>
              Segment: {currentSegmentTranscript}
            </Text>
          ) : null}
        </View>

        {/* Central Mic Button & Sound Waves */}
        <View style={styles.micAreaContainer}>
          <Animated.View style={[styles.soundWave, {transform: [{scale: waveAnim1.interpolate({inputRange: [0,1], outputRange: [1, 1.3]})}], opacity: waveAnim1.interpolate({inputRange: [0,0.5,1], outputRange: [0,0.5,0]})}]} />
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
          <Animated.View style={[styles.soundWave, {transform: [{scale: waveAnim2.interpolate({inputRange: [0,1], outputRange: [1, 1.3]})}], opacity: waveAnim2.interpolate({inputRange: [0,0.5,1], outputRange: [0,0.5,0]})}]} />
        </View>
        
        {/* Simple Language Selection */}
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onLanguageChange={handleLanguageChange}
          disabled={isRecording}
        />

        {/* Quality Indicator */}
        {renderQualityIndicator()}

        {/* Enhanced Transcript Preview */}
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
                <Text style={[styles.saveButtonText, !canAcceptTranscript ? styles.disabledText : null]}>
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
      
      {isProcessing ? (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      ) : null}
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
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: theme.colors.primary,
    opacity: 0.4,
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
  acceptIconContainer: {
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
    lineHeight: theme.typography.fontSizes.sm * 1.8,
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
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.isDarkMode ? 'rgba(60, 60, 80, 0.2)' : 'rgba(240, 240, 250, 0.7)', 
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary,
  },
  qualityContainer: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
  },
  qualityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  qualityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.xs,
  },
  qualityText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  alternativesButton: {
    padding: theme.spacing.xs,
  },
  alternativesButtonText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  alternativesContainer: {
    marginTop: theme.spacing.xs,
  },
  alternativeItem: {
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    borderRadius: 4,
    marginBottom: theme.spacing.xs,
  },
  alternativeText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  alternativeConfidence: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
});

export default AudioRecorderUI; 