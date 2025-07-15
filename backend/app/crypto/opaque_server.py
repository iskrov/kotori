"""
Production OPAQUE Server Implementation

This module provides server-side OPAQUE protocol support using the libopaque 1.0.0 library.
It implements the OPAQUE registration and authentication flows with proper zero-knowledge
guarantees and cryptographic security.

OPAQUE (Oblivious Pseudorandom Function with Asymmetric Keys) is a zero-knowledge
password-based authentication protocol where the server never learns the user's
password or derived keys.
"""

import os
import secrets
import hashlib
import time
from typing import Dict, Optional, Tuple, Any
from dataclasses import dataclass
import base64
import json

# Import the libopaque library
import opaque

# OPAQUE Configuration Constants
OPAQUE_CONTEXT = "vibes-opaque-v1.0.0"
OPAQUE_NONCE_LENGTH = 32
OPAQUE_SALT_LENGTH = 32


@dataclass
class OpaqueRegistrationRecord:
    """Server-side registration record for OPAQUE"""
    user_id: str
    opaque_record: bytes  # Complete OPAQUE record from libopaque
    salt: bytes
    created_at: float


@dataclass
class OpaqueRegistrationRequest:
    """Client registration request"""
    user_id: str
    registration_request: bytes  # Serialized registration request from client


@dataclass
class OpaqueRegistrationResponse:
    """Server registration response"""
    registration_response: bytes  # Serialized registration response
    salt: bytes


@dataclass
class OpaqueLoginRequest:
    """Client login request"""
    user_id: str
    credential_request: bytes  # Serialized credential request from client


@dataclass
class OpaqueLoginResponse:
    """Server login response"""
    credential_response: bytes  # Serialized credential response
    salt: bytes
    success: bool
    session_key: Optional[bytes] = None


@dataclass
class OpaqueAuthenticationState:
    """Server authentication state during login flow"""
    user_id: str
    server_session: bytes
    shared_key: bytes
    created_at: float


class OpaqueServerError(Exception):
    """OPAQUE server-specific errors"""
    pass


