import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ShareErrorBoundary } from '../ShareErrorBoundary';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <Text>No error</Text>;
};

describe('ShareErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    renderWithTheme(
      <ShareErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ShareErrorBoundary>
    );
    
    expect(screen.getByText('No error')).toBeTruthy();
  });

  it('renders error UI when child component throws', () => {
    renderWithTheme(
      <ShareErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ShareErrorBoundary>
    );
    
    expect(screen.getByText('Something Went Wrong')).toBeTruthy();
    expect(screen.getByText('Test error message')).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
    expect(screen.getByText('Go Back')).toBeTruthy();
  });

  it('calls onError callback when error occurs', () => {
    const mockOnError = jest.fn();
    
    renderWithTheme(
      <ShareErrorBoundary onError={mockOnError}>
        <ThrowError shouldThrow={true} />
      </ShareErrorBoundary>
    );
    
    expect(mockOnError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('resets error state when retry button is pressed', () => {
    const { rerender } = renderWithTheme(
      <ShareErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ShareErrorBoundary>
    );
    
    // Should show error UI
    expect(screen.getByText('Something Went Wrong')).toBeTruthy();
    
    // Press retry button
    const retryButton = screen.getByText('Try Again');
    fireEvent.press(retryButton);
    
    // Rerender with non-throwing component
    rerender(
      <ThemeProvider>
        <ShareErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ShareErrorBoundary>
      </ThemeProvider>
    );
    
    // Should show children again
    expect(screen.getByText('No error')).toBeTruthy();
  });

  it('resets error state when go back button is pressed', () => {
    const { rerender } = renderWithTheme(
      <ShareErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ShareErrorBoundary>
    );
    
    // Should show error UI
    expect(screen.getByText('Something Went Wrong')).toBeTruthy();
    
    // Press go back button
    const goBackButton = screen.getByText('Go Back');
    fireEvent.press(goBackButton);
    
    // Rerender with non-throwing component
    rerender(
      <ThemeProvider>
        <ShareErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ShareErrorBoundary>
      </ThemeProvider>
    );
    
    // Should show children again
    expect(screen.getByText('No error')).toBeTruthy();
  });

  it('uses custom fallback component when provided', () => {
    const CustomFallback: React.FC<any> = ({ error }) => (
      <Text>Custom error: {error.message}</Text>
    );
    
    renderWithTheme(
      <ShareErrorBoundary fallback={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </ShareErrorBoundary>
    );
    
    expect(screen.getByText('Custom error: Test error message')).toBeTruthy();
  });

  it('has proper accessibility labels', () => {
    renderWithTheme(
      <ShareErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ShareErrorBoundary>
    );
    
    const retryButton = screen.getByLabelText('Try again');
    const goBackButton = screen.getByLabelText('Go back');
    
    expect(retryButton).toBeTruthy();
    expect(goBackButton).toBeTruthy();
  });
});
