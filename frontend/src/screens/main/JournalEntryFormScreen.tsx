import React, { useState, useEffect } from 'react';
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
  Modal
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

const JournalEntryFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { journalId } = route.params as { journalId?: string };
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingEntry, setIsFetchingEntry] = useState(false);
  
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  useEffect(() => {
    if (journalId) {
      fetchEntryData();
    }
    navigation.setOptions({ title: journalId ? 'Edit Entry' : 'New Entry' });
  }, [journalId, navigation]);
  
  const fetchEntryData = async () => {
    if (!journalId) return;
    
    try {
      setIsFetchingEntry(true);
      const response = await JournalAPI.getEntry(journalId);
      const entry = response.data;
      setTitle(entry.title || '');
      setContent(entry.content || '');
      setTags(entry.tags || []);
    } catch (error) {
      logger.error('Error fetching entry data', { journalId, error });
      Alert.alert('Error', 'Failed to load journal entry data');
    } finally {
      setIsFetchingEntry(false);
    }
  };
  
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
      setContent(prevContent => prevContent + (prevContent ? ' ' : '') + transcribedText);
      
      if (detectedLanguage) {
        logger.info(`Detected language: ${detectedLanguage}`);
      }
    }
  };
  
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
        tags 
      };
      
      if (journalId) {
        await JournalAPI.updateEntry(journalId, entryData);
        Alert.alert('Success', 'Journal entry updated successfully');
      } else {
        entryData.entry_date = new Date().toISOString();
        await JournalAPI.createEntry(entryData);
        Alert.alert('Success', 'Journal entry created successfully');
      }
      
      navigation.goBack();
    } catch (error) {
      logger.error('Error saving journal entry', { journalId, error });
      Alert.alert('Error', 'Failed to save journal entry');
    } finally {
      setIsLoading(false);
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
            />
          </Modal>
        )}
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.button, 
            styles.saveButton,
            isLoading && styles.disabledButton
          ]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    justifyContent: 'space-around',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  button: {
    borderRadius: 5,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamilies.bold,
  },
  cancelButton: {
    backgroundColor: theme.colors.gray200,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
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
});

export default JournalEntryFormScreen; 