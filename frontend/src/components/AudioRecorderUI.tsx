import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { TranscriptionResult } from '../hooks/useAudioRecorderLogic';

// Import simple language selector
import LanguageSelector from './LanguageSelector';

// Helper function to add alpha to hex colors
const addAlpha = (color: string, alpha: string): string => {
  // If color already has alpha, return as is
  if (color.length === 9) return color;
  // Add alpha to 6-digit hex color
  if (color.length === 7) return color + alpha;
  // For other formats, just return the color (won't add alpha)
  return color;
};

interface SaveButtonState {
  text: string;
  disabled: boolean;
  isSaving: boolean;
}

interface AudioRecorderUIProps {
  // State props
  transcriptSegments: string[];
  setTranscriptSegments: React.Dispatch<React.SetStateAction<string[]>>;
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
  
  // Save button state
  saveButtonState?: SaveButtonState;
}

export const AudioRecorderUI: React.FC<AudioRecorderUIProps> = ({
  transcriptSegments,
  setTranscriptSegments,
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
  saveButtonState,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);

  // Combine all transcript segments into one text for unified editing
  const fullTranscriptText = transcriptSegments.join(' ');
  
  const handleFullTranscriptChange = (text: string) => {
    // Split the text back into segments based on sentences or paragraphs
    // For now, we'll treat it as one segment, but could be enhanced later
    if (text.trim()) {
      setTranscriptSegments([text]);
    } else {
      setTranscriptSegments([]);
    }
  };

  // Calculate progress for circular indicator (max 5 minutes = 300 seconds)
  const maxDuration = 300;
  const progress = Math.min(recordingDuration / maxDuration, 1);

  // Get effective save button state
  const effectiveSaveButtonState = saveButtonState || {
    text: 'Save',
    disabled: !canAcceptTranscript,
    isSaving: false
  };

  // Get recording status for display
  const getRecordingStatus = () => {
    if (!permissionGranted) {
      return {
        text: 'Microphone permission required',
        subtext: 'Please grant microphone access to record',
        color: theme.colors.error
      };
    }
    
    if (isRecording) {
      return {
        text: 'Recording in progress',
        subtext: 'Tap the microphone to stop',
        color: theme.colors.error
      };
    }
    
    if (isTranscribingSegment) {
      return {
        text: 'Processing audio',
        subtext: 'Converting speech to text...',
        color: theme.colors.accent
      };
    }
    
    return {
      text: 'Ready to record',
      subtext: 'Tap the microphone to start a new segment',
      color: theme.colors.primary
    };
  };

  const recordingStatus = getRecordingStatus();

  return (
    <View style={styles.container}>
      {/* Language Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isLanguageModalVisible}
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onLanguageChange={(lang) => {
                handleLanguageChange(lang);
                setLanguageModalVisible(false);
              }}
              disabled={isRecording}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Top Header with Language Selector */}
      <View style={styles.headerContainer}>
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <Animated.View 
                style={[
                  styles.recordingDot,
                  {
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }
                ]}
              />
              <Text style={styles.recordingText}>REC</Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.languageSettingsButton}
          onPress={() => setLanguageModalVisible(true)}
          disabled={isRecording}
        >
          <Ionicons 
            name="language" 
            size={24} 
            color={isRecording ? theme.colors.disabled : theme.colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      {/* Processing overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.processingTitle}>Processing Audio</Text>
            <Text style={styles.processingSubtext}>Converting your speech to text...</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.transcriptScroll} contentContainerStyle={styles.transcriptContent}>
        {/* Recording Area */}
        <View style={[styles.recordingArea, transcriptSegments.length === 0 && { flex: 1 }]}>
          {/* Waveform visualization */}
          {isRecording && (
            <View style={styles.waveformContainer}>
              {Array.from({ length: 20 }, (_, index) => {
                const animValue = index % 2 === 0 ? waveAnim1 : waveAnim2;
                
                return (
                  <Animated.View
                    key={index}
                    style={[
                      styles.waveformBar,
                      {
                        height: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [4, 24],
                        }),
                        opacity: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}

          {/* Main microphone button with animations */}
          <View style={styles.micAreaContainer}>
            <View style={styles.micButtonWrapper}>
              {/* Animated sound waves */}
              {isRecording && (
                <>
                  <Animated.View
                    style={[
                      styles.soundWave,
                      styles.leftWave,
                      {
                        opacity: waveAnim1,
                        transform: [
                          {
                            scale: waveAnim1.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.8, 1.2],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.soundWave,
                      styles.centerWave,
                      {
                        opacity: waveAnim2,
                        transform: [
                          {
                            scale: waveAnim2.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.9, 1.3],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.soundWave,
                      styles.rightWave,
                      {
                        opacity: waveAnim1,
                        transform: [
                          {
                            scale: waveAnim1.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.8, 1.2],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </>
              )}

              {/* Main microphone button with progress indicator */}
              <View style={styles.micButtonContainer}>
                {/* Circular progress indicator */}
                {isRecording && (
                  <View style={styles.progressRing}>
                    <View 
                      style={[
                        styles.progressArc,
                        {
                          transform: [
                            { rotate: `${(progress || 0) * 360}deg` }
                          ]
                        }
                      ]}
                    />
                  </View>
                )}
                
                <Animated.View
                  style={{
                    transform: [{ scale: pulseAnim }],
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.micButton,
                      isRecording && styles.micButtonActive,
                      !permissionGranted && styles.disabledButton,
                    ]}
                    onPress={handleMicPress}
                    disabled={!permissionGranted}
                  >
                    <Ionicons
                      name={isRecording ? 'stop' : 'mic'}
                      size={36}
                      color={theme.colors.white}
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </View>

          {/* Recording Status */}
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: recordingStatus.color }]}>
              {recordingStatus.text}
            </Text>
            <Text style={styles.statusSubtext}>
              {recordingStatus.subtext}
            </Text>
          </View>
        </View>

        {/* Unified Transcript Editor */}
        {transcriptSegments.length > 0 && (
          <View style={styles.transcriptCard}>
            <View style={styles.transcriptHeader}>
              <View style={styles.transcriptTitleContainer}>
                <Ionicons name="document-text" size={24} color={theme.colors.primary} />
                <Text style={styles.transcriptTitle}>Transcript</Text>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  effectiveSaveButtonState.disabled && styles.saveButtonDisabled,
                  effectiveSaveButtonState.isSaving && styles.saveButtonSaving,
                ]}
                onPress={handleAcceptTranscript}
                disabled={effectiveSaveButtonState.disabled}
              >
                <Ionicons
                  name={effectiveSaveButtonState.isSaving ? "time" : effectiveSaveButtonState.text === 'Saved' ? "checkmark-circle" : "save"}
                  size={16}
                  color={effectiveSaveButtonState.disabled ? theme.colors.disabled : 
                         effectiveSaveButtonState.text === 'Saved' ? theme.colors.success : theme.colors.primary}
                />
                <Text
                  style={[
                    styles.saveButtonText,
                    effectiveSaveButtonState.disabled && styles.saveButtonTextDisabled,
                    effectiveSaveButtonState.text === 'Saved' && styles.saveButtonTextSaved,
                  ]}
                >
                  {effectiveSaveButtonState.text}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.unifiedTranscriptInput}
              value={fullTranscriptText}
              onChangeText={handleFullTranscriptChange}
              multiline
              placeholder="Your transcribed text will appear here..."
              placeholderTextColor={theme.colors.textDisabled}
              textAlignVertical="top"
            />

            {/* Transcription Quality Indicator */}
            {transcriptionQuality && (
              <View style={styles.qualityContainer}>
                <Text style={styles.qualityLabel}>Quality: </Text>
                <Text style={[
                  styles.qualityValue,
                  transcriptionQuality === 'excellent' && styles.qualityExcellent,
                  transcriptionQuality === 'good' && styles.qualityGood,
                  transcriptionQuality === 'fair' && styles.qualityFair,
                  transcriptionQuality === 'poor' && styles.qualityPoor,
                ]}>
                  {transcriptionQuality.charAt(0).toUpperCase() + transcriptionQuality.slice(1)}
                </Text>
              </View>
            )}

            {/* Transcription Alternatives */}
            {showAlternatives && lastTranscriptionResult?.alternatives && lastTranscriptionResult.alternatives.length > 0 && (
              <View style={styles.alternativesContainer}>
                <Text style={styles.alternativesTitle}>Alternative transcriptions:</Text>
                {lastTranscriptionResult.alternatives.map((alternative, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.alternativeItem}
                    onPress={() => {
                      if (alternative.transcript && alternative.transcript.trim()) {
                        setTranscriptSegments([alternative.transcript]);
                      }
                    }}
                  >
                    <Text style={styles.alternativeText}>{alternative.transcript}</Text>
                    {alternative.confidence !== undefined && (
                      <Text style={styles.alternativeConfidence}>
                        {Math.round(alternative.confidence * 100)}%
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.md,
    backgroundColor: addAlpha(theme.colors.error, '20'),
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
    marginRight: theme.spacing.xs,
  },
  recordingText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamilies.bold,
    fontWeight: 'bold',
  },
  languageSettingsButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
  },
  recordingArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  micAreaContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.lg,
  },
  micButtonWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    position: 'relative',
  },
  progressRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: addAlpha(theme.colors.primary, '20'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressArc: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: theme.colors.primary,
    borderRightColor: theme.colors.primary,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  micButtonActive: {
    backgroundColor: theme.colors.error,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
    opacity: 0.7,
  },
  soundWave: {
    position: 'absolute',
    borderRadius: 30,
    backgroundColor: addAlpha(theme.colors.primary, '40'),
  },
  leftWave: {
    width: 60,
    height: 60,
    left: -20,
  },
  centerWave: {
    width: 80,
    height: 80,
    zIndex: -1,
  },
  rightWave: {
    width: 60,
    height: 60,
    right: -20,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    marginBottom: theme.spacing.md,
  },
  waveformBar: {
    width: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: 1.5,
    marginHorizontal: 1,
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  statusText: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  statusSubtext: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
  },
  transcriptCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    margin: theme.spacing.lg,
    ...theme.shadows.md,
    minHeight: 200,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  transcriptTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transcriptTitle: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginLeft: theme.spacing.sm,
  },

  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: addAlpha(theme.colors.success, '20'),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: addAlpha(theme.colors.success, '40'),
  },
  saveButtonDisabled: {
    backgroundColor: addAlpha(theme.colors.disabled, '20'),
    borderColor: addAlpha(theme.colors.disabled, '40'),
  },
  saveButtonText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.success,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: theme.spacing.xs,
  },
  saveButtonTextDisabled: {
    color: theme.colors.disabled,
  },
  saveButtonSaving: {
    backgroundColor: addAlpha(theme.colors.accent, '20'),
    borderColor: addAlpha(theme.colors.accent, '40'),
  },
  saveButtonTextSaved: {
    color: theme.colors.success,
  },
  unifiedTranscriptInput: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: theme.typography.lineHeights.loose * theme.typography.fontSizes.md,
    minHeight: 150,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    paddingBottom: theme.spacing.lg,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: addAlpha(theme.colors.background, 'E6'),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  processingContent: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  processingTitle: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  processingSubtext: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  modalTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  modalCloseButton: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
  },
  modalCloseButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamilies.bold,
    fontSize: theme.typography.fontSizes.md,
  },
  qualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  qualityLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  qualityValue: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  qualityExcellent: {
    color: theme.colors.success,
  },
  qualityGood: {
    color: theme.colors.accent,
  },
  qualityFair: {
    color: theme.colors.primary,
  },
  qualityPoor: {
    color: theme.colors.error,
  },
  alternativesContainer: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  alternativesTitle: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.xs,
  },
  alternativeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  alternativeText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  alternativeConfidence: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginLeft: theme.spacing.xs,
  },
});

export default AudioRecorderUI; 