import { renderHook, act } from '@testing-library/react-native';
import { useShareHistory } from '../useShareHistory';
import shareService from '../../services/shareService';

// Mock dependencies
jest.mock('../../services/shareService');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockShareService = shareService as jest.Mocked<typeof shareService>;

describe('useShareHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useShareHistory());

    expect(result.current.shares).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.refreshing).toBe(false);
    expect(typeof result.current.fetchShares).toBe('function');
    expect(typeof result.current.refreshShares).toBe('function');
    expect(typeof result.current.deleteShare).toBe('function');
  });

  it('fetches shares successfully', async () => {
    const mockShares = [
      {
        id: 'share-1',
        title: 'Test Share',
        content: { answers: [], template_name: 'Test Template' },
        share_token: 'token-1',
        expires_at: '2025-02-01T10:00:00Z',
        created_at: '2025-01-25T10:00:00Z',
        access_count: 5,
      },
    ];

    mockShareService.getShareHistory.mockResolvedValue(mockShares);

    const { result } = renderHook(() => useShareHistory());

    await act(async () => {
      await result.current.fetchShares();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.shares).toHaveLength(1);
    expect(result.current.shares[0].id).toBe('share-1');
    expect(result.current.shares[0].status).toBe('active');
    expect(result.current.shares[0].template_name).toBe('Test Template');
  });

  it('handles fetch error', async () => {
    mockShareService.getShareHistory.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useShareHistory());

    await act(async () => {
      await result.current.fetchShares();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Network error');
    expect(result.current.shares).toEqual([]);
  });

  it('processes share data correctly for expired shares', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const mockShares = [
      {
        id: 'share-1',
        title: 'Expired Share',
        content: { answers: [] },
        share_token: 'token-1',
        expires_at: yesterday.toISOString(),
        created_at: '2025-01-20T10:00:00Z',
      },
    ];

    mockShareService.getShareHistory.mockResolvedValue(mockShares);

    const { result } = renderHook(() => useShareHistory());

    await act(async () => {
      await result.current.fetchShares();
    });

    expect(result.current.shares[0].status).toBe('expired');
    expect(result.current.shares[0].is_expired).toBe(true);
    expect(result.current.shares[0].days_until_expiry).toBe(0);
  });

  it('processes share data correctly for active shares', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);

    const mockShares = [
      {
        id: 'share-1',
        title: 'Active Share',
        content: { answers: [] },
        share_token: 'token-1',
        expires_at: tomorrow.toISOString(),
        created_at: '2025-01-20T10:00:00Z',
      },
    ];

    mockShareService.getShareHistory.mockResolvedValue(mockShares);

    const { result } = renderHook(() => useShareHistory());

    await act(async () => {
      await result.current.fetchShares();
    });

    expect(result.current.shares[0].status).toBe('active');
    expect(result.current.shares[0].is_expired).toBe(false);
    expect(result.current.shares[0].days_until_expiry).toBe(5);
  });

  it('sorts shares by creation date (newest first)', async () => {
    const mockShares = [
      {
        id: 'share-1',
        title: 'Older Share',
        content: { answers: [] },
        share_token: 'token-1',
        expires_at: '2025-02-01T10:00:00Z',
        created_at: '2025-01-20T10:00:00Z',
      },
      {
        id: 'share-2',
        title: 'Newer Share',
        content: { answers: [] },
        share_token: 'token-2',
        expires_at: '2025-02-01T10:00:00Z',
        created_at: '2025-01-25T10:00:00Z',
      },
    ];

    mockShareService.getShareHistory.mockResolvedValue(mockShares);

    const { result } = renderHook(() => useShareHistory());

    await act(async () => {
      await result.current.fetchShares();
    });

    expect(result.current.shares[0].title).toBe('Newer Share');
    expect(result.current.shares[1].title).toBe('Older Share');
  });

  it('refreshes shares successfully', async () => {
    const mockShares = [
      {
        id: 'share-1',
        title: 'Refreshed Share',
        content: { answers: [] },
        share_token: 'token-1',
        expires_at: '2025-02-01T10:00:00Z',
        created_at: '2025-01-25T10:00:00Z',
      },
    ];

    mockShareService.getShareHistory.mockResolvedValue(mockShares);

    const { result } = renderHook(() => useShareHistory());

    await act(async () => {
      await result.current.refreshShares();
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.shares).toHaveLength(1);
    expect(result.current.shares[0].title).toBe('Refreshed Share');
  });

  it('handles refresh error', async () => {
    mockShareService.getShareHistory.mockRejectedValue(new Error('Refresh failed'));

    const { result } = renderHook(() => useShareHistory());

    await act(async () => {
      await result.current.refreshShares();
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBe('Refresh failed');
  });

  it('deletes share successfully', async () => {
    // First, populate with some shares
    const mockShares = [
      {
        id: 'share-1',
        title: 'Share to Delete',
        content: { answers: [] },
        share_token: 'token-1',
        expires_at: '2025-02-01T10:00:00Z',
        created_at: '2025-01-25T10:00:00Z',
      },
      {
        id: 'share-2',
        title: 'Share to Keep',
        content: { answers: [] },
        share_token: 'token-2',
        expires_at: '2025-02-01T10:00:00Z',
        created_at: '2025-01-24T10:00:00Z',
      },
    ];

    mockShareService.getShareHistory.mockResolvedValue(mockShares);
    mockShareService.deleteShare.mockResolvedValue();

    const { result } = renderHook(() => useShareHistory());

    // Fetch shares first
    await act(async () => {
      await result.current.fetchShares();
    });

    expect(result.current.shares).toHaveLength(2);

    // Delete one share
    await act(async () => {
      await result.current.deleteShare('share-1');
    });

    expect(mockShareService.deleteShare).toHaveBeenCalledWith('share-1');
    expect(result.current.shares).toHaveLength(1);
    expect(result.current.shares[0].id).toBe('share-2');
  });

  it('handles delete error', async () => {
    mockShareService.deleteShare.mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => useShareHistory());

    await expect(
      act(async () => {
        await result.current.deleteShare('share-1');
      })
    ).rejects.toThrow('Delete failed');
  });

  it('prevents concurrent fetches', async () => {
    mockShareService.getShareHistory.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 100))
    );

    const { result } = renderHook(() => useShareHistory());

    // Start two fetches concurrently
    act(() => {
      result.current.fetchShares();
      result.current.fetchShares();
    });

    // Should only call the service once
    expect(mockShareService.getShareHistory).toHaveBeenCalledTimes(1);
  });

  it('prevents concurrent refreshes', async () => {
    mockShareService.getShareHistory.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 100))
    );

    const { result } = renderHook(() => useShareHistory());

    // Start two refreshes concurrently
    act(() => {
      result.current.refreshShares();
      result.current.refreshShares();
    });

    // Should only call the service once
    expect(mockShareService.getShareHistory).toHaveBeenCalledTimes(1);
  });
});