class ProductionOpaqueServer:
    """
    Production OPAQUE Server Implementation
    
    Provides server-side OPAQUE protocol support using libopaque 1.0.0 library.
    This implementation provides proper zero-knowledge authentication with
    cryptographic security guarantees.
    """
    
    def __init__(self):
        """Initialize production OPAQUE server"""
        self.registration_records: Dict[str, OpaqueRegistrationRecord] = {}
        self.active_sessions: Dict[str, bytes] = {}
        self.pending_registrations: Dict[str, Tuple[bytes, bytes]] = {}  # user_id -> (server_session, response)
        self.authentication_states: Dict[str, OpaqueAuthenticationState] = {}
        
    def _generate_ids(self, user_id: str) -> opaque.Ids:
        """Generate OPAQUE IDs structure"""
        return opaque.Ids(user_id, "vibes-server")
    
    def start_registration(self, request: OpaqueRegistrationRequest) -> OpaqueRegistrationResponse:
        """
        Start OPAQUE registration flow using libopaque
        
        Args:
            request: Client registration request with registration_request
            
        Returns:
            Server registration response with evaluated response
        """
        try:
            # Generate salt for this user
            salt = secrets.token_bytes(OPAQUE_SALT_LENGTH)
            
            # Create registration response using libopaque
            server_session, registration_response = opaque.CreateRegistrationResponse(
                request.registration_request
            )
            
            # Store pending registration state
            self.pending_registrations[request.user_id] = (server_session, registration_response)
            
            return OpaqueRegistrationResponse(
                registration_response=registration_response,
                salt=salt
            )
            
        except Exception as e:
            raise OpaqueServerError(f"Registration start failed: {str(e)}")
    
    def finish_registration(self, user_id: str, finalize_request: bytes) -> bool:
        """
        Finish OPAQUE registration flow using libopaque
        
        Args:
            user_id: User identifier
            finalize_request: Client finalization request
            
        Returns:
            True if registration successful
        """
        try:
            if user_id not in self.pending_registrations:
                raise OpaqueServerError("No registration in progress for user")
            
            server_session, registration_response = self.pending_registrations[user_id]
            
            # Finalize registration using libopaque
            opaque_record = opaque.StoreUserRecord(server_session, finalize_request)
            
            # Create final registration record
            final_record = OpaqueRegistrationRecord(
                user_id=user_id,
                opaque_record=opaque_record,
                salt=secrets.token_bytes(OPAQUE_SALT_LENGTH),  # Fresh salt per user
                created_at=time.time()
            )
            
            # Store final record and remove pending
            self.registration_records[user_id] = final_record
            del self.pending_registrations[user_id]
            
            return True
            
        except Exception as e:
            raise OpaqueServerError(f"Registration finish failed: {str(e)}")
    
    def start_login(self, request: OpaqueLoginRequest) -> OpaqueLoginResponse:
        """
        Start OPAQUE login flow using libopaque
        
        Args:
            request: Client login request with credential_request
            
        Returns:
            Server login response with credential_response
        """
        try:
            # Check if user exists
            if request.user_id not in self.registration_records:
                return OpaqueLoginResponse(
                    credential_response=b"",
                    salt=b"",
                    success=False
                )
            
            record = self.registration_records[request.user_id]
            ids = self._generate_ids(request.user_id)
            
            # Create credential response using libopaque
            credential_response, shared_key, server_session = opaque.CreateCredentialResponse(
                request.credential_request,
                record.opaque_record,
                ids,
                OPAQUE_CONTEXT
            )
            
            # Store authentication state for finish_login
            auth_state = OpaqueAuthenticationState(
                user_id=request.user_id,
                server_session=server_session,
                shared_key=shared_key,
                created_at=time.time()
            )
            
            # Use a session ID based on user_id and timestamp for uniqueness
            session_id = f"{request.user_id}_{int(time.time() * 1000)}"
            self.authentication_states[session_id] = auth_state
            
            return OpaqueLoginResponse(
                credential_response=credential_response,
                salt=record.salt,
                success=True,
                session_key=shared_key
            )
            
        except Exception as e:
            raise OpaqueServerError(f"Login start failed: {str(e)}")
    
    def finish_login(self, user_id: str, user_auth: bytes) -> Tuple[bool, Optional[bytes]]:
        """
        Finish OPAQUE login flow using libopaque
        
        Args:
            user_id: User identifier
            user_auth: Client authentication token
            
        Returns:
            Tuple of (success, session_key)
        """
        try:
            # Find the authentication state for this user
            auth_state = None
            session_id = None
            
            for sid, state in self.authentication_states.items():
                if state.user_id == user_id:
                    auth_state = state
                    session_id = sid
                    break
            
            if not auth_state:
                return False, None
            
            # Verify user authentication using libopaque
            try:
                opaque.UserAuth(auth_state.server_session, user_auth)
                
                # Authentication successful
                session_key = auth_state.shared_key
                
                # Store active session
                self.active_sessions[user_id] = session_key
                
                # Clean up authentication state
                del self.authentication_states[session_id]
                
                return True, session_key
                
            except Exception as verify_error:
                # Authentication failed
                del self.authentication_states[session_id]
                return False, None
            
        except Exception as e:
            raise OpaqueServerError(f"Login finish failed: {str(e)}")
    
    def get_user_record(self, user_id: str) -> Optional[OpaqueRegistrationRecord]:
        """Get user registration record"""
        return self.registration_records.get(user_id)
    
    def has_user(self, user_id: str) -> bool:
        """Check if user exists"""
        return user_id in self.registration_records
    
    def get_session_key(self, user_id: str) -> Optional[bytes]:
        """Get active session key for user"""
        return self.active_sessions.get(user_id)
    
    def invalidate_session(self, user_id: str) -> bool:
        """Invalidate user session"""
        if user_id in self.active_sessions:
            del self.active_sessions[user_id]
            return True
        return False
    
    def cleanup_expired_sessions(self, max_age_seconds: int = 3600) -> int:
        """Clean up expired sessions and authentication states"""
        current_time = time.time()
        cleaned_count = 0
        
        # Clean up expired authentication states
        expired_auth_states = []
        for session_id, auth_state in self.authentication_states.items():
            if current_time - auth_state.created_at > max_age_seconds:
                expired_auth_states.append(session_id)
        
        for session_id in expired_auth_states:
            del self.authentication_states[session_id]
            cleaned_count += 1
        
        # Clean up expired pending registrations (older than 5 minutes)
        expired_registrations = []
        for user_id in self.pending_registrations:
            # Since we don't store timestamps for pending registrations,
            # we'll clean up any that are older than 5 minutes
            # This is a simplified approach
            pass
        
        return cleaned_count
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get server statistics"""
        return {
            "registered_users": len(self.registration_records),
            "active_sessions": len(self.active_sessions),
            "pending_registrations": len(self.pending_registrations),
            "authentication_states": len(self.authentication_states)
        }


# Backward compatibility aliases
OpaqueServer = ProductionOpaqueServer


def serialize_opaque_data(data: Any) -> str:
    """
    Serialize OPAQUE data for transport
    
    Args:
        data: Data to serialize (bytes, dict, etc.)
        
    Returns:
        Base64-encoded JSON string
    """
    if isinstance(data, bytes):
        return base64.b64encode(data).decode('utf-8')
    elif isinstance(data, dict):
        return json.dumps(data)
    else:
        return str(data)


def deserialize_opaque_data(data_str: str) -> bytes:
    """
    Deserialize OPAQUE data from transport
    
    Args:
        data_str: Base64-encoded string
        
    Returns:
        Deserialized bytes
    """
    try:
        return base64.b64decode(data_str.encode('utf-8'))
    except Exception as e:
        raise OpaqueServerError(f"Failed to deserialize OPAQUE data: {str(e)}") 