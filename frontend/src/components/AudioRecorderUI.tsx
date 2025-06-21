import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { getLanguageName } from '../config/languageConfig';

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
  
  // Optional close handler for modal mode
  onClose?: () => void;
  
  // Optional existing content to show as context
  existingContent?: string;
  
  // Optional handler for saving with complete edited text
  onSaveWithCompleteText?: (completeText: string) => void;
}

// Waveform component for dynamic visualization
const WaveformVisualization: React.FC<{
  isRecording: boolean;
  waveAnim1: Animated.Value;
  waveAnim2: Animated.Value;
  theme: AppTheme;
}> = ({ isRecording, waveAnim1, waveAnim2, theme }) => {
  const waveformBars = Array.from({ length: 12 }, (_, i) => {
    // Create staggered animation for each bar
    const animValue = i % 2 === 0 ? waveAnim1 : waveAnim2;
    const delay = i * 50; // Stagger the animation
    
    return (
      <Animated.View
        key={i}
        style={[
          {
            width: 3,
            backgroundColor: theme.colors.primary,
            marginHorizontal: 1,
            borderRadius: 1.5,
          },
          {
            height: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 25 + Math.random() * 15], // Random heights for more dynamic look
            }),
          },
        ]}
      />
    );
  });

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      marginVertical: theme.spacing.sm, // Further reduced spacing
    }}>
      {waveformBars}
    </View>
  );
};

