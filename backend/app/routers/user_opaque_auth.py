"""
User OPAQUE Authentication Router

Provides user authentication endpoints using OPAQUE zero-knowledge protocol.
All users must be registered with OPAQUE authentication.
"""

import logging
import base64
import secrets
import subprocess
import json
import os
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, UTC
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import uuid

from app.dependencies import get_db
from app.models import User
from app.models.secret_tag_opaque import OpaqueSession

logger = logging.getLogger(__name__)

router = APIRouter()

# OPAQUE server setup - this should be stored securely in production
def get_or_create_opaque_server_setup(db: Session) -> str:
    """
    Get or create the OPAQUE server setup from database.
    This ensures the server setup persists across restarts.
    """
    from app.models.opaque_server_config import OpaqueServerConfig
    
    # Try to get existing server setup
    config = db.query(OpaqueServerConfig).filter(
        OpaqueServerConfig.id == "default",
        OpaqueServerConfig.is_active == True
    ).first()
    
    if config and config.server_setup:
        logger.info("Using existing OPAQUE server setup from database")
        return config.server_setup
    
    # Generate a new server setup
    logger.warning("No OPAQUE server setup found, generating and storing new one")
    try:
        result = subprocess.run([
            'node', '-e', 
            '''
const opaque = require("@serenity-kit/opaque");

async function createSetup() {
  try {
    if (opaque.ready) {
      await opaque.ready;
    }
    const setup = opaque.server.createSetup();
    console.log(setup);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

createSetup();
            '''
        ], capture_output=True, text=True, cwd='/home/ai/src/vibes/backend')
        
        if result.returncode == 0:
            server_setup = result.stdout.strip()
            
            # Store in database
            if config:
                # Update existing config
                config.server_setup = server_setup
                config.updated_at = datetime.now(UTC)
                config.is_active = True
            else:
                # Create new config
                config = OpaqueServerConfig(
                    id="default",
                    server_setup=server_setup,
                    is_active=True,
                    description="Default OPAQUE server configuration"
                )
                db.add(config)
            
            db.commit()
            logger.info("Generated and stored new OPAQUE server setup in database")
            return server_setup
        else:
            logger.error(f"Failed to generate OPAQUE server setup: {result.stderr}")
            raise Exception(f"Failed to generate OPAQUE server setup: {result.stderr}")
    except Exception as e:
        logger.error(f"Error generating OPAQUE server setup: {e}")
        raise Exception(f"Error generating OPAQUE server setup: {e}")

# Legacy environment variable support (deprecated)
OPAQUE_SERVER_SETUP = os.environ.get('OPAQUE_SERVER_SETUP')
if OPAQUE_SERVER_SETUP:
    logger.warning("Using OPAQUE_SERVER_SETUP from environment (deprecated). Consider migrating to database storage.")

# Request/Response Models
class UserRegistrationStartRequest(BaseModel):
    """Request for starting user registration"""
    userIdentifier: str = Field(..., description="User's email address")
    registrationRequest: str = Field(..., description="Base64 OPAQUE registration request")
    name: str = Field(..., description="User's display name")

class UserRegistrationStartResponse(BaseModel):
    """Response for registration start"""
    registrationResponse: str = Field(..., description="Base64 OPAQUE registration response")

class UserRegistrationFinishRequest(BaseModel):
    """Request for finishing user registration"""
    userIdentifier: str = Field(..., description="User's email address")
    registrationRecord: str = Field(..., description="Base64 OPAQUE registration record")

class UserLoginStartRequest(BaseModel):
    """Request for starting user login"""
    userIdentifier: str = Field(..., description="User's email address")
    loginRequest: str = Field(..., description="Base64 OPAQUE login request")

class UserLoginStartResponse(BaseModel):
    """Response for login start"""
    loginResponse: str = Field(..., description="Base64 OPAQUE login response")

class UserLoginFinishRequest(BaseModel):
    """Request for finishing user login"""
    userIdentifier: str = Field(..., description="User's email address")
    finishLoginRequest: str = Field(..., description="Base64 OPAQUE finish login request")

class OpaqueStatusResponse(BaseModel):
    """OPAQUE server status response"""
    opaque_enabled: bool = Field(True, description="Whether OPAQUE is enabled")
    supported_features: Dict[str, bool] = Field(
        default_factory=lambda: {
            "registration": True,
            "login": True,
            "user_authentication": True
        },
        description="Supported OPAQUE features"
    )


