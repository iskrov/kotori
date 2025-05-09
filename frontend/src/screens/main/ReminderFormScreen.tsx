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
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

const ReminderFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
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
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Reminder title"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={theme.colors.textSecondary}
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
            placeholderTextColor={theme.colors.textSecondary}
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
                <Ionicons name="remove" size={theme.typography.fontSizes.xl} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              
              <Text style={styles.controlLabel}>Date</Text>
              
              <TouchableOpacity
                style={styles.controlButton}
                onPress={addOneDay}
              >
                <Ionicons name="add" size={theme.typography.fontSizes.xl} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.dateControls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={subtractOneHour}
              >
                <Ionicons name="remove" size={theme.typography.fontSizes.xl} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              
              <Text style={styles.controlLabel}>Time</Text>
              
              <TouchableOpacity
                style={styles.controlButton}
                onPress={addOneHour}
              >
                <Ionicons name="add" size={theme.typography.fontSizes.xl} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <View style={styles.switchContainer}>
          <Text style={styles.label}>Enable Reminder</Text>
          <Switch
            trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
            thumbColor={isEnabled ? (theme.isDarkMode ? theme.colors.background : theme.colors.white) : theme.colors.gray100}
            ios_backgroundColor={theme.colors.gray300}
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
            <ActivityIndicator size="small" color={theme.isDarkMode ? theme.colors.background : theme.colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
  scrollContainer: {
    flex: 1,
    paddingBottom: theme.spacing.md,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  input: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray800 : theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 5,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  textArea: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray800 : theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 5,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    minHeight: 100,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  dateDisplayContainer: {
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
    padding: theme.spacing.md,
    borderRadius: 5,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  dateText: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  timeText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  dateControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  dateControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.isDarkMode ? theme.colors.gray700 : theme.colors.gray100,
    padding: theme.spacing.sm,
    borderRadius: 5,
  },
  controlButton: {
    padding: theme.spacing.sm,
  },
  controlLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.text,
    marginHorizontal: theme.spacing.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  button: {
    borderRadius: 5,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.isDarkMode ? theme.colors.background : theme.colors.white,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamilies.bold,
  },
  cancelButton: {
    backgroundColor: theme.colors.gray200,
  },
  cancelButtonText: {
    color: theme.isDarkMode ? theme.colors.text : theme.colors.textSecondary,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
  },
});

export default ReminderFormScreen; 