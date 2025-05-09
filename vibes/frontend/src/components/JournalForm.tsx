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
  // Use our audio playback hook for handling audio playback
  const {
    isPlaying,
    togglePlayback,
    error: playbackError
  } = useAudioPlayback();

  const handlePlayRecording = async () => {
    if (audioUri) {
      await togglePlayback(audioUri);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={onChangeTitle}
        placeholder="Enter a title (optional)"
        placeholderTextColor="#999"
        maxLength={100}
      />
      
      <Text style={styles.label}>Content</Text>
      <View style={styles.contentContainer}>
        <TextInput
          style={[styles.input, styles.contentInput]}
          value={content}
          onChangeText={onChangeContent}
          placeholder="Start typing or tap below to record your thoughts..."
          placeholderTextColor="#999"
          multiline
          scrollEnabled={false}
        />
        
        <View style={styles.contentActions}>
          <TouchableOpacity
            style={[styles.recordButtonInline, (isLoading || isSaving) && styles.disabledButtonInline]}
            onPress={onShowRecorder}
            disabled={isLoading || isSaving}
          >
            <Ionicons name="mic" size={20} color={(isLoading || isSaving) ? '#aaa' : '#7D4CDB'} style={styles.recordIcon} />
            <Text style={[styles.recordButtonText, (isLoading || isSaving) && styles.disabledButtonTextInline]}>Record Audio</Text>
          </TouchableOpacity>
          
          {audioUri && (
            <TouchableOpacity
              style={[styles.contentActionButton, isPlaying && styles.disabledButtonInline]}
              onPress={handlePlayRecording}
              disabled={isPlaying || isLoading || isSaving}
            >
              <Ionicons 
                name={isPlaying ? "pause-circle" : "play-circle"} 
                size={24} 
                color={isPlaying || isLoading || isSaving ? '#aaa' : '#7D4CDB'} 
              />
              <Text style={[styles.contentActionText, isPlaying || isLoading || isSaving ? styles.disabledButtonTextInline : {}]}>
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
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="save-outline" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Entry</Text>
          </>
        )}
      </TouchableOpacity>
      {isAutoSaving && <Text style={styles.autoSaveIndicator}>Auto-saving...</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
    marginTop: 16,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  contentContainer: {
    backgroundColor: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingTop: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  contentInput: {
    minHeight: 150,
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  contentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#ddd',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#fff',
  },
  recordButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E9E5F6',
    borderRadius: 20,
  },
  recordIcon: {
    marginRight: 6,
  },
  recordButtonText: {
    color: '#7D4CDB',
    fontWeight: '500',
    fontSize: 14,
  },
  contentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  contentActionText: {
    marginLeft: 6,
    color: '#7D4CDB',
    fontWeight: '500',
    fontSize: 14,
  },
  disabledButtonInline: {
    backgroundColor: '#f0f0f0',
  },
  disabledButtonTextInline: {
    color: '#aaa',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#7D4CDB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#B0A9C8',
  },
  autoSaveIndicator: {
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
});

export default JournalForm; 