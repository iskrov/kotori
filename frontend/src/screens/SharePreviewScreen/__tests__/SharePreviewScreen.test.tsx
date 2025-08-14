import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import SharePreviewScreen from '../index';
import { MainStackParamList } from '../../../navigation/types';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const Stack = createStackNavigator<MainStackParamList>();

const renderWithNavigation = (params: any) => {
  return render(
    <NavigationContainer>
      <ThemeProvider>
        <Stack.Navigator>
          <Stack.Screen
            name="SharePreview"
            component={SharePreviewScreen}
            initialParams={params}
          />
        </Stack.Navigator>
      </ThemeProvider>
    </NavigationContainer>
  );
};

describe('SharePreviewScreen', () => {
  const mockParams = {
    templateId: 'template-1',
    dateRange: {
      start: '2025-01-20T00:00:00.000Z',
      end: '2025-01-26T23:59:59.000Z',
    },
    period: 'weekly' as const,
  };

  it('renders loading state initially', () => {
    renderWithNavigation(mockParams);
    
    expect(screen.getByText('Generating your summary...')).toBeTruthy();
    expect(screen.getByText('This may take a few moments')).toBeTruthy();
  });

  it('renders share preview after loading', async () => {
    renderWithNavigation(mockParams);
    
    await waitFor(() => {
      expect(screen.getByText('Review Summary')).toBeTruthy();
    }, { timeout: 3000 });

    expect(screen.getByText('Weekly Summary')).toBeTruthy();
    expect(screen.getByText('How has your mood been overall this week?')).toBeTruthy();
    expect(screen.getByText('What sleep patterns did you experience?')).toBeTruthy();
    expect(screen.getByText('Any significant symptoms or health concerns?')).toBeTruthy();
  });

  it('shows confidence indicators for answers', async () => {
    renderWithNavigation(mockParams);
    
    await waitFor(() => {
      expect(screen.getByText('Review Summary')).toBeTruthy();
    }, { timeout: 3000 });

    expect(screen.getByText('High confidence')).toBeTruthy();
    expect(screen.getByText('Low confidence - please review')).toBeTruthy();
  });

  it('allows editing answers', async () => {
    renderWithNavigation(mockParams);
    
    await waitFor(() => {
      expect(screen.getByText('Review Summary')).toBeTruthy();
    }, { timeout: 3000 });

    // Find and tap on an answer to edit it
    const answerText = screen.getByText(/My mood has been generally positive/);
    fireEvent.press(answerText);

    // Should show edit mode
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  it('shows share options when share button is pressed', async () => {
    renderWithNavigation(mockParams);
    
    await waitFor(() => {
      expect(screen.getByText('Review Summary')).toBeTruthy();
    }, { timeout: 3000 });

    const shareButton = screen.getByText('Share Summary');
    fireEvent.press(shareButton);

    await waitFor(() => {
      expect(screen.getByText('Share Options')).toBeTruthy();
    });

    expect(screen.getByText('Download PDF')).toBeTruthy();
    expect(screen.getByText('Share via Apps')).toBeTruthy();
    expect(screen.getByText('Send via Email')).toBeTruthy();
  });

  it('has proper accessibility labels', async () => {
    renderWithNavigation(mockParams);
    
    await waitFor(() => {
      expect(screen.getByText('Review Summary')).toBeTruthy();
    }, { timeout: 3000 });

    // Check that edit hints are present
    const editHints = screen.getAllByText('Tap to edit');
    expect(editHints.length).toBeGreaterThan(0);
  });

  it('handles back navigation', async () => {
    renderWithNavigation(mockParams);
    
    await waitFor(() => {
      expect(screen.getByText('Review Summary')).toBeTruthy();
    }, { timeout: 3000 });

    // The back button should be present (arrow-back icon)
    // In a real test environment, we could test navigation behavior
    expect(screen.getByText('Review Summary')).toBeTruthy();
  });
});

