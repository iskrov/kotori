import axios from 'axios';
import * as FileSystem from 'expo-file-system';
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
  language?: string;
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
   * Download PDF for a share
   */
  async downloadPDF(shareId: string, filename?: string): Promise<PDFDownloadResult> {
    try {
      logger.info('[ShareService] Downloading PDF', { shareId });

      const baseUrl = api.defaults.baseURL || 'http://localhost:8001';
      const downloadUrl = `${baseUrl}/api/v1/shares/${shareId}/pdf`;
      const finalFilename = filename || `share-${shareId}-${Date.now()}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${finalFilename}`;

      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        fileUri,
        {
          // Note: FileSystem.downloadAsync doesn't automatically use api instance headers
          // In a production app, you'd need to get auth headers from storage
          headers: {
            'Content-Type': 'application/pdf',
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
        filename: finalFilename,
        size: fileInfo.size || 0,
      };

      logger.info('[ShareService] PDF downloaded successfully', result);
      return result;
    } catch (error) {
      logger.error('[ShareService] Failed to download PDF', error);
      throw new Error('Failed to download PDF. Please check your connection and try again.');
    }
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
   * Clean up downloaded files
   */
  async cleanupFile(fileUri: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
        logger.info('[ShareService] File cleaned up', { fileUri });
      }
    } catch (error) {
      logger.warn('[ShareService] Failed to cleanup file', { fileUri, error });
      // Don't throw - cleanup is not critical
    }
  }
}

export const shareService = new ShareService();
export default shareService;
