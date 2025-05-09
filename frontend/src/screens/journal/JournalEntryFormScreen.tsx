import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { JournalAPI } from '../../services/api';
import { JournalEntry, JournalEntryCreate, JournalEntryUpdate, JournalStackParamList } from '../../types';
import TagInput from '../../components/TagInput';

type JournalEntryFormRouteProp = RouteProp<JournalStackParamList, 'JournalEntryForm'>;

const JournalEntryFormScreen = () => {
  const route = useRoute<JournalEntryFormRouteProp>();
  const navigation = useNavigation();
  const { journalId } = route.params || {};
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialEntry, setInitialEntry] = useState<JournalEntry | null>(null);

  // Fetch entry data if editing an existing entry
  useEffect(() => {
    if (journalId) {
      fetchEntryDetails();
    }
  }, [journalId]);

  const fetchEntryDetails = async () => {
    try {
      setIsLoading(true);
      const response = await JournalAPI.getEntry(journalId);
      const entry = response.data;
      
      setInitialEntry(entry);
      setTitle(entry.title || '');
      setContent(entry.content || '');
      setTags(entry.tags.map(tag => tag.name));
    } catch (error) {
      console.error('Error fetching journal entry details', error);
      Alert.alert('Error', 'Failed to load journal entry details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content for your journal entry');
      return;
    }

    try {
      setIsSaving(true);

      if (journalId) {
        // Update existing entry
        const entryData: JournalEntryUpdate = {
          title: title.trim() || null,
          content: content.trim(),
          tags: tags,
        };
        await JournalAPI.updateEntry(journalId, entryData);
      } else {
        // Create new entry
        const entryData: JournalEntryCreate = {
          title: title.trim() || null,
          content: content.trim(),
          entry_date: format(new Date(), 'yyyy-MM-dd'),
          tags: tags,
        };
        await JournalAPI.createEntry(entryData);
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving journal entry', error);
      Alert.alert('Error', 'Failed to save journal entry');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {journalId ? 'Edit Entry' : 'New Entry'}
        </Text>
        
        <TouchableOpacity
          style={[styles.headerButton, !content.trim() && styles.disabledButton]}
          onPress={handleSave}
          disabled={!content.trim() || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#7D4CDB" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.formContainer}>
        <TextInput
          style={styles.titleInput}
          placeholder="Title (optional)"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#999"
        />
        
        <TextInput
          style={styles.contentInput}
          placeholder="Start typing your journal entry here..."
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          placeholderTextColor="#999"
        />
        
        <View style={styles.tagsSection}>
          <Text style={styles.tagsLabel}>Tags</Text>
          <TagInput
            tags={tags}
            onChangeTags={setTags}
          />
        </View>
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cancelText: {
    fontSize: 16,
    color: '#777',
  },
  saveText: {
    fontSize: 16,
    color: '#7D4CDB',
    fontWeight: '600',
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    paddingVertical: 8,
  },
  contentInput: {
    fontSize: 18,
    color: '#333',
    lineHeight: 26,
    minHeight: 200,
  },
  tagsSection: {
    marginTop: 30,
    marginBottom: 20,
  },
  tagsLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
});

export default JournalEntryFormScreen; 