class UserRegistrationFinishResponse(BaseModel):
    """Response for finishing user registration"""
    success: bool = Field(..., description="Whether registration was successful")
    message: str = Field(..., description="Registration status message")


class UserLoginFinishResponse(BaseModel):
    """Response for finishing user login"""
    success: bool = Field(..., description="Whether login was successful")
    user: Dict[str, Any] = Field(..., description="User information")
    token: str = Field(..., description="JWT access token")
    token_type: str = Field(..., description="Token type (bearer)")
    sessionKey: str = Field(..., description="OPAQUE session key derived by server")
    exportKey: Optional[str] = Field(None, description="OPAQUE export key (only available client-side)")
    message: str = Field(..., description="Login status message")

def call_opaque_server(operation: str, data: Dict[str, Any], server_setup: str) -> Dict[str, Any]:
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
        
        # Execute the Node.js script
        result = subprocess.run([
            'node', '-e', script
        ], capture_output=True, text=True, cwd='/home/ai/src/vibes/backend')
        
        if result.returncode != 0:
            logger.error(f"Node.js script failed with return code {result.returncode}")
            logger.error(f"stderr: {result.stderr}")
            logger.error(f"stdout: {result.stdout}")
            raise Exception(f"OPAQUE server call failed: {result.stderr}")
        
        # Parse the result
        response = json.loads(result.stdout.strip())
        
        if not response.get('success'):
            raise Exception(f"OPAQUE operation failed: {response.get('error')}")
        
        return response['result']
        
    except Exception as e:
        logger.error(f"Error calling OPAQUE server: {e}")
        raise

@router.get("/status", response_model=OpaqueStatusResponse)
async def get_opaque_status(db: Session = Depends(get_db)):
    """Get OPAQUE server status and capabilities"""
    try:
        server_setup = get_or_create_opaque_server_setup(db)
        if not server_setup:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OPAQUE server not properly configured"
            )
        return OpaqueStatusResponse()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting OPAQUE status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get OPAQUE status: {e}"
        )

@router.post("/register/start", response_model=UserRegistrationStartResponse)
async def start_user_registration(
    request: UserRegistrationStartRequest,
    db: Session = Depends(get_db)
):
    """
    Start OPAQUE user registration process
    """
    try:
        logger.info(f"Starting OPAQUE user registration for {request.userIdentifier}")
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == request.userIdentifier).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists"
            )
        
        server_setup = get_or_create_opaque_server_setup(db)
        if not server_setup:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OPAQUE server not properly configured"
            )
        
        # Call the proper OPAQUE server
        result = call_opaque_server('createRegistrationResponse', {
            'userIdentifier': request.userIdentifier,
            'registrationRequest': request.registrationRequest
        }, server_setup)
        
        # Store the user's name temporarily for the finish phase
        session_id = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(minutes=10)  # 10 minute expiration
        
        # Clean up any existing registration sessions for this user email
        # Since we don't have a user_id yet, we'll clean up by session_data containing the email
        existing_sessions = db.query(OpaqueSession).filter(
            OpaqueSession.session_state == 'registration_started'
        ).all()
        
        # Remove sessions where the session_data contains this email
        for session in existing_sessions:
            try:
                if session.session_data:
                    session_data = json.loads(session.session_data.decode('utf-8'))
                    if session_data.get('email') == request.userIdentifier:
                        db.delete(session)
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
        db.add(opaque_session)
        db.commit()
        
        logger.info(f"OPAQUE user registration started for {request.userIdentifier}")
        
        return UserRegistrationStartResponse(
            registrationResponse=result['registrationResponse']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in user registration start: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration start failed"
        )

