import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import logger from '../utils/logger';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface WebSocketTranscriptionHookProps {
  onOpen?: () => void;
  onClose?: (event: { code: number; reason: string }) => void;
  onMessage?: (data: any) => void; // For raw messages if needed
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string, detectedLanguage?: string) => void;
  onTranscriptionError?: (errorMessage: string) => void;
  onStatusUpdate?: (statusMessage: string) => void; // For general status messages from WS
}

export interface WebSocketTranscriptionHook {
  wsStatus: WebSocketStatus;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: string | object) => boolean; // Returns true if message was sent
  // sendAudioChunk: (chunk: Blob | ArrayBuffer) => boolean; // Future: for live streaming
}

const useWebSocketTranscription = ({
  onOpen,
  onClose,
  onMessage,
  onInterimTranscript,
  onFinalTranscript,
  onTranscriptionError,
  onStatusUpdate,
}: WebSocketTranscriptionHookProps): WebSocketTranscriptionHook => {
  const ws = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected');
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    // Fetch token on mount, but don't auto-connect
    AsyncStorage.getItem('access_token').then(token => {
      if (token) {
        setAuthToken(token);
      } else {
        logger.warn('WebSocket: Auth token not found on initial load.');
      }
    });

    // Cleanup WebSocket on unmount
    return () => {
      if (ws.current) {
        logger.info('useWebSocketTranscription unmounting, closing WebSocket.');
        ws.current.onclose = null; // Avoid triggering onClose callback during forced close
        ws.current.onerror = null;
        ws.current.onmessage = null;
        ws.current.onopen = null;
        ws.current.close();
        ws.current = null;
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      logger.info('WebSocket already connected.');
      setWsStatus('connected'); // Ensure status is correct
      onOpen?.();
      return;
    }

    if (wsStatus === 'connecting') {
      logger.info('WebSocket connection attempt already in progress.');
      return;
    }

    let token = authToken;
    if (!token) {
      logger.info('WebSocket: Auth token not in state, re-fetching...');
      token = await AsyncStorage.getItem('access_token');
    }

    if (!token) {
      logger.error('WebSocket: Cannot connect. No auth token found (key: access_token).');
      setWsStatus('error');
      onTranscriptionError?.('Authentication Error: Missing token.');
      Alert.alert('Authentication Error', 'Could not connect to transcription service. Please log in again.');
      return;
    }
    setAuthToken(token); // Store it if re-fetched

    setWsStatus('connecting');
    logger.info('Attempting WebSocket connection...');

    const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8001';
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/transcribe';
    logger.info(`Connecting to WebSocket: ${wsUrl}`);

    try {
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        logger.info('WebSocket Connected!');
        setWsStatus('connected');
        // Send authentication token
        socket.send(JSON.stringify({ type: 'auth', token }));
        onOpen?.();
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string);
          logger.debug('WebSocket message received:', message);
          onMessage?.(message); // Generic message handler

          if (message.type === 'interim_transcript') {
            onInterimTranscript?.(message.text);
          } else if (message.type === 'final_transcript') {
            onFinalTranscript?.(message.text, message.language_code); // Assuming language_code might be present
          } else if (message.type === 'error') {
            logger.error('WebSocket server error:', message.message);
            onTranscriptionError?.(message.message);
             // setWsStatus('error'); // Let onClose handle status for critical errors, or decide specific logic
          } else if (message.type === 'status') {
            logger.info('WebSocket status update:', message.message);
            onStatusUpdate?.(message.message);
          } else if (message.type === 'language_detected'){
            logger.info('Language detected by server:', message.code);
            // Potentially call a specific handler if needed, or use onStatusUpdate
          }

        } catch (e) {
          logger.error('Failed to parse WebSocket message:', event.data, e);
          onTranscriptionError?.('Received malformed message from server.');
        }
      };

      socket.onerror = (errorEvent) => {
        // The error object in onerror is often not very detailed directly.
        // True error details might be in the reason for onclose.
        logger.error('WebSocket Error Event:', errorEvent);
        setWsStatus('error');
        onTranscriptionError?.('WebSocket connection error. Please try again.');
        // Don't Alert here, let the component decide based on onTranscriptionError
      };

      socket.onclose = (event) => {
        logger.info('WebSocket Closed:', { code: event.code, reason: event.reason });
        ws.current = null; // Clear the ref
        // Only set to disconnected if not already in error state from onerror
        if (wsStatus !== 'error') {
             setWsStatus('disconnected');
        }
        onClose?.({ code: event.code, reason: event.reason });
        // Alert.alert('Connection Closed', `Transcription service disconnected: ${event.reason || event.code}`);
      };
    } catch (e) {
        logger.error('Failed to create WebSocket object or initial connection error:', e);
        setWsStatus('error');
        onTranscriptionError?.('Could not establish connection to transcription service.');
        ws.current = null;
    }
  }, [authToken, wsStatus, onOpen, onClose, onMessage, onInterimTranscript, onFinalTranscript, onTranscriptionError, onStatusUpdate]);

  const disconnect = useCallback(() => {
    if (ws.current) {
      logger.info('Manually disconnecting WebSocket...');
      ws.current.close(); // Simplest call, 0 arguments
      // onclose handler will set ws.current to null and update status
    }
  }, []);

  const sendMessage = useCallback((message: string | object): boolean => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        ws.current.send(payload);
        logger.debug('WebSocket message sent:', payload);
        return true;
      } catch (error) {
        logger.error('Failed to send WebSocket message:', error);
        onTranscriptionError?.('Failed to send message to server.');
        return false;
      }
    } else {
      logger.warn('Cannot send WebSocket message: Connection not open.');
      // onTranscriptionError?.('Cannot send message: Connection not open.'); // Could be too noisy
      return false;
    }
  }, [onTranscriptionError]);

  return {
    wsStatus,
    connect,
    disconnect,
    sendMessage,
  };
};

export default useWebSocketTranscription; 