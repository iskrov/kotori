import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

// Use existing types and correct styles path
import { JournalEntry } from '../types';

interface JournalCardProps {
  entry: JournalEntry;
  onPress?: (entry: JournalEntry) => void;
  style?: object;
}

const JournalCard: React.FC<JournalCardProps> = ({ entry, onPress, style }) => {
  // Calculate preview text - truncate if needed
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
          <Ionicons name="musical-note" size={16} color="#7D4CDB" />
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
          {entry.tags.map((tag: any, index: number) => (
            <View key={index} style={styles.tag} testID={`tag-${index}`}>
              <Text style={styles.tagText}>{typeof tag === 'string' ? tag : tag.name}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#666666',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  content: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#f0ebff',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#7D4CDB',
  },
});

export default JournalCard; 