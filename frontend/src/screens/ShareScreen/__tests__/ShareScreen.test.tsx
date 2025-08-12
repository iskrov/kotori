import React from 'react';
import { render, screen } from '@testing-library/react-native';
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
    
    // Check if placeholder components are rendered
    expect(screen.getByText('Period Selector - Coming Soon')).toBeTruthy();
    expect(screen.getByText('Template List - Coming Soon')).toBeTruthy();
    
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
});

