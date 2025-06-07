import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  SafeAreaView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

import { JournalAPI } from '../../services/api';
import AudioRecorder from '../../components/AudioRecorder';
import logger from '../../utils/logger';
import TagInput from '../../components/TagInput';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { Tag } from '../../types';

const JournalEntryFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { journalId } = route.params as { journalId?: string };
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [entryDate, setEntryDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingEntry, setIsFetchingEntry] = useState(false);
  
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalTags, setOriginalTags] = useState<Tag[]>([]);
  const [originalEntryDate, setOriginalEntryDate] = useState<string>('');
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // This ref will hold stable versions of the handler functions.
  const handlersRef = useRef({
    handleSave: async () => {},
    handleDiscard: () => {},
    handleBackPress: () => navigation.goBack(),
  });

  // This `useEffect` runs only ONCE to set up stable navigation options.
  useEffect(() => {
    navigation.setOptions({
      title: journalId ? 'Edit Entry' : 'New Entry',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => handlersRef.current.handleBackPress()}
          style={{ marginLeft: 16, padding: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [journalId, navigation, theme.colors.text]);

  // This `useEffect` updates the handler functions in the ref whenever state changes.
  useEffect(() => {
    const handleSave = async () => {
      if (!content.trim()) {
        Alert.alert('Error', 'Please enter some content for your journal entry');
        return;
      }
      try {
        setIsLoading(true);
        const entryData: any = {
          title: title || `Entry ${new Date().toLocaleDateString()}`,
          content,
          tags,
          entry_date: entryDate || new Date().toISOString(),
        };

        if (journalId) {
          await JournalAPI.updateEntry(journalId, entryData);
          setOriginalTitle(entryData.title);
          setOriginalContent(entryData.content);
          setOriginalTags(entryData.tags);
          setOriginalEntryDate(entryData.entry_date);
          setHasUnsavedChanges(false);
          Alert.alert('Success', 'Journal entry updated', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          await JournalAPI.createEntry(entryData);
          Alert.alert('Success', 'Journal entry created', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      } catch (error) {
        logger.error('Error saving journal entry', { journalId, error });
        Alert.alert('Error', 'Failed to save journal entry');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDiscard = () => {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard all changes?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              if (journalId) {
                setTitle(originalTitle);
                setContent(originalContent);
                setTags(originalTags);
                setEntryDate(originalEntryDate);
              } else {
                setTitle('');
                setContent('');
                setTags([]);
                setEntryDate(new Date().toISOString());
              }
              setHasUnsavedChanges(false);
              navigation.goBack();
            },
          },
        ]
      );
    };

    const handleBackPress = () => {
      if (hasUnsavedChanges) {
        Alert.alert(
          'Unsaved Changes',
          'You have unsaved changes. What would you like to do?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Save Changes', style: 'default', onPress: handleSave },
            { text: 'Discard', style: 'destructive', onPress: handleDiscard },
          ]
        );
      } else {
        navigation.goBack();
      }
    };

    handlersRef.current = { handleSave, handleDiscard, handleBackPress };
  }, [
    title, content, tags, entryDate, hasUnsavedChanges,
    originalTitle, originalContent, originalTags, originalEntryDate,
    journalId, navigation
  ]);

  useEffect(() => {
    const fetchEntryData = async () => {
      if (!journalId) return;
      try {
        setIsFetchingEntry(true);
        const response = await JournalAPI.getEntry(journalId);
        const entry = response.data;
        setTitle(entry.title || '');
        setContent(entry.content || '');
        setTags(entry.tags || []);
        setEntryDate(entry.entry_date || new Date().toISOString());
        setOriginalTitle(entry.title || '');
        setOriginalContent(entry.content || '');
        setOriginalTags(entry.tags || []);
        setOriginalEntryDate(entry.entry_date || new Date().toISOString());
        setHasUnsavedChanges(false);
      } catch (error) {
        logger.error('Error fetching entry data', { journalId, error });
        Alert.alert('Error', 'Failed to load journal entry data');
      } finally {
        setIsFetchingEntry(false);
      }
    };

    if (journalId) {
      fetchEntryData();
    } else {
      setEntryDate(new Date().toISOString());
    }
  }, [journalId]);

  useEffect(() => {
    if (isFetchingEntry) return;
    const hasChanges =
      title !== originalTitle ||
      content !== originalContent ||
      JSON.stringify(tags) !== JSON.stringify(originalTags) ||
      entryDate !== originalEntryDate;
    setHasUnsavedChanges(hasChanges);
  }, [
    title,
    content,
    tags,
    entryDate,
    originalTitle,
    originalContent,
    originalTags,
    originalEntryDate,
    isFetchingEntry,
  ]);

  const handleShowRecorder = async () => {
    try {
      const { granted } = await Audio.getPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Microphone Permission Needed',
          'Please grant microphone access in your device settings to record.',
          [{ text: 'OK' }]
        );
        return;
      }

      setShowRecorder(true);
      logger.info('JournalEntryFormScreen: Showing AudioRecorder modal');
    } catch (error) {
      logger.error('Error showing recorder', error);
      Alert.alert('Error', 'Could not prepare for recording');
    }
  };
  
  const handleTranscriptionComplete = (transcribedText: string, detectedLanguage?: string) => {
    setShowRecorder(false);
    
    if (transcribedText) {
      // For edit mode, append new transcription to existing content with proper formatting
      setContent(prevContent => {
        if (!prevContent.trim()) {
          // If no existing content, just use the new transcription
          return transcribedText;
        } else {
          // If there's existing content, add the new transcription on a new line
          return prevContent + '\n' + transcribedText;
        }
      });
      
      if (detectedLanguage) {
        logger.info(`Detected language: ${detectedLanguage}`);
      }
    }
  };

  const handleAutoSave = (currentTranscript: string) => {
    if (currentTranscript && currentTranscript.trim()) {
      const newContent = content.trim() ? content + '\n' + currentTranscript : currentTranscript;
      setContent(newContent);
      logger.info('JournalEntryFormScreen: Content updated locally (no auto-save to backend)');
    }
  };

  if (isFetchingEntry) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Edit Mode Indicator */}
        {journalId && (
          <View style={styles.editModeIndicator}>
            <Ionicons name="create" size={20} color={theme.colors.primary} />
            <Text style={styles.editModeText}>Editing Entry</Text>
            {hasUnsavedChanges && (
              <View style={styles.unsavedIndicator}>
                <Text style={styles.unsavedText}>●</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter a title for your entry (optional)"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Entry Date</Text>
          <TextInput
            style={styles.input}
            value={entryDate ? new Date(entryDate).toLocaleDateString() : ''}
            onChangeText={(text) => {
              // Simple date parsing - in a real app you'd want a proper date picker
              try {
                const date = new Date(text);
                if (!isNaN(date.getTime())) {
                  setEntryDate(date.toISOString());
                }
              } catch (error) {
                // Invalid date, ignore
              }
            }}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Entry Content</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={10}
            placeholder="Write your journal entry here..."
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
            placeholderTextColor={theme.colors.textSecondary}
          />
          <TouchableOpacity 
            style={styles.recordButtonInline} 
            onPress={handleShowRecorder} 
            disabled={isRecording || isLoading || isTranscribing}
          >
            <Ionicons name="mic" size={theme.typography.fontSizes.xl} color={theme.colors.primary} style={styles.recordIcon} />
            <Text style={styles.recordButtonText}>Record Audio</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Tags</Text>
          <TagInput tags={tags} onChangeTags={setTags} />
        </View>

        {showRecorder && (
          <Modal
            animationType="slide"
            transparent={false}
            visible={showRecorder}
            onRequestClose={() => {
              if (!isRecording) {
                setShowRecorder(false);
              }
            }}
          >
            <AudioRecorder 
              onTranscriptionComplete={handleTranscriptionComplete}
              onCancel={() => setShowRecorder(false)}
              onAutoSave={handleAutoSave} // Auto-save transcriptions to content
              showCloseButton={true} // Show close button in modal mode
              existingContent={content} // Pass existing content for context
            />
          </Modal>
        )}
      </ScrollView>

      {/* Buttons are now a regular view at the bottom, not absolute positioned */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => hasUnsavedChanges ? handlersRef.current.handleDiscard() : navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>
            {hasUnsavedChanges ? 'Discard' : 'Cancel'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.button,
            styles.saveButton,
            (isLoading || !hasUnsavedChanges) && styles.disabledButton,
          ]}
          onPress={handlersRef.current.handleSave}
          disabled={isLoading || !hasUnsavedChanges}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>
              {journalId ? 'Save Changes' : 'Create Entry'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingBottom: Platform.OS === 'ios' ? 88 : 75, // Account for tab bar height
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  input: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray800 : theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 5,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  textArea: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 5,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    minHeight: 150,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.lg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 16,
    flex: 1,
    minHeight: 56,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.primary + '20',
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamilies.bold,
    letterSpacing: 0.5,
  },
  cancelButton: {
    backgroundColor: theme.colors.gray200,
    borderWidth: 2,
    borderColor: theme.colors.gray200 + '20',
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
    letterSpacing: 0.5,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
    opacity: 0.6,
  },
  recordButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gray100,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 5,
    marginTop: theme.spacing.md,
  },
  recordIcon: {
    marginRight: theme.spacing.sm,
  },
  recordButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  editModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '10',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  editModeText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  unsavedIndicator: {
    marginLeft: theme.spacing.sm,
  },
  unsavedText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.warning,
    fontFamily: theme.typography.fontFamilies.bold,
  },
});

export default JournalEntryFormScreen; 