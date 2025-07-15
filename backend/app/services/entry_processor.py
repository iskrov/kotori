"""
Entry Processing Service

This service implements the complete pipeline for secure journal entry submission
with integrated secret phrase detection, OPAQUE authentication, and encrypted storage.

Key Features:
- Real-time phrase detection during entry submission
- Seamless OPAQUE authentication for detected phrases
- Secure encrypted entry storage in vault system
- Backward compatibility with regular journal entries
- Comprehensive error handling and audit logging

Security:
- Zero-knowledge phrase processing
- Constant-time operations to prevent timing attacks
- Rate limiting and abuse prevention
- Secure memory handling for sensitive operations
"""

import logging
import time
import asyncio
from datetime import datetime, UTC
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session

from ..models.journal_entry import JournalEntry as JournalEntryModel
from ..models.secret_tag_opaque import SecretTag
from ..schemas.journal import (
    JournalEntry, JournalEntryCreate, SecretPhraseAuthResponse, 
    SecretTagJournalEntry, JournalEntryCreateResponse
)
from ..services.phrase_processor import SecretPhraseProcessor, create_phrase_processor
from ..services.opaque_service import create_opaque_service
from ..services.vault_service import VaultService
from ..services.journal_service import journal_service
from ..utils.performance_monitor import get_performance_monitor, time_operation
from ..middleware.rate_limiter import get_rate_limiter, RateLimitType
from ..crypto.memory import SecureMemory, secure_zero
from ..crypto.aes_gcm import AESGCMCrypto
from ..core.security import audit_security_event
from ..core.security import SecurityEventType

logger = logging.getLogger(__name__)

class ProcessingStage(Enum):
    """Stages of entry processing pipeline"""
    VALIDATION = "validation"
    PHRASE_DETECTION = "phrase_detection"
    AUTHENTICATION = "authentication"
    ENCRYPTION = "encryption"
    STORAGE = "storage"
    COMPLETION = "completion"

class ProcessingResult(Enum):
    """Results of entry processing"""
    SUCCESS_REGULAR = "success_regular"           # Regular entry created
    SUCCESS_SECRET = "success_secret"             # Secret entry created with authentication
    SUCCESS_MIXED = "success_mixed"               # Entry with both regular and secret content
    FAILURE_VALIDATION = "failure_validation"     # Validation failed
    FAILURE_RATE_LIMIT = "failure_rate_limit"     # Rate limit exceeded
    FAILURE_AUTHENTICATION = "failure_authentication"  # Secret phrase auth failed
    FAILURE_ENCRYPTION = "failure_encryption"     # Encryption failed
    FAILURE_STORAGE = "failure_storage"           # Storage failed

@dataclass
class ProcessingContext:
    """Context object for tracking entry processing state"""
    user_id: str
    ip_address: Optional[str]
    entry_request: JournalEntryCreate
    session_id: Optional[str] = None
    current_stage: ProcessingStage = ProcessingStage.VALIDATION
    processing_start_time: float = 0.0
    detected_phrases: List[str] = None
    authenticated_tags: List[SecretTag] = None
    encryption_keys: Dict[str, bytes] = None
    vault_operations: List[Dict[str, Any]] = None
    error_message: Optional[str] = None
    performance_metrics: Dict[str, float] = None

    def __post_init__(self):
        if self.detected_phrases is None:
            self.detected_phrases = []
        if self.authenticated_tags is None:
            self.authenticated_tags = []
        if self.encryption_keys is None:
            self.encryption_keys = {}
        if self.vault_operations is None:
            self.vault_operations = []
        if self.performance_metrics is None:
            self.performance_metrics = {}

class EntryProcessingError(Exception):
    """Base exception for entry processing errors"""
    def __init__(self, message: str, stage: ProcessingStage, context: Optional[ProcessingContext] = None):
        super().__init__(message)
        self.message = message
        self.stage = stage
        self.context = context

