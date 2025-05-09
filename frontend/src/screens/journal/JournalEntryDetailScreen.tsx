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
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import { JournalAPI } from '../../services/api';
import { JournalEntry, JournalStackParamList } from '../../types';

type JournalEntryDetailRouteProp = RouteProp<JournalStackParamList, 'JournalEntryDetail'>;

const JournalEntryDetailScreen = () => {
  const route = useRoute<JournalEntryDetailRouteProp>();
  const navigation = useNavigation();
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
      console.error('Error fetching journal entry details', error);
      Alert.alert('Error', 'Failed to load journal entry details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    if (entry) {
      navigation.navigate('JournalEntryForm', { journalId: entry.id });
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await JournalAPI.deleteEntry(entryId);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting journal entry', error);
              Alert.alert('Error', 'Failed to delete journal entry');
            }
          },
        },
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

  const formattedDate = format(parseISO(entry.entry_date), 'EEEE, MMMM d, yyyy');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleEdit}
          >
            <Ionicons name="create-outline" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={24} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        <Text style={styles.date}>{formattedDate}</Text>
        
        {entry.title && (
          <Text style={styles.title}>{entry.title}</Text>
        )}
        
        <Text style={styles.entryContent}>{entry.content}</Text>
        
        {entry.audio_url && (
          <View style={styles.audioContainer}>
            <TouchableOpacity style={styles.audioButton}>
              <Ionicons name="play" size={24} color="#fff" />
              <Text style={styles.audioText}>Play Recording</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {entry.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            <Text style={styles.tagsTitle}>Tags</Text>
            <View style={styles.tagsList}>
              {entry.tags.map((tag) => (
                <View key={tag.id} style={styles.tag}>
                  <Text style={styles.tagText}>{tag.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#7D4CDB',
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  date: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  entryContent: {
    fontSize: 18,
    color: '#333',
    lineHeight: 28,
  },
  audioContainer: {
    marginTop: 30,
    marginBottom: 20,
  },
  audioButton: {
    backgroundColor: '#7D4CDB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tagsContainer: {
    marginTop: 30,
    marginBottom: 20,
  },
  tagsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#EBE4FB',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#7D4CDB',
    fontSize: 14,
  },
});

export default JournalEntryDetailScreen; 