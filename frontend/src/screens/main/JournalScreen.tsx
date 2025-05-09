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

// Journal entry interface
interface JournalEntry {
  id: string;
  title: string;
  content: string;
  entry_date: string;
  audio_url: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const JournalScreen = () => {
  const navigation = useNavigation();
  
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
      fetchEntries();
      fetchTags();
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
      setAvailableTags(response.data.map((tag: any) => tag.name));
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
    
    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(entry => 
        selectedTags.every(tag => entry.tags.includes(tag))
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
    navigation.navigate('Record');
  };
  
  // Navigate to entry detail screen
  const handleEntryPress = (entry: JournalEntry) => {
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
        keyExtractor={item => item.id}
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
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search entries..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
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
          <ActivityIndicator size="large" color="#7D4CDB" />
        </View>
      ) : (
        <>
          {filteredEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="journal-outline" size={64} color="#ddd" />
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
                  colors={['#7D4CDB']}
                />
              }
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7D4CDB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    fontSize: 16,
    color: '#333',
  },
  tagsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  tagChip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  tagChipSelected: {
    backgroundColor: '#7D4CDB',
  },
  tagText: {
    color: '#666',
    fontSize: 14,
  },
  tagTextSelected: {
    color: '#fff',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  monthSection: {
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
  },
});

export default JournalScreen; 