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

const JournalEntryFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
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
        <ActivityIndicator size="large" color="#7D4CDB" />
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
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter a title for your entry (optional)"
            placeholderTextColor="#999"
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
          />
          <TouchableOpacity 
            style={styles.recordButtonInline} 
            onPress={handleShowRecorder} 
            disabled={isRecording || isLoading}
          >
            <Ionicons name="mic" size={20} color="#7D4CDB" style={styles.recordIcon} />
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
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 15,
    fontSize: 16,
    marginBottom: 10,
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 15,
    fontSize: 16,
    minHeight: 200,
    paddingBottom: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#7D4CDB',
    marginLeft: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  recordButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  recordIcon: {
    marginRight: 4,
  },
  recordButtonText: {
    color: '#7D4CDB',
    fontWeight: '500',
  },
});

export default JournalEntryFormScreen; 