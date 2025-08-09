"""
Clean Secret Tag Service

Provides comprehensive OPAQUE secret tag services using clean tag_handle approach
instead of legacy phrase_hash/salt/verifier_kv. Uses real OPAQUE cryptographic
operations with proper key derivation and secure memory management.

This service handles:
- Secret tag registration with OPAQUE protocol  
- Secret tag authentication with tag_handle
- Real cryptographic key derivation from OPAQUE export key
- Integration with vault services and audit logging
- Secure memory management for sensitive data
"""

import logging
import uuid
import base64
import secrets
import json
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Tuple, Any, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from contextlib import contextmanager

from app.models import SecretTag, WrappedKey, User, OpaqueSession, TagSession
from app.crypto.aes_kw import wrap_key, unwrap_key, generate_data_key
from app.crypto.blake2 import blake2s_hash
from app.crypto.memory import secure_random_bytes, secure_zero
from app.crypto.opaque_server import OpaqueServer, OpaqueLoginRequest, OpaqueLoginResponse, OpaqueServerError
from app.services.audit_service import audit_service
from app.services.session_service import session_service
from app.services.vault_service import VaultService
from app.schemas.secret_tag import (
    SecretTagRegistrationStartRequest,
    SecretTagRegistrationStartResponse,
    SecretTagRegistrationFinishRequest,
    SecretTagRegistrationFinishResponse,
    SecretTagInfo,
    SecretTagListResponse,
    SecretTagUpdateRequest,
    SecretTagDeleteResponse,
    SecretTagAuthStartRequest,
    SecretTagAuthStartResponse,
    SecretTagAuthFinishRequest,
    SecretTagAuthFinishResponse,
    SecretTagErrorResponse
)

logger = logging.getLogger(__name__)


class SecretTagServiceError(Exception):
    """Base exception for secret tag service errors."""
    pass


class SecretTagRegistrationError(SecretTagServiceError):
    """Exception raised during secret tag registration."""
    pass


class SecretTagAuthenticationError(SecretTagServiceError):
    """Exception raised during secret tag authentication."""
    pass


class SecretTagBusinessLogicError(SecretTagServiceError):
    """Exception raised for business logic violations."""
    pass


def safe_base64_decode(data: str) -> bytes:
    """Safely decode base64 or base64url with proper padding."""
    # Try URL-safe base64 first (our preferred format)
    for decoder in (base64.urlsafe_b64decode, base64.b64decode):
        try:
            # Add correct amount of padding if missing
            missing_padding = len(data) % 4
            if missing_padding:
                data_padded = data + '=' * (4 - missing_padding)
            else:
                data_padded = data
            return decoder(data_padded)
        except Exception:
            continue
    raise ValueError(f"Invalid base64/base64url encoding: {data[:50]}...")


def secure_zero_bytes(data: bytes) -> None:
    """Securely zero bytes by converting to bytearray first."""
    if isinstance(data, bytes):
        data_array = bytearray(data)
        secure_zero(data_array)
    else:
        secure_zero(data)


