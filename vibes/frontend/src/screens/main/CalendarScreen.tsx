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

type CalendarScreenNavigationProp = StackNavigationProp<MainStackParamList>;
type JournalDetailNavigationProp = StackNavigationProp<JournalStackParamList, 'JournalEntryDetail'>;

const CalendarScreen = () => {
  const navigation = useNavigation<CalendarScreenNavigationProp>();
  const journalNavigation = useNavigation<JournalDetailNavigationProp>();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Replace useEffect with useFocusEffect to fetch data whenever the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Fetch entries when the screen gains focus
      fetchEntries();

      // Optional: Return a cleanup function if needed
      // return () => console.log('CalendarScreen blurred');
    }, []) // Dependency array is empty, so it runs on every focus
  );
  
  // Filter entries when selected date changes
  useEffect(() => {
    filterEntriesByDate();
  }, [selectedDate, entries]);
  
  // Generate days for the calendar
  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };
  
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
    }
  };
  
  // Filter entries by selected date
  const filterEntriesByDate = () => {
    const filtered = entries.filter(entry => {
      try {
        const entryDate = parseISO(entry.entry_date);
        // Explicitly compare Year, Month, and Day components
        // This avoids potential timezone nuances with isSameDay if entry_date has unexpected UTC offset
        return entryDate.getFullYear() === selectedDate.getFullYear() &&
               entryDate.getMonth() === selectedDate.getMonth() &&
               entryDate.getDate() === selectedDate.getDate();
      } catch (e) {
        console.error(`Error parsing entry_date: ${entry.entry_date}`, e);
        return false; // Ignore entries with invalid dates
      }
    });
    setFilteredEntries(filtered);
  };
  
  // Navigate to previous month
  const goToPreviousMonth = () => {
    const previousMonth = new Date(currentMonth);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    setCurrentMonth(previousMonth);
  };
  
  // Navigate to next month
  const goToNextMonth = () => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentMonth(nextMonth);
  };
  
  // Navigate to record screen to create a new entry
  const handleCreateEntry = () => {
    navigation.navigate('Record');
  };
  
  // Navigate to entry detail screen
  const handleEntryPress = (entry: JournalEntry) => {
    journalNavigation.navigate('JournalEntryDetail', { entryId: entry.id });
  };
  
  // Render calendar day
  const renderDay = (day: Date) => {
    const dayString = format(day, 'd');
    const hasEntries = entries.some(entry => {
      try {
        const entryDate = parseISO(entry.entry_date);
        // Use the same explicit comparison here for consistency
        return entryDate.getFullYear() === day.getFullYear() &&
               entryDate.getMonth() === day.getMonth() &&
               entryDate.getDate() === day.getDate();
      } catch (e) {
        // Log error but don't crash the indicator logic
        console.error(`Error parsing entry_date for indicator: ${entry.entry_date}`, e);
        return false;
      }
    });
    
    // isSameDay is fine for selection styling
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
  
  // Render journal entry
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
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.monthText}>
          {format(currentMonth, 'MMMM yyyy')}
        </Text>
        
        <TouchableOpacity onPress={goToNextMonth}>
          <Ionicons name="chevron-forward" size={24} color="#333" />
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
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#7D4CDB" />
        </View>
      ) : (
        <View style={styles.entriesContainer}>
          {filteredEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#ddd" />
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
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  calendar: {
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  weekDayText: {
    color: '#7D4CDB',
    fontWeight: '500',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingVertical: 10,
  },
  dayContainer: {
    height: 40,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
    borderRadius: 20,
  },
  selectedDayContainer: {
    backgroundColor: '#7D4CDB',
  },
  dayText: {
    fontSize: 16,
    color: '#333',
  },
  selectedDayText: {
    color: '#fff',
  },
  entryIndicator: {
    height: 4,
    width: 4,
    borderRadius: 2,
    backgroundColor: '#7D4CDB',
    marginTop: 2,
  },
  selectedEntryIndicator: {
    backgroundColor: '#fff',
  },
  selectedDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#7D4CDB',
    borderRadius: 20,
    height: 40,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entriesContainer: {
    flex: 1,
    marginHorizontal: 10,
    marginBottom: 10,
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
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999',
  },
  createButton: {
    marginTop: 20,
    backgroundColor: '#7D4CDB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  listContent: {
    padding: 10,
  },
});

export default CalendarScreen; 
 
 