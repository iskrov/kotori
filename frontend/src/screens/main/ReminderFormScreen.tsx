import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Platform
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, addHours, parseISO } from 'date-fns';

import api from '../../services/api';

const ReminderFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { reminderId } = route.params as { reminderId?: string };
  
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date());
  const [isEnabled, setIsEnabled] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingReminder, setIsFetchingReminder] = useState(false);
  
  // Fetch reminder data if editing an existing reminder
  useEffect(() => {
    if (reminderId) {
      fetchReminderData();
    }
  }, [reminderId]);
  
  const fetchReminderData = async () => {
    try {
      setIsFetchingReminder(true);
      const response = await api.reminder.getReminder(reminderId as string);
      const reminder = response.data;
      
      setTitle(reminder.title || '');
      setNote(reminder.note || '');
      setReminderDate(new Date(reminder.reminder_time));
      setIsEnabled(reminder.is_active);
    } catch (error) {
      console.error('Error fetching reminder data', error);
      Alert.alert('Error', 'Failed to load reminder data');
    } finally {
      setIsFetchingReminder(false);
    }
  };
  
  const handleSave = async () => {
    // Validate form
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your reminder');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const reminderData = {
        title,
        note,
        reminder_time: reminderDate.toISOString(),
        is_active: isEnabled
      };
      
      if (reminderId) {
        // Update existing reminder
        await api.reminder.updateReminder(reminderId as string, reminderData);
        Alert.alert('Success', 'Reminder updated successfully');
      } else {
        // Create new reminder
        await api.reminder.createReminder(reminderData);
        Alert.alert('Success', 'Reminder created successfully');
      }
      
      navigation.goBack();
    } catch (error) {
      console.error('Error saving reminder', error);
      Alert.alert('Error', 'Failed to save reminder');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Date functions
  const addOneDay = () => {
    setReminderDate(prevDate => addDays(prevDate, 1));
  };
  
  const subtractOneDay = () => {
    setReminderDate(prevDate => addDays(prevDate, -1));
  };
  
  const addOneHour = () => {
    setReminderDate(prevDate => addHours(prevDate, 1));
  };
  
  const subtractOneHour = () => {
    setReminderDate(prevDate => addHours(prevDate, -1));
  };
  
  if (isFetchingReminder) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7D4CDB" />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Reminder title"
            value={title}
            onChangeText={setTitle}
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Add a note (optional)"
            value={note}
            onChangeText={setNote}
            textAlignVertical="top"
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Reminder Date & Time</Text>
          
          <View style={styles.dateDisplayContainer}>
            <Text style={styles.dateText}>
              {format(reminderDate, 'EEEE, MMMM d, yyyy')}
            </Text>
            <Text style={styles.timeText}>
              {format(reminderDate, 'h:mm a')}
            </Text>
          </View>
          
          <View style={styles.dateControlsContainer}>
            <View style={styles.dateControls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={subtractOneDay}
              >
                <Ionicons name="remove" size={20} color="#666" />
              </TouchableOpacity>
              
              <Text style={styles.controlLabel}>Date</Text>
              
              <TouchableOpacity
                style={styles.controlButton}
                onPress={addOneDay}
              >
                <Ionicons name="add" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.dateControls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={subtractOneHour}
              >
                <Ionicons name="remove" size={20} color="#666" />
              </TouchableOpacity>
              
              <Text style={styles.controlLabel}>Time</Text>
              
              <TouchableOpacity
                style={styles.controlButton}
                onPress={addOneHour}
              >
                <Ionicons name="add" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <View style={styles.switchContainer}>
          <Text style={styles.label}>Enable Reminder</Text>
          <Switch
            trackColor={{ false: '#e0e0e0', true: '#a387e2' }}
            thumbColor={isEnabled ? '#7D4CDB' : '#f4f3f4'}
            onValueChange={setIsEnabled}
            value={isEnabled}
          />
        </View>
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.button, 
            styles.saveButton,
            isLoading && styles.disabledButton
          ]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  dateDisplayContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 15,
    marginBottom: 10,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 16,
    color: '#666',
  },
  dateControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateControls: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '48%',
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 16,
    color: '#333',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#7D4CDB',
    marginLeft: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});

export default ReminderFormScreen; 