@router.post("/register/finish", response_model=UserRegistrationFinishResponse)
async def finish_user_registration(
    request: UserRegistrationFinishRequest,
    db: Session = Depends(get_db)
):
    """
    Finish OPAQUE user registration process
    """
    try:
        logger.info(f"Finishing OPAQUE user registration for {request.userIdentifier}")
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == request.userIdentifier).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists"
            )
        
        # Retrieve the stored name from the registration session
        # Since we used a temporary UUID during registration, we need to find the session by email in session_data
        registration_sessions = db.query(OpaqueSession).filter(
            OpaqueSession.session_state == 'registration_started',
            OpaqueSession.expires_at > datetime.now(UTC)
        ).all()
        
        opaque_session = None
        for session in registration_sessions:
            try:
                if session.session_data:
                    session_data = json.loads(session.session_data.decode('utf-8'))
                    if session_data.get('email') == request.userIdentifier:
                        opaque_session = session
                        break
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
        
        # Use stored name if available, otherwise fall back to email prefix
        if opaque_session and opaque_session.session_data:
            session_data = json.loads(opaque_session.session_data.decode('utf-8'))
            full_name = session_data.get('name', request.userIdentifier.split('@')[0])
        else:
            full_name = request.userIdentifier.split('@')[0]  # Fallback to email prefix
        
        # Create new user with OPAQUE authentication
        # Store the registration record as the password hash (base64 encoded)
        new_user = User(
            email=request.userIdentifier,
            full_name=full_name,
            hashed_password=request.registrationRecord,  # Store OPAQUE record as "password"
            is_active=True,
            is_superuser=False
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Clean up the registration session
        if opaque_session:
            db.delete(opaque_session)
            db.commit()
        
        logger.info(f"OPAQUE user registration completed for {request.userIdentifier}")
        
        return UserRegistrationFinishResponse(
            success=True,
            message="User registered successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in user registration finish: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration finish failed"
        )

@router.post("/login/start", response_model=UserLoginStartResponse)
async def start_user_login(
    request: UserLoginStartRequest,
    db: Session = Depends(get_db)
):
    """
    Start OPAQUE user login process
    """
    try:
        logger.info(f"Starting OPAQUE user login for {request.userIdentifier}")
        
        # Check if user exists
        user = db.query(User).filter(User.email == request.userIdentifier).first()
        if not user:
            # Return a fake response to prevent user enumeration
            dummy_response = base64.b64encode(f"login_response_for_unknown_user".encode()).decode('utf-8')
            return UserLoginStartResponse(loginResponse=dummy_response)
        
        server_setup = get_or_create_opaque_server_setup(db)
        if not server_setup:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OPAQUE server not properly configured"
            )
        
        # Call the proper OPAQUE server
        result = call_opaque_server('startLogin', {
            'userIdentifier': request.userIdentifier,
            'registrationRecord': user.hashed_password,  # The stored OPAQUE registration record
            'startLoginRequest': request.loginRequest
        }, server_setup)
        
        # Store the server login state in the database using OpaqueSession
        session_id = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(minutes=10)  # 10 minute expiration
        
        # Clean up any existing sessions for this user
        db.query(OpaqueSession).filter(
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
        db.add(opaque_session)
        db.commit()
        
        logger.info(f"OPAQUE user login started for {request.userIdentifier}")
        return UserLoginStartResponse(loginResponse=result['loginResponse'])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in user login start: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login start failed: {str(e)}"
        )

@router.post("/login/finish", response_model=UserLoginFinishResponse)
async def finish_user_login(
    request: UserLoginFinishRequest,
    db: Session = Depends(get_db)
):
    """
    Finish OPAQUE user login process and return JWT token
    """
    try:
        logger.info(f"Finishing OPAQUE user login for {request.userIdentifier}")
        
        # Check if user exists
        user = db.query(User).filter(User.email == request.userIdentifier).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Get the stored server login state from the database
        opaque_session = db.query(OpaqueSession).filter(
            OpaqueSession.user_id == str(user.id),
            OpaqueSession.session_state == 'login_started',
            OpaqueSession.expires_at > datetime.now(UTC)
        ).first()
        
        if not opaque_session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active login session"
            )
        
        server_login_state = opaque_session.session_data.decode('utf-8')
        
        # Get server setup for login finish
        server_setup = get_or_create_opaque_server_setup(db)
        
        # Call the proper OPAQUE server to finish login
        result = call_opaque_server('finishLogin', {
            'finishLoginRequest': request.finishLoginRequest,
            'serverLoginState': server_login_state
        }, server_setup)
        
        # Ensure we got a sessionKey from the server
        if not result.get('sessionKey'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OPAQUE server did not return sessionKey"
            )
        
        # Clean up the temporary login state
        db.delete(opaque_session)
        db.commit()
        
        logger.info(f"OPAQUE user login completed for {request.userIdentifier}")
        
        # Create JWT token for API authentication
        from ..core.security import create_access_token
        access_token = create_access_token(subject=user.id)
        
        return UserLoginFinishResponse(
            success=True,
            user={
                "id": str(user.id),  # Convert to string to match frontend type
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "is_superuser": user.is_superuser,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None
            },
            token=access_token,  # JWT token for API authentication
            token_type="bearer",
            sessionKey=result['sessionKey'],  # The OPAQUE session key derived by the server
            exportKey=None,  # Export key is only available on the client side
            message="Login successful"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in user login finish: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login finish failed"
        ) 