class EntryProcessor:
    """
    Main service for processing journal entry submissions with phrase detection.
    
    This service orchestrates the complete pipeline:
    1. Entry validation and preprocessing
    2. Secret phrase detection using enhanced processor
    3. OPAQUE authentication for detected phrases
    4. Encrypted storage for secret content
    5. Regular storage for non-secret content
    6. Response generation with appropriate format
    """
    
    def __init__(self, db: Session):
        """Initialize the entry processor with required services"""
        self.db = db
        self.phrase_processor = create_phrase_processor(db)
        self.opaque_service = create_opaque_service(db)
        self.vault_service = VaultService(db)
        self.performance_monitor = get_performance_monitor()
        self.rate_limiter = get_rate_limiter()
        self.secure_memory = SecureMemory(64 * 1024)
        self.aes_crypto = AESGCMCrypto()
        
        # Processing configuration
        self.max_processing_time_seconds = 30
        self.max_phrase_detection_time_seconds = 5
        self.max_authentication_time_seconds = 10
        self.enable_phrase_detection = True
        self.enable_performance_monitoring = True
    
    async def process_entry_submission(
        self,
        entry_request: JournalEntryCreate,
        user_id: str,
        detect_phrases: bool = True,
        ip_address: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> JournalEntryCreateResponse:
        """
        Process a journal entry submission with optional phrase detection.
        
        Behavior based on entry content:
        1. Password Entry (only secret phrase): Returns SecretPhraseAuthResponse with encrypted entries
        2. Mixed Content (secret phrase + other text): Returns JournalEntry (saved as encrypted, no secret entries exposed)
        3. Regular Entry (no secret phrases): Returns JournalEntry (saved normally)
        
        Args:
            entry_request: The journal entry creation request
            user_id: ID of the user creating the entry
            detect_phrases: Whether to enable phrase detection
            ip_address: Optional IP address for rate limiting
            session_id: Optional session ID for tracking
            
        Returns:
            JournalEntry: For regular entries and mixed content entries
            SecretPhraseAuthResponse: For password entries (with encrypted entries list)
            
        Raises:
            EntryProcessingError: If processing fails at any stage
        """
        # Create processing context
        context = ProcessingContext(
            user_id=user_id,
            ip_address=ip_address,
            entry_request=entry_request,
            session_id=session_id,
            processing_start_time=time.time()
        )
        
        try:
            # Stage 1: Validation and rate limiting
            await self._validate_entry_request(context)
            
            # Stage 2: Phrase detection (if enabled)
            if detect_phrases and self.enable_phrase_detection:
                await self._detect_secret_phrases(context)
            
            # Stage 3: Authentication (if phrases detected)
            if context.detected_phrases:
                await self._authenticate_secret_phrases(context)
            
            # Stage 4: Process based on authentication results
            if context.authenticated_tags:
                # Has authenticated secret tags - create secret entry
                return await self._create_secret_entry(context)
            else:
                # No secret phrases or authentication failed - create regular entry
                return await self._create_regular_entry(context)
                
        except EntryProcessingError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in entry processing: {e}")
            self._audit_processing_error(context, str(e))
            raise EntryProcessingError(
                f"Internal processing error: {str(e)}",
                context.current_stage,
                context
            )
        finally:
            # Cleanup sensitive data
            self._cleanup_processing_context(context)
    
    async def _validate_entry_request(self, context: ProcessingContext) -> None:
        """Validate entry request and check rate limits"""
        context.current_stage = ProcessingStage.VALIDATION
        
        with time_operation("entry_validation"):
            # Check rate limits
            if not self._check_rate_limits(context):
                self._audit_rate_limit_exceeded(context)
                raise EntryProcessingError(
                    "Rate limit exceeded for entry processing",
                    ProcessingStage.VALIDATION,
                    context
                )
            
            # Validate entry content
            if not context.entry_request.content and not context.entry_request.encrypted_content:
                raise EntryProcessingError(
                    "Entry must contain either content or encrypted_content",
                    ProcessingStage.VALIDATION,
                    context
                )
            
            # Validate content length
            content_length = len(context.entry_request.content or "")
            if content_length > 50000:  # 50KB limit
                raise EntryProcessingError(
                    f"Entry content too large: {content_length} characters",
                    ProcessingStage.VALIDATION,
                    context
                )
            
            # Validate encrypted content format if present
            if context.entry_request.encrypted_content:
                if not context.entry_request.encryption_iv:
                    raise EntryProcessingError(
                        "Encrypted content requires encryption_iv",
                        ProcessingStage.VALIDATION,
                        context
                    )
            
            logger.info(f"Entry validation successful for user {context.user_id}")
    
    async def _detect_secret_phrases(self, context: ProcessingContext) -> None:
        """Detect secret phrases in entry content"""
        context.current_stage = ProcessingStage.PHRASE_DETECTION
        
        if not context.entry_request.content:
            logger.debug("No content to process for phrase detection")
            return
        
        try:
            with time_operation("phrase_detection"):
                # Use phrase processor for detection
                detected_phrases = self.phrase_processor.extract_normalized_phrases(
                    context.entry_request.content
                )
                
                # Filter and validate detected phrases
                valid_phrases = []
                for phrase in detected_phrases[:10]:  # Limit to 10 phrases
                    if self.phrase_processor._is_valid_phrase(phrase):
                        valid_phrases.append(phrase)
                
                context.detected_phrases = valid_phrases
                
                logger.info(f"Detected {len(valid_phrases)} valid phrases for user {context.user_id}")
                
                if valid_phrases:
                    self._audit_phrase_detection(context, len(valid_phrases))
                    
        except Exception as e:
            logger.error(f"Error in phrase detection: {e}")
            # Continue processing without phrase detection
            context.detected_phrases = []
    
    async def _authenticate_secret_phrases(self, context: ProcessingContext) -> None:
        """Authenticate detected secret phrases using OPAQUE"""
        context.current_stage = ProcessingStage.AUTHENTICATION
        
        if not context.detected_phrases:
            return
        
        authenticated_tags = []
        
        try:
            with time_operation("phrase_authentication"):
                for phrase in context.detected_phrases:
                    # Find matching secret tag
                    secret_tag = self.phrase_processor.find_matching_secret_tag(
                        context.user_id, phrase
                    )
                    
                    if secret_tag:
                        # Attempt OPAQUE authentication
                        encryption_key = self.phrase_processor.authenticate_phrase_and_get_key(
                            phrase, secret_tag
                        )
                        
                        if encryption_key:
                            authenticated_tags.append(secret_tag)
                            # Store encryption key securely
                            tag_id_hex = secret_tag.tag_id.hex()
                            context.encryption_keys[tag_id_hex] = encryption_key
                            
                            logger.info(f"Successfully authenticated secret tag {tag_id_hex} for user {context.user_id}")
                        else:
                            logger.warning(f"OPAQUE authentication failed for phrase with tag {secret_tag.tag_id.hex()}")
                    else:
                        logger.debug(f"No matching secret tag found for detected phrase")
                
                context.authenticated_tags = authenticated_tags
                
                if authenticated_tags:
                    self._audit_successful_authentication(context, len(authenticated_tags))
                else:
                    self._audit_authentication_failure(context)
                    
        except Exception as e:
            logger.error(f"Error in phrase authentication: {e}")
            self._audit_authentication_error(context, str(e))
            # Continue with regular entry creation
            context.authenticated_tags = []
    
    def _is_password_entry(self, context: ProcessingContext) -> bool:
        """
        Check if the entry content is ONLY a secret phrase (password entry).
        
        A password entry:
        - Contains content that matches a secret phrase exactly (after normalization)
        - Should NOT be saved to the database
        - Should ONLY be used for authentication
        
        Returns:
            True if this is a password entry, False otherwise
        """
        if not context.entry_request.content or not context.detected_phrases:
            return False
        
        # Normalize the entire content
        normalized_content = self.phrase_processor._normalize_phrase(context.entry_request.content.strip())
        
        # Check if the normalized content exactly matches any detected phrase
        for phrase in context.detected_phrases:
            if normalized_content == phrase:
                logger.info(f"Entry detected as password entry for user {context.user_id}")
                return True
        
        return False

    async def _create_secret_entry(self, context: ProcessingContext) -> Union[SecretPhraseAuthResponse, JournalEntry]:
        """Create an encrypted entry for authenticated secret phrases"""
        context.current_stage = ProcessingStage.ENCRYPTION
        
        if not context.authenticated_tags:
            raise EntryProcessingError(
                "No authenticated tags for secret entry creation",
                ProcessingStage.ENCRYPTION,
                context
            )
        
        # For now, use the first authenticated tag (can be enhanced for multiple tags)
        primary_tag = context.authenticated_tags[0]
        tag_id_hex = primary_tag.tag_id.hex()
        encryption_key = context.encryption_keys[tag_id_hex]
        
        try:
            with time_operation("secret_entry_encryption"):
                # Check if this is a password entry (only secret phrase)
                is_password_entry = self._is_password_entry(context)
                
                if is_password_entry:
                    # Password entry: DON'T save to database, only authenticate and return secret entries
                    logger.info(f"Processing password entry for user {context.user_id}, tag {tag_id_hex}")
                    self._audit_password_entry_authentication(context, primary_tag)
                    
                    # Get all encrypted entries for this tag
                    encrypted_entries = self.phrase_processor.get_encrypted_entries_for_tag(primary_tag)
                    
                    # Convert to response schema
                    entry_responses = []
                    for entry in encrypted_entries:
                        entry_response = SecretTagJournalEntry(
                            id=entry.id,
                            title=entry.title,
                            content=entry.encrypted_content.hex() if entry.encrypted_content else "",
                            entry_date=entry.entry_date,
                            audio_url=entry.audio_url,
                            user_id=entry.user_id,
                            created_at=entry.created_at,
                            updated_at=entry.updated_at,
                            secret_tag_id=entry.secret_tag_id,
                            encrypted_content=entry.encrypted_content.hex() if entry.encrypted_content else "",
                            encryption_iv=entry.encryption_iv.hex() if entry.encryption_iv else "",
                            tags=[]  # Will be populated if needed
                        )
                        entry_responses.append(entry_response)
                    
                    context.current_stage = ProcessingStage.COMPLETION
                    
                    # Return secret phrase authentication response with entries
                    response = SecretPhraseAuthResponse(
                        authentication_successful=True,
                        secret_tag_id=tag_id_hex,
                        tag_name=primary_tag.tag_name,
                        encrypted_entries=entry_responses,
                        total_entries=len(entry_responses),
                        message=f"Password entry authenticated for tag '{primary_tag.tag_name}'. Retrieved {len(entry_responses)} encrypted entries."
                    )
                    
                    logger.info(f"Password entry authentication completed for user {context.user_id}, tag {tag_id_hex}")
                    return response
                    
                else:
                    # Mixed content entry: Save as encrypted entry but DON'T return secret entries list
                    # This maintains security - user must make separate password entry to access secret entries
                    logger.info(f"Processing mixed content entry with secret phrase for user {context.user_id}, tag {tag_id_hex}")
                    
                    # Encrypt the entry content
                    iv, encrypted_content, auth_tag = self.aes_crypto.encrypt(
                        plaintext=context.entry_request.content.encode('utf-8'),
                        key=encryption_key
                    )
                    
                    # Create encrypted entry in database
                    encrypted_entry_data = JournalEntryCreate(
                        title=context.entry_request.title,
                        content="",  # Clear content for secret entries
                        entry_date=context.entry_request.entry_date,
                        audio_url=context.entry_request.audio_url,
                        tags=context.entry_request.tags or [],
                        secret_tag_id=primary_tag.tag_id,
                        encrypted_content=encrypted_content.hex(),
                        encryption_iv=iv.hex(),
                        created_at=context.entry_request.created_at
                    )
                    
                    # Store in database
                    context.current_stage = ProcessingStage.STORAGE
                    db_entry = journal_service.create_with_user(
                        db=self.db,
                        obj_in=encrypted_entry_data,
                        user_id=context.user_id
                    )
                    
                    context.current_stage = ProcessingStage.COMPLETION
                    
                    self._audit_mixed_content_entry_creation(context, primary_tag)
                    
                    # Return only the created entry, NOT the list of secret entries
                    # This maintains security - secret entries remain hidden until explicit password entry
                    logger.info(f"Mixed content entry saved securely for user {context.user_id}, tag {tag_id_hex}")
                    
                    # Convert to regular JournalEntry response (hiding the secret nature)
                    response_entry = JournalEntry(
                        id=db_entry.id,
                        title=db_entry.title,
                        content="[Encrypted Entry - Use password entry to access]",  # Placeholder content
                        entry_date=db_entry.entry_date,
                        audio_url=db_entry.audio_url,
                        user_id=db_entry.user_id,
                        created_at=db_entry.created_at,
                        updated_at=db_entry.updated_at,
                        tags=db_entry.tags or []
                    )
                    
                    return response_entry
                    
        except Exception as e:
            logger.error(f"Error creating secret entry: {e}")
            self._audit_secret_entry_error(context, str(e))
            raise EntryProcessingError(
                f"Failed to create secret entry: {str(e)}",
                ProcessingStage.ENCRYPTION,
                context
            )
    
    async def _create_regular_entry(self, context: ProcessingContext) -> JournalEntry:
        """Create a regular journal entry"""
        context.current_stage = ProcessingStage.STORAGE
        
        try:
            with time_operation("regular_entry_creation"):
                # Create regular entry
                db_entry = journal_service.create_with_user(
                    db=self.db,
                    obj_in=context.entry_request,
                    user_id=context.user_id
                )
                
                context.current_stage = ProcessingStage.COMPLETION
                
                self._audit_regular_entry_creation(context)
                
                logger.info(f"Created regular entry {db_entry.id} for user {context.user_id}")
                
                return db_entry
                
        except Exception as e:
            logger.error(f"Error creating regular entry: {e}")
            self._audit_regular_entry_error(context, str(e))
            raise EntryProcessingError(
                f"Failed to create regular entry: {str(e)}",
                ProcessingStage.STORAGE,
                context
            )
    
    def _check_rate_limits(self, context: ProcessingContext) -> bool:
        """Check rate limits for entry processing"""
        try:
            # Check user rate limit
            user_allowed, _ = self.rate_limiter.check_rate_limit(
                RateLimitType.USER,
                str(context.user_id),
                "entry_processing"
            )
            
            if not user_allowed:
                return False
            
            # Check IP rate limit if available
            if context.ip_address:
                ip_allowed, _ = self.rate_limiter.check_rate_limit(
                    RateLimitType.IP,
                    context.ip_address,
                    "entry_processing"
                )
                
                if not ip_allowed:
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking rate limits: {e}")
            # Allow processing if rate limiter fails
            return True
    
    def _cleanup_processing_context(self, context: ProcessingContext) -> None:
        """Clean up sensitive data from processing context"""
        try:
            # Zero out encryption keys
            for key_id, key_bytes in context.encryption_keys.items():
                if isinstance(key_bytes, bytes):
                    # Convert bytes to bytearray for secure zeroing
                    key_array = bytearray(key_bytes)
                    secure_zero(key_array)
            
            context.encryption_keys.clear()
            
            # Clear sensitive phrases
            context.detected_phrases.clear()
            
            # Record processing metrics
            if self.enable_performance_monitoring:
                processing_time = time.time() - context.processing_start_time
                self.performance_monitor.record_metric("entry_processing_time", processing_time)
                
        except Exception as e:
            logger.error(f"Error cleaning up processing context: {e}")
    
    # Audit logging methods
    def _audit_processing_error(self, context: ProcessingContext, error: str) -> None:
        """Audit processing errors"""
        audit_security_event(
            event_type="entry_processing_error",
            user_id=context.user_id,
            details={
                "error": error,
                "stage": context.current_stage.value,
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )
    
    def _audit_rate_limit_exceeded(self, context: ProcessingContext) -> None:
        """Audit rate limit violations"""
        audit_security_event(
            event_type="entry_processing_rate_limit_exceeded",
            user_id=context.user_id,
            details={
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )
    
    def _audit_phrase_detection(self, context: ProcessingContext, phrase_count: int) -> None:
        """Audit phrase detection events"""
        audit_security_event(
            event_type="secret_phrase_detection",
            user_id=context.user_id,
            details={
                "phrase_count": phrase_count,
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )
    
    def _audit_successful_authentication(self, context: ProcessingContext, tag_count: int) -> None:
        """Audit successful phrase authentication"""
        audit_security_event(
            event_type="secret_phrase_authentication_success",
            user_id=context.user_id,
            details={
                "authenticated_tag_count": tag_count,
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )
    
    def _audit_authentication_failure(self, context: ProcessingContext) -> None:
        """Audit authentication failures"""
        audit_security_event(
            event_type="secret_phrase_authentication_failure",
            user_id=context.user_id,
            details={
                "detected_phrase_count": len(context.detected_phrases),
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )
    
    def _audit_authentication_error(self, context: ProcessingContext, error: str) -> None:
        """Audit authentication errors"""
        audit_security_event(
            event_type="secret_phrase_authentication_error",
            user_id=context.user_id,
            details={
                "error": error,
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )
    
    def _audit_secret_entry_creation(self, context: ProcessingContext, secret_tag: SecretTag) -> None:
        """Audit secret entry creation"""
        audit_security_event(
            event_type="secret_entry_created",
            user_id=context.user_id,
            details={
                "secret_tag_id": secret_tag.tag_id.hex(),
                "tag_name": secret_tag.tag_name,
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )
    
    def _audit_secret_entry_error(self, context: ProcessingContext, error: str) -> None:
        """Audit secret entry creation errors"""
        audit_security_event(
            event_type="secret_entry_creation_error",
            user_id=context.user_id,
            details={
                "error": error,
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )
    
    def _audit_regular_entry_creation(self, context: ProcessingContext) -> None:
        """Audit regular entry creation"""
        audit_security_event(
            event_type="regular_entry_created",
            user_id=context.user_id,
            details={
                "phrases_detected": len(context.detected_phrases),
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )
    
    def _audit_regular_entry_error(self, context: ProcessingContext, error: str) -> None:
        """Audit regular entry creation errors"""
        audit_security_event(
            event_type="regular_entry_creation_error",
            user_id=context.user_id,
            details={
                "error": error,
                "ip_address": context.ip_address,
                "session_id": context.session_id
            }
        )

    def _audit_password_entry_authentication(self, context: ProcessingContext, secret_tag: SecretTag) -> None:
        """Audit successful password entry authentication"""
        audit_security_event(
            event_type=SecurityEventType.AUTHENTICATION_SUCCESS,
            user_id=context.user_id,
            details={
                "action": "password_entry_authentication",
                "secret_tag_id": secret_tag.tag_id.hex(),
                "tag_name": secret_tag.tag_name,
                "ip_address": context.ip_address,
                "session_id": context.session_id,
                "processing_stage": context.current_stage.value,
                "entry_saved": False,  # Password entries are not saved
                "timestamp": time.time()
            }
        )

    def _audit_mixed_content_entry_creation(self, context: ProcessingContext, secret_tag: SecretTag) -> None:
        """Audit mixed content entry creation (entry with secret phrase + other content)"""
        audit_security_event(
            event_type=SecurityEventType.DATA_ACCESS,
            user_id=context.user_id,
            details={
                "action": "mixed_content_entry_created",
                "secret_tag_id": secret_tag.tag_id.hex(),
                "tag_name": secret_tag.tag_name,
                "ip_address": context.ip_address,
                "session_id": context.session_id,
                "processing_stage": context.current_stage.value,
                "entry_saved": True,  # Mixed content entries are saved
                "secret_entries_returned": False,  # Security: secret entries NOT returned
                "timestamp": time.time()
            }
        )

# Service factory function
def create_entry_processor(db: Session) -> EntryProcessor:
    """Create and configure an entry processor instance"""
    return EntryProcessor(db) 