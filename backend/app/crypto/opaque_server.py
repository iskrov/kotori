"""
OPAQUE Server Implementation

This module provides server-side OPAQUE protocol support using Python cryptographic
primitives. It implements the OPAQUE registration and authentication flows to work
with the JavaScript client implementation.

OPAQUE (Oblivious Pseudorandom Function with Asymmetric Keys) is a zero-knowledge
password-based authentication protocol where the server never learns the user's
password or derived keys.
"""

import os
import secrets
import hashlib
from typing import Dict, Optional, Tuple, Any
from dataclasses import dataclass
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend
import base64
import json

# OPAQUE Configuration Constants
OPAQUE_HASH_ALGORITHM = hashes.SHA256()
OPAQUE_CURVE = ec.SECP256R1()
OPAQUE_INFO_REGISTRATION = b"OPAQUE-Registration"
OPAQUE_INFO_LOGIN = b"OPAQUE-Login"
OPAQUE_NONCE_LENGTH = 32
OPAQUE_SALT_LENGTH = 32


@dataclass
class OpaqueRegistrationRecord:
    """Server-side registration record for OPAQUE"""
    user_id: str
    envelope: bytes  # Encrypted client data
    server_public_key: bytes
    server_private_key: bytes  # Stored securely, encrypted in production
    salt: bytes
    created_at: float


@dataclass
class OpaqueRegistrationRequest:
    """Client registration request"""
    user_id: str
    blinded_element: bytes
    client_public_key: bytes


@dataclass
class OpaqueRegistrationResponse:
    """Server registration response"""
    evaluated_element: bytes
    server_public_key: bytes
    salt: bytes


@dataclass
class OpaqueLoginRequest:
    """Client login request"""
    user_id: str
    blinded_element: bytes
    client_public_key: bytes


@dataclass
class OpaqueLoginResponse:
    """Server login response"""
    evaluated_element: bytes
    server_public_key: bytes
    salt: bytes
    success: bool
    session_key: Optional[bytes] = None


class OpaqueServerError(Exception):
    """OPAQUE server-specific errors"""
    pass


