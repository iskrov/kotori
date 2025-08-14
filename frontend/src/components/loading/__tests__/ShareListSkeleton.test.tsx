import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ShareListSkeleton } from '../ShareListSkeleton';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('ShareListSkeleton', () => {
  it('renders default number of skeleton items', () => {
    renderWithTheme(<ShareListSkeleton />);
    
    // Should render 5 skeleton items by default (check by skeleton headers)
    const skeletonHeaders = screen.getAllByTestId('skeleton-header');
    expect(skeletonHeaders).toHaveLength(5);
  });

  it('renders custom number of skeleton items', () => {
    renderWithTheme(<ShareListSkeleton itemCount={3} />);
    
    const skeletonHeaders = screen.getAllByTestId('skeleton-header');
    expect(skeletonHeaders).toHaveLength(3);
  });

  it('shows search bar when showSearch is true', () => {
    renderWithTheme(<ShareListSkeleton showSearch={true} />);
    
    // Should have search container
    expect(screen.getByTestId('search-skeleton')).toBeTruthy();
  });

  it('hides search bar when showSearch is false', () => {
    renderWithTheme(<ShareListSkeleton showSearch={false} />);
    
    // Should not have search container
    expect(screen.queryByTestId('search-skeleton')).toBeFalsy();
  });

  it('renders skeleton structure correctly', () => {
    renderWithTheme(<ShareListSkeleton itemCount={1} />);
    
    // Should have header elements
    expect(screen.getByTestId('skeleton-header')).toBeTruthy();
    expect(screen.getByTestId('skeleton-content')).toBeTruthy();
    expect(screen.getByTestId('skeleton-footer')).toBeTruthy();
  });
});
