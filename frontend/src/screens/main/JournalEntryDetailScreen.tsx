import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import { JournalAPI } from '../../services/api';
import { JournalEntry, JournalStackParamList, Tag } from '../../types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

// Define the type for the route params
type JournalEntryDetailRouteProp = RouteProp<JournalStackParamList, 'JournalEntryDetail'>;

// Define the type for the navigation prop
type JournalEntryDetailNavigationProp = StackNavigationProp<JournalStackParamList, 'JournalEntryDetail'>;

const JournalEntryDetailScreen = () => {
  const navigation = useNavigation<JournalEntryDetailNavigationProp>();
  const route = useRoute<JournalEntryDetailRouteProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const { entryId } = route.params;
  
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useFocusEffect(
    useCallback(() => {
      console.log('JournalEntryDetailScreen: Screen focused, fetching fresh data');
      fetchEntryDetails();
      
      return () => {
        console.log('JournalEntryDetailScreen: Screen unfocused');
      };
    }, [entryId])
  );
  
  const fetchEntryDetails = async () => {
    try {
      setIsLoading(true);
      const response = await JournalAPI.getEntry(entryId);
      setEntry(response.data);
    } catch (error) {
      console.error('Error fetching entry details', error);
      Alert.alert('Error', 'Failed to load journal entry details');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEdit = () => {
    navigation.navigate('JournalEntryForm', { journalId: entryId });
  };
  
  const handleDelete = async () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this journal entry? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await JournalAPI.deleteEntry(entryId);
              Alert.alert('Success', 'Journal entry deleted successfully');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting entry', error);
              Alert.alert('Error', 'Failed to delete journal entry');
            }
          }
        }
      ]
    );
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  if (!entry) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={theme.spacing.xxl * 1.5} color={theme.colors.error} />
        <Text style={styles.errorText}>Entry not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.dateText}>
            {format(parseISO(entry.entry_date), 'EEEE, MMMM d, yyyy')}
          </Text>
          <Text style={styles.timeText}>
            {format(parseISO(entry.entry_date), 'h:mm a')}
          </Text>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.entryText}>{entry.content}</Text>
        </View>
        
        <View style={styles.metadataContainer}>
          {/* Commenting out mood - not in type */}
          {/* {entry.mood && (
            <View style={styles.metadataItem}>
              <Ionicons name="happy-outline" size={20} color="#666" />
              <Text style={styles.metadataText}>Mood: {entry.mood}</Text>
            </View>
          )} */}
          
          {/* Commenting out location - not in type */}
          {/* {entry.location && (
            <View style={styles.metadataItem}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <Text style={styles.metadataText}>{entry.location}</Text>
            </View>
          )} */}
          
          {entry.tags && entry.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              <Ionicons name="pricetag-outline" size={theme.typography.fontSizes.xl} color={theme.colors.textSecondary} />
              <View style={styles.tagsList}>
                {entry.tags.map((tag: Tag, index: number) => (
                  <View key={tag.id ? String(tag.id) : `${entry.id}-tag-${index}`} style={styles.tag}>
                    <Text style={styles.tagText}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.actionBar}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleEdit}
        >
          <Ionicons name="create-outline" size={theme.typography.fontSizes.xxl} color={theme.colors.primary} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={theme.typography.fontSizes.xxl} color={theme.colors.error} />
          <Text style={[styles.actionText, { color: theme.colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Function to generate styles based on the theme
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
  scrollContent: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateText: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  timeText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  content: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: theme.isDarkMode ? 1 : 2 },
    shadowOpacity: theme.isDarkMode ? 0.2 : 0.1,
    shadowRadius: theme.isDarkMode ? 2 : 4,
    elevation: theme.isDarkMode ? 2 : 3,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 0.5 : 0,
  },
  entryText: {
    fontSize: theme.typography.fontSizes.md,
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  metadataContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: theme.isDarkMode ? 1 : 2 },
    shadowOpacity: theme.isDarkMode ? 0.2 : 0.1,
    shadowRadius: theme.isDarkMode ? 2 : 4,
    elevation: theme.isDarkMode ? 2 : 3,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 0.5 : 0,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  metadataText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: theme.spacing.sm,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  tag: {
    backgroundColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 15,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  tagText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  actionButton: {
    alignItems: 'center',
    padding: theme.spacing.sm,
  },
  actionText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  errorText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.error,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  backButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 5,
  },
  backButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.bold,
  },
});

export default JournalEntryDetailScreen; 