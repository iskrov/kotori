import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { JournalEntry } from '../../types';
import JournalCard from '../../components/JournalCard';
import { RootStackParamList } from '../../navigation/types';
import { logger } from '../../utils/logger';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  
  // Extract first name for greeting
  const getFirstName = () => {
    if (user?.full_name) {
      return user.full_name.split(' ')[0]; // Get first part of the name
    }
    return 'there'; // Fallback greeting
  };
  
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState({
    totalEntries: 0,
    currentStreak: 0,
    entriesThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Replace useEffect with useFocusEffect to fetch data whenever the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Fetch data when the screen gains focus
      fetchData();

      // Optional: Return a cleanup function if needed
      // return () => console.log('HomeScreen blurred');
    }, []) // Dependency array is empty, so it runs on every focus
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      logger.info("HomeScreen: Fetching data...");
      
      // Fetch user stats from the new backend endpoint with the correct prefix
      logger.info("HomeScreen: Fetching stats from /api/users/me/stats...");
      const statsResponse = await api.get('/api/users/me/stats');
      logger.info("HomeScreen: Stats response received", statsResponse.data);
      setStats({
        totalEntries: statsResponse.data.total_entries,
        currentStreak: statsResponse.data.current_streak,
        entriesThisWeek: statsResponse.data.entries_this_week,
      });
      
      // Fetch recent entries, ensuring descending order by entry_date
      logger.info("HomeScreen: Fetching recent journals from /api/journals...");
      const entriesResponse = await api.get('/api/journals', {
        params: { 
          limit: 3, 
          sort: 'entry_date:desc' // Explicitly request sorting if backend supports it
        }
      });
      logger.info(`HomeScreen: Recent entries response received (${entriesResponse.data.length} entries)`);
      setRecentEntries(entriesResponse.data);
      
    } catch (error: any) {
      // Log the specific error
      logger.error('HomeScreen: Error fetching home data', { 
        message: error.message, 
        status: error.response?.status,
        data: error.response?.data
      });
      // In development mode, don't show error alert
      if (!__DEV__) {
        Alert.alert('Error', 'Failed to load your data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const navigateToRecord = () => {
    navigation.navigate('Main', { screen: 'Record', params: undefined });
  };

  const navigateToJournalList = () => {
    navigation.navigate('Main', { screen: 'Journal', params: { screen: 'JournalList' } });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7D4CDB" testID="loading-indicator" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {getFirstName()}!</Text>
          <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalEntries}</Text>
          <Text style={styles.statLabel}>Total Entries</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.currentStreak}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.entriesThisWeek}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Entries</Text>
        <TouchableOpacity onPress={navigateToJournalList}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {recentEntries.length > 0 ? (
        recentEntries.map((entry) => (
          <JournalCard key={entry.id} entry={entry} />
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No journal entries yet</Text>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={navigateToRecord}
          >
            <Text style={styles.startButtonText}>Start Journaling</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    width: '30%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7D4CDB',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 16,
    color: '#7D4CDB',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#7D4CDB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default HomeScreen; 