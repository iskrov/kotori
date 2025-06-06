import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView
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
    console.log('[JournalEntryDetailScreen] handleDelete function called');
    navigation.navigate('DeleteConfirmation', { entryId });
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
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
          style={[styles.actionButton, styles.editButton]} 
          onPress={handleEdit}
          activeOpacity={0.8}
        >
          <Ionicons name="create" size={28} color={theme.colors.white} />
          <Text style={[styles.actionText, styles.editButtonText]}>Edit Entry</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]} 
          onPress={() => {
            console.log('[JournalEntryDetailScreen] Delete button pressed!');
            handleDelete();
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="trash" size={28} color={theme.colors.white} />
          <Text style={[styles.actionText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// Function to generate styles based on the theme
const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingBottom: Platform.OS === 'ios' ? 88 : 75, // Account for tab bar height
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  dateText: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.bold,
    letterSpacing: -0.5,
  },
  timeText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    fontWeight: '600',
  },
  content: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.isDarkMode ? 0.2 : 0.12,
    shadowRadius: theme.isDarkMode ? 6 : 8,
    elevation: theme.isDarkMode ? 4 : 6,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 1 : 0,
  },
  entryText: {
    fontSize: theme.typography.fontSizes.lg,
    lineHeight: theme.typography.lineHeights.loose * theme.typography.fontSizes.lg,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    letterSpacing: 0.2,
  },
  metadataContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: theme.isDarkMode ? 0.2 : 0.1,
    shadowRadius: theme.isDarkMode ? 4 : 6,
    elevation: theme.isDarkMode ? 3 : 4,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 1 : 0,
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
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tagText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.bold,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 16,
    flex: 1,
    minHeight: 56,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  editButton: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.primary + '20',
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
    borderWidth: 2,
    borderColor: theme.colors.error + '20',
  },
  actionText: {
    fontSize: theme.typography.fontSizes.lg,
    marginLeft: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.bold,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  editButtonText: {
    color: theme.colors.white,
  },
  deleteButtonText: {
    color: theme.colors.white,
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