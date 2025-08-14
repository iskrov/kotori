import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import logger from '../utils/logger';

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
  isWifiEnabled: boolean | null;
  strength: number | null;
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true, // Assume connected initially
    connectionType: null,
    isInternetReachable: null,
    isWifiEnabled: null,
    strength: null,
  });

  const [isOnline, setIsOnline] = useState(true);
  const [hasSlowConnection, setHasSlowConnection] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      logger.info('[useNetworkStatus] Network state changed', {
        isConnected: state.isConnected,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      });

      const status: NetworkStatus = {
        isConnected: state.isConnected ?? false,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
        isWifiEnabled: state.type === 'wifi' ? state.isConnected : null,
        strength: null, // Not available in all network types
      };

      setNetworkStatus(status);
      setIsOnline(status.isConnected && (status.isInternetReachable !== false));

      // Detect slow connection based on connection type
      const slowConnectionTypes = ['2g', 'slow-2g'];
      setHasSlowConnection(
        slowConnectionTypes.includes(state.type) ||
        (state.type === 'cellular' && 
         state.details?.cellularGeneration === '2g')
      );
    });

    // Get initial state
    NetInfo.fetch().then((state: NetInfoState) => {
      const status: NetworkStatus = {
        isConnected: state.isConnected ?? false,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
        isWifiEnabled: state.type === 'wifi' ? state.isConnected : null,
        strength: null,
      };

      setNetworkStatus(status);
      setIsOnline(status.isConnected && (status.isInternetReachable !== false));

      logger.info('[useNetworkStatus] Initial network state', status);
    });

    return unsubscribe;
  }, []);

  const checkConnectivity = async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      const isConnected = state.isConnected && (state.isInternetReachable !== false);
      
      logger.info('[useNetworkStatus] Manual connectivity check', {
        isConnected,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      });

      return isConnected;
    } catch (error) {
      logger.error('[useNetworkStatus] Failed to check connectivity', error);
      return false;
    }
  };

  const getConnectionQuality = (): 'excellent' | 'good' | 'poor' | 'offline' => {
    if (!isOnline) return 'offline';
    if (hasSlowConnection) return 'poor';
    
    switch (networkStatus.connectionType) {
      case 'wifi':
        return 'excellent';
      case '5g':
      case '4g':
        return 'good';
      case '3g':
        return 'good';
      case '2g':
      case 'slow-2g':
        return 'poor';
      default:
        return 'good';
    }
  };

  const getConnectionMessage = (): string => {
    const quality = getConnectionQuality();
    
    switch (quality) {
      case 'offline':
        return 'No internet connection. Some features may not be available.';
      case 'poor':
        return 'Slow connection detected. Operations may take longer than usual.';
      case 'good':
        return 'Connected to the internet.';
      case 'excellent':
        return 'Connected via Wi-Fi.';
      default:
        return 'Connected to the internet.';
    }
  };

  return {
    networkStatus,
    isOnline,
    hasSlowConnection,
    checkConnectivity,
    getConnectionQuality,
    getConnectionMessage,
  };
};

export default useNetworkStatus;
