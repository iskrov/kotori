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
from typing import Dict, Any
from datetime import datetime, timedelta, UTC
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models import User
from app.models.secret_tag_opaque import OpaqueSession

logger = logging.getLogger(__name__)

router = APIRouter()

# OPAQUE server setup - this should be stored securely in production
OPAQUE_SERVER_SETUP = os.environ.get('OPAQUE_SERVER_SETUP')
if not OPAQUE_SERVER_SETUP:
    # Generate a server setup for development
    logger.warning("No OPAQUE_SERVER_SETUP found, generating one for development")
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
            OPAQUE_SERVER_SETUP = result.stdout.strip()
            logger.info("Generated OPAQUE server setup for development")
        else:
            logger.error(f"Failed to generate OPAQUE server setup: {result.stderr}")
            OPAQUE_SERVER_SETUP = None
    except Exception as e:
        logger.error(f"Error generating OPAQUE server setup: {e}")
        OPAQUE_SERVER_SETUP = None

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
    sessionKey: str = Field(..., description="OPAQUE session key for client-side key derivation")
    exportKey: str = Field(..., description="OPAQUE export key for client-side key derivation")
    message: str = Field(..., description="Login status message")

def call_opaque_server(operation: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Call the OPAQUE server implementation via Node.js"""
    try:
        # Create the Node.js script
        script = f"""
const opaque = require('@serenity-kit/opaque');

const serverSetup = '{OPAQUE_SERVER_SETUP}';
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
async def get_opaque_status():
    """Get OPAQUE server status and capabilities"""
    if not OPAQUE_SERVER_SETUP:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPAQUE server not properly configured"
        )
    return OpaqueStatusResponse()

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
        
        if not OPAQUE_SERVER_SETUP:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OPAQUE server not properly configured"
            )
        
        # Call the proper OPAQUE server
        result = call_opaque_server('createRegistrationResponse', {
            'userIdentifier': request.userIdentifier,
            'registrationRequest': request.registrationRequest
        })
        
        # Store the user's name temporarily for the finish phase
        session_id = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(minutes=10)  # 10 minute expiration
        
        # Clean up any existing registration sessions for this user
        db.query(OpaqueSession).filter(
            OpaqueSession.user_id == request.userIdentifier,  # Use email as temp user_id
            OpaqueSession.session_state == 'registration_started'
        ).delete()
        
        # Create new registration session to store the name
        opaque_session = OpaqueSession(
            session_id=session_id,
            user_id=request.userIdentifier,  # Use email as temp user_id
            session_state='registration_started',
            session_data=request.name.encode('utf-8'),  # Store the name
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
        opaque_session = db.query(OpaqueSession).filter(
            OpaqueSession.user_id == request.userIdentifier,
            OpaqueSession.session_state == 'registration_started',
            OpaqueSession.expires_at > datetime.now(UTC)
        ).first()
        
        # Use stored name if available, otherwise fall back to email prefix
        if opaque_session and opaque_session.session_data:
            full_name = opaque_session.session_data.decode('utf-8')
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
        
        if not OPAQUE_SERVER_SETUP:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OPAQUE server not properly configured"
            )
        
        # Call the proper OPAQUE server
        result = call_opaque_server('startLogin', {
            'userIdentifier': request.userIdentifier,
            'registrationRecord': user.hashed_password,  # The stored OPAQUE registration record
            'startLoginRequest': request.loginRequest
        })
        
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
        
        # Call the proper OPAQUE server to finish login
        result = call_opaque_server('finishLogin', {
            'finishLoginRequest': request.finishLoginRequest,
            'serverLoginState': server_login_state
        })
        
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
            sessionKey=result.get('sessionKey'),  # The OPAQUE session key for client-side key derivation
            exportKey=result.get('exportKey'),  # The OPAQUE export key for client-side key derivation
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