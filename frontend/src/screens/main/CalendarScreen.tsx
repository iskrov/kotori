import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { JournalAPI } from '../../services/api';
import { encryptedJournalService } from '../../services/encryptedJournalService';
import { JournalEntry, Tag } from '../../types';
import JournalCard from '../../components/JournalCard';
import SafeScrollView from '../../components/SafeScrollView';
import ScreenHeader from '../../components/ScreenHeader';
import { CalendarSkeleton, JournalCardSkeleton } from '../../components/SkeletonLoader';
import { MainStackParamList, MainTabParamList, JournalStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { voicePhraseDetector } from '../../services/VoicePhraseDetector';
import { AppTheme } from '../../config/theme';
import { componentStyles, accessibilityTokens } from '../../styles/theme';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

type CalendarScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Calendar'>,
  StackNavigationProp<MainStackParamList>
>;

const CalendarScreen = () => {
  const navigation = useNavigation<CalendarScreenNavigationProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  // Set document title for web browsers
  useDocumentTitle('Calendar');
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [filteredEntriesForSelectedDate, setFilteredEntriesForSelectedDate] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSecretTags, setHasActiveSecretTags] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Scroll to top functionality
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollViewRef = useRef<any>(null);
  const scrollToTopOpacity = React.useRef(new Animated.Value(0)).current;
  
  // Handle scroll events to show/hide scroll-to-top button
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    
    // Show scroll-to-top button when scrolled down more than 200px
    const shouldShow = contentOffset.y > 200;
    if (shouldShow !== showScrollToTop) {
      setShowScrollToTop(shouldShow);
      Animated.timing(scrollToTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: false, // Changed to false for web compatibility
      }).start();
    }
  }, [showScrollToTop, scrollToTopOpacity]);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: 0,
        animated: true,
      });
    }
  }, []);
  
  // Check for active secret tags
  useEffect(() => {
    const checkActiveSecretTags = async () => {
      const activeSessions = voicePhraseDetector.getActiveSessions();
      setHasActiveSecretTags(activeSessions.length > 0);
    };
    
    checkActiveSecretTags();
    // Check periodically for secret tag changes
    const interval = setInterval(checkActiveSecretTags, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const visibleEntries = useMemo(() => {
    // For now, return all entries - filtering will happen server-side
    return allEntries;
  }, [allEntries, hasActiveSecretTags]);
  
  useFocusEffect(
    React.useCallback(() => {
      fetchEntries();
      // Also refresh entries for the currently selected date when returning to screen
      if (selectedDate) {
        fetchEntriesForSelectedDate(selectedDate);
      }
    }, [selectedDate])
  );
  
  useEffect(() => {
    // When the selectedDate changes, fetch entries for that date
    if (selectedDate) {
      fetchEntriesForSelectedDate(selectedDate);
    }
  }, [selectedDate]);

  // Keep a separate effect for when secret tag visibility changes
  useEffect(() => {
    if (selectedDate && allEntries.length > 0) {
      // Refresh filtered entries when secret tags change
      fetchEntriesForSelectedDate(selectedDate);
    }
  }, [hasActiveSecretTags]);
  
  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };
  
  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all entries for date indicators in the calendar using decryption-aware service
      const entries = await encryptedJournalService.getEntries({
        limit: 100,  // Fetch more entries to show indicators properly
        include_public: true
      });
      setAllEntries(entries as JournalEntry[]);
      
      // Also trigger filtering for the selected date
      await fetchEntriesForSelectedDate(selectedDate);
    } catch (error) {
      console.error('Error fetching journal entries', error);
      Alert.alert('Error', 'Failed to load journal entries');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    fetchEntries();
  }, [selectedDate]);
  
  // New function to fetch entries for a specific date
  const fetchEntriesForSelectedDate = async (date: Date) => {
    try {
      // Format date as YYYY-MM-DD for API query
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // Use start_date and end_date parameters to filter by exact date using decryption-aware service
      const entries = await encryptedJournalService.getEntries({
        // Filter by the specific date using both start_date and end_date
        start_date: formattedDate,
        end_date: formattedDate,
        include_public: true
      });
      
      setFilteredEntriesForSelectedDate(entries as JournalEntry[]);
    } catch (error) {
      console.error(`Error fetching entries for date ${format(date, 'yyyy-MM-dd')}`, error);
      setFilteredEntriesForSelectedDate([]);
    }
  };
  
  // Replace filterEntriesByDate with a function that triggers fetchEntriesForSelectedDate
  const filterEntriesByDate = () => {
    fetchEntriesForSelectedDate(selectedDate);
  };
  
  const goToPreviousMonth = () => {
    const previousMonth = new Date(currentMonth);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    setCurrentMonth(previousMonth);
  };
  
  const goToNextMonth = () => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentMonth(nextMonth);
  };
  
  const handleCreateEntry = () => {
    // Pass the selected date to the Record screen
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    navigation.navigate('Record', { 
      selectedDate: formattedDate
    });
  };
  
  const handleEntryPress = (entry: JournalEntry) => {
    // Navigate to JournalEntryDetail in the main stack
    navigation.navigate('JournalEntryDetail', { entryId: entry.id.toString() });
  };
  
  const renderDay = (day: Date) => {
    const dayString = format(day, 'd');
    const entriesOnDay = visibleEntries.filter(entry => {
      try {
        const entryDate = parseISO(entry.entry_date);
        return entryDate.getFullYear() === day.getFullYear() &&
               entryDate.getMonth() === day.getMonth() &&
               entryDate.getDate() === day.getDate();
      } catch (e) {
        console.error(`Error parsing entry_date for indicator: ${entry.entry_date}`, e);
        return false;
      }
    });
    
    const hasEntriesOnDay = entriesOnDay.length > 0;
    const isSelected = isSameDay(day, selectedDate);
    const isToday = isSameDay(day, new Date());
    
    const entryCountText = hasEntriesOnDay 
      ? ` — ${entriesOnDay.length} ${entriesOnDay.length === 1 ? 'entry' : 'entries'}`
      : '';
    
    return (
      <TouchableOpacity 
        style={[
          styles.dayContainer,
          isToday && styles.todayContainer,
          isSelected && styles.selectedDayContainer
        ]} 
        onPress={() => {
          setSelectedDate(day);
          // Fetch entries immediately for better user experience
          fetchEntriesForSelectedDate(day);
        }}
        accessibilityLabel={`${format(day, 'EEEE, MMMM d, yyyy')}${entryCountText}`}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityHint="Tap to view entries for this date"
      >
        <Text style={[
          styles.dayText,
          isToday && styles.todayText,
          isSelected && styles.selectedDayText
        ]}>
          {dayString}
        </Text>
        
        {hasEntriesOnDay && <View style={[
          styles.entryIndicator,
          isSelected && styles.selectedEntryIndicator
        ]} />}
      </TouchableOpacity>
    );
  };
  
  const renderEntry = ({ item, index }: { item: JournalEntry; index: number }) => (
    <JournalCard 
      entry={item}
      onPress={() => handleEntryPress(item)}
      key={`calendar-entry-${item.id}-${index}`}
    />
  );
  
  return (
    <View style={styles.container}>
      <ScreenHeader 
        title="Calendar" 
        showSecretTagIndicator={hasActiveSecretTags}
        secretTagText="Secret Tags Active"
      />
      
      <SafeScrollView 
        ref={scrollViewRef}
        style={{ flex: 1 }} 
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        onScroll={handleScroll}
        ref={scrollViewRef}
      >
        <View style={styles.calendarHeader}>
          <TouchableOpacity 
            style={styles.navButton}
            onPress={goToPreviousMonth}
            accessibilityLabel={`Go to previous month, ${format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1), 'MMMM yyyy')}`}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={theme.typography.fontSizes.xxl} color={theme.colors.text} />
          </TouchableOpacity>
          
          <Text style={styles.monthText}>
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
          
          <TouchableOpacity 
            style={styles.navButton}
            onPress={goToNextMonth}
            accessibilityLabel={`Go to next month, ${format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1), 'MMMM yyyy')}`}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-forward" size={theme.typography.fontSizes.xxl} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.calendar}>
          <View style={styles.weekDays}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={styles.weekDayText}>{day}</Text>
            ))}
          </View>
          
          <View style={styles.daysContainer}>
            {getDaysInMonth().map((day) => (
              <View key={day.toISOString()}>
                {renderDay(day)}
              </View>
            ))}
          </View>
        </View>
        
        <View style={styles.selectedDateContainer}>
          <Text style={styles.selectedDateText}>
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </Text>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={handleCreateEntry}
            accessibilityLabel={`Create new journal entry for ${format(selectedDate, 'MMMM d, yyyy')}`}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={theme.typography.fontSizes.xxl} color={theme.isDarkMode ? theme.colors.background : theme.colors.white} />
          </TouchableOpacity>
        </View>
        
        {isLoading ? (
          <View style={styles.skeletonContainer}>
            <CalendarSkeleton />
            {Array.from({ length: 3 }, (_, index) => (
              <JournalCardSkeleton key={`skeleton-${index}`} />
            ))}
          </View>
        ) : (
          <View style={styles.entriesContainer}>
            {filteredEntriesForSelectedDate.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={theme.spacing.xxl * 1.5} color={theme.colors.disabled} />
                <Text style={styles.emptyText}>
                  {"No entries for this date"}
                </Text>
                <TouchableOpacity 
                  style={styles.createButton}
                  onPress={handleCreateEntry}
                  accessibilityLabel={`Create journal entry for ${format(selectedDate, 'MMMM d, yyyy')}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.createButtonText}>Create Entry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.entriesListContainer}>
                <FlatList
                  data={filteredEntriesForSelectedDate}
                  renderItem={renderEntry}
                  keyExtractor={(item, index) => `calendar-list-${item.id}-${index}`}
                  contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                />
              </View>
            )}
          </View>
        )}
      </SafeScrollView>
      
      {/* Scroll to Top Button */}
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
          accessibilityLabel="Scroll to top of calendar"
          accessibilityRole="button"
          accessibilityHint="Scroll to the top of the calendar screen"
        >
          <Ionicons name="chevron-up" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const getStyles = (theme: AppTheme) => {
  const { width, height } = Dimensions.get('window');
  const isDesktop = width > 768; // Consider devices wider than 768px as desktop
  const isTablet = width > 480 && width <= 768;
  
  // Calculate responsive calendar dimensions
  const calendarMaxWidth = isDesktop ? 600 : width - (theme.spacing.md * 2);
  const calendarPadding = isDesktop ? theme.spacing.xl : theme.spacing.md;
  
  // Calculate day cell size - ensure calendar fits within screen
  const availableWidth = calendarMaxWidth - (theme.spacing.sm * 2);
  const dayCellSize = Math.min(
    availableWidth / 7, // Ensure 7 days fit in one row
    isDesktop ? 60 : 45  // Max size constraints
  );
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: calendarPadding,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      maxWidth: calendarMaxWidth,
      alignSelf: 'center',
      width: '100%',
    },
    monthText: {
      fontSize: theme.typography.fontSizes.lg,
      fontWeight: '600',
      color: theme.colors.textSecondary, // Using textSecondary for softer appearance
      fontFamily: theme.typography.fontFamilies.semiBold,
    },
    calendar: {
      ...componentStyles.card,
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      margin: theme.spacing.md,
      maxWidth: calendarMaxWidth,
      alignSelf: 'center',
      width: isDesktop ? calendarMaxWidth : '100%',
    },
    weekDays: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: theme.spacing.sm,
    },
    weekDayText: {
      fontSize: isDesktop ? theme.typography.fontSizes.sm : theme.typography.fontSizes.xs,
      color: theme.colors.textMuted, // Using textMuted for weekday headers
      fontFamily: theme.typography.fontFamilies.semiBold,
      width: dayCellSize,
      textAlign: 'center',
    },
    daysContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
    },
    dayContainer: {
      width: dayCellSize,
      height: dayCellSize,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      margin: 1,
      minHeight: accessibilityTokens.minTouchTarget,
    },
    todayContainer: {
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      borderWidth: 1,
    },
    selectedDayContainer: {
      backgroundColor: theme.colors.chipBackground, // Light teal background
      borderColor: theme.colors.primary,
      borderWidth: 2,
      borderStyle: 'solid',
    },
    dayText: {
      fontSize: isDesktop ? theme.typography.fontSizes.sm : theme.typography.fontSizes.xs,
      color: theme.colors.textSecondary, // Softer default text
      fontFamily: theme.typography.fontFamilies.regular,
    },
    todayText: {
      color: theme.colors.primary,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamilies.semiBold,
    },
    selectedDayText: {
      color: theme.colors.chipText, // Teal text on light teal background
      fontWeight: '600',
      fontFamily: theme.typography.fontFamilies.semiBold,
    },
    entryIndicator: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary, // Teal indicator dot
      position: 'absolute',
      bottom: isDesktop ? 6 : 4,
    },
    selectedEntryIndicator: {
      backgroundColor: theme.colors.primary, // Keep teal even when selected
    },
    selectedDateContainer: {
      padding: theme.spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      maxWidth: calendarMaxWidth,
      alignSelf: 'center',
      width: isDesktop ? calendarMaxWidth : '100%',
    },
    navButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      minWidth: accessibilityTokens.minTouchTarget,
      minHeight: accessibilityTokens.minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedDateText: {
      fontSize: theme.typography.fontSizes.md,
      fontWeight: '600',
      color: theme.colors.textSecondary, // Softer appearance
      fontFamily: theme.typography.fontFamilies.semiBold,
    },
    addButton: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      minWidth: accessibilityTokens.minTouchTarget,
      minHeight: accessibilityTokens.minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
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
    },
    entriesContainer: {
      flex: 1,
      maxWidth: calendarMaxWidth,
      alignSelf: 'center',
      width: isDesktop ? calendarMaxWidth : '100%',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
      minHeight: isDesktop ? 200 : 150,
    },
    emptyText: {
      fontSize: theme.typography.fontSizes.md,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      textAlign: 'center',
      fontFamily: theme.typography.fontFamilies.regular,
    },
    createButton: {
      ...componentStyles.primaryButton,
    },
    createButtonText: {
      color: theme.colors.white,
      fontSize: theme.typography.fontSizes.md,
      fontWeight: '600',
      fontFamily: theme.typography.fontFamilies.semiBold,
    },
    listContent: {
      padding: theme.spacing.md,
      paddingBottom: Platform.OS === 'ios' ? 60 : 50, // Extra bottom padding for navigation
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: 120, // Consistent spacing for scroll-to-top button
    },
    entriesListContainer: {
      minHeight: isDesktop ? 300 : 200,
    },
    scrollToTopButton: {
      position: 'absolute',
      bottom: 30, // Consistent with other screens
      right: 20,  // Consistent with other screens
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
};

export default CalendarScreen; 
 
 