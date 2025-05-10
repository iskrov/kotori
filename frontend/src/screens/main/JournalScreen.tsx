import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { JournalAPI, TagsAPI } from '../../services/api';
import JournalCard from '../../components/JournalCard';
import { JournalEntry, Tag, MainTabParamList, JournalStackParamList, RootStackParamList } from '../../types';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

// Define navigation prop types correctly
type JournalScreenNavigationProp = StackNavigationProp<JournalStackParamList, 'JournalList'>;
// If JournalScreen is used in a context where it can navigate to MainTab screens:
type AppNavigationProp = StackNavigationProp<RootStackParamList>; // Assuming RootStackParamList has MainTabParamList

const JournalScreen = () => {
  const navigation = useNavigation<JournalScreenNavigationProp>();
  const appNavigation = useNavigation<AppNavigationProp>(); // For navigating to other tabs like Record
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  // State
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Fetch journal entries when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('JournalScreen: Screen focused, fetching fresh data');
      fetchEntries();
      fetchTags();
      return () => {
        // Cleanup when screen is unfocused
        console.log('JournalScreen: Screen unfocused');
      };
    }, [])
  );
  
  // Filter entries whenever search query or selected tags change
  useEffect(() => {
    filterEntries();
  }, [searchQuery, selectedTags, entries]);
  
  // Fetch journal entries from API
  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      
      const response = await JournalAPI.getEntries();
      setEntries(response.data);
    } catch (error) {
      console.error('Error fetching journal entries', error);
      Alert.alert('Error', 'Failed to load journal entries');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Fetch available tags from API
  const fetchTags = async () => {
    try {
      const response = await TagsAPI.getTags();
      setAvailableTags(response.data.map((tag: Tag) => tag.name));
    } catch (error) {
      console.error('Error fetching tags', error);
    }
  };
  
  // Handle refresh
  const onRefresh = () => {
    setIsRefreshing(true);
    fetchEntries();
  };
  
  // Filter entries based on search query and selected tags
  const filterEntries = () => {
    let filtered = [...entries];
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.title.toLowerCase().includes(query) || 
        entry.content.toLowerCase().includes(query)
      );
    }
    
    // Filter by selected tags (now entry.tags is Tag[])
    if (selectedTags.length > 0) {
      filtered = filtered.filter(entry => 
        selectedTags.every(selectedTagName => 
          entry.tags.some(tagObject => tagObject.name === selectedTagName)
        )
      );
    }
    
    setFilteredEntries(filtered);
  };
  
  // Toggle tag selection
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  // Navigate to entry creation screen
  const handleCreateEntry = () => {
    // Navigate to the 'Record' screen, assuming it's in the 'Main' tab navigator
    // If 'Record' is a top-level screen in RootStackParamList, this might differ.
    // This assumes 'Record' is part of MainTabParamList which is a screen in RootStackParamList called 'Main'
    appNavigation.navigate('Main', { screen: 'Record', params: undefined } as any); // Use 'as any' to bypass complex type check for now, ensure types are aligned
  };
  
  // Navigate to entry detail screen
  const handleEntryPress = (entry: JournalEntry) => {
    // navigation here is JournalScreenNavigationProp, which should be able to navigate to JournalEntryDetail
    navigation.navigate('JournalEntryDetail', { entryId: entry.id });
  };
  
  // Render journal entry item
  const renderItem = ({ item }: { item: JournalEntry }) => (
    <JournalCard 
      entry={item}
      onPress={() => handleEntryPress(item)}
    />
  );
  
  // Group entries by month
  const groupEntriesByMonth = () => {
    const grouped: { [key: string]: JournalEntry[] } = {};
    
    filteredEntries.forEach(entry => {
      const date = new Date(entry.entry_date);
      const monthYear = format(date, 'MMMM yyyy');
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      
      grouped[monthYear].push(entry);
    });
    
    return Object.entries(grouped).map(([month, entries]) => ({
      month,
      entries,
    }));
  };
  
  // Render month section
  const renderMonthSection = ({ item }: { item: { month: string, entries: JournalEntry[] } }) => (
    <View style={styles.monthSection}>
      <Text style={styles.monthTitle}>{item.month}</Text>
      <FlatList
        data={item.entries}
        renderItem={renderItem}
        keyExtractor={entry => entry.id}
        scrollEnabled={false}
      />
    </View>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Journal Entries</Text>
        
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleCreateEntry}
        >
          <Ionicons name="add" size={theme.typography.fontSizes.xxl} color={theme.isDarkMode ? theme.colors.background : theme.colors.white} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={theme.typography.fontSizes.xl} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search entries..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.textSecondary}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={theme.typography.fontSizes.xl} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      
      {availableTags.length > 0 && (
        <View style={styles.tagsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {availableTags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagChip,
                  selectedTags.includes(tag) && styles.tagChipSelected
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text 
                  style={[
                    styles.tagText,
                    selectedTags.includes(tag) && styles.tagTextSelected
                  ]}
                >
                  #{tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <>
          {filteredEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="journal-outline" size={theme.spacing.xxl * 1.5} color={theme.colors.disabled} />
              <Text style={styles.emptyText}>No journal entries found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || selectedTags.length > 0
                  ? 'Try changing your search or filters'
                  : 'Tap the + button to create your first entry'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={groupEntriesByMonth()}
              renderItem={renderMonthSection}
              keyExtractor={item => item.month}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  colors={[theme.colors.primary]}
                  tintColor={theme.colors.primary}
                />
              }
            />
          )}
        </>
      )}
    </View>
  );
};

// Function to generate styles based on the theme
const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.fontSizes.xxl,
    fontFamily: theme.typography.fontFamilies.bold,
    color: theme.colors.text,
  },
  addButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.xxl,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  tagsContainer: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tagChip: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
    marginRight: theme.spacing.sm,
  },
  tagChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tagText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  tagTextSelected: {
    color: theme.colors.onPrimary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
  },
  monthSection: {
    marginBottom: theme.spacing.md,
  },
  monthTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.isDarkMode ? theme.colors.gray800 : theme.colors.gray100,
    fontFamily: theme.typography.fontFamilies.bold,
  },
});

export default JournalScreen; 