import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { api } from './api';
import logger from '../utils/logger';

export interface ShareData {
  id: string;
  title: string;
  content: {
    answers: Array<{
      question_id: string;
      question_text: string;
      answer: string;
      confidence: number;
      source_entries?: string[];
    }>;
    template_info: {
      template_id: string;
      name: string;
      description?: string;
      category?: string;
      version: string;
    };
    generation_metadata: {
      processing_notes?: string;
      ai_model: string;
      generation_method: string;
    };
    source_language: string;
    target_language: string;
    entry_count: number;
    generated_at: string;
  };
  share_token: string;
  template_id: string;
  target_language: string;
  entry_count: number;
  question_count: number;
  expires_at: string;
  created_at: string;
  access_count: number;
  is_active: boolean;
  last_accessed_at?: string;
}

export interface SharePlaintextEntry {
  id?: string;
  content: string;
  entry_date?: string;
  title?: string;
}

export interface ShareRequest {
  template_id: string;
  // Either provide entries (preferred with consent) or a date_range/ids
  entries?: SharePlaintextEntry[];
  consent_acknowledged?: boolean;
  date_range?: {
    start: string;
    end: string;
  };
  period?: 'daily' | 'weekly' | 'monthly';
  target_language?: string;
}

export interface PDFDownloadResult {
  uri: string;
  filename: string;
  size: number;
}

