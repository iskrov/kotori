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
import { JournalEntry, JournalEntryCreate, JournalEntryUpdate, JournalStackParamList, Tag } from '../../types';
import TagInput from '../../components/TagInput';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

type JournalEntryFormRouteProp = RouteProp<JournalStackParamList, 'JournalEntryForm'>;

const JournalEntryFormScreen = () => {
  const route = useRoute<JournalEntryFormRouteProp>();
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { journalId } = route.params || {};
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialEntry, setInitialEntry] = useState<JournalEntry | null>(null);

  useEffect(() => {
    if (journalId) {
      fetchEntryDetails();
    }
    navigation.setOptions({
      headerTitle: journalId ? 'Edit Entry' : 'New Entry',
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerNavButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSave}
          disabled={!content.trim() || isSaving}
          style={styles.headerNavButton}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={[styles.saveText, (!content.trim()) && styles.disabledButtonText]}>Save</Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [journalId, navigation, isSaving, title, content, tags, theme, initialEntry]);

  const fetchEntryDetails = async () => {
    if (!journalId) return;
    try {
      setIsLoading(true);
      const response = await JournalAPI.getEntry(journalId);
      const entry = response.data as JournalEntry;
      
      setInitialEntry(entry);
      setTitle(entry.title || '');
      setContent(entry.content || '');
      setTags(entry.tags || []);
    } catch (error) {
      console.error('Error fetching journal entry details:', error);
      Alert.alert('Error', 'Failed to load journal entry details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('[FormScreen] Attempting to save. Content trimmed:', content.trim());
    if (!content.trim()) {
      Alert.alert('Validation Error', 'Please enter some content for your journal entry.');
      return;
    }

    try {
      setIsSaving(true);
      console.log('[FormScreen] Current tags state before map:', JSON.stringify(tags));
      const tagNamesForApi = tags.map(tag => {
        if (!tag || typeof tag.name === 'undefined') {
          console.error('[FormScreen] Invalid tag object in tags array:', JSON.stringify(tag));
          throw new Error('Invalid tag object encountered during mapping.');
        }
        return tag.name;
      });
      console.log('[FormScreen] handleSave - tagNamesForApi (after map):', JSON.stringify(tagNamesForApi));

      if (journalId && initialEntry) {
        const entryData: JournalEntryUpdate = {
          title: title.trim() || undefined,
          content: content.trim(),
          tags: tagNamesForApi,
          entry_date: initialEntry.entry_date,
        };
        console.log('[FormScreen] Updating entry with data:', JSON.stringify(entryData));
        await JournalAPI.updateEntry(journalId, entryData);
      } else if (!journalId) {
        const entryData: JournalEntryCreate = {
          title: title.trim() || undefined,
          content: content.trim(),
          entry_date: format(new Date(), 'yyyy-MM-dd'),
          tags: tagNamesForApi,
        };
        console.log('[FormScreen] Creating new entry with data:', JSON.stringify(entryData));
        await JournalAPI.createEntry(entryData);
      } else {
        console.error('[FormScreen] handleSave: Attempting to update without initialEntry data.');
        Alert.alert('Save Error', 'Could not save changes. Initial entry data missing.');
        setIsSaving(false);
        return;
      }

      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error saving journal entry:', error);
      Alert.alert('Save Error', 'Failed to save journal entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        style={styles.formContainer}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={styles.titleInput}
          placeholder="Title (optional)"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor={theme.colors.textSecondary}
        />
        
        <TextInput
          style={styles.contentInput}
          placeholder="Start typing your journal entry here..."
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          placeholderTextColor={theme.colors.textSecondary}
          scrollEnabled={false}
        />
        
        <View style={styles.tagsSection}>
          <Text style={styles.tagsLabel}>Tags</Text>
          <TagInput
            tags={tags}
            onChangeTags={setTags}
            placeholder="Add tags..."
          />
        </View>
      </ScrollView>
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
  headerNavButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  saveText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  disabledButtonText: {
    color: theme.colors.disabled,
  },
  formContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  titleInput: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contentInput: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeights.md,
    minHeight: 200,
  },
  tagsSection: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  tagsLabel: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
});

export default JournalEntryFormScreen; 