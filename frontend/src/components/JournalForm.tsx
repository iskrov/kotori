import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TagInput from './TagInput';
import TextInput from './TextInput';
import useAudioPlayback from '../hooks/useAudioPlayback';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

// Helper to determine if native driver should be used
const useNativeDriver = Platform.OS !== 'web';

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
  
  const [writingStartTime, setWritingStartTime] = useState<Date | null>(null);
  const [writingDuration, setWritingDuration] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveIndicatorAnim = useRef(new Animated.Value(0)).current;
  
  const {
    isPlaying,
    togglePlayback,
  } = useAudioPlayback();

  // Track writing time and word count
  useEffect(() => {
    if (content && !writingStartTime) {
      setWritingStartTime(new Date());
    }
    
    // Update word count
    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
    
    // Update writing duration
    if (writingStartTime) {
      const duration = Math.floor((Date.now() - writingStartTime.getTime()) / 1000);
      setWritingDuration(duration);
    }
  }, [content, writingStartTime]);

  // Auto-save indicator animation
  useEffect(() => {
    if (isAutoSaving) {
      Animated.sequence([
        Animated.timing(saveIndicatorAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver,
        }),
        Animated.delay(1000),
        Animated.timing(saveIndicatorAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver,
        }),
      ]).start(() => {
        if (!isAutoSaving) {
          setLastSaved(new Date());
        }
      });
    }
  }, [isAutoSaving]);

  const handlePlayRecording = async () => {
    if (audioUri) {
      await togglePlayback(audioUri);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getWritingStats = () => {
    const stats = [];
    if (wordCount > 0) stats.push(`${wordCount} words`);
    if (writingDuration > 0) stats.push(`${formatDuration(writingDuration)} writing`);
    return stats.length > 0 ? stats.join(' • ') : null;
  };

  const recordButtonIconColor = (isLoading || isSaving) ? theme.colors.disabled : theme.colors.primary;
  const playButtonIconColor = (isPlaying || isLoading || isSaving) ? theme.colors.disabled : theme.colors.primary;

  // Convert tags array to Tag objects for TagInput
  const tagObjects = tags.map((tagName, index) => ({
    id: null as any,
    name: tagName
  }));

  const handleTagsChange = (newTags: any[]) => {
    const tagNames = newTags.map(tag => tag.name);
    onChangeTags(tagNames);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        {/* Header with stats */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Journal Entry</Text>
          {getWritingStats() && (
            <Text style={styles.writingStats}>{getWritingStats()}</Text>
          )}
        </View>

        {/* Title Input */}
        <TextInput
          label="Title"
          value={title}
          onChangeText={onChangeTitle}
          placeholder="Give your entry a title..."
          maxLength={100}
          characterCount
          helperText="Optional but helps organize your thoughts"
          leftIcon="create-outline"
        />
        
        {/* Content Input */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionLabel}>Content</Text>
          <View style={styles.contentContainer}>
            <TextInput
              label="What's on your mind?"
              value={content}
              onChangeText={onChangeContent}
              placeholder="Start typing or record your thoughts..."
              multiline
              numberOfLines={8}
              style={styles.contentInput}
              variant="filled"
              size="large"
            />
            
            {/* Content Actions */}
            <View style={styles.contentActions}>
              <TouchableOpacity
                style={[styles.actionButton, (isLoading || isSaving) && styles.disabledButton]}
                onPress={onShowRecorder}
                disabled={isLoading || isSaving}
                accessibilityLabel="Record audio"
                accessibilityHint="Add voice recording to your entry"
              >
                <View style={styles.actionButtonContent}>
                  <Ionicons name="mic" size={20} color={recordButtonIconColor} />
                  <Text style={[styles.actionButtonText, (isLoading || isSaving) && styles.disabledText]}>
                    Record Audio
                  </Text>
                </View>
              </TouchableOpacity>
              
              {audioUri && (
                <TouchableOpacity
                  style={[styles.actionButton, (isPlaying || isLoading || isSaving) && styles.disabledButton]}
                  onPress={handlePlayRecording}
                  disabled={isPlaying || isLoading || isSaving}
                  accessibilityLabel={isPlaying ? "Pause recording" : "Play recording"}
                >
                  <View style={styles.actionButtonContent}>
                    <Ionicons 
                      name={isPlaying ? "pause-circle" : "play-circle"} 
                      size={24} 
                      color={playButtonIconColor} 
                    />
                    <Text style={[styles.actionButtonText, (isPlaying || isLoading || isSaving) && styles.disabledText]}>
                      {isPlaying ? "Playing..." : "Play Recording"}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        
        {/* Tags Section */}
        <View style={styles.tagsSection}>
          <Text style={styles.sectionLabel}>Tags</Text>
          <TagInput
            tags={tagObjects}
            onChangeTags={handleTagsChange}
            placeholder="Add tags to organize your entry..."
            suggestions={['personal', 'work', 'reflection', 'gratitude', 'goals', 'ideas']}
          />
        </View>
        
        {/* Auto-save indicator */}
        <Animated.View 
          style={[
            styles.autoSaveContainer,
            { opacity: saveIndicatorAnim }
          ]}
        >
          <View style={styles.autoSaveContent}>
            <Ionicons name="cloud-done" size={16} color={theme.colors.success} />
            <Text style={styles.autoSaveText}>Auto-saved</Text>
          </View>
        </Animated.View>

        {/* Last saved indicator */}
        {lastSaved && !isAutoSaving && (
          <Text style={styles.lastSavedText}>
            Last saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
        
        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (isSaving || isLoading || isAutoSaving) && styles.saveButtonDisabled
          ]}
          onPress={onSave}
          disabled={isSaving || isLoading || isAutoSaving}
          accessibilityLabel="Save journal entry"
          accessibilityHint="Saves your entry to your journal"
        >
          {isSaving ? (
            <View style={styles.saveButtonContent}>
              <ActivityIndicator size="small" color={theme.colors.onPrimary} />
              <Text style={styles.saveButtonText}>Saving...</Text>
            </View>
          ) : (
            <View style={styles.saveButtonContent}>
              <Ionicons name="save-outline" size={20} color={theme.colors.onPrimary} />
              <Text style={styles.saveButtonText}>Save Entry</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  form: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  headerTitle: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.xs,
  },
  writingStats: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  sectionLabel: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.md,
  },
  contentSection: {
    marginBottom: theme.spacing.xl,
  },
  contentContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  contentInput: {
    marginBottom: theme.spacing.lg,
  },
  contentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  actionButton: {
    backgroundColor: theme.colors.primaryLight + '20',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight + '40',
    minHeight: 48,
    flex: 1,
    minWidth: 140,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: theme.spacing.sm,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled + '20',
    borderColor: theme.colors.disabled + '40',
  },
  disabledText: {
    color: theme.colors.disabled,
  },
  tagsSection: {
    marginBottom: theme.spacing.xl,
  },
  autoSaveContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  autoSaveContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  autoSaveText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.success,
    fontFamily: theme.typography.fontFamilies.medium,
    marginLeft: theme.spacing.xs,
  },
  lastSavedText: {
    textAlign: 'center',
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDisabled,
    fontFamily: theme.typography.fontFamilies.regular,
    marginBottom: theme.spacing.lg,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    ...theme.shadows.md,
    minHeight: 56,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: theme.colors.onPrimary,
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamilies.bold,
    marginLeft: theme.spacing.sm,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.disabled,
    opacity: 0.6,
  },
});

export default JournalForm; 