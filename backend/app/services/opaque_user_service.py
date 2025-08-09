"""
OPAQUE User Authentication Service

Provides comprehensive OPAQUE user authentication services including registration
and login using the Node.js @serenity-kit/opaque library integration.

This service handles the dual authentication architecture supporting both:
- OAuth users (google_id populated, opaque_envelope NULL)
- OPAQUE users (opaque_envelope populated, google_id NULL)
"""

import logging
import base64
import secrets
import subprocess
import json
import os
import uuid
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models import User
from app.models.secret_tag_opaque import OpaqueSession
from app.models.opaque_server_config import OpaqueServerConfig
from app.schemas.opaque_user import (
    UserRegistrationStartRequest,
    UserRegistrationStartResponse,
    UserRegistrationFinishRequest,
    UserRegistrationFinishResponse,
    UserLoginStartRequest,
    UserLoginStartResponse,
    UserLoginFinishRequest,
    UserLoginFinishResponse
)
from app.core.security import create_access_token

logger = logging.getLogger(__name__)

def safe_base64_decode(data: str) -> bytes:
    """Safely decode base64 or base64url with proper padding."""
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

class OpaqueUserServiceError(Exception):
    """Base exception for OPAQUE user service operations."""
    pass


class OpaqueUserRegistrationError(OpaqueUserServiceError):
    """Exception for OPAQUE user registration failures."""
    pass


class OpaqueUserAuthenticationError(OpaqueUserServiceError):
    """Exception for OPAQUE user authentication failures."""
    pass