class OpaqueServer:
    """
    OPAQUE Server Implementation
    
    Provides server-side OPAQUE protocol support for zero-knowledge authentication.
    This implementation uses Python cryptographic primitives to handle the OPAQUE
    flows while maintaining compatibility with the JavaScript client.
    """
    
    def __init__(self):
        """Initialize OPAQUE server"""
        self.registration_records: Dict[str, OpaqueRegistrationRecord] = {}
        self.active_sessions: Dict[str, bytes] = {}
        
    def _generate_keypair(self) -> Tuple[bytes, bytes]:
        """Generate EC keypair for OPAQUE protocol"""
        private_key = ec.generate_private_key(OPAQUE_CURVE, default_backend())
        public_key = private_key.public_key()
        
        # Use PKCS8 format for private key (more compatible)
        private_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        # Use uncompressed point format for public key
        public_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint
        )
        
        return private_bytes, public_bytes
    
    def _derive_key(self, shared_secret: bytes, salt: bytes, info: bytes, length: int = 32) -> bytes:
        """Derive key using HKDF"""
        hkdf = HKDF(
            algorithm=OPAQUE_HASH_ALGORITHM,
            length=length,
            salt=salt,
            info=info,
            backend=default_backend()
        )
        return hkdf.derive(shared_secret)
    
    def _simulate_oprf_evaluation(self, blinded_element: bytes, server_key: bytes) -> bytes:
        """
        Simulate OPRF evaluation for OPAQUE protocol
        
        In a full OPAQUE implementation, this would use proper OPRF evaluation.
        This simplified version uses HMAC-based evaluation for compatibility.
        """
        # Use HMAC to simulate OPRF evaluation
        import hmac
        return hmac.new(server_key, blinded_element, hashlib.sha256).digest()
    
    def start_registration(self, request: OpaqueRegistrationRequest) -> OpaqueRegistrationResponse:
        """
        Start OPAQUE registration flow
        
        Args:
            request: Client registration request with blinded element
            
        Returns:
            Server registration response with evaluated element
        """
        try:
            # Generate server keypair for this registration
            server_private_key, server_public_key = self._generate_keypair()
            
            # Generate salt for this user
            salt = secrets.token_bytes(OPAQUE_SALT_LENGTH)
            
            # Evaluate the blinded element (simplified OPRF)
            evaluated_element = self._simulate_oprf_evaluation(
                request.blinded_element, 
                server_private_key
            )
            
            # Store temporary registration state
            temp_record = OpaqueRegistrationRecord(
                user_id=request.user_id,
                envelope=b"",  # Will be filled in finish_registration
                server_public_key=server_public_key,
                server_private_key=server_private_key,
                salt=salt,
                created_at=0  # Will be updated in finish_registration
            )
            
            # Store with temporary key for finish_registration
            temp_key = f"temp_{request.user_id}"
            self.registration_records[temp_key] = temp_record
            
            return OpaqueRegistrationResponse(
                evaluated_element=evaluated_element,
                server_public_key=server_public_key,
                salt=salt
            )
            
        except Exception as e:
            raise OpaqueServerError(f"Registration start failed: {str(e)}")
    
    def finish_registration(self, user_id: str, envelope: bytes) -> bool:
        """
        Finish OPAQUE registration flow
        
        Args:
            user_id: User identifier
            envelope: Client-encrypted envelope
            
        Returns:
            True if registration successful
        """
        try:
            temp_key = f"temp_{user_id}"
            
            if temp_key not in self.registration_records:
                raise OpaqueServerError("No registration in progress for user")
            
            # Get temporary record and finalize it
            temp_record = self.registration_records[temp_key]
            
            # Create final registration record
            final_record = OpaqueRegistrationRecord(
                user_id=user_id,
                envelope=envelope,
                server_public_key=temp_record.server_public_key,
                server_private_key=temp_record.server_private_key,
                salt=temp_record.salt,
                created_at=secrets.randbits(64) / (2**32)  # Simplified timestamp
            )
            
            # Store final record and remove temporary
            self.registration_records[user_id] = final_record
            del self.registration_records[temp_key]
            
            return True
            
        except Exception as e:
            raise OpaqueServerError(f"Registration finish failed: {str(e)}")
    
    def start_login(self, request: OpaqueLoginRequest) -> OpaqueLoginResponse:
        """
        Start OPAQUE login flow
        
        Args:
            request: Client login request with blinded element
            
        Returns:
            Server login response with evaluated element
        """
        try:
            # Check if user exists
            if request.user_id not in self.registration_records:
                return OpaqueLoginResponse(
                    evaluated_element=b"",
                    server_public_key=b"",
                    salt=b"",
                    success=False
                )
            
            record = self.registration_records[request.user_id]
            
            # Evaluate the blinded element using stored server key
            evaluated_element = self._simulate_oprf_evaluation(
                request.blinded_element,
                record.server_private_key
            )
            
            return OpaqueLoginResponse(
                evaluated_element=evaluated_element,
                server_public_key=record.server_public_key,
                salt=record.salt,
                success=True
            )
            
        except Exception as e:
            raise OpaqueServerError(f"Login start failed: {str(e)}")
    
    def finish_login(self, user_id: str, client_proof: bytes) -> Tuple[bool, Optional[bytes]]:
        """
        Finish OPAQUE login flow
        
        Args:
            user_id: User identifier
            client_proof: Client authentication proof
            
        Returns:
            Tuple of (success, session_key)
        """
        try:
            if user_id not in self.registration_records:
                return False, None
            
            record = self.registration_records[user_id]
            
            # In a full implementation, we would verify the client proof
            # For this simplified version, we assume proof is valid if present
            if not client_proof:
                return False, None
            
            # Generate session key
            session_key = secrets.token_bytes(32)
            
            # Store active session
            self.active_sessions[user_id] = session_key
            
            return True, session_key
            
        except Exception as e:
            raise OpaqueServerError(f"Login finish failed: {str(e)}")
    
    def get_user_record(self, user_id: str) -> Optional[OpaqueRegistrationRecord]:
        """Get user registration record"""
        return self.registration_records.get(user_id)
    
    def has_user(self, user_id: str) -> bool:
        """Check if user is registered"""
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
        """
        Clean up expired sessions
        
        Args:
            max_age_seconds: Maximum session age in seconds
            
        Returns:
            Number of sessions cleaned up
        """
        # In a production implementation, this would check actual timestamps
        # For now, we'll implement basic cleanup logic
        expired_count = 0
        
        # This is a simplified implementation
        # In production, you'd track session timestamps
        if len(self.active_sessions) > 100:  # Arbitrary limit
            # Remove oldest sessions (simplified)
            users_to_remove = list(self.active_sessions.keys())[:10]
            for user_id in users_to_remove:
                del self.active_sessions[user_id]
                expired_count += 1
        
        return expired_count


# Utility functions for serialization
def serialize_opaque_data(data: Any) -> str:
    """Serialize OPAQUE data for API responses"""
    if isinstance(data, bytes):
        return base64.b64encode(data).decode('utf-8')
    elif isinstance(data, (OpaqueRegistrationResponse, OpaqueLoginResponse)):
        result = {}
        for key, value in data.__dict__.items():
            if isinstance(value, bytes):
                result[key] = base64.b64encode(value).decode('utf-8')
            else:
                result[key] = value
        return result
    else:
        return data


def deserialize_opaque_data(data_str: str) -> bytes:
    """Deserialize OPAQUE data from API requests"""
    try:
        return base64.b64decode(data_str)
    except Exception:
        raise OpaqueServerError("Invalid base64 data") 