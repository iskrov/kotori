"""
Secret Phrase Processing Service

This service handles server-side detection and processing of secret phrases
in journal entry content during submission. It integrates with the OPAQUE
authentication system to provide zero-knowledge phrase verification.

Security features:
- Constant-time phrase processing to prevent timing attacks
- Rate limiting to prevent brute force attacks
- Secure memory handling for sensitive operations
- Comprehensive audit logging for security monitoring
"""

import logging
import re
import time
import hashlib
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, UTC

from ..models.secret_tag_opaque import SecretTag
from ..crypto.blake2 import generate_tag_id
# Legacy opaque_service import removed - now using V1 clean implementation
from ..crypto.opaque_keys import find_matching_tag_id, authenticate_secret_phrase
from ..models.journal_entry import JournalEntry as JournalEntryModel
from ..crypto.secure_ops import timed_authentication
from ..crypto.memory import secure_zero
from ..utils.text_normalization import (
    TextNormalizer, NormalizationLevel, 
    create_medium_normalizer, create_relaxed_normalizer
)
from ..utils.fuzzy_matching import (
    FuzzyMatcher, SimilarityAlgorithm, FuzzyMatchConfig,
    create_levenshtein_matcher, create_jaro_winkler_matcher, create_soundex_matcher
)
from ..utils.performance_monitor import (
    get_performance_monitor, time_operation, record_metric, increment_counter
)
from ..middleware.rate_limiter import get_rate_limiter, RateLimitType

logger = logging.getLogger(__name__)

# Security constants
MAX_PHRASES_PER_REQUEST = 10
MAX_PHRASE_PROCESSING_TIME_MS = 1000  # 1 second maximum
MIN_PHRASE_PROCESSING_TIME_MS = 100   # Minimum time to prevent timing attacks
RATE_LIMIT_WINDOW_MINUTES = 5
MAX_REQUESTS_PER_WINDOW = 10

class PhraseProcessingError(Exception):
    """Exception for phrase processing errors"""
    pass

