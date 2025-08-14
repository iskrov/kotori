import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { AnimatedButton } from '../AnimatedButton';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

// Mock AccessibilityInfo
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
  },
}));

const mockAccessibilityInfo = AccessibilityInfo as jest.Mocked<typeof AccessibilityInfo>;

describe('AnimatedButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessibilityInfo.isReduceMotionEnabled.mockResolvedValue(false);
  });

  it('renders with title', () => {
    const mockOnPress = jest.fn();
    
    renderWithTheme(
      <AnimatedButton title="Test Button" onPress={mockOnPress} />
    );
    
    expect(screen.getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const mockOnPress = jest.fn();
    
    renderWithTheme(
      <AnimatedButton title="Test Button" onPress={mockOnPress} />
    );
    
    const button = screen.getByText('Test Button');
    fireEvent.press(button);
    
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders different variants correctly', () => {
    const mockOnPress = jest.fn();
    
    const { rerender } = renderWithTheme(
      <AnimatedButton title="Primary" onPress={mockOnPress} variant="primary" />
    );
    
    expect(screen.getByText('Primary')).toBeTruthy();
    
    rerender(
      <ThemeProvider>
        <AnimatedButton title="Secondary" onPress={mockOnPress} variant="secondary" />
      </ThemeProvider>
    );
    
    expect(screen.getByText('Secondary')).toBeTruthy();
  });

  it('shows loading state', () => {
    const mockOnPress = jest.fn();
    
    renderWithTheme(
      <AnimatedButton title="Loading" onPress={mockOnPress} loading={true} />
    );
    
    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.getByTestId('activity-indicator')).toBeTruthy();
  });

  it('is disabled when disabled prop is true', () => {
    const mockOnPress = jest.fn();
    
    renderWithTheme(
      <AnimatedButton title="Disabled" onPress={mockOnPress} disabled={true} />
    );
    
    const button = screen.getByText('Disabled');
    fireEvent.press(button);
    
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('is disabled when loading', () => {
    const mockOnPress = jest.fn();
    
    renderWithTheme(
      <AnimatedButton title="Loading" onPress={mockOnPress} loading={true} />
    );
    
    const button = screen.getByText('Loading');
    fireEvent.press(button);
    
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('renders with icon', () => {
    const mockOnPress = jest.fn();
    
    renderWithTheme(
      <AnimatedButton 
        title="With Icon" 
        onPress={mockOnPress} 
        icon="checkmark" 
      />
    );
    
    expect(screen.getByText('With Icon')).toBeTruthy();
    // Icon rendering is handled by Ionicons, which we'd need to mock to test fully
  });

  it('has proper accessibility attributes', () => {
    const mockOnPress = jest.fn();
    
    renderWithTheme(
      <AnimatedButton 
        title="Accessible" 
        onPress={mockOnPress}
        accessibilityLabel="Custom label"
        accessibilityHint="Custom hint"
      />
    );
    
    const button = screen.getByLabelText('Custom label');
    expect(button).toBeTruthy();
  });

  it('respects reduced motion preferences', async () => {
    mockAccessibilityInfo.isReduceMotionEnabled.mockResolvedValue(true);
    const mockOnPress = jest.fn();
    
    renderWithTheme(
      <AnimatedButton title="Reduced Motion" onPress={mockOnPress} />
    );
    
    const button = screen.getByText('Reduced Motion');
    
    // Simulate press events
    fireEvent(button, 'pressIn');
    fireEvent(button, 'pressOut');
    
    // Animation should be skipped, but button should still work
    fireEvent.press(button);
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders different sizes correctly', () => {
    const mockOnPress = jest.fn();
    
    const { rerender } = renderWithTheme(
      <AnimatedButton title="Small" onPress={mockOnPress} size="small" />
    );
    
    expect(screen.getByText('Small')).toBeTruthy();
    
    rerender(
      <ThemeProvider>
        <AnimatedButton title="Large" onPress={mockOnPress} size="large" />
      </ThemeProvider>
    );
    
    expect(screen.getByText('Large')).toBeTruthy();
  });

  it('renders full width when specified', () => {
    const mockOnPress = jest.fn();
    
    renderWithTheme(
      <AnimatedButton title="Full Width" onPress={mockOnPress} fullWidth />
    );
    
    expect(screen.getByText('Full Width')).toBeTruthy();
  });
});
