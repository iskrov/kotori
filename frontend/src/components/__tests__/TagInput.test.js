import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TagInput from '../TagInput';

describe('TagInput', () => {
  const mockTags = ['react', 'native', 'testing'];
  const mockOnAddTag = jest.fn();
  const mockOnRemoveTag = jest.fn();

  const renderTagInput = (props = {}) => {
    return render(
      <TagInput
        tags={mockTags}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
        {...props}
      />
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all provided tags', () => {
    const { getByText } = renderTagInput();
    
    mockTags.forEach(tag => {
      expect(getByText(tag)).toBeTruthy();
    });
  });

  it('renders input field for adding new tags', () => {
    const { getByPlaceholderText } = renderTagInput();
    
    expect(getByPlaceholderText('Add tag...')).toBeTruthy();
  });

  it('adds a new tag when text is submitted', () => {
    const { getByPlaceholderText } = renderTagInput();
    
    const input = getByPlaceholderText('Add tag...');
    fireEvent.changeText(input, 'newTag');
    fireEvent(input, 'submitEditing', { nativeEvent: { text: 'newTag' } });
    
    expect(mockOnAddTag).toHaveBeenCalledWith('newTag');
  });

  it('clears input after tag is added', () => {
    const { getByPlaceholderText } = renderTagInput();
    
    const input = getByPlaceholderText('Add tag...');
    fireEvent.changeText(input, 'newTag');
    fireEvent(input, 'submitEditing', { nativeEvent: { text: 'newTag' } });
    
    // Input should be cleared after submission
    expect(input.props.value).toBe('');
  });

  it('does not add empty tags', () => {
    const { getByPlaceholderText } = renderTagInput();
    
    const input = getByPlaceholderText('Add tag...');
    fireEvent.changeText(input, '');
    fireEvent(input, 'submitEditing', { nativeEvent: { text: '' } });
    
    expect(mockOnAddTag).not.toHaveBeenCalled();
  });

  it('does not add duplicate tags', () => {
    const { getByPlaceholderText } = renderTagInput();
    
    const input = getByPlaceholderText('Add tag...');
    fireEvent.changeText(input, 'react'); // 'react' is already in mockTags
    fireEvent(input, 'submitEditing', { nativeEvent: { text: 'react' } });
    
    expect(mockOnAddTag).not.toHaveBeenCalled();
  });

  it('removes a tag when delete button is pressed', () => {
    const { getAllByTestId } = renderTagInput();
    
    const deleteButtons = getAllByTestId('tag-delete-button');
    // Press the delete button for the first tag
    fireEvent.press(deleteButtons[0]);
    
    expect(mockOnRemoveTag).toHaveBeenCalledWith('react');
  });

  it('handles case-insensitive tag comparison', () => {
    const { getByPlaceholderText } = renderTagInput();
    
    const input = getByPlaceholderText('Add tag...');
    fireEvent.changeText(input, 'REACT'); // 'react' is already in mockTags but with different case
    fireEvent(input, 'submitEditing', { nativeEvent: { text: 'REACT' } });
    
    expect(mockOnAddTag).not.toHaveBeenCalled();
  });

  it('trims whitespace from tags', () => {
    const { getByPlaceholderText } = renderTagInput();
    
    const input = getByPlaceholderText('Add tag...');
    fireEvent.changeText(input, '  newTag  ');
    fireEvent(input, 'submitEditing', { nativeEvent: { text: '  newTag  ' } });
    
    expect(mockOnAddTag).toHaveBeenCalledWith('newTag');
  });

  it('renders custom placeholder text when provided', () => {
    const customPlaceholder = 'Enter tags here...';
    const { getByPlaceholderText } = renderTagInput({ placeholder: customPlaceholder });
    
    expect(getByPlaceholderText(customPlaceholder)).toBeTruthy();
  });
}); 