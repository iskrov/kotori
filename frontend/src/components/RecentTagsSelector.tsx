import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { Tag } from '../types';
import { TagsAPI } from '../services/api';
import logger from '../utils/logger';

interface RecentTag extends Tag {
  last_used: string;
  usage_count: number;
}

interface RecentTagsSelectorProps {
  onTagSelect: (tag: Tag) => void;
  selectedTags: Tag[];
  maxTags?: number;
}

const RecentTagsSelector: React.FC<RecentTagsSelectorProps> = ({
  onTagSelect,
  selectedTags,
  maxTags = 10,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [recentTags, setRecentTags] = useState<RecentTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadRecentTags();
  }, []);

  const loadRecentTags = async () => {
    try {
      setIsLoading(true);
      const response = await TagsAPI.getRecentTags(5);
      setRecentTags(response.data);
    } catch (error) {
      logger.error('Failed to load recent tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagPress = (tag: RecentTag) => {
    // Check if tag is already selected
    const isSelected = selectedTags.some(selectedTag => 
      selectedTag.id === tag.id || selectedTag.name.toLowerCase() === tag.name.toLowerCase()
    );
    
    if (isSelected) {
      return; // Don't add duplicate tags
    }

    if (selectedTags.length >= maxTags) {
      return; // Don't exceed max tags
    }

    // Convert RecentTag to Tag format
    const tagToAdd: Tag = {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      created_at: tag.created_at,
      updated_at: tag.updated_at,
    };

    onTagSelect(tagToAdd);
  };

  const formatLastUsed = (lastUsed: string) => {
    const date = new Date(lastUsed);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading recent tags...</Text>
      </View>
    );
  }

  if (recentTags.length === 0) {
    return null; // Don't show anything if no recent tags
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent Tags</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {recentTags.map((tag) => {
          const isSelected = selectedTags.some(selectedTag => 
            selectedTag.id === tag.id || selectedTag.name.toLowerCase() === tag.name.toLowerCase()
          );
          const isDisabled = selectedTags.length >= maxTags && !isSelected;
          
          return (
            <TouchableOpacity
              key={tag.id}
              style={[
                styles.tagButton,
                isSelected && styles.tagButtonSelected,
                isDisabled && styles.tagButtonDisabled,
              ]}
              onPress={() => handleTagPress(tag)}
              disabled={isSelected || isDisabled}
              activeOpacity={0.7}
            >
              <View style={styles.tagContent}>
                <View style={styles.tagHeader}>
                  <Ionicons 
                    name="pricetag" 
                    size={16} 
                    color={tag.color || theme.colors.primary}
                    style={styles.tagIcon}
                  />
                  <Text style={[
                    styles.tagName,
                    isSelected && styles.tagNameSelected,
                    isDisabled && styles.tagNameDisabled,
                  ]}>
                    {tag.name}
                  </Text>
                </View>
                <Text style={[
                  styles.tagMeta,
                  isSelected && styles.tagMetaSelected,
                  isDisabled && styles.tagMetaDisabled,
                ]}>
                  {formatLastUsed(tag.last_used)} • {tag.usage_count} uses
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.xs,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  loadingText: {
    marginLeft: theme.spacing.sm,
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  tagButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 120,
  },
  tagButtonSelected: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  tagButtonDisabled: {
    opacity: 0.5,
  },
  tagContent: {
    alignItems: 'flex-start',
  },
  tagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  tagIcon: {
    marginRight: 4,
  },
  tagName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    flex: 1,
  },
  tagNameSelected: {
    color: theme.colors.primary,
  },
  tagNameDisabled: {
    color: theme.colors.textSecondary,
  },
  tagMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  tagMetaSelected: {
    color: theme.colors.primary + 'CC',
  },
  tagMetaDisabled: {
    color: theme.colors.textSecondary + '80',
  },
});

export default RecentTagsSelector; 