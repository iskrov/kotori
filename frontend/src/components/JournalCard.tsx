import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { JournalEntry, Tag } from '../types';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

interface JournalCardProps {
  entry: JournalEntry;
  onPress?: (entry: JournalEntry) => void;
  style?: object;
}

const JournalCard: React.FC<JournalCardProps> = ({ entry, onPress, style }) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);

  // Log tag IDs for debugging
  if (entry.tags && entry.tags.length > 0) {
    console.log(
      `JournalCard entry ID ${entry.id} - Tag IDs for keys:`,
      entry.tags.map(t => String(t.id))
    );
  }

  const getPreviewText = (content: string, maxLength: number = 100) => {
    if (!content) return 'No content';
    if (content.length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  };

  const formattedDate = format(
    typeof entry.entry_date === 'string' ? parseISO(entry.entry_date) : entry.entry_date,
    'MMM dd, yyyy'
  );

  const handlePress = () => {
    if (onPress) {
      onPress(entry);
    }
  };
  
  return (
    <Pressable 
      style={[styles.container, style]} 
      onPress={handlePress}
      testID="journal-card"
    >
      <View style={styles.header}>
        <Text style={styles.date} testID="journal-date">{formattedDate}</Text>
        {entry.audio_url && (
          <Ionicons name="musical-notes" size={16} color={theme.colors.primary} />
        )}
      </View>
      
      {entry.title && (
        <Text style={styles.title} testID="journal-title">{entry.title}</Text>
      )}
      
      <Text 
        style={styles.content} 
        numberOfLines={2}
        testID="journal-content"
      >
        {getPreviewText(entry.content)}
      </Text>
      
      {entry.tags && entry.tags.length > 0 && (
        <View style={styles.tagsContainer} testID="tags-container">
          {entry.tags.map((tag: Tag, index: number) => (
            <View key={tag.id ? String(tag.id) : `${entry.id}-tag-${index}`} style={styles.tag} testID={`tag-${tag.id ?? index}`}>
              <Text style={styles.tagText}>{tag.name}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    elevation: theme.isDarkMode ? 1 : 3,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: theme.isDarkMode ? 1 : 2 },
    shadowOpacity: theme.isDarkMode ? 0.2 : 0.15,
    shadowRadius: theme.isDarkMode ? 2 : 2.5,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 0.5 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  date: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  title: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  content: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
    borderRadius: 16,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  tagText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.isDarkMode ? theme.colors.text : theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
});

export default JournalCard; 