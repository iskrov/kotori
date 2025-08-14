import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import ShareHistoryScreen from '../index';
import { MainStackParamList } from '../../../navigation/types';
import * as useShareHistory from '../../../hooks/useShareHistory';

// Mock dependencies
jest.mock('../../../hooks/useShareHistory');
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockUseShareHistory = useShareHistory as jest.Mocked<typeof useShareHistory>;

const Stack = createStackNavigator<MainStackParamList>();

const renderWithNavigation = () => {
  return render(
    <NavigationContainer>
      <ThemeProvider>
        <Stack.Navigator>
          <Stack.Screen
            name="ShareHistory"
            component={ShareHistoryScreen}
          />
        </Stack.Navigator>
      </ThemeProvider>
    </NavigationContainer>
  );
};

describe('ShareHistoryScreen', () => {
  const mockShareHistoryHook = {
    shares: [],
    loading: false,
    error: null,
    refreshing: false,
    fetchShares: jest.fn(),
    refreshShares: jest.fn(),
    deleteShare: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseShareHistory.useShareHistory.mockReturnValue(mockShareHistoryHook);
  });

  it('renders loading state', () => {
    mockUseShareHistory.useShareHistory.mockReturnValue({
      ...mockShareHistoryHook,
      loading: true,
    });

    renderWithNavigation();

    expect(screen.getByText('Loading your shares...')).toBeTruthy();
  });

  it('renders error state', () => {
    mockUseShareHistory.useShareHistory.mockReturnValue({
      ...mockShareHistoryHook,
      error: 'Network error',
    });

    renderWithNavigation();

    expect(screen.getByText('Failed to Load History')).toBeTruthy();
    expect(screen.getByText('Network error')).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  it('renders empty state when no shares exist', () => {
    renderWithNavigation();

    expect(screen.getByText('No Shares Yet')).toBeTruthy();
    expect(screen.getByText(/You haven't created any shares yet/)).toBeTruthy();
  });

  it('renders share list when shares exist', () => {
    const mockShares = [
      {
        id: 'share-1',
        title: 'Weekly Summary',
        template_name: 'Medical Visit',
        status: 'active' as const,
        is_expired: false,
        days_until_expiry: 5,
        created_at: '2025-01-20T10:00:00Z',
        expires_at: '2025-01-27T10:00:00Z',
        access_count: 2,
        content: { answers: [] },
        share_token: 'token-1',
      },
    ];

    mockUseShareHistory.useShareHistory.mockReturnValue({
      ...mockShareHistoryHook,
      shares: mockShares,
    });

    renderWithNavigation();

    expect(screen.getByText('Weekly Summary')).toBeTruthy();
    expect(screen.getByText('Medical Visit')).toBeTruthy();
  });

  it('shows search functionality', () => {
    renderWithNavigation();

    // Open search
    const searchButton = screen.getByTestId('search-button') || screen.getAllByRole('button')[1];
    fireEvent.press(searchButton);

    expect(screen.getByPlaceholderText('Search shares...')).toBeTruthy();
  });

  it('filters shares based on search query', () => {
    const mockShares = [
      {
        id: 'share-1',
        title: 'Weekly Summary',
        template_name: 'Medical Visit',
        status: 'active' as const,
        is_expired: false,
        days_until_expiry: 5,
        created_at: '2025-01-20T10:00:00Z',
        expires_at: '2025-01-27T10:00:00Z',
        access_count: 2,
        content: { answers: [] },
        share_token: 'token-1',
      },
      {
        id: 'share-2',
        title: 'Monthly Report',
        template_name: 'Wellness Check',
        status: 'active' as const,
        is_expired: false,
        days_until_expiry: 10,
        created_at: '2025-01-15T10:00:00Z',
        expires_at: '2025-01-30T10:00:00Z',
        access_count: 0,
        content: { answers: [] },
        share_token: 'token-2',
      },
    ];

    mockUseShareHistory.useShareHistory.mockReturnValue({
      ...mockShareHistoryHook,
      shares: mockShares,
    });

    renderWithNavigation();

    // Open search
    const searchButton = screen.getAllByRole('button')[1];
    fireEvent.press(searchButton);

    // Search for "weekly"
    const searchInput = screen.getByPlaceholderText('Search shares...');
    fireEvent.changeText(searchInput, 'weekly');

    // Should show only the weekly summary
    expect(screen.getByText('Weekly Summary')).toBeTruthy();
    expect(screen.queryByText('Monthly Report')).toBeFalsy();
  });

  it('shows no results state when search returns no matches', () => {
    const mockShares = [
      {
        id: 'share-1',
        title: 'Weekly Summary',
        template_name: 'Medical Visit',
        status: 'active' as const,
        is_expired: false,
        days_until_expiry: 5,
        created_at: '2025-01-20T10:00:00Z',
        expires_at: '2025-01-27T10:00:00Z',
        access_count: 2,
        content: { answers: [] },
        share_token: 'token-1',
      },
    ];

    mockUseShareHistory.useShareHistory.mockReturnValue({
      ...mockShareHistoryHook,
      shares: mockShares,
    });

    renderWithNavigation();

    // Open search
    const searchButton = screen.getAllByRole('button')[1];
    fireEvent.press(searchButton);

    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText('Search shares...');
    fireEvent.changeText(searchInput, 'nonexistent');

    expect(screen.getByText('No Results Found')).toBeTruthy();
    expect(screen.getByText(/No shares match "nonexistent"/)).toBeTruthy();
  });

  it('calls fetchShares when screen comes into focus', () => {
    renderWithNavigation();

    expect(mockShareHistoryHook.fetchShares).toHaveBeenCalled();
  });

  it('retries loading when try again button is pressed', () => {
    mockUseShareHistory.useShareHistory.mockReturnValue({
      ...mockShareHistoryHook,
      error: 'Network error',
    });

    renderWithNavigation();

    const retryButton = screen.getByText('Try Again');
    fireEvent.press(retryButton);

    expect(mockShareHistoryHook.fetchShares).toHaveBeenCalled();
  });

  it('handles back navigation', () => {
    const mockGoBack = jest.fn();
    jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
      goBack: mockGoBack,
      navigate: jest.fn(),
    });

    renderWithNavigation();

    // The back button should be the first touchable element in the header
    const backButton = screen.getAllByRole('button')[0];
    fireEvent.press(backButton);

    expect(mockGoBack).toHaveBeenCalled();
  });
});
