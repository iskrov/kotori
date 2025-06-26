import { SecretTag, SecretTagCreateRequest, SecretTagResponse, SecretTagListResponse } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

/**
 * Service for managing secret tags with server-side hash verification.
 * 
 * The server handles all cryptographic operations including phrase hashing
 * with Argon2, ensuring consistent security across the application.
 */
export class SecretTagHashService {
  private readonly API_BASE = '/api/secret-tags';

  /**
   * Create a new secret tag with server-side hash verification
   */
  async createSecretTag(tagName: string, secretPhrase: string, colorCode: string = '#007AFF'): Promise<SecretTagResponse> {
    try {
      // Prepare request data - server will handle hashing
      const requestData = {
        tag_name: tagName,
        phrase: secretPhrase,  // Send raw phrase to server
        color_code: colorCode
      };

      // Use the configured api instance instead of raw fetch to ensure correct baseURL
      const response = await api.post(this.API_BASE, requestData);

      const result = response.data;
      console.log(`Created secret tag '${tagName}' with server-side hash verification`);
      
      return result;
    } catch (error) {
      console.error('Error creating secret tag:', error);
      throw error;
    }
  }

  /**
   * Get all secret tags for the current user
   */
  async getSecretTags(): Promise<SecretTagListResponse> {
    try {
      // This endpoint should return all tags, which will be filtered client-side if needed.
      const response = await api.get(this.API_BASE);
      // Assuming the actual tags are in response.data
      const allTags = response.data; 
      
      // The backend doesn't distinguish between secret and regular tags at this endpoint,
      // so we might need to filter them if the response contains a 'type' field.
      // For now, we assume this endpoint is intended to return what we need,
      // and we just return the data. The calling function will handle it.
      return allTags;
    } catch (error) {
      console.error('Error fetching secret tags:', error);
      throw error;
    }
  }

  /**
   * Verify a secret phrase against stored server-side hashes
   */
  async verifySecretPhrase(phrase: string): Promise<{ isValid: boolean; tagName: string; tagId?: string }> {
    try {
      // Get all user's secret tags
      const tagsResponse = await this.getSecretTags();
      const tags = tagsResponse.tags || [];
      
      // Test the phrase against each tag's hash
      for (const tag of tags) {
        try {
          // Verify with server using the raw phrase
          const verificationResponse = await api.post(`${this.API_BASE}/verify-phrase`, {
            phrase: phrase,
            tag_id: tag.id
          });

          if (verificationResponse.status === 200) {
            const verificationResult = verificationResponse.data;
            if (verificationResult.is_valid) {
              console.log(`Secret phrase verified for tag: ${verificationResult.tag_name}`);
              return {
                isValid: true,
                tagName: verificationResult.tag_name,
                tagId: tag.id
              };
            }
          }
        } catch (error) {
          console.warn(`Error verifying phrase against tag ${tag.id}:`, error);
          // Continue checking other tags
        }
      }

      // No matching tag found
      return { isValid: false, tagName: '' };
    } catch (error) {
      console.error('Error verifying secret phrase:', error);
      return { isValid: false, tagName: '' };
    }
  }

  /**
   * Update a secret tag color (color only for security reasons)
   */
  async updateSecretTagColor(tagId: string, colorCode: string): Promise<SecretTagResponse> {
    try {
      const updateData = {
        color_code: colorCode
      };
      
      const response = await api.put(`${this.API_BASE}/${tagId}`, updateData);
      
      if (response.status !== 200) {
        throw new Error(`Failed to update secret tag: ${response.status}`);
      }
      
      console.log(`Updated secret tag color: ${tagId} -> ${colorCode}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to update secret tag color:', error);

      throw error;
    }
  }

  /**
   * Delete a secret tag
   */
  async deleteSecretTag(tagId: string): Promise<boolean> {
    try {
      const response = await api.delete(`${this.API_BASE}/${tagId}`);

      // Accept both 200 OK and 204 No Content as successful deletion
      if (response.status === 200 || response.status === 204) {
        console.log(`Deleted secret tag: ${tagId}`);
        return true;
      } else {
        const errorData = response.data || {};
        throw new Error(errorData.detail || `Failed to delete secret tag: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting secret tag:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const secretTagHashService = new SecretTagHashService(); 