import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { AudioRecorderUI } from '../AudioRecorderUI';
import { ThemeProvider } from '../../contexts/ThemeContext';

// Mock dependencies
jest.mock('../../config/languageConfig', () => ({
  getLanguages: () => [
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
    { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
  ],
}));

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

const defaultProps = {
  transcriptSegments: [],
  setTranscriptSegments: jest.fn(),
  currentSegmentTranscript: '',
  isTranscribingSegment: false,
  lastTranscriptionResult: null,
  showAlternatives: false,
  selectedLanguage: 'en-US',
  isProcessing: false,
  canAcceptTranscript: true,
  pulseAnim: new Animated.Value(1),
  waveAnim1: new Animated.Value(0),
  waveAnim2: new Animated.Value(0),
  isRecording: false,
  recordingDuration: 0,
  permissionGranted: true,
  handleMicPress: jest.fn(),
  handleAcceptTranscript: jest.fn(),
  handleLanguageChange: jest.fn(),
  formatDuration: jest.fn().mockReturnValue('00:00'),
  setShowAlternatives: jest.fn(),
};

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('AudioRecorderUI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays existing content when provided', () => {
    const existingContent = 'This is existing journal content.';
    const { getByDisplayValue } = renderWithTheme(
      <AudioRecorderUI
        {...defaultProps}
        existingContent={existingContent}
      />
    );

    expect(getByDisplayValue(existingContent)).toBeTruthy();
  });

  it('combines existing content with new transcript segments', () => {
    const existingContent = 'This is existing content.';
    const transcriptSegments = ['This is new transcribed content.'];
    const expectedCombined = 'This is existing content.\n\nThis is new transcribed content.';
    
    const { getByDisplayValue } = renderWithTheme(
      <AudioRecorderUI
        {...defaultProps}
        existingContent={existingContent}
        transcriptSegments={transcriptSegments}
      />
    );

    expect(getByDisplayValue(expectedCombined)).toBeTruthy();
  });

  it('handles text input changes correctly with existing content', () => {
    const existingContent = 'Existing content.';
    const setTranscriptSegments = jest.fn();
    const { getByDisplayValue } = renderWithTheme(
      <AudioRecorderUI
        {...defaultProps}
        existingContent={existingContent}
        setTranscriptSegments={setTranscriptSegments}
      />
    );

    const textInput = getByDisplayValue(existingContent);
    
    // Simulate user adding new content after existing content
    const newText = 'Existing content.\n\nNew added content.';
    fireEvent.changeText(textInput, newText);

    // Should extract only the new part
    expect(setTranscriptSegments).toHaveBeenCalledWith(['New added content.']);
  });

  it('handles complete text replacement when existing content is removed', () => {
    const existingContent = 'Existing content.';
    const setTranscriptSegments = jest.fn();
    const { getByDisplayValue } = renderWithTheme(
      <AudioRecorderUI
        {...defaultProps}
        existingContent={existingContent}
        setTranscriptSegments={setTranscriptSegments}
      />
    );

    const textInput = getByDisplayValue(existingContent);
    
    // Simulate user completely replacing the content
    const newText = 'Completely new content.';
    fireEvent.changeText(textInput, newText);

    // Should treat as complete replacement
    expect(setTranscriptSegments).toHaveBeenCalledWith(['Completely new content.']);
  });

  it('works normally without existing content', () => {
    const transcriptSegments = ['New transcribed content.'];
    const { getByDisplayValue } = renderWithTheme(
      <AudioRecorderUI
        {...defaultProps}
        transcriptSegments={transcriptSegments}
      />
    );

    expect(getByDisplayValue('New transcribed content.')).toBeTruthy();
  });
}); 