class SecretPhraseProcessor:
    """
    Service for server-side secret phrase processing in journal entries.
    
    This service:
    1. Extracts potential secret phrases from journal entry content
    2. Normalizes phrases using the same rules as the OPAQUE system
    3. Generates deterministic TagIDs for phrase lookup
    4. Authenticates phrases using the OPAQUE protocol
    5. Returns encrypted entries for successfully authenticated secret tags
    
    Security Features:
    - Constant-time phrase processing to prevent timing attacks
    - Rate limiting to prevent brute force attacks
    - Secure memory handling for sensitive operations
    - Comprehensive audit logging for security monitoring
    """
    
    # Phrase processing constants
    MIN_PHRASE_LENGTH = 3
    MAX_PHRASE_LENGTH = 100
    MAX_PHRASES_PER_ENTRY = 10
    
    def __init__(self, db: Session):
        """Initialize the phrase processor with database session"""
        self.db = db
        # Legacy opaque_service creation removed - now using V1 clean implementation
        
        # Enhanced utilities
        self.text_normalizer = create_medium_normalizer()
        self.relaxed_normalizer = create_relaxed_normalizer()
        self.fuzzy_matcher = create_levenshtein_matcher(threshold=0.85)
        self.soundex_matcher = create_soundex_matcher()
        self.performance_monitor = get_performance_monitor()
        self.rate_limiter = get_rate_limiter()
        
        # Legacy rate limiting cache (kept for backward compatibility)
        self._rate_limit_cache = {}
        
        # Phrase processing configuration
        self.enable_fuzzy_matching = True
        self.fuzzy_threshold = 0.85
        self.max_fuzzy_candidates = 10
        self.enable_soundex_matching = True
        self.enable_performance_monitoring = True
    
    def _check_rate_limit(self, user_id: str, ip_address: Optional[str] = None) -> bool:
        """
        Check if the user/IP is within rate limits for phrase processing.
        
        Args:
            user_id: ID of the user
            ip_address: Optional IP address for additional rate limiting
            
        Returns:
            True if within rate limits, False otherwise
        """
        try:
            # Use enhanced rate limiter
            user_allowed, user_retry_after = self.rate_limiter.check_rate_limit(
                RateLimitType.USER, str(user_id), "phrase_processing"
            )
            
            if not user_allowed:
                logger.warning(f"Rate limit exceeded for user {user_id}, retry after {user_retry_after}s")
                return False
            
            # Check IP rate limit if provided
            if ip_address:
                ip_allowed, ip_retry_after = self.rate_limiter.check_rate_limit(
                    RateLimitType.IP, ip_address, "phrase_processing"
                )
                
                if not ip_allowed:
                    logger.warning(f"Rate limit exceeded for IP {ip_address[:8]}..., retry after {ip_retry_after}s")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            
            # Fall back to legacy rate limiting
            return self._legacy_rate_limit_check(user_id, ip_address)
    
    def _legacy_rate_limit_check(self, user_id: str, ip_address: Optional[str] = None) -> bool:
        """Legacy rate limit check for fallback."""
        now = datetime.now(UTC)
        window_start = now - timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)
        
        # Create rate limit keys
        user_key = f"user_{user_id}"
        ip_key = f"ip_{hashlib.sha256(ip_address.encode()).hexdigest()}" if ip_address else None
        
        # Check user rate limit
        user_requests = self._rate_limit_cache.get(user_key, [])
        user_requests = [req_time for req_time in user_requests if req_time > window_start]
        
        if len(user_requests) >= MAX_REQUESTS_PER_WINDOW:
            logger.warning(f"Rate limit exceeded for user {user_id}")
            return False
        
        # Check IP rate limit if provided
        if ip_key:
            ip_requests = self._rate_limit_cache.get(ip_key, [])
            ip_requests = [req_time for req_time in ip_requests if req_time > window_start]
            
            if len(ip_requests) >= MAX_REQUESTS_PER_WINDOW * 2:  # Higher limit for IP
                logger.warning(f"Rate limit exceeded for IP")
                return False
            
            # Update IP cache
            ip_requests.append(now)
            self._rate_limit_cache[ip_key] = ip_requests
        
        # Update user cache
        user_requests.append(now)
        self._rate_limit_cache[user_key] = user_requests
        
        return True
    
    def _secure_phrase_processing(self, phrase: str) -> Tuple[bool, Optional[str]]:
        """
        Process a phrase with constant-time operations to prevent timing attacks.
        
        Args:
            phrase: The phrase to process
            
        Returns:
            Tuple of (is_valid, normalized_phrase)
        """
        start_time = time.time()
        
        try:
            # Normalize the phrase
            normalized = self._normalize_phrase(phrase)
            
            # Check if phrase is valid
            is_valid = self._is_valid_phrase(normalized)
            
            # Ensure minimum processing time to prevent timing attacks
            elapsed_ms = (time.time() - start_time) * 1000
            if elapsed_ms < MIN_PHRASE_PROCESSING_TIME_MS:
                time.sleep((MIN_PHRASE_PROCESSING_TIME_MS - elapsed_ms) / 1000)
            
            return is_valid, normalized if is_valid else None
            
        except Exception as e:
            logger.error(f"Error in secure phrase processing: {e}")
            
            # Still enforce minimum timing
            elapsed_ms = (time.time() - start_time) * 1000
            if elapsed_ms < MIN_PHRASE_PROCESSING_TIME_MS:
                time.sleep((MIN_PHRASE_PROCESSING_TIME_MS - elapsed_ms) / 1000)
            
            return False, None
    
    def _audit_phrase_processing(self, user_id: str, phrase_count: int, auth_success: bool, ip_address: Optional[str] = None):
        """
        Audit log phrase processing attempts for security monitoring.
        
        Args:
            user_id: ID of the user
            phrase_count: Number of phrases processed
            auth_success: Whether authentication was successful
            ip_address: Optional IP address
        """
        try:
            # Hash IP for privacy
            if ip_address:
                ip_hash = hashlib.sha256(ip_address.encode()).hexdigest()
                ip_hash_display = ip_hash[:16]
            else:
                ip_hash_display = 'None'
            
            logger.info(f"Phrase processing audit: user={user_id}, phrases={phrase_count}, "
                       f"success={auth_success}, ip_hash={ip_hash_display}")
            
            # In a production system, this would write to a dedicated audit log
            # For now, we'll use the standard logger
            
        except Exception as e:
            logger.error(f"Error in audit logging: {e}")
    
    def extract_normalized_phrases(self, content: str) -> List[str]:
        """
        Extract and normalize potential secret phrases from journal content.
        
        This method identifies potential secret phrases by:
        1. Splitting content into sentences and meaningful phrases
        2. Normalizing each phrase using consistent rules
        3. Filtering phrases by length and common word exclusions
        
        Args:
            content: The journal entry content to process
            
        Returns:
            List of normalized phrases that could be secret phrases
        """
        if not content or not content.strip():
            return []
        
        try:
            # Split content into potential phrases
            # Use sentence boundaries and common phrase separators
            phrase_patterns = [
                r'[.!?]+',  # Sentence boundaries
                r'[,;:]+',  # Clause separators
                r'\s+and\s+',  # Conjunction boundaries
                r'\s+but\s+',  # Contrast boundaries
                r'\s+then\s+',  # Sequence boundaries
            ]
            
            # Split content by multiple patterns
            phrases = [content]
            for pattern in phrase_patterns:
                new_phrases = []
                for phrase in phrases:
                    new_phrases.extend(re.split(pattern, phrase, flags=re.IGNORECASE))
                phrases = new_phrases
            
            # Normalize and filter phrases
            normalized_phrases = []
            for phrase in phrases:
                normalized = self._normalize_phrase(phrase)
                if self._is_valid_phrase(normalized):
                    normalized_phrases.append(normalized)
            
            # Limit number of phrases to process for performance
            return normalized_phrases[:self.MAX_PHRASES_PER_ENTRY]
            
        except Exception as e:
            logger.error(f"Error extracting phrases from content: {e}")
            return []
    
    def _normalize_phrase(self, phrase: str) -> str:
        """
        Normalize a phrase using enhanced text normalization.
        
        This provides comprehensive normalization including Unicode handling,
        diacritics removal, and contractions expansion.
        
        Args:
            phrase: Raw phrase to normalize
            
        Returns:
            Normalized phrase
        """
        if not phrase:
            return ""
        
        try:
            # Use enhanced text normalizer
            normalized = self.text_normalizer.normalize_phrase(phrase)
            
            # Record performance metric
            if self.enable_performance_monitoring:
                record_metric("phrase_normalization", len(phrase), "characters")
            
            return normalized
            
        except Exception as e:
            logger.error(f"Error in enhanced phrase normalization: {e}")
            
            # Fall back to legacy normalization
            return self._legacy_normalize_phrase(phrase)
    
    def _legacy_normalize_phrase(self, phrase: str) -> str:
        """Legacy phrase normalization for fallback."""
        if not phrase:
            return ""
        
        # Strip whitespace and convert to lowercase
        normalized = phrase.strip().lower()
        
        # Remove common punctuation (but preserve meaningful characters)
        # This matches the normalization in the encryption service
        normalized = normalized.translate(str.maketrans('', '', '.,!?;:'))
        
        # Collapse multiple spaces to single space
        normalized = re.sub(r'\s+', ' ', normalized)
        
        return normalized.strip()
    
    def _is_valid_phrase(self, phrase: str) -> bool:
        """
        Check if a normalized phrase is valid for secret phrase processing.
        
        Args:
            phrase: Normalized phrase to validate
            
        Returns:
            True if phrase is valid for processing
        """
        if not phrase:
            return False
        
        # Check length constraints
        if len(phrase) < self.MIN_PHRASE_LENGTH or len(phrase) > self.MAX_PHRASE_LENGTH:
            return False
        
        # Exclude common single words that are unlikely to be secret phrases
        common_words = {
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
            'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may',
            'might', 'must', 'shall', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
            'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
            'his', 'her', 'its', 'our', 'their'
        }
        
        # If phrase is just a single common word, exclude it
        if phrase in common_words:
            return False
        
        # Exclude very short phrases with only common words
        words = phrase.split()
        if len(words) <= 2 and all(word in common_words for word in words):
            return False
        
        return True
    
    def generate_tag_id(self, phrase: str) -> bytes:
        """
        Generate deterministic TagID for a phrase.
        
        Args:
            phrase: Normalized phrase
            
        Returns:
            16-byte TagID
        """
        return generate_tag_id(phrase)
    
    def find_matching_secret_tag(self, user_id: str, phrase: str) -> Optional[SecretTag]:
        """
        Find a secret tag that matches the given phrase by TagID.
        
        Args:
            user_id: ID of the user
            phrase: Normalized phrase to search for
            
        Returns:
            Matching SecretTag if found, None otherwise
        """
        try:
            # Generate TagID for the phrase
            tag_id = self.generate_tag_id(phrase)
            
            # Look up secret tag by tag_handle
            secret_tag = self.db.query(SecretTag).filter(
                SecretTag.user_id == user_id,
                SecretTag.tag_handle == tag_id
            ).first()
            
            return secret_tag
            
        except Exception as e:
            logger.error(f"Error finding matching secret tag: {e}")
            return None
    
    def authenticate_phrase_with_opaque(self, phrase: str, secret_tag: SecretTag) -> bool:
        """
        Authenticate a phrase using the OPAQUE protocol.
        
        Args:
            phrase: The phrase to authenticate
            secret_tag: The secret tag to authenticate against
            
        Returns:
            True if authentication successful
        """
        try:
            # NOTE: This method is deprecated - phrase_processor should use V1 OPAQUE services
            # Legacy fields phrase_hash, salt, verifier_kv have been replaced with tag_handle
            # For now, return False to indicate authentication failure
            logger.warning("authenticate_phrase_with_opaque called with legacy implementation - use V1 secret tag service instead")
            return False
            
        except Exception as e:
            logger.error(f"OPAQUE authentication failed: {e}")
            return False
    
    def get_encrypted_entries_for_tag(self, secret_tag: SecretTag) -> List[JournalEntryModel]:
        """
        Retrieve encrypted journal entries associated with a secret tag.
        
        This method finds all journal entries that were encrypted with this secret tag
        and are accessible now that the tag has been authenticated.
        
        Args:
            secret_tag: The authenticated secret tag
            
        Returns:
            List of journal entries associated with this tag
        """
        try:
            logger.info(f"Retrieving encrypted entries for secret tag: {secret_tag.phrase_hash.hex()}")
            
            # Query journal entries that are associated with this secret tag
            entries = self.db.query(JournalEntryModel).filter(
                JournalEntryModel.secret_tag_id == secret_tag.id,
                JournalEntryModel.encrypted_content.isnot(None)  # Only encrypted entries
            ).order_by(JournalEntryModel.entry_date.desc()).all()
            
            logger.info(f"Found {len(entries)} encrypted entries for secret tag")
            return entries
            
        except Exception as e:
            logger.error(f"Error retrieving encrypted entries: {e}")
            return []
    
    def decrypt_entry_content(self, entry: JournalEntryModel, encryption_key: bytes) -> Optional[str]:
        """
        Decrypt the content of an encrypted journal entry.
        
        Args:
            entry: The journal entry with encrypted content
            encryption_key: The encryption key derived from OPAQUE authentication
            
        Returns:
            Decrypted content string if successful, None otherwise
        """
        try:
            if not entry.encrypted_content or not entry.wrapped_key or not entry.encryption_iv:
                logger.warning(f"Entry {entry.id} missing encryption fields")
                return None
            
            # Import AES decryption functions
            from ..crypto.aes_kw import unwrap_key
            from ..crypto.aes_gcm import decrypt_data
            
            # Unwrap the entry's data key using the phrase-derived encryption key
            entry_key = unwrap_key(encryption_key, entry.wrapped_key)
            
            # Decrypt the content
            decrypted_content = decrypt_data(
                entry_key,
                entry.encryption_iv,
                entry.encrypted_content
            )
            
            # Convert bytes to string
            return decrypted_content.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Error decrypting entry content: {e}")
            return None
    
    def process_entry_for_secret_phrases(
        self, 
        content: str, 
        user_id: str,
        ip_address: Optional[str] = None
    ) -> Tuple[bool, Optional[SecretTag], List[JournalEntryModel], Optional[bytes]]:
        """
        Process a journal entry for secret phrases and return authentication results.
        
        This is the main entry point for phrase processing that:
        1. Checks rate limits and applies security measures
        2. Extracts and normalizes phrases from content using secure processing
        3. Checks each phrase for matching secret tags
        4. Authenticates phrases using OPAQUE with timing attack protection
        5. Returns encrypted entries for successful authentication
        6. Logs security audit information
        
        Args:
            content: Journal entry content to process
            user_id: ID of the user creating the entry
            ip_address: Optional IP address for rate limiting and audit logging
            
        Returns:
            Tuple of (authentication_success, authenticated_tag, encrypted_entries, encryption_key)
        """
        start_time = time.time()
        auth_success = False
        phrase_count = 0
        
        try:
            # Check rate limits first
            if not self._check_rate_limit(user_id, ip_address):
                logger.warning(f"Rate limit exceeded for user {user_id}, rejecting request")
                self._audit_phrase_processing(user_id, 0, False, ip_address)
                return False, None, [], None
            
            # Extract potential secret phrases with security limits
            phrases = self.extract_normalized_phrases(content)
            phrase_count = len(phrases)
            
            # Enforce maximum phrases per request
            if phrase_count > MAX_PHRASES_PER_REQUEST:
                logger.warning(f"Too many phrases ({phrase_count}) in request from user {user_id}")
                phrases = phrases[:MAX_PHRASES_PER_REQUEST]
                phrase_count = MAX_PHRASES_PER_REQUEST
            
            if not phrases:
                logger.debug("No phrases extracted from content")
                self._audit_phrase_processing(user_id, 0, False, ip_address)
                return False, None, [], None
            
            logger.info(f"Processing {phrase_count} phrases for user {user_id}")
            
            # Process each phrase with security measures
            for phrase in phrases:
                logger.debug(f"Processing phrase with length {len(phrase)}")
                
                # Use secure phrase processing to prevent timing attacks
                is_valid, normalized_phrase = self._secure_phrase_processing(phrase)
                
                if not is_valid or not normalized_phrase:
                    continue
                
                # Find matching secret tag
                secret_tag = self.find_matching_secret_tag(user_id, normalized_phrase)
                
                if secret_tag:
                    logger.info(f"Found matching secret tag for phrase: {secret_tag.phrase_hash.hex()}")
                    
                    # Authenticate the phrase with timing protection
                    encryption_key = self._secure_authenticate_phrase(normalized_phrase, secret_tag)
                    
                    if encryption_key:
                        logger.info(f"OPAQUE authentication successful for tag: {secret_tag.phrase_hash.hex()}")
                        auth_success = True
                        
                        # Get encrypted entries for this tag
                        encrypted_entries = self.get_encrypted_entries_for_tag(secret_tag)
                        
                        # Audit successful authentication
                        self._audit_phrase_processing(user_id, phrase_count, True, ip_address)
                        
                        return True, secret_tag, encrypted_entries, encryption_key
                    else:
                        logger.warning(f"OPAQUE authentication failed for tag: {secret_tag.phrase_hash.hex()}")
                else:
                    logger.debug(f"No matching secret tag found for phrase")
            
            # No successful authentication
            logger.debug("No secret phrase authentication successful")
            
        except Exception as e:
            logger.error(f"Error processing entry for secret phrases: {e}")
            
        finally:
            # Ensure minimum processing time to prevent timing attacks
            elapsed_ms = (time.time() - start_time) * 1000
            if elapsed_ms < MIN_PHRASE_PROCESSING_TIME_MS:
                time.sleep((MIN_PHRASE_PROCESSING_TIME_MS - elapsed_ms) / 1000)
            
            # Audit the attempt
            if not auth_success:
                self._audit_phrase_processing(user_id, phrase_count, False, ip_address)
        
        return False, None, [], None
    
    def _secure_authenticate_phrase(self, phrase: str, secret_tag: SecretTag) -> Optional[bytes]:
        """
        Authenticate a phrase using OPAQUE with timing attack protection.
        
        Args:
            phrase: The normalized phrase to authenticate
            secret_tag: The secret tag to authenticate against
            
        Returns:
            Encryption key if authentication successful, None otherwise
        """
        start_time = time.time()
        
        try:
            # Use the existing authentication method with timing protection
            encryption_key = self.authenticate_phrase_and_get_key(phrase, secret_tag)
            
            # Ensure minimum processing time
            elapsed_ms = (time.time() - start_time) * 1000
            if elapsed_ms < MIN_PHRASE_PROCESSING_TIME_MS:
                time.sleep((MIN_PHRASE_PROCESSING_TIME_MS - elapsed_ms) / 1000)
            
            return encryption_key
            
        except Exception as e:
            logger.error(f"Error in secure phrase authentication: {e}")
            
            # Still enforce minimum timing even on error
            elapsed_ms = (time.time() - start_time) * 1000
            if elapsed_ms < MIN_PHRASE_PROCESSING_TIME_MS:
                time.sleep((MIN_PHRASE_PROCESSING_TIME_MS - elapsed_ms) / 1000)
            
            return None
    
    def authenticate_phrase_and_get_key(self, phrase: str, secret_tag: SecretTag) -> Optional[bytes]:
        """
        Authenticate a phrase using OPAQUE and return the encryption key.
        
        Args:
            phrase: The phrase to authenticate
            secret_tag: The secret tag to authenticate against
            
        Returns:
            Encryption key if authentication successful, None otherwise
        """
        try:
            # Create a compatible SecretTag object for the opaque_keys module
            from ..crypto.opaque_keys import SecretTag as OpaqueSecretTag
            import base64
            
            # Convert database SecretTag to opaque_keys SecretTag format
            opaque_tag = OpaqueSecretTag(
                tag_id_b64=base64.b64encode(secret_tag.phrase_hash).decode('ascii'),
                salt_b64=base64.b64encode(secret_tag.salt).decode('ascii'),
                verifier_b64=base64.b64encode(secret_tag.verifier_kv).decode('ascii')  # Use verifier_kv field
            )
            
            # Use the OPAQUE key derivation to authenticate and get encryption key
            encryption_key = authenticate_secret_phrase(phrase, opaque_tag)
            return encryption_key  # This is the encryption key, not just a boolean
            
        except Exception as e:
            logger.error(f"OPAQUE authentication failed: {e}")
            return None

# Factory function for creating phrase processor instances
def create_phrase_processor(db: Session) -> SecretPhraseProcessor:
    """
    Create a SecretPhraseProcessor instance.
    
    Args:
        db: Database session
        
    Returns:
        Configured SecretPhraseProcessor instance
    """
    return SecretPhraseProcessor(db) 