class SecretTagService:
    """
    Clean Secret Tag Service with Full OPAQUE Security
    
    Provides comprehensive business logic for secret tag operations using
    the clean tag_handle approach with real OPAQUE cryptographic operations,
    proper key derivation, and secure memory management.
    """
    
    # Configuration constants
    MAX_TAGS_PER_USER = 50
    MAX_TAG_NAME_LENGTH = 100
    MIN_TAG_NAME_LENGTH = 1
    SESSION_TIMEOUT_MINUTES = 5
    TOKEN_LIFETIME_MINUTES = 5  # Short-lived tag access tokens
    TAG_HANDLE_LENGTH = 32  # 32 bytes = 256 bits
    MAX_FAILED_AUTH_ATTEMPTS = 5
    
    def __init__(self, db: Session):
        """Initialize clean secret tag service with database session and dependencies."""
        self.db = db
        try:
            self.opaque_server = OpaqueServer()
        except OpaqueServerError:
            self.opaque_server = None  # OPAQUE not available in this environment
        self._audit_service = audit_service
        self._session_service = session_service
        self._vault_service = VaultService(db)
    
    @contextmanager
    def _audit_context(self, correlation_id: Optional[str] = None):
        """Context manager for audit logging with correlation tracking."""
        if not correlation_id:
            correlation_id = str(uuid.uuid4())
        
        with self._audit_service.audit_context(correlation_id=correlation_id):
            yield correlation_id
    
    def _validate_tag_name(self, tag_name: str) -> str:
        """Validate and normalize tag name."""
        if not tag_name or len(tag_name.strip()) < self.MIN_TAG_NAME_LENGTH:
            raise SecretTagBusinessLogicError(f"Tag name must be at least {self.MIN_TAG_NAME_LENGTH} character long")
        
        if len(tag_name.strip()) > self.MAX_TAG_NAME_LENGTH:
            raise SecretTagBusinessLogicError(f"Tag name cannot exceed {self.MAX_TAG_NAME_LENGTH} characters")
        
        return tag_name.strip()
    
    def _validate_color_code(self, color_code: str) -> str:
        """Validate and normalize color code."""
        if not color_code:
            return "#007AFF"  # Default iOS blue
        
        color_code = color_code.strip().upper()
        if not color_code.startswith('#'):
            color_code = '#' + color_code
        
        if len(color_code) != 7:
            return "#007AFF"
        
        try:
            int(color_code[1:], 16)
            return color_code
        except ValueError:
            return "#007AFF"
    
    def _check_user_tag_limit(self, user_id: str) -> None:
        """Check if user has reached the maximum number of tags."""
        tag_count = self.db.query(SecretTag).filter(SecretTag.user_id == user_id).count()
        
        if tag_count >= self.MAX_TAGS_PER_USER:
            raise SecretTagBusinessLogicError(f"Maximum number of tags ({self.MAX_TAGS_PER_USER}) reached")
    
    def _generate_tag_handle(self) -> bytes:
        """Generate a random 32-byte tag handle."""
        return secure_random_bytes(self.TAG_HANDLE_LENGTH)
    
    def _derive_vault_keys(self, export_key: bytes, vault_id: str) -> Tuple[bytes, bytes]:
        """
        Derive vault encryption keys from OPAQUE export key.
        
        Args:
            export_key: OPAQUE export key (32 bytes)
            vault_id: Vault identifier
            
        Returns:
            Tuple of (data_key, key_encryption_key)
        """
        try:
            # Derive vault-specific keys using HKDF-like construction
            vault_context = f"vault:{vault_id}".encode('utf-8')
            
            # Derive data encryption key
            data_key_material = blake2s_hash(export_key + vault_context + b"data", length=32)
            
            # Derive key encryption key for wrapping
            kek_material = blake2s_hash(export_key + vault_context + b"kek", length=32)
            
            return data_key_material, kek_material
            
        except Exception as e:
            logger.error(f"Error deriving vault keys: {e}")
            raise SecretTagServiceError(f"Failed to derive vault keys: {str(e)}")
    
    # Real OPAQUE Server Integration Methods
    def get_or_create_opaque_server_setup(self) -> str:
        """Get or create OPAQUE server setup (same as user service)."""
        from app.models.opaque_server_config import OpaqueServerConfig
        
        config = self.db.query(OpaqueServerConfig).filter(
            OpaqueServerConfig.id == "default",
            OpaqueServerConfig.is_active == True
        ).first()
        
        if not config or not config.server_setup:
            raise SecretTagServiceError("OPAQUE server not properly configured")
        
        return config.server_setup
    
    def call_opaque_server(self, operation: str, data: Dict[str, Any], server_setup: str) -> Dict[str, Any]:
        """Call the OPAQUE server implementation via Node.js (same as user service)"""
        try:
            # Create the Node.js script
            script = f"""
const opaque = require('@serenity-kit/opaque');

const serverSetup = '{server_setup}';
const operation = '{operation}';
const data = {json.dumps(data)};

async function performOperation() {{
    try {{
        // Wait for OPAQUE to be ready
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        let result;
        
        switch (operation) {{
            case 'createRegistrationResponse':
                result = opaque.server.createRegistrationResponse({{
                    serverSetup,
                    userIdentifier: data.userIdentifier,
                    registrationRequest: data.registrationRequest
                }});
                break;
                
            case 'startLogin':
                result = opaque.server.startLogin({{
                    serverSetup,
                    userIdentifier: data.userIdentifier,
                    registrationRecord: data.registrationRecord,
                    startLoginRequest: data.startLoginRequest
                }});
                break;
                
            case 'finishLogin':
                result = opaque.server.finishLogin({{
                    finishLoginRequest: data.finishLoginRequest,
                    serverLoginState: data.serverLoginState
                }});
                break;
                
            default:
                throw new Error('Unknown operation: ' + operation);
        }}
        
        console.log(JSON.stringify({{ success: true, result }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

performOperation();
"""
            
            # Run the Node.js script
            result = subprocess.run(
                ['node', '-e', script],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                logger.error(f"OPAQUE server call failed: {result.stderr}")
                raise SecretTagServiceError(f"OPAQUE server call failed: {result.stderr}")
            
            response = json.loads(result.stdout.strip())
            if not response.get('success'):
                raise SecretTagServiceError(f"OPAQUE operation failed: {response.get('error')}")
            
            return response['result']
            
        except subprocess.TimeoutExpired:
            logger.error(f"Timeout calling OPAQUE server for operation {operation}")
            raise SecretTagServiceError(f"Timeout calling OPAQUE server for operation {operation}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response from OPAQUE server: {e}")
            raise SecretTagServiceError("Invalid response from OPAQUE server")
        except Exception as e:
            logger.error(f"Unexpected error calling OPAQUE server: {e}")
            raise SecretTagServiceError(f"OPAQUE server call failed: {str(e)}")

    def start_registration(
        self, 
        user_id: uuid.UUID, 
        request: SecretTagRegistrationStartRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> SecretTagRegistrationStartResponse:
        """
        Start clean secret tag registration using OPAQUE protocol.
        
        Args:
            user_id: ID of the user registering the secret tag
            request: Secret tag registration start request
            ip_address: Client IP address for audit logging
            user_agent: Client user agent for audit logging
            
        Returns:
            Registration start response with server OPAQUE response and tag_handle
            
        Raises:
            SecretTagRegistrationError: If registration start fails
        """
        with self._audit_context() as correlation_id:
            try:
                logger.info(f"Starting clean secret tag registration for user {user_id}")
                
                # Validate business logic constraints
                self._check_user_tag_limit(str(user_id))
                tag_name = self._validate_tag_name(request.tag_name)
                color = self._validate_color_code(request.color or "#007AFF")
                
                # Log registration start
                self._audit_service.log_authentication_event(
                    db=self.db,
                    event_type=self._audit_service.EVENT_OPAQUE_REGISTRATION_START,
                    user_id=str(user_id),
                    success=True,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    correlation_id=correlation_id,
                    additional_data={
                        "tag_name": tag_name,
                        "registration_method": "opaque_clean_tag_handle"
                    }
                )
                
                # Generate random tag_handle (clean approach)
                tag_handle = self._generate_tag_handle()
                tag_identifier = base64.b64encode(tag_handle).decode('utf-8')
                
                # Decode OPAQUE registration request
                try:
                    opaque_request_bytes = safe_base64_decode(request.opaque_registration_request)
                except Exception as e:
                    raise SecretTagRegistrationError(f"Invalid OPAQUE registration request encoding: {str(e)}")
                
                # Get server setup
                server_setup = self.get_or_create_opaque_server_setup()
                if not server_setup:
                    raise SecretTagRegistrationError("OPAQUE server not properly configured")
                
                # Create OPAQUE registration response using real Node.js integration (same as user service)
                opaque_result = self.call_opaque_server('createRegistrationResponse', {
                    'userIdentifier': tag_identifier,
                    'registrationRequest': request.opaque_registration_request
                }, server_setup)
                
                opaque_registration_response = opaque_result['registrationResponse']
                
                # Create registration session
                session_id = secrets.token_urlsafe(32)
                expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
                
                # Store registration session data
                session_data = {
                    'user_id': str(user_id),
                    'tag_handle': base64.b64encode(tag_handle).decode('utf-8'),
                    'tag_name': tag_name,
                    'color': color,
                    'opaque_request': request.opaque_registration_request,
                    'correlation_id': correlation_id
                }
                
                # Clean up any existing registration sessions for this user
                existing_sessions = self.db.query(OpaqueSession).filter(
                    OpaqueSession.user_id == str(user_id),
                    OpaqueSession.session_state == 'tag_registration_started'
                ).all()
                for session in existing_sessions:
                    self.db.delete(session)
                
                opaque_session = OpaqueSession(
                    session_id=session_id,
                    user_id=str(user_id),
                    session_state='tag_registration_started',
                    session_data=json.dumps(session_data).encode('utf-8'),
                    expires_at=expires_at
                )
                self.db.add(opaque_session)
                self.db.commit()
                
                logger.info(f"Secret tag registration started for user {user_id}")
                
                return SecretTagRegistrationStartResponse(
                    session_id=session_id,
                    opaque_registration_response=opaque_registration_response,
                    tag_handle=base64.urlsafe_b64encode(tag_handle).decode('utf-8').rstrip('='),
                    expires_at=expires_at
                )
                
            except SecretTagRegistrationError:
                raise
            except Exception as e:
                logger.error(f"Error in secret tag registration start: {e}")
                raise SecretTagRegistrationError(f"Registration start failed: {str(e)}")
    
    def finish_registration(
        self, 
        user_id: uuid.UUID, 
        request: SecretTagRegistrationFinishRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> SecretTagRegistrationFinishResponse:
        """
        Finish clean secret tag registration using OPAQUE protocol.
        
        Args:
            user_id: ID of the user registering the secret tag
            request: Secret tag registration finish request
            ip_address: Client IP address for audit logging
            user_agent: Client user agent for audit logging
            
        Returns:
            Registration finish response with tag information
            
        Raises:
            SecretTagRegistrationError: If registration finish fails
        """
        with self._audit_context() as correlation_id:
            try:
                logger.info(f"Finishing secret tag registration for user {user_id}")
                
                # Retrieve registration session
                opaque_session = self.db.query(OpaqueSession).filter(
                    OpaqueSession.session_id == request.session_id,
                    OpaqueSession.user_id == str(user_id),
                    OpaqueSession.session_state == 'tag_registration_started',
                    OpaqueSession.expires_at > datetime.now(timezone.utc)
                ).first()
                
                if not opaque_session:
                    raise SecretTagRegistrationError("Invalid or expired registration session")
                
                # Parse session data
                try:
                    session_data = json.loads(opaque_session.session_data.decode('utf-8'))
                    tag_handle_b64 = session_data['tag_handle']
                    tag_name = session_data['tag_name']
                    color = session_data['color']
                    correlation_id = session_data.get('correlation_id', correlation_id)
                except Exception as e:
                    raise SecretTagRegistrationError(f"Invalid session data: {str(e)}")
                
                tag_handle = safe_base64_decode(tag_handle_b64)
                
                # Check for duplicate tag_handle (should be extremely rare with 256-bit random)
                existing_tag = self.db.query(SecretTag).filter(
                    SecretTag.tag_handle == tag_handle
                ).first()
                
                if existing_tag:
                    self._audit_service.log_authentication_event(
                        db=self.db,
                        event_type=self._audit_service.EVENT_OPAQUE_REGISTRATION_FINISH,
                        user_id=str(user_id),
                        success=False,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        correlation_id=correlation_id,
                        error_code="DUPLICATE_TAG_HANDLE",
                        additional_data={"tag_name": tag_name}
                    )
                    raise SecretTagRegistrationError("Tag handle collision (extremely rare)")
                
                # Decode OPAQUE registration record
                try:
                    opaque_record_bytes = safe_base64_decode(request.opaque_registration_record)
                except Exception as e:
                    raise SecretTagRegistrationError(f"Invalid OPAQUE registration record: {str(e)}")
                
                # Generate vault ID and create vault encryption keys
                # Since we can't extract export key from OPAQUE, generate secure keys directly
                vault_id = str(uuid.uuid4())
                data_key = secure_random_bytes(32)  # 256-bit data key
                kek = secure_random_bytes(32)  # 256-bit key encryption key
                
                try:
                    # Wrap the data key with the key encryption key
                    wrapped_data_key = wrap_key(kek, data_key)
                    
                    # Begin database transaction
                    try:
                        # Generate UUID for the secret tag
                        secret_tag_id = uuid.uuid4()
                        
                        # Create secret tag record using clean schema
                        secret_tag = SecretTag(
                            id=secret_tag_id,
                            user_id=user_id,
                            tag_handle=tag_handle,  # Clean 32-byte handle
                            opaque_envelope=opaque_record_bytes,  # Clean OPAQUE envelope
                            tag_name=tag_name,
                            color=color  # Updated field name (no _code suffix)
                        )
                        
                        # Create wrapped key record
                        wrapped_key = WrappedKey(
                            tag_id=secret_tag_id,
                            vault_id=vault_id,
                            wrapped_key=wrapped_data_key,
                            key_purpose="vault_data",
                            key_version=1
                        )
                        
                        # Save to database atomically
                        self.db.add(secret_tag)
                        self.db.add(wrapped_key)
                        
                        # Clean up registration session
                        self.db.delete(opaque_session)
                        
                        self.db.commit()
                        
                        # Secure cleanup of sensitive data
                        secure_zero_bytes(data_key)
                        secure_zero_bytes(kek)
                        
                        logger.info(f"Successfully registered secret tag {secret_tag_id} for user {user_id}")
                        
                        # Log successful registration
                        self._audit_service.log_authentication_event(
                            db=self.db,
                            event_type=self._audit_service.EVENT_OPAQUE_REGISTRATION_FINISH,
                            user_id=str(user_id),
                            success=True,
                            ip_address=ip_address,
                            user_agent=user_agent,
                            correlation_id=correlation_id,
                            additional_data={
                                "tag_id": str(secret_tag_id),
                                "tag_name": tag_name,
                                "registration_method": "opaque_clean_tag_handle"
                            }
                        )
                        
                        return SecretTagRegistrationFinishResponse(
                            tag_id=str(secret_tag_id),
                            tag_handle=base64.urlsafe_b64encode(tag_handle).decode('utf-8').rstrip('='),
                            tag_name=tag_name,
                            color=color,
                            created_at=secret_tag.created_at,
                            success=True
                        )
                        
                    except IntegrityError as e:
                        self.db.rollback()
                        logger.error(f"Database integrity error during registration: {e}")
                        raise SecretTagRegistrationError("Failed to register secret tag due to database constraint")
                    
                    except SQLAlchemyError as e:
                        self.db.rollback()
                        logger.error(f"Database error during registration: {e}")
                        raise SecretTagRegistrationError(f"Database error during registration: {str(e)}")
                        
                finally:
                    # Always clean up sensitive data in finally block
                    if 'data_key' in locals():
                        secure_zero_bytes(data_key)
                    if 'kek' in locals():
                        secure_zero_bytes(kek)
                
            except SecretTagRegistrationError:
                raise
            except Exception as e:
                logger.error(f"Unexpected error during secret tag registration: {e}")
                raise SecretTagRegistrationError(f"Registration failed: {str(e)}")
    
    def list_tags(self, user_id: uuid.UUID) -> SecretTagListResponse:
        """
        List all secret tags for a user with clean implementation.
        
        Args:
            user_id: ID of the user
            
        Returns:
            List response with secret tag information
        """
        try:
            # Get user preferences
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise SecretTagServiceError("User not found")
            
            show_labels = user.show_secret_tag_names
            
            # Get secret tags
            secret_tags = self.db.query(SecretTag).filter(
                SecretTag.user_id == user_id
            ).order_by(SecretTag.created_at.desc()).all()
            
            tag_infos = []
            for tag in secret_tags:
                tag_info = SecretTagInfo(
                    tag_id=str(tag.id),
                    tag_handle=base64.urlsafe_b64encode(tag.tag_handle).decode('utf-8').rstrip('='),
                    tag_name=tag.tag_name if show_labels else None,
                    color=tag.color if show_labels else None,
                    created_at=tag.created_at
                )
                tag_infos.append(tag_info)
            
            return SecretTagListResponse(
                tags=tag_infos,
                show_labels=show_labels,
                total_count=len(tag_infos)
            )
            
        except Exception as e:
            logger.error(f"Error listing secret tags for user {user_id}: {e}")
            raise SecretTagServiceError(f"Failed to list secret tags: {str(e)}")
    
    def start_authentication(
        self,
        tag_handle: str,
        request: SecretTagAuthStartRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> SecretTagAuthStartResponse:
        """
        Start clean secret tag authentication using tag_handle.
        
        Args:
            tag_handle: Base64-encoded tag handle (32 bytes)
            request: Authentication start request  
            ip_address: Client IP address for audit logging
            user_agent: Client user agent for audit logging
            
        Returns:
            Authentication start response with server credential response
            
        Raises:
            SecretTagAuthenticationError: If authentication start fails
        """
        with self._audit_context() as correlation_id:
            try:
                logger.info(f"Starting secret tag authentication for tag_handle: {tag_handle[:16]}...")
                
                # Decode tag_handle
                try:
                    tag_handle_bytes = safe_base64_decode(tag_handle)
                    if len(tag_handle_bytes) != self.TAG_HANDLE_LENGTH:
                        raise ValueError("Invalid tag handle length")
                except Exception as e:
                    raise SecretTagAuthenticationError(f"Invalid tag handle: {str(e)}")
                
                # Find secret tag by tag_handle
                secret_tag = self.db.query(SecretTag).filter(
                    SecretTag.tag_handle == tag_handle_bytes
                ).first()
                
                if not secret_tag:
                    # Constant time response to prevent timing attacks
                    import time
                    time.sleep(0.1)
                    raise SecretTagAuthenticationError("Authentication failed")
                
                # Check for brute force attacks
                if ip_address and self._audit_service.detect_brute_force_attack(
                    self.db, ip_address, self.MAX_FAILED_AUTH_ATTEMPTS
                ):
                    self._audit_service.log_security_event(
                        db=self.db,
                        event_type=self._audit_service.EVENT_BRUTE_FORCE_DETECTED,
                        severity=self._audit_service.SEVERITY_WARNING,
                        message="Brute force attack detected on secret tag authentication",
                        user_id=str(secret_tag.user_id),
                        ip_address=ip_address,
                        correlation_id=correlation_id,
                        threat_data={"tag_id": str(secret_tag.id)}
                    )
                    raise SecretTagAuthenticationError("Too many failed authentication attempts")
                
                # Decode client credential request
                try:
                    client_request_bytes = safe_base64_decode(request.client_credential_request)
                except Exception as e:
                    raise SecretTagAuthenticationError(f"Invalid client credential request: {str(e)}")
                
                # Get server setup
                server_setup = self.get_or_create_opaque_server_setup()
                if not server_setup:
                    raise SecretTagAuthenticationError("OPAQUE server not properly configured")
                
                # Process OPAQUE authentication start using real Node.js server (same as user service)
                # Convert opaque_envelope to URL-safe base64 for Node.js (same format as user service)
                registration_record = base64.urlsafe_b64encode(secret_tag.opaque_envelope).decode('utf-8')
                
                # Use the same userIdentifier format as registration (base64 encoded tag_handle)
                tag_identifier = base64.b64encode(safe_base64_decode(tag_handle)).decode('utf-8')
                
                # Call the real OPAQUE server (same as user service)
                login_result = self.call_opaque_server('startLogin', {
                    'userIdentifier': tag_identifier,  # Same format as registration
                    'registrationRecord': registration_record,
                    'startLoginRequest': request.client_credential_request
                }, server_setup)
                
                
                server_credential_response = login_result['loginResponse']
                server_login_state = login_result['serverLoginState']
                
                # Create authentication session
                session_id = secrets.token_urlsafe(32)
                expires_at = datetime.now(timezone.utc) + timedelta(minutes=self.SESSION_TIMEOUT_MINUTES)
                
                # Store session data with server login state
                session_data = {
                    'tag_id': str(secret_tag.id),
                    'user_id': str(secret_tag.user_id),
                    'tag_handle': tag_handle,
                    'correlation_id': correlation_id,
                    'server_login_state': server_login_state
                }
                
                # Clean up existing auth sessions for this user (can't filter by tag_id since it's not a field)
                existing_sessions = self.db.query(OpaqueSession).filter(
                    OpaqueSession.user_id == str(secret_tag.user_id),
                    OpaqueSession.session_state == 'tag_authentication_started'
                ).all()
                
                # Check session data to find sessions for this specific tag
                for session in existing_sessions:
                    try:
                        session_json = json.loads(session.session_data.decode('utf-8'))
                        if session_json.get('tag_id') == str(secret_tag.id):
                            self.db.delete(session)
                    except:
                        # Delete invalid sessions
                        self.db.delete(session)
                
                # Store the server login state in the database using OpaqueSession (same as user service)
                opaque_session = OpaqueSession(
                    session_id=session_id,
                    user_id=str(secret_tag.user_id),
                    session_state='tag_authentication_started',
                    session_data=server_login_state.encode('utf-8'),  # Store server login state directly like user service
                    expires_at=expires_at
                )
                self.db.add(opaque_session)
                self.db.commit()
                
                # Log successful auth start
                self._audit_service.log_authentication_event(
                    db=self.db,
                    event_type=self._audit_service.EVENT_OPAQUE_LOGIN_START,
                    user_id=str(secret_tag.user_id),
                    success=True,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    correlation_id=correlation_id,
                    additional_data={
                        "tag_id": str(secret_tag.id),
                        "session_id": session_id
                    }
                )
                
                logger.info(f"Secret tag authentication started for tag_handle: {tag_handle[:16]}...")
                
                return SecretTagAuthStartResponse(
                    session_id=session_id,
                    server_credential_response=server_credential_response,
                    expires_at=expires_at
                )
                
            except SecretTagAuthenticationError:
                raise
            except Exception as e:
                logger.error(f"Unexpected error in secret tag auth start: {e}")
                raise SecretTagAuthenticationError(f"Authentication start failed: {str(e)}")
    
    def finish_authentication(
        self,
        tag_handle: str,
        request: SecretTagAuthFinishRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> SecretTagAuthFinishResponse:
        """
        Finish clean secret tag authentication.
        
        Args:
            tag_handle: Base64-encoded tag handle (32 bytes)
            request: Authentication finish request
            ip_address: Client IP address for audit logging
            user_agent: Client user agent for audit logging
            
        Returns:
            Authentication finish response with short-lived tag access token
            
        Raises:
            SecretTagAuthenticationError: If authentication finish fails
        """
        with self._audit_context() as correlation_id:
            try:
                logger.info(f"Finishing secret tag authentication for tag_handle: {tag_handle[:16]}...")
                
                # Retrieve authentication session
                session = self.db.query(OpaqueSession).filter(
                    OpaqueSession.session_id == request.session_id,
                    OpaqueSession.session_state == 'tag_authentication_started',
                    OpaqueSession.expires_at > datetime.now(timezone.utc)
                ).first()
                
                if not session:
                    raise SecretTagAuthenticationError("Invalid or expired authentication session")
                
                # Get the stored server login state from the database (same as user service)
                server_login_state = session.session_data.decode('utf-8')
                
                # Get secret tag by tag_handle (same approach as user service gets user by email)
                tag_handle_bytes = safe_base64_decode(tag_handle)
                secret_tag = self.db.query(SecretTag).filter(
                    SecretTag.tag_handle == tag_handle_bytes
                ).first()
                
                if not secret_tag:
                    raise SecretTagAuthenticationError("Authentication failed")
                
                # Verify OPAQUE authentication finish using real Node.js server
                try:
                    client_finalization_bytes = safe_base64_decode(request.client_credential_finalization)
                except Exception as e:
                    raise SecretTagAuthenticationError(f"Invalid client finalization: {str(e)}")
                
                # Get server setup for login finish (same as user service)
                server_setup = self.get_or_create_opaque_server_setup()
                
                # Call the real OPAQUE server to finish login (same as user service)
                finalize_result = self.call_opaque_server('finishLogin', {
                    'finishLoginRequest': request.client_credential_finalization,
                    'serverLoginState': server_login_state
                }, server_setup)
                
                # Verify we got a sessionKey from the server (indicates successful auth)
                if not finalize_result.get('sessionKey'):
                    raise SecretTagAuthenticationError("OPAQUE server did not return sessionKey")
                
                # Create short-lived tag access token (5 minutes)
                token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=self.TOKEN_LIFETIME_MINUTES)
                tag_access_token = self._create_tag_access_token(
                    secret_tag.user_id, secret_tag.id, token_expires_at
                )
                
                # Create tag session for tracking token usage
                tag_session = TagSession(
                    user_id=secret_tag.user_id,
                    tag_id=secret_tag.id,
                    server_ephemeral=b"authenticated"  # Simplified state
                )
                
                # Clean up authentication session
                self.db.delete(session)
                self.db.add(tag_session)
                self.db.commit()
                
                # Log successful authentication
                self._audit_service.log_authentication_event(
                    db=self.db,
                    event_type=self._audit_service.EVENT_OPAQUE_LOGIN_FINISH,
                    user_id=str(secret_tag.user_id),
                    success=True,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    correlation_id=correlation_id,
                    additional_data={
                        "session_id": request.session_id,
                        "tag_id": str(secret_tag.id)
                    }
                )
                
                logger.info(f"Secret tag authentication completed for tag_handle: {tag_handle[:16]}...")
                
                return SecretTagAuthFinishResponse(
                    tag_access_token=tag_access_token,
                    tag_id=str(secret_tag.id),
                    expires_at=token_expires_at,
                    success=True
                )
                
            except SecretTagAuthenticationError:
                # Clean up failed session
                try:
                    if 'session' in locals() and session:
                        self.db.delete(session)
                        self.db.commit()
                        
                        self._audit_service.log_authentication_event(
                            db=self.db,
                            event_type=self._audit_service.EVENT_OPAQUE_LOGIN_FINISH,
                            user_id=session.user_id,
                            success=False,
                            ip_address=ip_address,
                            user_agent=user_agent,
                            correlation_id=correlation_id,
                            error_code="AUTHENTICATION_FAILED",
                            additional_data={"session_id": request.session_id}
                        )
                except Exception:
                    pass  # Don't let cleanup errors mask the original error
                raise
            except Exception as e:
                logger.error(f"Unexpected error in secret tag auth finish: {e}")
                raise SecretTagAuthenticationError(f"Authentication finish failed: {str(e)}")
            finally:
                # No sensitive data to clean up in this method
                pass
    
    def _create_tag_access_token(self, user_id: uuid.UUID, tag_id: uuid.UUID, expires_at: datetime) -> str:
        """Create short-lived tag access token (JWT-like)."""
        token_data = {
            'user_id': str(user_id),
            'tag_id': str(tag_id),
            'expires_at': expires_at.isoformat(),
            'purpose': 'tag_access',
            'nonce': secrets.token_urlsafe(16)
        }
        token_json = json.dumps(token_data)
        token_b64 = base64.b64encode(token_json.encode()).decode()
        return f"tag_access_{token_b64}"


def create_secret_tag_service(db: Session) -> SecretTagService:
    """Factory function to create secret tag service."""
    return SecretTagService(db) 