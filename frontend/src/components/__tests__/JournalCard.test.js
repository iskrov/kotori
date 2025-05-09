import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import JournalCard from '../JournalCard';

describe('JournalCard', () => {
  const mockEntry = {
    id: '1',
    title: 'Test Journal Entry',
    content: 'This is the content of the test journal entry.',
    entry_date: '2023-03-27T12:00:00Z',
    tags: ['test', 'journal'],
    created_at: '2023-03-27T12:00:00Z',
    updated_at: '2023-03-27T12:00:00Z'
  };

  const mockOnPress = jest.fn();

  const renderJournalCard = (props = {}) => {
    return render(
      <JournalCard 
        entry={mockEntry}
        onPress={mockOnPress}
        {...props}
      />
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders journal entry title and truncated content', () => {
    const { getByText } = renderJournalCard();
    
    expect(getByText('Test Journal Entry')).toBeTruthy();
    expect(getByText('This is the content of the test journal entry.')).toBeTruthy();
  });

  it('renders formatted date correctly', () => {
    const { getByText } = renderJournalCard();
    
    // Assuming the date formatter displays the date in a specific format
    // This test might need to be adjusted based on your actual date formatting
    expect(getByText(/Mar 27, 2023/)).toBeTruthy();
  });

  it('renders tags correctly', () => {
    const { getByText } = renderJournalCard();
    
    expect(getByText('test')).toBeTruthy();
    expect(getByText('journal')).toBeTruthy();
  });

  it('calls onPress handler when card is pressed', () => {
    const { getByTestId } = renderJournalCard();
    
    const cardContainer = getByTestId('journal-card');
    fireEvent.press(cardContainer);
    
    expect(mockOnPress).toHaveBeenCalledWith(mockEntry.id);
  });

  it('applies custom styles when provided', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByTestId } = renderJournalCard({ style: customStyle });
    
    const cardContainer = getByTestId('journal-card');
    
    // This test assumes that your component applies the style prop to the container
    expect(cardContainer.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining(customStyle)
      ])
    );
  });

  it('renders correctly with minimal entry data', () => {
    const minimalEntry = {
      id: '2',
      title: 'Minimal Entry',
      content: '',
      entry_date: '2023-03-28T12:00:00Z',
      tags: [],
      created_at: '2023-03-28T12:00:00Z',
      updated_at: '2023-03-28T12:00:00Z'
    };
    
    const { getByText, queryByText } = render(
      <JournalCard entry={minimalEntry} onPress={mockOnPress} />
    );
    
    expect(getByText('Minimal Entry')).toBeTruthy();
    expect(queryByText('No content')).toBeTruthy(); // Assuming your component shows 'No content' for empty content
  });
}); 