class ShareService {
  /**
   * Generate a new share from journal entries
   */
  async generateShare(request: ShareRequest): Promise<ShareData> {
    try {
      logger.info('[ShareService] Generating share', request);
      
      // Share generation can take longer due to AI processing; override default timeout
      const response = await api.post('/api/v1/shares/', request, { timeout: 60000 });

      logger.info('[ShareService] Share generated successfully', { shareId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('[ShareService] Failed to generate share', error);
      throw new Error('Failed to generate share. Please try again.');
    }
  }

  /**
   * Get an existing share by ID
   */
  async getShare(shareId: string): Promise<ShareData> {
    try {
      logger.info('[ShareService] Fetching share', { shareId });
      
      const response = await api.get(`/api/v1/shares/${shareId}`);

      return response.data;
    } catch (error) {
      logger.error('[ShareService] Failed to fetch share', error);
      throw new Error('Failed to load share. Please try again.');
    }
  }

  /**
   * Update a share with edited content
   */
  async updateShare(shareId: string, updates: Partial<ShareData>): Promise<ShareData> {
    try {
      logger.info('[ShareService] Updating share', { shareId });
      
      const response = await api.put(`/api/v1/shares/${shareId}`, updates);

      logger.info('[ShareService] Share updated successfully');
      return response.data;
    } catch (error) {
      logger.error('[ShareService] Failed to update share', error);
      throw new Error('Failed to save changes. Please try again.');
    }
  }

  /**
   * Download PDF for a share (platform-aware)
   */
  async downloadPDF(shareId: string, filename?: string): Promise<PDFDownloadResult> {
    try {
      logger.info('[ShareService] Downloading PDF', { shareId });

      const baseUrl = api.defaults.baseURL || 'http://localhost:8001';
      const downloadUrl = `${baseUrl}/api/v1/shares/${shareId}/pdf`;
      const finalFilename = filename || `share-${shareId}-${Date.now()}.pdf`;

      if (Platform.OS === 'web') {
        // Web platform: use fetch and create blob URL
        return await this._downloadPDFWeb(downloadUrl, finalFilename);
      } else {
        // Native platform: use expo-file-system
        return await this._downloadPDFNative(downloadUrl, finalFilename);
      }
    } catch (error) {
      logger.error('[ShareService] Failed to download PDF', error);
      throw new Error('Failed to download PDF. Please check your connection and try again.');
    }
  }

  /**
   * Download PDF on web platform using axios and blob
   */
  private async _downloadPDFWeb(downloadUrl: string, filename: string): Promise<PDFDownloadResult> {
    // Extract share ID from the download URL
    const shareId = downloadUrl.split('/shares/')[1].split('/pdf')[0];
    
    // Use our existing API instance which has authentication interceptors
    const response = await api.get(`/api/v1/shares/${shareId}/pdf`, {
      responseType: 'blob', // Important: get response as blob
      headers: {
        'Accept': 'application/pdf',
      },
    });

    const blob = response.data;
    const blobUrl = URL.createObjectURL(blob);

    const result: PDFDownloadResult = {
      uri: blobUrl,
      filename,
      size: blob.size,
    };

    logger.info('[ShareService] PDF downloaded successfully (web)', result);
    return result;
  }

  /**
   * Download PDF on native platform using expo-file-system
   */
  private async _downloadPDFNative(downloadUrl: string, filename: string): Promise<PDFDownloadResult> {
    // Get auth headers from authService
    const { authService } = await import('./authService');
    const authHeaders = authService.getAuthHeaders();

    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    const downloadResult = await FileSystem.downloadAsync(
      downloadUrl,
      fileUri,
      {
        headers: {
          'Content-Type': 'application/pdf',
          ...authHeaders, // Include authentication headers
        },
      }
    );

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
    
    if (!fileInfo.exists) {
      throw new Error('Downloaded file not found');
    }

    const result: PDFDownloadResult = {
      uri: downloadResult.uri,
      filename,
      size: fileInfo.size || 0,
    };

    logger.info('[ShareService] PDF downloaded successfully (native)', result);
    return result;
  }

  /**
   * Download PDF using public share token (no auth required)
   */
  async downloadPublicPDF(shareToken: string, filename?: string): Promise<PDFDownloadResult> {
    try {
      logger.info('[ShareService] Downloading public PDF', { shareToken });

      const baseUrl = api.defaults.baseURL || 'http://localhost:8001';
      const downloadUrl = `${baseUrl}/api/v1/shares/public/${shareToken}/pdf`;
      const finalFilename = filename || `share-${shareToken}-${Date.now()}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${finalFilename}`;

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      
      if (!fileInfo.exists) {
        throw new Error('Downloaded file not found');
      }

      const result: PDFDownloadResult = {
        uri: downloadResult.uri,
        filename: finalFilename,
        size: fileInfo.size || 0,
      };

      logger.info('[ShareService] Public PDF downloaded successfully', result);
      return result;
    } catch (error) {
      logger.error('[ShareService] Failed to download public PDF', error);
      throw new Error('Failed to download PDF. Please check your connection and try again.');
    }
  }

  /**
   * Get share history for current user
   */
  async getShareHistory(): Promise<ShareData[]> {
    try {
      logger.info('[ShareService] Fetching share history');
      
      // Use trailing slash to avoid 307 redirect which can drop CORS headers
      const response = await api.get('/api/v1/shares/');

      const shares: ShareData[] = Array.isArray(response.data)
        ? response.data
        : (response.data?.shares ?? []);

      logger.info('[ShareService] Share history fetched', { count: shares.length });
      return shares;
    } catch (error) {
      logger.error('[ShareService] Failed to fetch share history', error);
      throw new Error('Failed to load share history. Please try again.');
    }
  }

  /**
   * Delete/revoke a share
   */
  async deleteShare(shareId: string): Promise<void> {
    try {
      logger.info('[ShareService] Deleting share', { shareId });
      
      await api.delete(`/api/v1/shares/${shareId}`);

      logger.info('[ShareService] Share deleted successfully');
    } catch (error) {
      logger.error('[ShareService] Failed to delete share', error);
      throw new Error('Failed to delete share. Please try again.');
    }
  }

  /**
   * Clean up downloaded files (platform-aware)
   */
  async cleanupFile(fileUri: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // On web, revoke blob URL to free memory
        if (fileUri.startsWith('blob:')) {
          URL.revokeObjectURL(fileUri);
          logger.info('[ShareService] Blob URL cleaned up', { fileUri });
        }
      } else {
        // On native, delete file from filesystem
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(fileUri);
          logger.info('[ShareService] File cleaned up', { fileUri });
        }
      }
    } catch (error) {
      logger.warn('[ShareService] Failed to cleanup file', { fileUri, error });
      // Don't throw - cleanup is not critical
    }
  }
}

export const shareService = new ShareService();
export default shareService;
