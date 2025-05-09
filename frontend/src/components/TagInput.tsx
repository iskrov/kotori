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
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

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
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    if (!inputValue.trim()) {
      return;
    }
    const newTag = inputValue.trim().toLowerCase();
    if (tags.includes(newTag) || tags.length >= maxTags) {
      setInputValue('');
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
      {tags.length > 0 && (
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
                testID={`tag-delete-button-${index}`}
                accessibilityLabel={`Delete tag ${tag}`}
              >
                <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      
      <View style={styles.inputContainer} testID="tag-input-field-container">
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={setInputValue}
          onSubmitEditing={handleAddTag}
          onKeyPress={handleKeyPress}
          placeholder={tags.length >= maxTags ? `Maximum ${maxTags} tags` : placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          returnKeyType="done"
          testID="tag-input-field"
          editable={tags.length < maxTags}
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
          <Ionicons name="add" size={20} color={theme.isDarkMode ? theme.colors.background : theme.colors.white} />
        </TouchableOpacity>
      </View>
      
      {tags.length < maxTags && (
        <Text style={styles.helpText} testID="tag-input-help-text">
          Press space, comma, or tap + to add a tag
        </Text>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  tagsScrollView: {
    maxHeight: 80,
    marginBottom: theme.spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
    borderRadius: 16,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },
  tagText: {
    color: theme.isDarkMode ? theme.colors.text : theme.colors.primary,
    fontSize: theme.typography.fontSizes.sm,
    marginRight: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  tagRemoveButton: {
    marginLeft: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    marginTop: theme.spacing.xs,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.text,
    backgroundColor: theme.isDarkMode ? theme.colors.gray800 : theme.colors.white,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
  },
  helpText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.regular,
  },
});

export default TagInput; 