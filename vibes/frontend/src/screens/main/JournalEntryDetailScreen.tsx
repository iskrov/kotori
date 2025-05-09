import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import { JournalAPI } from '../../services/api';
import { JournalEntry, JournalStackParamList } from '../../types';

// Define the type for the route params
type JournalEntryDetailRouteProp = RouteProp<JournalStackParamList, 'JournalEntryDetail'>;

// Define the type for the navigation prop
type JournalEntryDetailNavigationProp = StackNavigationProp<JournalStackParamList, 'JournalEntryDetail'>;

const JournalEntryDetailScreen = () => {
  const navigation = useNavigation<JournalEntryDetailNavigationProp>();
  const route = useRoute<JournalEntryDetailRouteProp>();
  const { entryId } = route.params;
  
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchEntryDetails();
  }, [entryId]);
  
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
        <ActivityIndicator size="large" color="#7D4CDB" />
      </View>
    );
  }
  
  if (!entry) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#f44336" />
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
              <Ionicons name="pricetag-outline" size={20} color="#666" />
              <View style={styles.tagsList}>
                {entry.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    {/* Render tag name */}
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
          <Ionicons name="create-outline" size={24} color="#7D4CDB" />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={24} color="#f44336" />
          <Text style={[styles.actionText, { color: '#f44336' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  dateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  timeText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  entryText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  metadataContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metadataText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 10,
  },
  tag: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#666',
  },
  actionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  actionText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#7D4CDB',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#7D4CDB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default JournalEntryDetailScreen; 