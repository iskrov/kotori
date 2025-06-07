import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { JournalAPI } from '../../services/api';
import { JournalEntry, Tag } from '../../types';
import JournalCard from '../../components/JournalCard';
import { MainStackParamList, MainTabParamList, JournalStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useHiddenMode } from '../../contexts/HiddenModeContext';
import { AppTheme } from '../../config/theme';

// --- Special Tag for Hidden Entries (Client-Side) ---
// TODO: Move this to a shared constants file
const HIDDEN_ENTRY_TAG = "_hidden_entry";
// ----------------------------------------------------

type CalendarScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Calendar'>,
  StackNavigationProp<MainStackParamList>
>;

const CalendarScreen = () => {
  const navigation = useNavigation<CalendarScreenNavigationProp>();
  const { theme } = useAppTheme();
  const { isHiddenMode } = useHiddenMode();
  const styles = getStyles(theme);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [filteredEntriesForSelectedDate, setFilteredEntriesForSelectedDate] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const visibleEntries = useMemo(() => {
    if (isHiddenMode) {
      return allEntries;
    }
    return allEntries.filter(entry => 
      !entry.tags.some((tag: Tag) => tag.name === HIDDEN_ENTRY_TAG)
    );
  }, [allEntries, isHiddenMode]);
  
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

  // Keep a separate effect for when visibility mode changes
  useEffect(() => {
    if (selectedDate && allEntries.length > 0) {
      // Refresh filtered entries when hidden mode changes
      fetchEntriesForSelectedDate(selectedDate);
    }
  }, [isHiddenMode]);
  
  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };
  
  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      // Fetch all entries for date indicators in the calendar
      const allEntriesResponse = await JournalAPI.getEntries({
        limit: 100,  // Fetch more entries to show indicators properly
        include_hidden: isHiddenMode
      });
      setAllEntries(allEntriesResponse.data);
      
      // Also trigger filtering for the selected date
      await fetchEntriesForSelectedDate(selectedDate);
    } catch (error) {
      console.error('Error fetching journal entries', error);
      Alert.alert('Error', 'Failed to load journal entries');
    } finally {
      setIsLoading(false);
    }
  };
  
  // New function to fetch entries for a specific date
  const fetchEntriesForSelectedDate = async (date: Date) => {
    try {
      // Format date as YYYY-MM-DD for API query
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // Use start_date and end_date parameters to filter by exact date
      const response = await JournalAPI.getEntries({
        // Filter by the specific date using both start_date and end_date
        start_date: formattedDate,
        end_date: formattedDate,
        include_hidden: isHiddenMode
      });
      
      // Filter entries based on hidden mode (additional client-side filtering)
      const entries = response.data;
      const filtered = isHiddenMode 
        ? entries 
        : entries.filter((entry: JournalEntry) => !entry.tags.some((tag: Tag) => tag.name === HIDDEN_ENTRY_TAG));
      
      setFilteredEntriesForSelectedDate(filtered);
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
    navigation.navigate('Journal', { 
      screen: 'JournalEntryDetail', 
      params: { entryId: entry.id } 
    });
  };
  
  const renderDay = (day: Date) => {
    const dayString = format(day, 'd');
    const hasEntriesOnDay = visibleEntries.some(entry => {
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
    
    const isSelected = isSameDay(day, selectedDate); 
    
    return (
      <TouchableOpacity 
        style={[
          styles.dayContainer,
          isSelected && styles.selectedDayContainer
        ]} 
        onPress={() => {
          setSelectedDate(day);
          // Fetch entries immediately for better user experience
          fetchEntriesForSelectedDate(day);
        }}
      >
        <Text style={[
          styles.dayText,
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
  
  const renderEntry = ({ item }: { item: JournalEntry }) => (
    <JournalCard 
      entry={item}
      onPress={() => handleEntryPress(item)}
    />
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
      </View>
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={goToPreviousMonth}>
            <Ionicons name="chevron-back" size={theme.typography.fontSizes.xxl} color={theme.colors.text} />
          </TouchableOpacity>
          
          <Text style={styles.monthText}>
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
          
          <TouchableOpacity onPress={goToNextMonth}>
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
          >
            <Ionicons name="add" size={theme.typography.fontSizes.xxl} color={theme.isDarkMode ? theme.colors.background : theme.colors.white} />
          </TouchableOpacity>
        </View>
        
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
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
                >
                  <Text style={styles.createButtonText}>Create Entry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.entriesListContainer}>
                <FlatList
                  data={filteredEntriesForSelectedDate}
                  renderItem={renderEntry}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.listContent}
                  scrollEnabled={false} // Let parent ScrollView handle scrolling
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
    header: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      alignItems: 'center',
    },
    title: {
      fontSize: theme.typography.fontSizes.xl,
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamilies.bold,
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
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamilies.bold,
    },
    calendar: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.card,
      margin: theme.spacing.md,
      borderRadius: 8,
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
      color: theme.colors.textSecondary,
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
      borderRadius: 5,
      margin: 1,
    },
    selectedDayContainer: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
      borderRadius: 20,
    },
    dayText: {
      fontSize: isDesktop ? theme.typography.fontSizes.sm : theme.typography.fontSizes.xs,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamilies.regular,
    },
    selectedDayText: {
      color: theme.isDarkMode ? theme.colors.background : theme.colors.white,
      fontWeight: 'bold',
      fontFamily: theme.typography.fontFamilies.bold,
    },
    entryIndicator: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.secondary,
      position: 'absolute',
      bottom: isDesktop ? 6 : 4,
    },
    selectedEntryIndicator: {
      backgroundColor: theme.isDarkMode ? theme.colors.background : theme.colors.white,
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
    selectedDateText: {
      fontSize: theme.typography.fontSizes.md,
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamilies.bold,
    },
    addButton: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.sm,
      borderRadius: 20,
    },
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: 25,
    },
    createButtonText: {
      color: theme.isDarkMode ? theme.colors.background : theme.colors.white,
      fontSize: theme.typography.fontSizes.md,
      fontWeight: 'bold',
      fontFamily: theme.typography.fontFamilies.bold,
    },
    listContent: {
      padding: theme.spacing.md,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    entriesListContainer: {
      minHeight: isDesktop ? 300 : 200,
    },
  });
};

export default CalendarScreen; 
 
 