class OpaqueUserService:
    """
    OPAQUE User Authentication Service
    
    Handles user registration and login using real OPAQUE protocol
    with Node.js @serenity-kit/opaque library integration.
    """
    
    def __init__(self, db: Session):
        """Initialize OPAQUE user service with database session."""
        self.db = db
    
    def get_or_create_opaque_server_setup(self) -> str:
        """
        Get or create the OPAQUE server setup from database.
        This ensures the server setup persists across restarts.
        """
        # Try to get existing server setup
        config = self.db.query(OpaqueServerConfig).filter(
            OpaqueServerConfig.id == "default",
            OpaqueServerConfig.is_active == True
        ).first()
        
        if config and config.server_setup:
            logger.info("Using existing OPAQUE server setup from database")
            return config.server_setup
        
        # Generate a new server setup
        logger.warning("No OPAQUE server setup found, generating and storing new one")
        try:
            # Use Node.js to generate server setup
            script = """
const opaque = require('@serenity-kit/opaque');

async function generateServerSetup() {
    try {
        // Wait for OPAQUE to be ready
        if (opaque.ready) {
            await opaque.ready;
        }
        
        const serverSetup = opaque.server.createSetup();
        console.log(JSON.stringify({ success: true, serverSetup }));
    } catch (error) {
        console.log(JSON.stringify({ success: false, error: error.message }));
    }
}

generateServerSetup();
"""
            
            # Run the Node.js script
            result = subprocess.run(
                ['node', '-e', script],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                logger.error(f"Failed to generate OPAQUE server setup: {result.stderr}")
                raise OpaqueUserServiceError("Failed to generate OPAQUE server setup")
            
            response = json.loads(result.stdout.strip())
            if not response.get('success'):
                raise OpaqueUserServiceError(f"OPAQUE setup generation failed: {response.get('error')}")
            
            server_setup = response['serverSetup']
            
            # Store in database
            if config:
                config.server_setup = server_setup
                config.is_active = True
                config.updated_at = datetime.now(timezone.utc)
            else:
                config = OpaqueServerConfig(
                    id="default",
                    server_setup=server_setup,
                    is_active=True
                )
                self.db.add(config)
            
            self.db.commit()
            logger.info("Generated and stored new OPAQUE server setup")
            return server_setup
            
        except subprocess.TimeoutExpired:
            logger.error("Timeout generating OPAQUE server setup")
            raise OpaqueUserServiceError("Timeout generating OPAQUE server setup")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response from OPAQUE setup generation: {e}")
            raise OpaqueUserServiceError("Invalid response from OPAQUE setup generation")
        except Exception as e:
            logger.error(f"Unexpected error generating OPAQUE server setup: {e}")
            raise OpaqueUserServiceError(f"Failed to generate OPAQUE server setup: {str(e)}")
    
    def call_opaque_server(self, operation: str, data: Dict[str, Any], server_setup: str) -> Dict[str, Any]:
        """Call the OPAQUE server implementation via Node.js"""
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
                raise OpaqueUserServiceError(f"OPAQUE server call failed: {result.stderr}")
            
            response = json.loads(result.stdout.strip())
            if not response.get('success'):
                raise OpaqueUserServiceError(f"OPAQUE operation failed: {response.get('error')}")
            
            return response['result']
            
        except subprocess.TimeoutExpired:
            logger.error(f"Timeout calling OPAQUE server for operation {operation}")
            raise OpaqueUserServiceError(f"Timeout calling OPAQUE server for operation {operation}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response from OPAQUE server: {e}")
            raise OpaqueUserServiceError("Invalid response from OPAQUE server")
        except Exception as e:
            logger.error(f"Unexpected error calling OPAQUE server: {e}")
            raise OpaqueUserServiceError(f"OPAQUE server call failed: {str(e)}")
    
    def start_registration(self, request: UserRegistrationStartRequest) -> UserRegistrationStartResponse:
        """
        Start OPAQUE user registration process using real OPAQUE protocol.
        
        Args:
            request: User registration start request
            
        Returns:
            Registration start response with OPAQUE registration response
            
        Raises:
            OpaqueUserRegistrationError: If registration start fails
        """
        try:
            logger.info(f"Starting OPAQUE user registration for {request.userIdentifier}")
            
            # Check if user already exists
            existing_user = self.db.query(User).filter(User.email == request.userIdentifier).first()
            if existing_user:
                raise OpaqueUserRegistrationError("User already exists")
            
            server_setup = self.get_or_create_opaque_server_setup()
            if not server_setup:
                raise OpaqueUserRegistrationError("OPAQUE server not properly configured")
            
            # Call the real OPAQUE server
            result = self.call_opaque_server('createRegistrationResponse', {
                'userIdentifier': request.userIdentifier,
                'registrationRequest': request.opaque_registration_request
            }, server_setup)
            
            # Store the user's name temporarily for the finish phase
            session_id = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minute expiration
            
            # Clean up any existing registration sessions for this user email
            existing_sessions = self.db.query(OpaqueSession).filter(
                OpaqueSession.session_state == 'registration_started'
            ).all()
            
            # Remove sessions where the session_data contains this email
            for session in existing_sessions:
                try:
                    if session.session_data:
                        session_data = json.loads(session.session_data.decode('utf-8'))
                        if session_data.get('email') == request.userIdentifier:
                            self.db.delete(session)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # Skip invalid session data
                    continue
            
            # Create new registration session to store the registration data
            # We'll use a placeholder UUID for user_id during registration
            temp_user_id = uuid.uuid4()
            session_data = {
                'email': request.userIdentifier,
                'name': request.name,
                'temp_user_id': str(temp_user_id)
            }
            
            opaque_session = OpaqueSession(
                session_id=session_id,
                user_id=temp_user_id,  # Use temporary UUID
                session_state='registration_started',
                session_data=json.dumps(session_data).encode('utf-8'),
                expires_at=expires_at
            )
            self.db.add(opaque_session)
            self.db.commit()
            
            logger.info(f"OPAQUE user registration started for {request.userIdentifier}")
            
            return UserRegistrationStartResponse(
                session_id=session_id,
                opaque_registration_response=result['registrationResponse'],
                expires_at=expires_at
            )
            
        except OpaqueUserRegistrationError:
            raise
        except Exception as e:
            logger.error(f"Error in user registration start: {e}")
            raise OpaqueUserRegistrationError(f"Registration start failed: {str(e)}")
    
    def finish_registration(self, request: UserRegistrationFinishRequest) -> UserRegistrationFinishResponse:
        """
        Finish OPAQUE user registration process.
        
        Args:
            request: User registration finish request
            
        Returns:
            Registration finish response with user info and access token
            
        Raises:
            OpaqueUserRegistrationError: If registration finish fails
        """
        try:
            logger.info(f"Finishing OPAQUE user registration for {request.userIdentifier}")
            
            # Check if user already exists
            existing_user = self.db.query(User).filter(User.email == request.userIdentifier).first()
            if existing_user:
                raise OpaqueUserRegistrationError("User already exists")
            
                    # Retrieve the specific registration session by session_id
            opaque_session = self.db.query(OpaqueSession).filter(
                OpaqueSession.session_id == request.session_id,
                OpaqueSession.session_state == 'registration_started'
            ).first()
            
            # Check if session exists and is not expired
            if not opaque_session:
                raise OpaqueUserRegistrationError("Invalid or missing registration session")
            
            if opaque_session.expires_at <= datetime.now(timezone.utc):
                # Clean up expired session
                self.db.delete(opaque_session)
                self.db.commit()
                raise OpaqueUserRegistrationError("Registration session has expired")
            
            # Verify the session belongs to the correct user and get stored name
            try:
                session_data = json.loads(opaque_session.session_data.decode('utf-8'))
                if session_data.get('email') != request.userIdentifier:
                    raise OpaqueUserRegistrationError("Session does not match user identifier")
                full_name = session_data.get('name', request.userIdentifier.split('@')[0])
            except (json.JSONDecodeError, UnicodeDecodeError):
                raise OpaqueUserRegistrationError("Invalid session data")
            
            # Create new user with OPAQUE authentication
            # Store the registration record as the opaque_envelope (updated field name)
            new_user = User(
                email=request.userIdentifier,
                full_name=full_name,
                opaque_envelope=safe_base64_decode(request.opaque_registration_record),  # Store as binary in new field
                google_id=None,  # OPAQUE users don't have Google ID
                is_active=True,
                is_superuser=False
            )
            
            self.db.add(new_user)
            self.db.commit()
            self.db.refresh(new_user)
            
            # Clean up the registration session
            if opaque_session:
                self.db.delete(opaque_session)
                self.db.commit()
            
            # Create JWT token for API authentication
            access_token = create_access_token(subject=new_user.id)
            
            logger.info(f"OPAQUE user registration completed for {request.userIdentifier}")
            
            return UserRegistrationFinishResponse(
                success=True,
                user={
                    "id": str(new_user.id),
                    "email": new_user.email,
                    "full_name": new_user.full_name,
                    "is_active": new_user.is_active,
                    "is_superuser": new_user.is_superuser,
                    "created_at": new_user.created_at.isoformat() if new_user.created_at else None,
                    "updated_at": new_user.updated_at.isoformat() if new_user.updated_at else None
                },
                access_token=access_token,
                token_type="bearer",
                message="Registration successful"
            )
            
        except OpaqueUserRegistrationError:
            raise
        except Exception as e:
            logger.error(f"Error in user registration finish: {e}")
            self.db.rollback()
            raise OpaqueUserRegistrationError(f"Registration finish failed: {str(e)}")
    
    def start_login(self, request: UserLoginStartRequest) -> UserLoginStartResponse:
        """
        Start OPAQUE user login process.
        
        Args:
            request: User login start request
            
        Returns:
            Login start response with OPAQUE server response
            
        Raises:
            OpaqueUserAuthenticationError: If login start fails
        """
        try:
            logger.info(f"Starting OPAQUE user login for {request.userIdentifier}")
            
            # Check if user exists
            user = self.db.query(User).filter(User.email == request.userIdentifier).first()
            if not user or user.opaque_envelope is None:
                # Return proper error instead of fake OPAQUE data to prevent client-side decoding errors
                raise OpaqueUserAuthenticationError("Invalid credentials")
            
            server_setup = self.get_or_create_opaque_server_setup()
            if not server_setup:
                raise OpaqueUserAuthenticationError("OPAQUE server not properly configured")
            
            # Convert opaque_envelope back to URL-safe base64 string for Node.js (same format as original)
            registration_record = base64.urlsafe_b64encode(user.opaque_envelope).decode('utf-8')
            
            # Call the real OPAQUE server
            result = self.call_opaque_server('startLogin', {
                'userIdentifier': request.userIdentifier,
                'registrationRecord': registration_record,
                'startLoginRequest': request.client_credential_request
            }, server_setup)
            
            
            # Store the server login state in the database using OpaqueSession
            session_id = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minute expiration
            
            # Clean up any existing sessions for this user
            self.db.query(OpaqueSession).filter(
                OpaqueSession.user_id == str(user.id),
                OpaqueSession.session_state == 'login_started'
            ).delete()
            
            # Create new session
            opaque_session = OpaqueSession(
                session_id=session_id,
                user_id=str(user.id),
                session_state='login_started',
                session_data=result['serverLoginState'].encode('utf-8'),
                expires_at=expires_at
            )
            self.db.add(opaque_session)
            self.db.commit()
            
            logger.info(f"OPAQUE user login started for {request.userIdentifier}")
            
            return UserLoginStartResponse(
                session_id=session_id,
                server_credential_response=result['loginResponse'],
                expires_at=expires_at
            )
            
        except OpaqueUserAuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Error in user login start: {e}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise OpaqueUserAuthenticationError(f"Login start failed: {str(e)}")
    
    def finish_login(self, request: UserLoginFinishRequest) -> UserLoginFinishResponse:
        """
        Finish OPAQUE user login process and return JWT token.
        
        Args:
            request: User login finish request
            
        Returns:
            Login finish response with user info and access token
            
        Raises:
            OpaqueUserAuthenticationError: If login finish fails
        """
        try:
            logger.info(f"Finishing OPAQUE user login for {request.userIdentifier}")
            
            # Check if user exists
            user = self.db.query(User).filter(User.email == request.userIdentifier).first()
            if not user or user.opaque_envelope is None:
                raise OpaqueUserAuthenticationError("Invalid credentials")
            
            # Get the stored server login state from the database
            opaque_session = self.db.query(OpaqueSession).filter(
                OpaqueSession.user_id == str(user.id),
                OpaqueSession.session_state == 'login_started',
                OpaqueSession.expires_at > datetime.now(timezone.utc)
            ).first()
            
            if not opaque_session:
                raise OpaqueUserAuthenticationError("No active login session")
            
            server_login_state = opaque_session.session_data.decode('utf-8')
            
            # Get server setup for login finish
            server_setup = self.get_or_create_opaque_server_setup()
            
            # Call the real OPAQUE server to finish login
            result = self.call_opaque_server('finishLogin', {
                'finishLoginRequest': request.client_credential_finalization,
                'serverLoginState': server_login_state
            }, server_setup)
            
            # Ensure we got a sessionKey from the server
            if not result.get('sessionKey'):
                raise OpaqueUserAuthenticationError("OPAQUE server did not return sessionKey")
            
            # Clean up the temporary login state
            self.db.delete(opaque_session)
            self.db.commit()
            
            # Create JWT token for API authentication
            access_token = create_access_token(subject=user.id)
            
            logger.info(f"OPAQUE user login completed for {request.userIdentifier}")
            
            return UserLoginFinishResponse(
                success=True,
                user={
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "is_active": user.is_active,
                    "is_superuser": user.is_superuser,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                    "updated_at": user.updated_at.isoformat() if user.updated_at else None
                },
                access_token=access_token,
                token_type="bearer",
                message="Login successful"
            )
            
        except OpaqueUserAuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Error in user login finish: {e}")
            raise OpaqueUserAuthenticationError(f"Login finish failed: {str(e)}")


def create_opaque_user_service(db: Session) -> OpaqueUserService:
    """Factory function to create OPAQUE user service."""
    return OpaqueUserService(db) 