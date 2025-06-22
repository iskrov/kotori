import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  FlatList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { JournalAPI, TagsAPI } from '../../services/api';
import JournalCard from '../../components/JournalCard';
import { JournalCardSkeleton } from '../../components/SkeletonLoader';
import SafeScrollView from '../../components/SafeScrollView';
import ScreenHeader from '../../components/ScreenHeader';

import { JournalEntry, Tag } from '../../types';
import { MainStackParamList, MainTabParamList, JournalStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useHiddenMode } from '../../contexts/HiddenModeContext';
import { AppTheme } from '../../config/theme';

// --- Special Tag for Hidden Entries (Client-Side) ---
// TODO: Move this to a shared constants file
const HIDDEN_ENTRY_TAG = "_hidden_entry";
// ----------------------------------------------------

// Define navigation prop types for tab navigation with access to main stack
type JournalScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Journal'>,
  StackNavigationProp<MainStackParamList>
>;

const JournalScreen = () => {
  const navigation = useNavigation<JournalScreenNavigationProp>();
  const { theme } = useAppTheme();
  const { isHiddenMode } = useHiddenMode();
  const styles = getStyles(theme);
  
  // State
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Scroll position persistence
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPosition = useRef({ offset: 0 });
  const shouldRestoreScroll = useRef(false);
  
  // Save scroll position when leaving screen
  const saveScrollPosition = useCallback(() => {
    if (scrollViewRef.current) {
      // Save current scroll offset for restoration
      shouldRestoreScroll.current = true;
    }
  }, []);

  // Fetch journal entries from API
  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      
      const response = await JournalAPI.getEntries({});
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

  // Restore scroll position after data loads
  const restoreScrollPosition = useCallback(() => {
    if (shouldRestoreScroll.current && scrollViewRef.current && filteredEntries.length > 0) {
      const timer = setTimeout(() => {
        try {
          if (scrollPosition.current.offset > 0) {
            scrollViewRef.current?.scrollTo({
              y: scrollPosition.current.offset,
              animated: false,
            });
          }
          shouldRestoreScroll.current = false;
        } catch (error) {
          console.log('Failed to restore scroll position:', error);
          shouldRestoreScroll.current = false;
        }
      }, 100); // Small delay to ensure content is rendered

      return () => clearTimeout(timer);
    }
  }, [filteredEntries]);

  // Fetch journal entries when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Test with a small delay
      const timer = setTimeout(() => {
        fetchEntries();
        fetchTags();
      }, 500); // 500ms delay

      return () => {
        clearTimeout(timer);
        saveScrollPosition();
      };
    }, []) // Use empty dependency array to avoid circular dependency
  );
  
  // Filter entries whenever search query, selected tags, base entries, or hidden mode changes
  useEffect(() => {
    filterEntries();
  }, [searchQuery, selectedTags, entries, isHiddenMode]);

  // Restore scroll position after filtered entries change
  useEffect(() => {
    restoreScrollPosition();
  }, [restoreScrollPosition]);
  
  // Handle refresh
  const onRefresh = () => {
    setIsRefreshing(true);
    fetchEntries();
  };
  
  // Filter entries based on search query and selected tags
  const filterEntries = () => {
    let processedEntries = [...entries];
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      processedEntries = processedEntries.filter(entry => 
        entry.title.toLowerCase().includes(query) || 
        entry.content.toLowerCase().includes(query)
      );
    }
    
    // Filter by selected tags
    if (selectedTags.length > 0) {
      processedEntries = processedEntries.filter(entry => 
        selectedTags.every(selectedTagName => 
          entry.tags.some(tagObject => tagObject.name === selectedTagName)
        )
      );
    }

    // Filter by hidden mode status
    if (!isHiddenMode) {
      processedEntries = processedEntries.filter(entry => 
        !entry.tags.some(tagObject => tagObject.name === HIDDEN_ENTRY_TAG)
      );
    }
    // If isHiddenMode is true, all entries (that match search/tags) are shown
    
    setFilteredEntries(processedEntries);
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
    // Navigate to Record modal in the parent MainStack
    navigation.navigate('Record');
  };
  
  // Navigate to entry detail screen
  const handleEntryPress = (entry: JournalEntry) => {
    console.log('Entry pressed:', entry.id);
    navigation.navigate('JournalEntryDetail', { entryId: entry.id.toString() });
  };
  
  // Group entries by month for SectionList
  const getSectionData = () => {
    const grouped: { [key: string]: JournalEntry[] } = {};
    
    filteredEntries.forEach(entry => {
      const date = new Date(entry.entry_date);
      const monthYear = format(date, 'MMMM yyyy');
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      
      grouped[monthYear].push(entry);
    });
    
    const sections = Object.entries(grouped).map(([month, entries]) => ({
      title: month,
      data: entries,
    }));
    
    return sections;
  };
  
  // Scroll to top functionality
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Handle scroll events to save position and show/hide scroll-to-top button
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    scrollPosition.current.offset = contentOffset.y;
    
    // Show scroll-to-top button when scrolled down more than 200px
    setShowScrollToTop(contentOffset.y > 200);
  }, []);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: 0,
        animated: true,
      });
    }
  }, []);
  
  return (
    <View style={styles.container}>
      <ScreenHeader title="Journal" />
      
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
      
      <SafeScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {isLoading ? (
          <View style={styles.skeletonContainer}>
            {Array.from({ length: 5 }, (_, index) => (
              <JournalCardSkeleton key={`skeleton-${index}`} />
            ))}
          </View>
        ) : (
          <>
            {filteredEntries.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="journal-outline" size={theme.spacing.xxl * 1.5} color={theme.colors.disabled} />
                <Text style={styles.emptyText}>No journal entries found</Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery || selectedTags.length > 0 || !isHiddenMode && entries.some(e => e.tags.some(t=>t.name === HIDDEN_ENTRY_TAG)) 
                    ? 'Try changing your search or filters, or check hidden mode.'
                    : 'Tap the + button to create your first entry'}
                </Text>
              </View>
            ) : (
              <>
                {getSectionData().map((section, sectionIndex) => (
                  <View key={section.title} style={styles.monthSection}>
                    <Text style={styles.monthTitle}>{section.title}</Text>
                    {section.data.map((entry, entryIndex) => (
                      <JournalCard 
                        key={`journal-entry-${entry.id}-${entryIndex}`}
                        entry={entry}
                        onPress={() => handleEntryPress(entry)}
                      />
                    ))}
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </SafeScrollView>
      
      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <TouchableOpacity
          style={styles.scrollToTopButton}
          onPress={scrollToTop}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="chevron-up" 
            size={24} 
            color={theme.colors.white} 
          />
        </TouchableOpacity>
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
  skeletonContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.sm,
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
  safeBottomPadding: {
    // Base padding plus extra for navigation elements
    paddingTop: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 200 : 185,
  },
  scrollToTopButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 105, // Above the tab bar
    right: theme.spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
});

export default JournalScreen; 