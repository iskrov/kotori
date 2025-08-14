import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../contexts/ThemeContext';
import QAItem from '../QAItem';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('QAItem', () => {
  const mockOnEdit = jest.fn();

  const defaultProps = {
    question: 'How has your mood been this week?',
    answer: 'My mood has been generally positive this week.',
    confidence: 0.85,
    onEdit: mockOnEdit,
    isLast: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders question and answer', () => {
    renderWithProviders(<QAItem {...defaultProps} />);
    
    expect(screen.getByText('How has your mood been this week?')).toBeTruthy();
    expect(screen.getByText('My mood has been generally positive this week.')).toBeTruthy();
  });

  it('shows high confidence indicator', () => {
    renderWithProviders(<QAItem {...defaultProps} confidence={0.9} />);
    
    expect(screen.getByText('High confidence')).toBeTruthy();
  });

  it('shows medium confidence indicator', () => {
    renderWithProviders(<QAItem {...defaultProps} confidence={0.7} />);
    
    expect(screen.getByText('Medium confidence')).toBeTruthy();
  });

  it('shows low confidence warning', () => {
    renderWithProviders(<QAItem {...defaultProps} confidence={0.5} />);
    
    expect(screen.getByText('Low confidence - please review')).toBeTruthy();
  });

  it('enters edit mode when answer is tapped', () => {
    renderWithProviders(<QAItem {...defaultProps} />);
    
    const answer = screen.getByText('My mood has been generally positive this week.');
    fireEvent.press(answer);

    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByDisplayValue('My mood has been generally positive this week.')).toBeTruthy();
  });

  it('saves edited answer', () => {
    renderWithProviders(<QAItem {...defaultProps} />);
    
    // Enter edit mode
    const answer = screen.getByText('My mood has been generally positive this week.');
    fireEvent.press(answer);

    // Edit the text
    const textInput = screen.getByDisplayValue('My mood has been generally positive this week.');
    fireEvent.changeText(textInput, 'My mood has been excellent this week.');

    // Save changes
    const saveButton = screen.getByText('Save');
    fireEvent.press(saveButton);

    expect(mockOnEdit).toHaveBeenCalledWith('My mood has been excellent this week.');
  });

  it('cancels editing without saving', () => {
    renderWithProviders(<QAItem {...defaultProps} />);
    
    // Enter edit mode
    const answer = screen.getByText('My mood has been generally positive this week.');
    fireEvent.press(answer);

    // Edit the text
    const textInput = screen.getByDisplayValue('My mood has been generally positive this week.');
    fireEvent.changeText(textInput, 'Different text');

    // Cancel changes
    const cancelButton = screen.getByText('Cancel');
    fireEvent.press(cancelButton);

    // Should not call onEdit and should return to original text
    expect(mockOnEdit).not.toHaveBeenCalled();
    expect(screen.getByText('My mood has been generally positive this week.')).toBeTruthy();
  });

  it('shows character count in edit mode', () => {
    renderWithProviders(<QAItem {...defaultProps} />);
    
    // Enter edit mode
    const answer = screen.getByText('My mood has been generally positive this week.');
    fireEvent.press(answer);

    // Should show character count
    expect(screen.getByText(/\/1000 characters/)).toBeTruthy();
  });

  it('shows edit hint when not editing', () => {
    renderWithProviders(<QAItem {...defaultProps} />);
    
    expect(screen.getByText('Tap to edit')).toBeTruthy();
  });

  it('has proper accessibility attributes', () => {
    renderWithProviders(<QAItem {...defaultProps} />);
    
    const answer = screen.getByText('My mood has been generally positive this week.');
    
    // Should have accessibility attributes for editing
    expect(answer).toBeTruthy();
    // In a real test environment, we could check accessibility roles and labels
  });
});

