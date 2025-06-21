import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../main/HomeScreen';
import { AuthContext } from '../../contexts/AuthContext';

// Mock the API services
jest.mock('../../services/api', () => ({
  JournalAPI: {
    getEntries: jest.fn(() => Promise.resolve({
      data: {
        items: [
          {
            id: '1',
            title: 'Test Journal',
            content: 'Test content',
            entry_date: '2023-03-27T12:00:00Z',
            tags: [],
            created_at: '2023-03-27T12:00:00Z',
            updated_at: '2023-03-27T12:00:00Z'
          }
        ],
        total: 1
      }
    })),
    searchEntries: jest.fn(() => Promise.resolve({
      data: {
        items: [
          {
            id: '2',
            title: 'Search Result',
            content: 'Found entry',
            entry_date: '2023-03-28T12:00:00Z',
            tags: [],
            created_at: '2023-03-28T12:00:00Z',
            updated_at: '2023-03-28T12:00:00Z'
          }
        ],
        total: 1
      }
    }))
  },
  ReminderAPI: {
    getReminders: jest.fn(() => Promise.resolve({
      data: {
        items: [
          {
            id: '1',
            title: 'Test Reminder',
            message: 'Remember to test',
            time: '10:00:00',
            frequency: 'daily',
            is_active: true,
            created_at: '2023-03-27T12:00:00Z',
            updated_at: '2023-03-27T12:00:00Z'
          }
        ],
        total: 1
      }
    }))
  }
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

describe('HomeScreen', () => {
  // Mock AuthContext value
  const mockAuthContextValue = {
    user: {
      id: '1',
      email: 'test@example.com',
      full_name: 'Test User',
      profile_picture: null,
    },
    isAuthenticated: true,
    isLoading: false,
  };
  
  const renderHomeScreen = () => {
    return render(
      <NavigationContainer>
        <AuthContext.Provider value={mockAuthContextValue}>
          <HomeScreen />
        </AuthContext.Provider>
      </NavigationContainer>
    );
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders welcome message with user name', async () => {
    const { getByText, findByText } = renderHomeScreen();
    
    // Wait for data to load
    await waitFor(() => {
      expect(getByText(/Welcome, Test User/)).toBeTruthy();
    });
  });
  
  it('navigates to journal entry detail when entry is pressed', async () => {
    const { findByText } = renderHomeScreen();
    
    // Wait for journal entry to load and then press it
    const journalEntry = await findByText('Test Journal');
    fireEvent.press(journalEntry);
    
    // Check that navigate was called with the right parameters
    expect(mockNavigate).toHaveBeenCalledWith('JournalEntryDetail', { entryId: '1' });
  });
  
  it('navigates to journal entry form when new entry button is pressed', async () => {
    const { findByText } = renderHomeScreen();
    
    // Wait for the button to appear and press it
    const newEntryButton = await findByText('New Entry');
    fireEvent.press(newEntryButton);
    
    // Check that navigate was called with the right parameters
    expect(mockNavigate).toHaveBeenCalledWith('Record', {});
  });
  
  it('shows search results when search is performed', async () => {
    const { getByPlaceholderText, findByText } = renderHomeScreen();
    
    // Find the search input and enter a search query
    const searchInput = getByPlaceholderText('Search journal entries...');
    fireEvent.changeText(searchInput, 'search');
    
    // Trigger the search (simulate pressing the search key)
    fireEvent(searchInput, 'submitEditing');
    
    // Wait for search results to appear
    const searchResult = await findByText('Search Result');
    expect(searchResult).toBeTruthy();
  });
  
  it('shows loading indicator when data is loading', () => {
    // Mock the API to delay returning data
    jest.mock('../../services/api', () => ({
      JournalAPI: {
        getEntries: jest.fn(() => new Promise(resolve => {
          setTimeout(() => {
            resolve({
              data: { items: [], total: 0 }
            });
          }, 1000);
        })),
        searchEntries: jest.fn(() => Promise.resolve({ data: { items: [], total: 0 } }))
      },
      ReminderAPI: {
        getReminders: jest.fn(() => Promise.resolve({ data: { items: [], total: 0 } }))
      }
    }));
    
    const { getByTestId } = renderHomeScreen();
    
    // Check for loading indicator
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });
}); 