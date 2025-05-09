import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { JournalAPI } from '../../services/api';
import { JournalEntry } from '../../types';
import JournalCard from '../../components/JournalCard';
import { MainStackParamList, JournalStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

type CalendarScreenNavigationProp = StackNavigationProp<MainStackParamList>;
type JournalDetailNavigationProp = StackNavigationProp<JournalStackParamList, 'JournalEntryDetail'>;

const CalendarScreen = () => {
  const navigation = useNavigation<CalendarScreenNavigationProp>();
  const journalNavigation = useNavigation<JournalDetailNavigationProp>();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useFocusEffect(
    React.useCallback(() => {
      fetchEntries();
    }, [])
  );
  
  useEffect(() => {
    filterEntriesByDate();
  }, [selectedDate, entries]);
  
  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };
  
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
    }
  };
  
  const filterEntriesByDate = () => {
    const filtered = entries.filter(entry => {
      try {
        const entryDate = parseISO(entry.entry_date);
        return entryDate.getFullYear() === selectedDate.getFullYear() &&
               entryDate.getMonth() === selectedDate.getMonth() &&
               entryDate.getDate() === selectedDate.getDate();
      } catch (e) {
        console.error(`Error parsing entry_date: ${entry.entry_date}`, e);
        return false;
      }
    });
    setFilteredEntries(filtered);
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
    navigation.navigate('Record');
  };
  
  const handleEntryPress = (entry: JournalEntry) => {
    journalNavigation.navigate('JournalEntryDetail', { entryId: entry.id });
  };
  
  const renderDay = (day: Date) => {
    const dayString = format(day, 'd');
    const hasEntries = entries.some(entry => {
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
        onPress={() => setSelectedDate(day)}
      >
        <Text style={[
          styles.dayText,
          isSelected && styles.selectedDayText
        ]}>
          {dayString}
        </Text>
        
        {hasEntries && <View style={[
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
            <View key={day.toISOString()} style={{ width: '14.28%' }}>
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
          {filteredEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={theme.spacing.xxl * 1.5} color={theme.colors.disabled} />
              <Text style={styles.emptyText}>No entries for this date</Text>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={handleCreateEntry}
              >
                <Text style={styles.createButtonText}>Create Entry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredEntries}
              renderItem={renderEntry}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.sm,
  },
  weekDayText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    width: '14.28%',
    textAlign: 'center',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayContainer: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 5,
  },
  selectedDayContainer: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    borderRadius: 20,
  },
  dayText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  selectedDayText: {
    color: theme.isDarkMode ? theme.colors.background : theme.colors.white,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamilies.bold,
  },
  entryIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.secondary,
    position: 'absolute',
    bottom: theme.spacing.xs,
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
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
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
});

export default CalendarScreen; 
 
 