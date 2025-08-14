import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Animated
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

// import { useAuth } from '../../contexts/AuthContext';
import { useHiddenMode } from '../../contexts/HiddenModeContext';
import { api } from '../../services/api';
import { encryptedJournalService } from '../../services/encryptedJournalService';
import { JournalEntry, Tag } from '../../types';
import JournalCard from '../../components/JournalCard';
import SafeScrollView from '../../components/SafeScrollView';
import ScreenHeader from '../../components/ScreenHeader';
import { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { logger } from '../../utils/logger';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { componentStyles, accessibilityTokens } from '../../styles/theme';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
// Greeting removed for calmer UI

// --- Special Tag for Hidden Entries (Client-Side) ---
// TODO: Move this to a shared constants file
const HIDDEN_ENTRY_TAG = "_hidden_entry";
// ----------------------------------------------------

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  StackNavigationProp<MainStackParamList>
>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  // Greeting removed: no need to read user name here
  const { theme } = useAppTheme();
  const { isHiddenMode } = useHiddenMode();
  const styles = getStyles(theme);
  
  // Set document title for web browsers
  useDocumentTitle('Home');
  
  // Personalized greeting removed for calmer UI
  
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState({
    totalEntries: 0,
    entriesToday: 0,
    entriesThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Scroll to top functionality
  const scrollViewRef = React.useRef<any>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollToTopOpacity = React.useRef(new Animated.Value(0)).current;

  // Greeting removed; only show date

  // Filter entries based on hidden mode
  const displayedEntries = useMemo(() => {
    if (isHiddenMode) {
      return recentEntries;
    }
    // Correctly check if any tag object has a name matching HIDDEN_ENTRY_TAG
    return recentEntries.filter(entry => 
      !entry.tags.some((tag: Tag) => tag.name === HIDDEN_ENTRY_TAG)
    );
  }, [recentEntries, isHiddenMode]);

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
      // Only log in debug mode and check for duplicate IDs
      const ids = recentEntries.map(entry => entry.id);
      const uniqueIds = [...new Set(ids)];
      if (ids.length !== uniqueIds.length) {
        logger.warn('HomeScreen: Duplicate entry IDs detected!', { ids, uniqueIds });
      }
    }
  }, [recentEntries]);

  // Log displayedEntries IDs when they change, for debugging key prop warning
  useEffect(() => {
    if (displayedEntries.length > 0) {
      // Only check for duplicate IDs in displayed entries
      const displayedIds = displayedEntries.map(entry => entry.id);
      const uniqueDisplayedIds = [...new Set(displayedIds)];
      if (displayedIds.length !== uniqueDisplayedIds.length) {
        logger.warn('HomeScreen: Duplicate displayed entry IDs detected!', { displayedIds, uniqueDisplayedIds });
      }
    }
  }, [displayedEntries]);

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const shouldShow = scrollY > 200;
    
    if (shouldShow !== showScrollToTop) {
      setShowScrollToTop(shouldShow);
      Animated.timing(scrollToTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: false, // Changed to false for web compatibility
      }).start();
    }
  };
  
  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user stats from the new backend endpoint with the correct prefix
      const statsResponse = await api.get('/api/users/me/stats');
      setStats({
        totalEntries: statsResponse.data.total_entries,
        entriesToday: statsResponse.data.entries_today,
        entriesThisWeek: statsResponse.data.entries_this_week,
      });
      
      // Fetch recent entries using decryption-aware service
      const entries = await encryptedJournalService.getEntries({
        limit: 1, // Only show 1 most recent entry on the home screen
        sort: 'entry_date:desc' // Explicitly request sorting if backend supports it
      });
      setRecentEntries(entries);
      
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
    // Navigate to Record modal in the parent MainStack
    navigation.navigate('Record');
  };

  const navigateToJournalList = () => {
    navigation.navigate('Journal', { screen: 'JournalList' });
  };

  const navigateToDetail = (entryId: number) => {
    // Navigate to JournalEntryDetail in the main stack
    navigation.navigate('JournalEntryDetail', { entryId: entryId.toString() });
  };

  const handleVibePress = (vibeId: string, tag: string) => {
    // Calm, non-gamified prompts (no emoji, neutral tone)
    const prompts: Record<string, string> = {
      grateful: 'What are you thankful for today?',
      reflect: 'What thoughts would you like to note?',
      inspired: 'Capture your idea in a few sentences.',
      stressed: 'Write down what feels heavy right now.',
      plan: 'Outline your next small step.',
    };

    const prompt = prompts[vibeId];
    navigation.navigate('Record', {
      // Do not send any emoji-related param
      vibeTag: tag,
      prefilledPrompt: prompt,
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
    <View style={styles.container}>
      <ScreenHeader title="Home" />
      
      <SafeScrollView 
        ref={scrollViewRef}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />
          ) : undefined
        }
      >
        <View style={styles.greetingContainer}>
          <View style={styles.greetingCard}>
            <View style={styles.greetingContent}>
              <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
            </View>
          </View>
        </View>

              <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Moments Captured</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.entriesToday}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.weekValue]}>{stats.entriesThisWeek}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.totalValue]}>{stats.totalEntries}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Quick Prompts Section */}
      <View style={styles.vibeContainer}>
        <Text style={styles.vibeTitle}>Quick Prompts</Text>
        <View style={styles.vibeButtonsContainer}>
          <TouchableOpacity 
            style={styles.vibeButton}
            onPress={() => handleVibePress('grateful', 'gratitude')}
            activeOpacity={0.7}
            accessibilityLabel="Grateful mood - Record what you're thankful for"
            accessibilityRole="button"
          >
            <Ionicons name="heart-outline" size={24} color={theme.colors.primary} style={styles.vibeIcon} />
            <Text style={styles.vibeLabel}>Grateful</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.vibeButton}
            onPress={() => handleVibePress('reflect', 'reflection')}
            activeOpacity={0.7}
            accessibilityLabel="Reflective mood - Record your thoughts"
            accessibilityRole="button"
          >
            <Ionicons name="book-outline" size={24} color={theme.colors.primary} style={styles.vibeIcon} />
            <Text style={styles.vibeLabel}>Reflective</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.vibeButton}
            onPress={() => handleVibePress('inspired', 'idea')}
            activeOpacity={0.7}
            accessibilityLabel="Inspired mood - Capture your ideas"
            accessibilityRole="button"
          >
            <Ionicons name="bulb-outline" size={24} color={theme.colors.primary} style={styles.vibeIcon} />
            <Text style={styles.vibeLabel}>Inspired</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.vibeButton}
            onPress={() => handleVibePress('stressed', 'stress')}
            activeOpacity={0.7}
            accessibilityLabel="Stressed mood - Unload what's weighing you down"
            accessibilityRole="button"
          >
            <Ionicons name="rainy-outline" size={24} color={theme.colors.primary} style={styles.vibeIcon} />
            <Text style={styles.vibeLabel}>Stressed</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.vibeButton}
            onPress={() => handleVibePress('plan', 'plan')}
            activeOpacity={0.7}
            accessibilityLabel="Planning mood - Record your goals and next steps"
            accessibilityRole="button"
          >
            <Ionicons name="radio-button-on-outline" size={24} color={theme.colors.primary} style={styles.vibeIcon} />
            <Text style={styles.vibeLabel}>Planning</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Last Entry</Text>
          <Text style={styles.sectionDate}>{format(new Date(), 'EEE, MMM d, yyyy')}</Text>
        </View>
        <TouchableOpacity 
          onPress={navigateToJournalList}
          accessibilityLabel="View all journal entries"
          accessibilityRole="button"
        >
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {displayedEntries.length > 0 ? (
        <JournalCard 
          key={`home-entry-${displayedEntries[0].id}`} 
          entry={displayedEntries[0]} 
          onPress={() => navigateToDetail(displayedEntries[0].id)}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={theme.spacing.xxl} color={theme.colors.disabled} />
          <Text style={styles.emptyText}>No journal entries yet</Text>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={navigateToRecord}
            accessibilityLabel="Start journaling - Create your first entry"
            accessibilityRole="button"
          >
            <Text style={styles.startButtonText}>Start Journaling</Text>
          </TouchableOpacity>
        </View>
      )}
      </SafeScrollView>
      
      {/* Scroll to top button */}
      <Animated.View 
        style={[
          styles.scrollToTopButton,
          {
            opacity: scrollToTopOpacity,
            transform: [{
              scale: scrollToTopOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              })
            }]
          }
        ]}
        pointerEvents={showScrollToTop ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={styles.scrollToTopButtonInner}
          onPress={scrollToTop}
          activeOpacity={0.7}
          accessibilityLabel="Scroll to top of home screen"
          accessibilityRole="button"
          accessibilityHint="Scroll to the top of the home screen"
        >
          <Ionicons name="chevron-up" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// Function to generate styles based on the theme
const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Consistent spacing for scroll-to-top button
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  greetingContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  greetingCard: {
    ...componentStyles.card,
    padding: theme.spacing.lg,
  },
  greetingContent: {
    alignItems: 'center', // Center the content horizontally
  },
  greeting: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    lineHeight: theme.typography.lineHeights.tight * theme.typography.fontSizes.xl,
  },

  date: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: theme.typography.lineHeights.normal * theme.typography.fontSizes.lg,
    textAlign: 'center', // Center the date text
  },
  statsContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  statsTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statCard: {
    ...componentStyles.card,
    padding: theme.spacing.md,
    alignItems: 'center',
    flex: 1,
    minHeight: 80,
  },
  statValue: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.xs,
  },
  weekValue: {
    color: theme.colors.secondary,
  },
  totalValue: {
    color: theme.colors.accent,
  },
  statLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
    textAlign: 'center',
    height: 16, // Fixed height for consistent alignment
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: '600',
    color: theme.colors.textSecondary, // Using textSecondary for softer appearance
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  sectionDate: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: 2,
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
    ...componentStyles.primaryButton,
    marginTop: theme.spacing.md,
  },
  startButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  // Vibe section styles
  vibeContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  vibeTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  vibeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vibeButton: {
    ...componentStyles.card,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '18%',
    minHeight: accessibilityTokens.minTouchTarget,
  },
  vibeIcon: {
    marginBottom: theme.spacing.xs,
  },
  vibeLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
    textAlign: 'center',
  },
  scrollToTopButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 1000,
  },
  scrollToTopButtonInner: {
    width: accessibilityTokens.minTouchTarget,
    height: accessibilityTokens.minTouchTarget,
    borderRadius: accessibilityTokens.minTouchTarget / 2,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md, // Using consistent soft shadows
  },
  
});

export default HomeScreen; 