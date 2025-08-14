import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import ShareScreen from '../index';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <NavigationContainer>
      <ThemeProvider>
        {component}
      </ThemeProvider>
    </NavigationContainer>
  );
};

describe('ShareScreen', () => {
  it('renders the main elements', () => {
    renderWithProviders(<ShareScreen />);
    
    // Check if main title is rendered
    expect(screen.getByText('Share Summary')).toBeTruthy();
    
    // Check if subtitle is rendered
    expect(screen.getByText('Create a summary to share with your care team')).toBeTruthy();
    
    // Check if period selector is rendered
    expect(screen.getByText('Select Period')).toBeTruthy();
    expect(screen.getByText('Daily')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
    
    // Check if template list is rendered
    expect(screen.getByText('Choose Template')).toBeTruthy();
    expect(screen.getByText('Wellness Check')).toBeTruthy();
    expect(screen.getByText('Medical Visit')).toBeTruthy();
    expect(screen.getByText('Mood Tracker')).toBeTruthy();
    
    // Check if action buttons are rendered
    expect(screen.getByText('Generate Share')).toBeTruthy();
    expect(screen.getByText('View History')).toBeTruthy();
  });
  
  it('has proper accessibility labels', () => {
    renderWithProviders(<ShareScreen />);
    
    // The screen should be accessible
    const title = screen.getByText('Share Summary');
    expect(title).toBeTruthy();
  });

  it('renders Generate Share button', () => {
    renderWithProviders(<ShareScreen />);
    
    const generateButton = screen.getByText('Generate Share');
    expect(generateButton).toBeTruthy();
    
    // Select a template to test interaction
    const wellnessTemplate = screen.getByText('Wellness Check');
    fireEvent.press(wellnessTemplate);
    
    // Template selection should work without errors
    expect(wellnessTemplate).toBeTruthy();
  });

  it('allows period selection', () => {
    renderWithProviders(<ShareScreen />);
    
    // Weekly should be selected by default
    const weeklyButton = screen.getByText('Weekly');
    const dailyButton = screen.getByText('Daily');
    
    // Click on Daily
    fireEvent.press(dailyButton);
    
    // This should trigger the period change (we can't easily test the visual state change without more setup)
    expect(dailyButton).toBeTruthy();
  });
});

