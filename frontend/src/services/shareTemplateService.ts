import { api } from './api';
import { Template } from '../types/template';
import logger from '../utils/logger';

export interface ShareTemplate {
  id: string;
  template_id: string;
  name: string;
  description: string;
  category?: string;
  question_count: number;
}

export interface TemplateQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options?: string[];
  required: boolean;
  help_text?: string;
  language_code: string;
}

export class ShareTemplateService {
  async getActiveTemplates(): Promise<ShareTemplate[]> {
    try {
      logger.info('[ShareTemplateService] Fetching active templates');
      const response = await api.get('/api/v1/share-templates', {
        params: { is_active: true }
      });
      logger.info('[ShareTemplateService] Successfully fetched templates', { count: response.data.length });
      return response.data;
    } catch (error) {
      logger.error('[ShareTemplateService] Failed to fetch templates', error);
      throw new Error('Failed to load templates. Please check your connection and try again.');
    }
  }

  async getTemplate(id: string): Promise<ShareTemplate> {
    try {
      logger.info('[ShareTemplateService] Fetching template', { id });
      const response = await api.get(`/api/v1/share-templates/${id}`);
      logger.info('[ShareTemplateService] Successfully fetched template', { id, name: response.data.name });
      return response.data;
    } catch (error) {
      logger.error('[ShareTemplateService] Failed to fetch template', { id, error });
      throw new Error(`Failed to load template: ${id}`);
    }
  }

  async getAllTemplates(): Promise<ShareTemplate[]> {
    try {
      logger.info('[ShareTemplateService] Fetching all templates');
      const response = await api.get('/api/v1/share-templates');
      logger.info('[ShareTemplateService] Successfully fetched all templates', { count: response.data.length });
      return response.data;
    } catch (error) {
      logger.error('[ShareTemplateService] Failed to fetch all templates', error);
      throw new Error('Failed to load templates. Please check your connection and try again.');
    }
  }
}

export const shareTemplateService = new ShareTemplateService();

