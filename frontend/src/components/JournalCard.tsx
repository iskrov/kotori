import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { JournalEntry, Tag } from '../types';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { componentStyles } from '../styles/theme';

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
  const [isPressed, setIsPressed] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
    setIsPressed(true);
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver,
      tension: 100,
      friction: 3,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver,
      tension: 100,
      friction: 3,
    }).start();
  };

  const handlePress = () => {
    if (onPress) {
      onPress(entry);
    }
  };

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
    opacity: scaleAnim.interpolate({
      inputRange: [0.98, 1],
      outputRange: [0.8, 1],
    }),
  };
  
  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable 
        style={[
          styles.container,
          isPressed && styles.pressed
        ]} 
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID="journal-card"
        accessibilityLabel={`Journal entry from ${formattedDate}${entry.title ? `: ${entry.title}` : ''}`}
        accessibilityRole="button"
        accessibilityHint="Tap to view full journal entry"
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
              <View key={`${entry.id}-tag-${tag.id || index}-${tag.name}`} style={styles.tag} testID={`tag-${tag.id ?? index}`}>
                <Text style={styles.tagText}>{tag.name}</Text>
              </View>
            ))}
            {entry.tags.length > 3 && (
              <View key={`${entry.id}-more-tags`} style={styles.moreTagsIndicator}>
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
    ...componentStyles.card,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    // ensure shadow color adapts to theme
    shadowColor: theme.colors.shadow,
    padding: theme.spacing.lg,
    marginVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.xs,
    overflow: 'hidden',
  },
  pressed: {
    backgroundColor: theme.isDarkMode 
      ? theme.colors.gray800 
      : theme.colors.gray100,
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
    backgroundColor: theme.colors.chipBackground,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  tagText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.chipText,
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