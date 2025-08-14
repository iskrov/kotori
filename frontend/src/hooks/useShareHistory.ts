import { useState, useCallback, useRef } from 'react';
import shareService, { ShareData } from '../services/shareService';
import logger from '../utils/logger';

export interface ShareHistoryItem extends ShareData {
  template_name?: string;
  access_count?: number;
  status: 'active' | 'expired' | 'revoked';
  is_expired: boolean;
  days_until_expiry: number;
}

export interface UseShareHistoryReturn {
  shares: ShareHistoryItem[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  fetchShares: () => Promise<void>;
  refreshShares: () => Promise<void>;
  deleteShare: (shareId: string) => Promise<void>;
}

export const useShareHistory = (): UseShareHistoryReturn => {
  const [shares, setShares] = useState<ShareHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isFetchingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const processShareData = (rawShares: ShareData[]): ShareHistoryItem[] => {
    return rawShares.map(share => {
      const expiryDate = new Date(share.expires_at);
      const now = new Date();
      const isExpired = expiryDate < now;
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...share,
        template_name: share.content?.template_name || 'Unknown Template',
        access_count: share.access_count || 0,
        status: isExpired ? 'expired' : 'active',
        is_expired: isExpired,
        days_until_expiry: Math.max(0, daysUntilExpiry),
      };
    });
  };

  const fetchShares = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      logger.info('[useShareHistory] Fetching share history');

      const rawShares = await shareService.getShareHistory();
      const processedShares = processShareData(rawShares);
      
      // Sort by creation date, newest first
      processedShares.sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      setShares(processedShares);
      logger.info('[useShareHistory] Share history fetched successfully', { 
        count: processedShares.length 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load share history';
      logger.error('[useShareHistory] Failed to fetch share history', error);
      setError(errorMessage);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const refreshShares = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      setRefreshing(true);
      setError(null);
      logger.info('[useShareHistory] Refreshing share history');

      const rawShares = await shareService.getShareHistory();
      const processedShares = processShareData(rawShares);
      
      // Sort by creation date, newest first
      processedShares.sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      setShares(processedShares);
      logger.info('[useShareHistory] Share history refreshed successfully', { 
        count: processedShares.length 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh share history';
      logger.error('[useShareHistory] Failed to refresh share history', error);
      setError(errorMessage);
    } finally {
      setRefreshing(false);
      isRefreshingRef.current = false;
    }
  }, []);

  const deleteShare = useCallback(async (shareId: string) => {
    try {
      logger.info('[useShareHistory] Deleting share', { shareId });
      
      await shareService.deleteShare(shareId);
      
      // Remove from local state
      setShares(prevShares => prevShares.filter(share => share.id !== shareId));
      
      logger.info('[useShareHistory] Share deleted successfully', { shareId });
    } catch (error) {
      logger.error('[useShareHistory] Failed to delete share', error);
      throw error; // Re-throw so the component can handle the error
    }
  }, []);

  return {
    shares,
    loading,
    error,
    refreshing,
    fetchShares,
    refreshShares,
    deleteShare,
  };
};

export default useShareHistory;
