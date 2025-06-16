import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { Tag } from '../types'; // Make sure this path is correct

// Helper to determine if native driver should be used
const useNativeDriver = Platform.OS !== 'web';

interface TagInputProps {
  tags: Tag[];
  onChangeTags: (tags: Tag[]) => void;
  maxTags?: number;
  placeholder?: string;
  suggestions?: string[]; // Common tags for autocomplete
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChangeTags,
  maxTags = 10,
  placeholder = "Add tag...",
  suggestions = []
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const currentTagNames = tags.map(tag => tag.name.toLowerCase());
      const filtered = suggestions.filter(suggestion => 
        suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
        !currentTagNames.includes(suggestion.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      
      // Animate suggestions appearance
      if (filtered.length > 0) {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver,
        }).start();
      }
    } else {
      setShowSuggestions(false);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver,
      }).start();
    }
  }, [inputValue, suggestions, tags, fadeAnim]);

  const handleAddTag = (tagName?: string) => {
    const newTagName = (tagName || inputValue).trim().toLowerCase();
    
    if (!newTagName) {
      return;
    }
    
    // Check for duplicates and max tags
    const currentTagNames = tags.map(tag => tag.name.toLowerCase());
    if (currentTagNames.includes(newTagName) || tags.length >= maxTags) {
      setInputValue('');
      setShowSuggestions(false);
      return;
    }
    
    const newTag: Tag = { name: newTagName, id: null as any };
    onChangeTags([...tags, newTag]);
    setInputValue('');
    setShowSuggestions(false);
    
    // Keep focus on input for continuous tagging
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleRemoveTag = (indexToRemove: number) => {
    const updatedTags = tags.filter((_, index) => index !== indexToRemove);
    onChangeTags(updatedTags);
  };

  const handleKeyPress = (e: any) => {
    const key = e.nativeEvent.key;
    
    if (key === 'Enter' || key === ' ' || key === ',') {
      e.preventDefault?.();
      handleAddTag();
    } else if (key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      handleRemoveTag(tags.length - 1);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    handleAddTag(suggestion);
  };

  const handleInputFocus = () => {
    if (inputValue.trim() && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for suggestion tap
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  return (
    <View style={styles.container} testID="tag-input-container">
      {/* Tags Display */}
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsScrollView}
          contentContainerStyle={styles.tagsContainer}
          testID="tags-scroll-view"
          keyboardShouldPersistTaps="handled"
        >
          {tags.map((tag, index) => (
            <Animated.View
              key={tag.id ? `tag-${tag.id}` : `tag-${tag.name}-${index}`}
              style={styles.tag}
              testID={`tag-item-${tag.name}-${index}`}
            >
              <Text style={styles.tagText} testID={`tag-text-${tag.name}`}>
                #{tag.name}
              </Text>
              <TouchableOpacity
                style={styles.tagRemoveButton}
                onPress={() => handleRemoveTag(index)}
                testID={`tag-delete-button-${tag.name}-${index}`}
                accessibilityLabel={`Delete tag ${tag.name}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      )}
      
      {/* Input Container */}
      <View style={styles.inputContainer} testID="tag-input-field-container">
        <View style={styles.inputWrapper}>
          <Ionicons 
            name="pricetag-outline" 
            size={20} 
            color={theme.colors.textSecondary} 
            style={styles.inputIcon}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={() => handleAddTag()}
            onKeyPress={handleKeyPress}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={tags.length >= maxTags ? `Maximum ${maxTags} tags` : placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            returnKeyType="done"
            testID="tag-input-field"
            editable={tags.length < maxTags}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.addButton,
            (!inputValue.trim() || tags.length >= maxTags) && styles.disabledButton
          ]}
          onPress={() => handleAddTag()}
          disabled={!inputValue.trim() || tags.length >= maxTags}
          testID="add-tag-button"
          accessibilityLabel="Add tag"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons 
            name="add" 
            size={22} 
            color={theme.colors.onPrimary} 
          />
        </TouchableOpacity>
      </View>

      {/* Suggestions */}
      {showSuggestions && (
        <Animated.View 
          style={[styles.suggestionsContainer, { opacity: fadeAnim }]}
          testID="suggestions-container"
        >
          <Text style={styles.suggestionsTitle}>Suggestions:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsContent}
          >
            {filteredSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={`suggestion-${index}`}
                style={styles.suggestionChip}
                onPress={() => handleSuggestionPress(suggestion)}
                testID={`suggestion-${suggestion}`}
              >
                <Text style={styles.suggestionText}>#{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}
      
      {/* Help Text */}
      {tags.length < maxTags && inputValue.length === 0 && !showSuggestions && (
        <Text style={styles.helpText} testID="tag-input-help-text">
          Press Enter, space, or comma to add • Backspace to remove last tag
        </Text>
      )}

      {/* Tag Counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          {tags.length}/{maxTags} tags
        </Text>
      </View>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  tagsScrollView: {
    maxHeight: 80,
    marginBottom: theme.spacing.md,
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
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.primaryLight + '20',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.isDarkMode ? theme.colors.gray600 : theme.colors.primaryLight + '40',
    minHeight: 36, // Larger touch target
  },
  tagText: {
    color: theme.isDarkMode ? theme.colors.text : theme.colors.primary,
    fontSize: theme.typography.fontSizes.sm,
    marginRight: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.medium,
    fontWeight: '500',
  },
  tagRemoveButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48, // Larger touch target
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    paddingVertical: theme.spacing.md,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.md,
    ...theme.shadows.sm,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
    opacity: 0.6,
  },
  suggestionsContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  suggestionsTitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
    marginBottom: theme.spacing.sm,
  },
  suggestionsContent: {
    flexDirection: 'row',
  },
  suggestionChip: {
    backgroundColor: theme.colors.accent + '20',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.accent + '40',
  },
  suggestionText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  helpText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.xs,
  },
  counterContainer: {
    alignItems: 'flex-end',
    marginTop: theme.spacing.xs,
  },
  counterText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDisabled,
    fontFamily: theme.typography.fontFamilies.regular,
  },
});

export default TagInput; 