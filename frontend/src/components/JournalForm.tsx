import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TagInput from './TagInput';
import useAudioPlayback from '../hooks/useAudioPlayback';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

interface JournalFormProps {
  title: string;
  content: string;
  tags: string[];
  audioUri: string | null;
  onChangeTitle: (text: string) => void;
  onChangeContent: (text: string) => void;
  onChangeTags: (tags: string[]) => void;
  onSave: () => void;
  onShowRecorder: () => void;
  isSaving: boolean;
  isAutoSaving: boolean;
  isLoading: boolean;
}

const JournalForm: React.FC<JournalFormProps> = ({
  title,
  content,
  tags,
  audioUri,
  onChangeTitle,
  onChangeContent,
  onChangeTags,
  onSave,
  onShowRecorder,
  isSaving,
  isAutoSaving,
  isLoading,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const {
    isPlaying,
    togglePlayback,
  } = useAudioPlayback();

  const handlePlayRecording = async () => {
    if (audioUri) {
      await togglePlayback(audioUri);
    }
  };

  const recordButtonIconColor = (isLoading || isSaving) ? theme.colors.disabled : theme.colors.primary;
  const playButtonIconColor = (isPlaying || isLoading || isSaving) ? theme.colors.disabled : theme.colors.primary;

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={onChangeTitle}
        placeholder="Enter a title (optional)"
        placeholderTextColor={theme.colors.textSecondary}
        maxLength={100}
      />
      
      <Text style={styles.label}>Content</Text>
      <View style={styles.contentContainer}>
        <TextInput
          style={[styles.input, styles.contentInput]}
          value={content}
          onChangeText={onChangeContent}
          placeholder="Start typing or tap below to record your thoughts..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          scrollEnabled={false}
        />
        
        <View style={styles.contentActions}>
          <TouchableOpacity
            style={[styles.recordButtonInline, (isLoading || isSaving) && styles.disabledButtonInline]}
            onPress={onShowRecorder}
            disabled={isLoading || isSaving}
          >
            <Ionicons name="mic" size={20} color={recordButtonIconColor} style={styles.recordIcon} />
            <Text style={[styles.recordButtonText, (isLoading || isSaving) && styles.disabledButtonText]}>Record Audio</Text>
          </TouchableOpacity>
          
          {audioUri && (
            <TouchableOpacity
              style={[styles.contentActionButton, (isPlaying || isLoading || isSaving) && styles.disabledButtonInline]}
              onPress={handlePlayRecording}
              disabled={isPlaying || isLoading || isSaving}
            >
              <Ionicons 
                name={isPlaying ? "pause-circle" : "play-circle"} 
                size={24} 
                color={playButtonIconColor} 
              />
              <Text style={[styles.contentActionText, (isPlaying || isLoading || isSaving) && styles.disabledButtonText]}>
                {isPlaying ? "Playing..." : "Play Recording"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <Text style={styles.label}>Tags</Text>
      <TagInput
        tags={tags}
        onChangeTags={onChangeTags}
        placeholder="Add tags (e.g., work, personal)"
      />
      
      <TouchableOpacity
        style={[
          styles.saveButton,
          (isSaving || isLoading || isAutoSaving) && styles.saveButtonDisabled
        ]}
        onPress={onSave}
        disabled={isSaving || isLoading || isAutoSaving}
      >
        {isSaving || isAutoSaving ? (
          <ActivityIndicator size="small" color={theme.isDarkMode ? theme.colors.background : theme.colors.white} />
        ) : (
          <>
            <Ionicons name="save-outline" size={20} color={theme.isDarkMode ? theme.colors.background : theme.colors.white} />
            <Text style={styles.saveButtonText}>Save Entry</Text>
          </>
        )}
      </TouchableOpacity>
      {isAutoSaving && <Text style={styles.autoSaveIndicator}>Auto-saving...</Text>}
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  form: {
    padding: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    backgroundColor: theme.isDarkMode ? theme.colors.gray800 : theme.colors.white,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  contentContainer: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray800 : theme.colors.white,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
  },
  input: {
    paddingTop: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    textAlignVertical: 'top',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    paddingHorizontal: theme.spacing.md,
  },
  contentInput: {
    minHeight: 150,
  },
  contentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  recordButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
    borderRadius: 20,
  },
  recordIcon: {
    marginRight: theme.spacing.xs,
  },
  recordButtonText: {
    color: theme.colors.primary,
    fontWeight: '500',
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  contentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  contentActionText: {
    marginLeft: theme.spacing.xs,
    color: theme.colors.primary,
    fontWeight: '500',
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  disabledButtonInline: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
  },
  disabledButtonText: {
    color: theme.colors.disabled,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  saveButtonText: {
    color: theme.isDarkMode ? theme.colors.background : theme.colors.white,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: 'bold',
    marginLeft: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  autoSaveIndicator: {
    textAlign: 'center',
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.regular,
  },
});

export default JournalForm; 