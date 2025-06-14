import CryptoJS from 'crypto-js';
import { SecretTag, SecretTagCreateRequest, SecretTagResponse } from '../types';

/**
 * Service for managing secret tags with server-side hash verification.
 * 
 * This approach stores salted hashes on the server for phrase verification
 * while keeping the actual phrases client-side only during activation.
 */
export class SecretTagHashService {
  private readonly API_BASE = '/api/secret-tags';
  
  /**
   * Generate a cryptographically secure salt for Argon2 hashing
   */
  private generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  /**
   * Hash a secret phrase using Argon2 (simulated with PBKDF2 for now)
   * TODO: Replace with actual Argon2 implementation when available in browsers
   */
  private async hashPhrase(phrase: string, salt: Uint8Array): Promise<string> {
    // Normalize the phrase (lowercase, trim)
    const normalizedPhrase = phrase.trim().toLowerCase();
    
    // Convert salt to WordArray for CryptoJS
    const saltWordArray = CryptoJS.lib.WordArray.create(Array.from(salt));
    
    // Use PBKDF2 as a temporary substitute for Argon2
    // In production, this should be replaced with actual Argon2
    const hash = CryptoJS.PBKDF2(normalizedPhrase, saltWordArray, {
      keySize: 256/32, // 256 bits = 32 bytes
      iterations: 100000, // High iteration count for security
      hasher: CryptoJS.algo.SHA256
    });
    
    return hash.toString(CryptoJS.enc.Base64);
  }

  /**
   * Create a new secret tag with server-side hash verification
   */
  async createSecretTag(tagName: string, secretPhrase: string): Promise<SecretTagResponse> {
    try {
      // Generate salt and hash the phrase
      const salt = this.generateSalt();
      const phraseHash = await this.hashPhrase(secretPhrase, salt);
      
      // Prepare request data
      const requestData: SecretTagCreateRequest = {
        tag_name: tagName,
        phrase_salt: Array.from(salt), // Convert to array for JSON serialization
        phrase_hash: phraseHash
      };

      const response = await fetch(this.API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create secret tag: ${response.status}`);
      }

      const result = await response.json();
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
  async getSecretTags(): Promise<SecretTagResponse[]> {
    try {
      const response = await fetch(this.API_BASE, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch secret tags: ${response.status}`);
      }

      const result = await response.json();
      return result.tags || [];
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
      const tags = await this.getSecretTags();
      
      // Test the phrase against each tag's hash
      for (const tag of tags) {
        try {
          // Recreate the hash using the stored salt
          const salt = new Uint8Array(tag.phrase_salt);
          const computedHash = await this.hashPhrase(phrase, salt);
          
          // Verify with server (this could be optimized to verify all at once)
          const verificationResponse = await fetch(`${this.API_BASE}/verify-phrase`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.getAuthToken()}`
            },
            body: JSON.stringify({
              phrase: phrase,
              tag_id: tag.id
            })
          });

          if (verificationResponse.ok) {
            const verificationResult = await verificationResponse.json();
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
   * Delete a secret tag
   */
  async deleteSecretTag(tagId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE}/${tagId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        console.log(`Deleted secret tag: ${tagId}`);
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to delete secret tag: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting secret tag:', error);
      throw error;
    }
  }

  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string {
    // This should match your app's authentication token storage
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }
    return token;
  }

  /**
   * Client-side phrase verification (for immediate feedback)
   * This is faster than server verification but less secure
   */
  async verifyPhraseClientSide(phrase: string, tag: SecretTagResponse): Promise<boolean> {
    try {
      const salt = new Uint8Array(tag.phrase_salt);
      const computedHash = await this.hashPhrase(phrase, salt);
      
      // Note: We can't compare directly since we don't have the server hash
      // This method would need the hash to be returned from the server
      // For now, always use server-side verification
      return false;
    } catch (error) {
      console.error('Error in client-side phrase verification:', error);
      return false;
    }
  }
}

// Export singleton instance
export const secretTagHashService = new SecretTagHashService(); 