export const AudioRecorderUI: React.FC<AudioRecorderUIProps> = ({
  transcriptSegments,
  setTranscriptSegments,
  currentSegmentTranscript,
  isTranscribingSegment,
  lastTranscriptionResult,
  showAlternatives,
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
  onClose,
  existingContent,
  onSaveWithCompleteText,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
  const pulseAnimRef = useRef(new Animated.Value(1)).current;

  // Animate recording button pulse
  useEffect(() => {
    if (isRecording) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimRef, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimRef, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      pulseAnimRef.setValue(1);
    }
  }, [isRecording, pulseAnimRef]);

  // Get the current new transcript (only new segments, not accumulated)
  const newTranscriptText = transcriptSegments.join('\n').trim();
  
  // For editing mode, show existing content + new transcript
  // For new entries, just show new transcript
  const displayText = existingContent && existingContent.trim() 
    ? (newTranscriptText 
        ? `${existingContent}\n\n${newTranscriptText}` 
        : existingContent)
    : newTranscriptText;
    
  // Use current segment transcript if actively transcribing, otherwise use display text
  const currentTranscript = currentSegmentTranscript || displayText;

  // Track user-edited text separately to avoid feedback loops
  const [editedText, setEditedText] = useState(currentTranscript);

  // Update edited text when transcript changes (but not during user editing)
  useEffect(() => {
    setEditedText(currentTranscript);
  }, [currentTranscript]);

  // Get effective save button state
  const effectiveSaveButtonState = saveButtonState || {
    text: 'Save',
    disabled: !canAcceptTranscript,
    isSaving: false
  };

  // Handle save button press
  const handleSavePress = useCallback(() => {
    if (onSaveWithCompleteText && existingContent) {
      // If we have a complete text handler and existing content, use the edited text
      onSaveWithCompleteText(editedText);
      // Clear transcript segments after saving to prevent accumulation
      setTranscriptSegments([]);
      // Reset edited text to just existing content for next recording
      setEditedText(existingContent);
    } else {
      // Otherwise use the normal transcript-based save
      handleAcceptTranscript();
    }
  }, [onSaveWithCompleteText, existingContent, editedText, handleAcceptTranscript, setTranscriptSegments]);

  // Get display text for transcription area
  const getTranscriptionDisplayText = () => {
    if (isTranscribingSegment) {
      return 'Processing audio...';
    }
    if (currentTranscript) {
      return currentTranscript;
    }
    if (isRecording) {
      return 'Listening...';
    }
    return 'Tap the microphone to start recording';
  };

  return (
    <View style={styles.container}>
      {/* Top Bar with Timer and Icons */}
      <View style={styles.topBar}>
        {/* Timer - Top Left */}
        <Text style={styles.timerTextTopLeft}>
          {formatDuration(recordingDuration)}
        </Text>
        
        {/* Icons - Top Right */}
        <View style={styles.topRightIcons}>
          {/* Language Icon */}
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setLanguageModalVisible(true)}
            disabled={isRecording}
          >
            <Ionicons 
              name="language" 
              size={20} 
              color={isRecording ? theme.colors.disabled : theme.colors.primary} 
            />
          </TouchableOpacity>
          
          {/* Lock Icon */}
          <TouchableOpacity
            style={styles.lockButton}
            onPress={() => setLanguageModalVisible(true)}
            disabled={isRecording}
          >
            <Ionicons 
              name="lock-closed" 
              size={20} 
              color={isRecording ? theme.colors.disabled : theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Waveform Visualization */}
      <WaveformVisualization
        isRecording={isRecording}
        waveAnim1={waveAnim1}
        waveAnim2={waveAnim2}
        theme={theme}
      />
      
      {/* Recording Button */}
      <View style={styles.recordingButtonContainer}>
        <Animated.View style={[
          styles.recordingButtonOuter,
          { transform: [{ scale: pulseAnimRef }] }
        ]}>
          <TouchableOpacity
            style={[
              styles.recordingButton,
              { backgroundColor: isRecording ? '#E53E3E' : theme.colors.primary }
            ]}
            onPress={handleMicPress}
            disabled={!permissionGranted}
          >
            <View style={styles.recordingButtonInner}>
              {isRecording ? (
                <View style={styles.stopIcon} />
              ) : (
                <Ionicons name="mic" size={32} color="white" />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
      
      {/* Recording Status */}
      <Text style={styles.recordingStatusText}>
        {isRecording ? 'Recording in progress' : 'Ready to record'}
      </Text>
      
      {/* Spacer to push transcript to bottom */}
      <View style={styles.spacer} />
        
      {/* Transcript Card - Bottom Area */}
      <View style={styles.transcriptCard}>
        {/* Header with Transcript label and Save button */}
        <View style={styles.transcriptHeader}>
          <View style={styles.transcriptLabelContainer}>
            <Ionicons name="document-text" size={20} color={theme.colors.primary} />
            <Text style={styles.transcriptLabel}>Transcript</Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.saveButtonSmall,
              effectiveSaveButtonState.disabled && styles.saveButtonSmallDisabled
            ]}
            onPress={handleSavePress}
            disabled={effectiveSaveButtonState.disabled}
          >
            {effectiveSaveButtonState.isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonSmallText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Editable Text Area */}
        <TextInput
          style={styles.transcriptTextInput}
          value={editedText}
          onChangeText={(text) => {
            // Simply update the edited text - no complex logic needed
            setEditedText(text);
          }}
          multiline
          placeholder={isTranscribingSegment ? 'Processing audio...' : (isRecording ? 'Listening...' : 'Tap the microphone to start recording')}
          placeholderTextColor={theme.colors.textSecondary}
          textAlignVertical="top"
          editable={!isTranscribingSegment}
        />
        
        {isTranscribingSegment && (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.transcriptionLoader}
          />
        )}
        
        {/* Transcription Alternatives */}
        {showAlternatives && lastTranscriptionResult?.alternatives && lastTranscriptionResult.alternatives.length > 0 && (
          <ScrollView style={styles.alternativesScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.alternativesContainer}>
              <Text style={styles.alternativesTitle}>Alternative transcriptions:</Text>
              {lastTranscriptionResult.alternatives.map((alternative, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.alternativeItem}
                  onPress={() => {
                    if (alternative.transcript && alternative.transcript.trim()) {
                      setTranscriptSegments([alternative.transcript]);
                      setShowAlternatives(false);
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
          </ScrollView>
        )}
      </View>

      {/* Language Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isLanguageModalVisible}
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setLanguageModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onLanguageChange={(languageCode) => {
                handleLanguageChange(languageCode);
                setLanguageModalVisible(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  
  // Top bar with timer and icons
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  
  // Icons container in top-right
  topRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  // Timer in top-left
  timerTextTopLeft: {
    fontSize: 32,
    fontWeight: '300',
    color: theme.colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  
  // Language button
  languageButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  // Lock button (language selector)
  lockButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  // Recording button
  recordingButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.lg,
  },
  
  // Spacer to push transcript to bottom - make it much smaller
  spacer: {
    flex: 0.3, // Further reduced from 0.5
    minHeight: 10,
  },
  recordingButtonOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  recordingButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 24,
    height: 24,
    backgroundColor: 'white',
    borderRadius: 4,
  },
  
  // Recording status
  recordingStatusText: {
    fontSize: 16,
    color: '#E53E3E',
    fontWeight: '500',
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  
  // Transcript card - simplified and taking more space
  transcriptCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg, // Add bottom margin for proper spacing
    ...theme.shadows.md,
    borderColor: theme.colors.borderLight,
    borderWidth: theme.isDarkMode ? 1 : 0,
    overflow: 'hidden',
    flex: 1, // Take remaining space
    minHeight: 250, // Ensure substantial minimum height
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.isDarkMode ? theme.colors.gray800 : theme.colors.gray50,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  transcriptLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transcriptLabel: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  saveButtonSmall: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  saveButtonSmallDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  saveButtonSmallText: {
    color: theme.colors.onPrimary,
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  transcriptTextInput: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.md,
    padding: theme.spacing.lg,
    flex: 1, // Take remaining space in the card
    textAlignVertical: 'top',
    fontFamily: theme.typography.fontFamilies.regular,
    backgroundColor: 'transparent',
  },
  
  // Legacy transcription display (keeping for compatibility)
  transcriptionContainer: {
    width: '100%',
    height: 120,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 20,
    position: 'relative',
  },
  transcriptionInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 22,
    padding: 16,
    textAlignVertical: 'top',
  },
  transcriptionScroll: {
    flex: 1,
  },
  transcriptionContent: {
    padding: 16,
    minHeight: 88,
  },
  transcriptionText: {
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 22,
  },
  alternativesScroll: {
    maxHeight: 80,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  transcriptionLoader: {
    position: 'absolute',
    bottom: theme.spacing.md,
    right: theme.spacing.md,
  },
  
  // Alternatives styles
  alternativesContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  alternativesTitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  alternativeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  alternativeText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.text,
    flex: 1,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  alternativeConfidence: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamilies.medium,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
});

export default AudioRecorderUI; 