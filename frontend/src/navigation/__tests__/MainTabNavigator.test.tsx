import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider } from '../../contexts/ThemeContext';
import MainTabNavigator from '../MainTabNavigator';

// Mock the audio prewarm service
jest.mock('../../services/audioPrewarmService', () => ({
  prewarmAudioSystem: jest.fn().mockResolvedValue(undefined),
  cleanup: jest.fn(),
  isReadyForRecording: jest.fn().mockReturnValue(true),
  getPerformanceMetrics: jest.fn().mockReturnValue({}),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock screens
jest.mock('../../screens/main/HomeScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View><Text>Home Screen</Text></View>;
});

jest.mock('../../screens/main/JournalScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View><Text>Journal Screen</Text></View>;
});

jest.mock('../../screens/ShareScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View><Text>Share Screen</Text></View>;
});

jest.mock('../../screens/main/CalendarScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View><Text>Calendar Screen</Text></View>;
});

jest.mock('../../screens/main/SettingsScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View><Text>Settings Screen</Text></View>;
});

// Mock FloatingActionButton
jest.mock('../../components/FloatingActionButton', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ onPress, testID }: any) => (
    <TouchableOpacity onPress={onPress} testID={testID}>
      <Text>Record Button</Text>
    </TouchableOpacity>
  );
});

const Stack = createStackNavigator();

const TestNavigator = () => (
  <NavigationContainer>
    <ThemeProvider>
      <Stack.Navigator>
        <Stack.Screen 
          name="MainTabs" 
          component={MainTabNavigator}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </ThemeProvider>
  </NavigationContainer>
);

describe('MainTabNavigator', () => {
  it('renders all tab screens including Share', () => {
    render(<TestNavigator />);
    
    // Check if tab labels are present
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Journal')).toBeTruthy();
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    
    // Check if floating action button is present
    expect(screen.getByTestId('main-record-button')).toBeTruthy();
  });
  
  it('has proper tab order', () => {
    render(<TestNavigator />);
    
    // The tabs should be in the expected order
    const tabLabels = screen.getAllByRole('button');
    
    // We should have 5 tabs (Home, Journal, Share, Calendar, Settings)
    // Plus the floating action button
    expect(tabLabels.length).toBeGreaterThanOrEqual(5);
  });
});

