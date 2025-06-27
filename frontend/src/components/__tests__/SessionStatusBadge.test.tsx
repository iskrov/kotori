/**
 * SessionStatusBadge Component Tests
 * 
 * Unit tests for the SessionStatusBadge component covering
 * different variants, countdown display, and health indicators.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SessionStatusBadge } from '../session/SessionStatusBadge';
import { SessionStatus } from '../../types/sessionIndicatorTypes';

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons'
}));

describe('SessionStatusBadge', () => {
  const mockSession: SessionStatus = {
    sessionId: 'test-session-1',
    tagName: 'Test Tag',
    isActive: true,
    isLocked: false,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    lastActivityAt: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
    deviceFingerprint: 'test-device-fingerprint',
    securityLevel: 'standard',
    remainingTimeMs: 10 * 60 * 1000, // 10 minutes
    healthScore: 95
  };

  it('renders compact variant correctly', () => {
    const { getByText, getByTestId } = render(
      <SessionStatusBadge
        session={mockSession}
        variant="compact"
        testID="test-badge"
      />
    );

    expect(getByTestId('test-badge')).toBeTruthy();
    expect(getByText('Test Tag')).toBeTruthy();
  });

  it('renders detailed variant correctly', () => {
    const { getByText, getByTestId } = render(
      <SessionStatusBadge
        session={mockSession}
        variant="detailed"
        testID="test-badge"
      />
    );

    expect(getByTestId('test-badge')).toBeTruthy();
    expect(getByText('Test Tag')).toBeTruthy();
    expect(getByText('STANDARD')).toBeTruthy();
    expect(getByText('95')).toBeTruthy();
  });

  it('renders minimal variant correctly', () => {
    const { getByTestId } = render(
      <SessionStatusBadge
        session={mockSession}
        variant="minimal"
        testID="test-badge"
      />
    );

    expect(getByTestId('test-badge')).toBeTruthy();
  });

  it('shows countdown when enabled', () => {
    const { getByText } = render(
      <SessionStatusBadge
        session={mockSession}
        showCountdown={true}
      />
    );

    // Should show some time format (minutes:seconds)
    expect(getByText(/\d+:\d+/)).toBeTruthy();
  });

  it('handles expired session correctly', () => {
    const expiredSession: SessionStatus = {
      ...mockSession,
      isActive: false,
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
      remainingTimeMs: 0
    };

    const { getByText } = render(
      <SessionStatusBadge
        session={expiredSession}
        variant="detailed"
      />
    );

    expect(getByText('Expired')).toBeTruthy();
  });

  it('shows locked status correctly', () => {
    const lockedSession: SessionStatus = {
      ...mockSession,
      isLocked: true
    };

    const { getByText } = render(
      <SessionStatusBadge
        session={lockedSession}
        variant="detailed"
      />
    );

    expect(getByText('Locked')).toBeTruthy();
  });

  it('handles press events', () => {
    const onPress = jest.fn();
    
    const { getByTestId } = render(
      <SessionStatusBadge
        session={mockSession}
        onPress={onPress}
        testID="test-badge"
      />
    );

    // Component should be touchable when onPress is provided
    expect(getByTestId('test-badge')).toBeTruthy();
  });

  it('displays correct accessibility label', () => {
    const { getByLabelText } = render(
      <SessionStatusBadge
        session={mockSession}
      />
    );

    expect(getByLabelText(/Session Test Tag, \d+:\d+ remaining/)).toBeTruthy();
  });

  it('handles different security levels', () => {
    const enhancedSession: SessionStatus = {
      ...mockSession,
      securityLevel: 'enhanced'
    };

    const { getByText } = render(
      <SessionStatusBadge
        session={enhancedSession}
        variant="detailed"
      />
    );

    expect(getByText('ENHANCED')).toBeTruthy();
  });

  it('shows health indicator when enabled', () => {
    const { getByText } = render(
      <SessionStatusBadge
        session={mockSession}
        variant="detailed"
        showHealthIndicator={true}
      />
    );

    expect(getByText('95')).toBeTruthy();
  });

  it('hides health indicator when disabled', () => {
    const { queryByText } = render(
      <SessionStatusBadge
        session={mockSession}
        variant="detailed"
        showHealthIndicator={false}
      />
    );

    expect(queryByText('95')).toBeNull();
  });
}); 