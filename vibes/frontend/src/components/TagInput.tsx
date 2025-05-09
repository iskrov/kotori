import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TagInputProps {
  tags: string[];
  onChangeTags: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChangeTags,
  maxTags = 10,
  placeholder = "Add tag..."
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    if (!inputValue.trim()) {
      return;
    }

    // Normalize tag (lowercase, trim)
    const newTag = inputValue.trim().toLowerCase();
    
    // Don't add if it already exists
    if (tags.includes(newTag)) {
      setInputValue('');
      return;
    }
    
    // Don't add if we've reached the max
    if (tags.length >= maxTags) {
      return;
    }
    
    onChangeTags([...tags, newTag]);
    setInputValue('');
  };

  const handleRemoveTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    onChangeTags(newTags);
  };

  const handleKeyPress = (e: any) => {
    if (e.nativeEvent.key === ' ' || e.nativeEvent.key === ',') {
      e.preventDefault?.();
      handleAddTag();
    }
  };

  return (
    <View style={styles.container} testID="tag-input-container">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tagsScrollView}
        contentContainerStyle={styles.tagsContainer}
        testID="tags-scroll-view"
      >
        {tags.map((tag, index) => (
          <View key={index} style={styles.tag} testID={`tag-item-${index}`}>
            <Text style={styles.tagText} testID={`tag-text-${index}`}>#{tag}</Text>
            <TouchableOpacity
              style={styles.tagRemoveButton}
              onPress={() => handleRemoveTag(index)}
              testID={`tag-delete-button`}
              accessibilityLabel={`Delete tag ${tag}`}
            >
              <Ionicons name="close-circle" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.inputContainer} testID="tag-input-field-container">
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={setInputValue}
          onSubmitEditing={handleAddTag}
          onKeyPress={handleKeyPress}
          placeholder={tags.length >= maxTags ? `Maximum ${maxTags} tags` : placeholder}
          placeholderTextColor="#999"
          returnKeyType="done"
          testID="tag-input-field"
        />
        <TouchableOpacity
          style={[
            styles.addButton,
            (!inputValue.trim() || tags.length >= maxTags) && styles.disabledButton
          ]}
          onPress={handleAddTag}
          disabled={!inputValue.trim() || tags.length >= maxTags}
          testID="add-tag-button"
          accessibilityLabel="Add tag"
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.helpText} testID="tag-input-help-text">
        Press space, comma, or tap + to add a tag
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  tagsScrollView: {
    maxHeight: 80,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0ebff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  tagText: {
    color: '#7D4CDB',
    fontSize: 14,
    marginRight: 4,
  },
  tagRemoveButton: {
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#333',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#7D4CDB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  helpText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

export default TagInput; 