import React, { useEffect, useState, useMemo } from 'react';
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
import { useHiddenMode } from '../../contexts/HiddenModeContext';
import { api } from '../../services/api';
import { JournalEntry, Tag } from '../../types';
import JournalCard from '../../components/JournalCard';
import { RootStackParamList } from '../../navigation/types';
import { logger } from '../../utils/logger';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

// --- Special Tag for Hidden Entries (Client-Side) ---
// TODO: Move this to a shared constants file
const HIDDEN_ENTRY_TAG = "_hidden_entry";
// ----------------------------------------------------

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isHiddenModeActive } = useHiddenMode();
  const styles = getStyles(theme);
  
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

  // Filter entries based on hidden mode
  const displayedEntries = useMemo(() => {
    if (isHiddenModeActive) {
      return recentEntries;
    }
    // Correctly check if any tag object has a name matching HIDDEN_ENTRY_TAG
    return recentEntries.filter(entry => 
      !entry.tags.some((tag: Tag) => tag.name === HIDDEN_ENTRY_TAG)
    );
  }, [recentEntries, isHiddenModeActive]);

  // Replace useEffect with useFocusEffect to fetch data whenever the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Fetch data when the screen gains focus
      fetchData();

      // Optional: Return a cleanup function if needed
      // return () => console.log('HomeScreen blurred');
    }, []) // Dependency array is empty, so it runs on every focus
  );

  // Log recentEntries IDs when they change, for debugging key prop warning
  useEffect(() => {
    if (recentEntries.length > 0) {
      logger.info(
        'HomeScreen: recentEntries IDs for key check:',
        recentEntries.map(entry => entry.id)
      );
    }
  }, [recentEntries]);

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
          limit: 10, // Fetch a bit more to account for potential hidden ones not shown
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

  const navigateToDetail = (entryId: string) => {
    // Navigate to JournalEntryDetail within the Journal stack, which is part of the Main tab
    navigation.navigate('Main', { 
      screen: 'Journal', 
      params: { 
        screen: 'JournalEntryDetail', 
        params: { entryId: entryId } 
      }
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} testID="loading-indicator" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        Platform.OS !== 'web' ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />
        ) : undefined
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

      {displayedEntries.length > 0 ? (
        displayedEntries.map((entry) => (
          <JournalCard 
            key={String(entry.id)} 
            entry={entry} 
            onPress={() => navigateToDetail(entry.id)}
          />
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={theme.spacing.xxl} color={theme.colors.disabled} />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  greeting: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  date: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  statCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    padding: theme.spacing.md,
    alignItems: 'center',
    width: '30%',
    elevation: theme.isDarkMode ? 1 : 2,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: theme.isDarkMode ? 1 : 2 },
    shadowOpacity: theme.isDarkMode ? 0.15 : 0.05,
    shadowRadius: theme.isDarkMode ? 2 : 3,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 1 : 0,
  },
  statValue: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  statLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  seeAllText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    marginTop: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  startButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 25,
    marginTop: theme.spacing.md,
  },
  startButtonText: {
    color: theme.isDarkMode ? theme.colors.background : theme.colors.white,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamilies.bold,
  },
});

export default HomeScreen; 