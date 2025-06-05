import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { JournalEntry, Tag } from '../types';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';

// Helper to determine if native driver should be used
const useNativeDriver = Platform.OS !== 'web';

interface JournalCardProps {
  entry: JournalEntry;
  onPress?: (entry: JournalEntry) => void;
  style?: object;
}

const JournalCard: React.FC<JournalCardProps> = ({ entry, onPress, style }) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const getPreviewText = (content: string, maxLength: number = 120) => {
    if (!content) return 'No content';
    if (content.length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  };

  const formattedDate = format(
    typeof entry.entry_date === 'string' ? parseISO(entry.entry_date) : entry.entry_date,
    'MMM dd, yyyy'
  );

  const formattedTime = format(
    typeof entry.entry_date === 'string' ? parseISO(entry.entry_date) : entry.entry_date,
    'h:mm a'
  );

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver,
    }).start();
  };

  const handlePress = () => {
    if (onPress) {
      onPress(entry);
    }
  };
  
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable 
        style={[styles.container]} 
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID="journal-card"
      >
        {/* Header with date and audio indicator */}
        <View style={styles.header}>
          <View style={styles.dateContainer}>
            <Text style={styles.date} testID="journal-date">{formattedDate}</Text>
            <Text style={styles.time}>{formattedTime}</Text>
          </View>
          {entry.audio_url && (
            <View style={styles.audioIndicator}>
              <Ionicons name="musical-notes" size={18} color={theme.colors.accent} />
            </View>
          )}
        </View>
        
        {/* Title */}
        {entry.title && (
          <Text style={styles.title} testID="journal-title" numberOfLines={2}>
            {entry.title}
          </Text>
        )}
        
        {/* Content preview */}
        <Text 
          style={styles.content} 
          numberOfLines={3}
          testID="journal-content"
        >
          {getPreviewText(entry.content)}
        </Text>
        
        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <View style={styles.tagsContainer} testID="tags-container">
            {entry.tags.slice(0, 3).map((tag: Tag, index: number) => (
              <View key={tag.id || `${entry.id}-tag-${index}`} style={styles.tag} testID={`tag-${tag.id ?? index}`}>
                <Text style={styles.tagText}>{tag.name}</Text>
              </View>
            ))}
            {entry.tags.length > 3 && (
              <View style={styles.moreTagsIndicator}>
                <Text style={styles.moreTagsText}>+{entry.tags.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom accent line */}
        <View style={styles.accentLine} />
      </Pressable>
    </Animated.View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.xs,
    ...theme.shadows.md,
    borderColor: theme.colors.borderLight,
    borderWidth: theme.isDarkMode ? 1 : 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  dateContainer: {
    flex: 1,
  },
  date: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
    marginBottom: theme.spacing.xs / 2,
  },
  time: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDisabled,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  audioIndicator: {
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.full,
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    lineHeight: theme.typography.lineHeights.tight * theme.typography.fontSizes.xl,
  },
  content: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
  },
  tag: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.primaryLight + '20',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.isDarkMode ? theme.colors.gray600 : theme.colors.primaryLight + '40',
  },
  tagText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.isDarkMode ? theme.colors.text : theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.medium,
    fontWeight: '500',
  },
  moreTagsIndicator: {
    backgroundColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  moreTagsText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  accentLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
  },
});

export default JournalCard; 