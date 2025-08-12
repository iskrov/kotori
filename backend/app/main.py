import logging
import time
import traceback
import json
from uuid import UUID

from fastapi import FastAPI
from fastapi import Request
from fastapi import status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

from app.api.v1.endpoints import speech as speech_router_module
from app.api.v1.endpoints import journal as v1_journal_router_module
from app.api.v1.endpoints import vault as vault_router_module
# Session router import disabled in PBI-4 Stage 2 (OpaqueSession model removed)
# from app.api.v1.endpoints import session as session_router_module
from app.api.v1.endpoints import audit as audit_router_module
from app.api.v1.endpoints import maintenance as maintenance_router_module
from app.api.v1.endpoints import share_templates as share_templates_router_module
from app.api.v1.endpoints import shares as shares_router_module
from app.api.v1.endpoints import template_import as template_import_router_module
from app.api.v1 import monitoring as monitoring_router_module
# New v1 authentication routers
from app.api.v1 import auth as v1_auth_router
# Secret tags router import removed in PBI-4 Stage 2
# from app.api.v1 import secret_tags as v1_secret_tags_router
from app.core.config import settings
# Legacy endpoints (non-authentication)
from app.routers import journals_router
from app.routers import reminders_router
from app.routers import users_router
from app.routers.tags import router as tags_router

from app.websockets import speech as speech_websocket_router

# Security middleware imports
from app.middleware.security_middleware import SecurityMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Custom JSON encoder for UUID support
class UUIDJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles UUID objects"""
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)


# Custom JSONResponse class that uses our UUID encoder
class UUIDJSONResponse(JSONResponse):
    """JSONResponse that properly handles UUID serialization"""
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            cls=UUIDJSONEncoder,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")


app = FastAPI(
    title="Kotori API",
    description="API for Kotori: Voice-Controlled Journaling Application",
    version="0.1.0",
    default_response_class=UUIDJSONResponse,  # Use our custom response class
)


# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors and return user-friendly messages"""
    logger.error(f"Validation error: {exc}")

    # Create a more user-friendly error message
    error_details = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        msg = error["msg"]
        error_details.append(f"{field}: {msg}")

    return UUIDJSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": error_details},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    logger.error(traceback.format_exc())

    return UUIDJSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


# Security middleware configuration (must be first)
app.add_middleware(SecurityMiddleware)
logger.info("Security middleware configured with comprehensive protection for Kotori")

# Add proxy headers middleware to handle X-Forwarded-Proto from Cloud Run
# This ensures HTTPS redirects work correctly behind a reverse proxy
if settings.ENVIRONMENT == "production":
    # Trust Cloud Run's proxy headers for HTTPS redirects
    from starlette.middleware.base import BaseHTTPMiddleware
    import logging
    
    class ProxyHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            # Honor X-Forwarded-Proto from Cloud Run to fix HTTPS redirects
            forwarded_proto = request.headers.get("x-forwarded-proto")
            if forwarded_proto:
                # Update the request scope to reflect the actual protocol
                request.scope["scheme"] = forwarded_proto
            
            response = await call_next(request)
            return response
    
    app.add_middleware(ProxyHeadersMiddleware)
    logger.info("Proxy headers middleware configured for production (fixes HTTPS redirects)")

# Add trusted host middleware for production security
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=["api.kotori.io", "kotori-api-412014849981.us-central1.run.app"]
    )
    logger.info("Trusted host middleware configured for production")

# CORS middleware configuration
if settings.ENVIRONMENT == "development":
    logger.info(f"Setting up CORS for development environment with origins: {settings.CORS_ORIGINS}")
    # Use explicit origins rather than wildcard when withCredentials is true
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,  # Use explicit origins list
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=86400,  # 24 hours
    )
    logger.info("CORS middleware configured for development (with explicit origins)")
else:
    logger.info(f"Setting up CORS for production environment with origins: {settings.CORS_ORIGINS}")
    # Stricter CORS settings for production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=86400,  # 24 hours
    )
    logger.info("CORS middleware configured for production (restricted origins)")


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    # Log the request
    logger.info(f"Request: {request.method} {request.url.path}")

    try:
        response = await call_next(request)
        process_time = time.time() - start_time

        # Log the response
        logger.info(
            f"Response: {request.method} {request.url.path} "
            f"Status: {response.status_code} Time: {process_time:.3f}s"
        )
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f"Error in request: {request.method} {request.url.path} "
            f"Error: {str(e)} Time: {process_time:.3f}s"
        )
        raise


# Include routers
app.include_router(maintenance_router_module.router, prefix="/api/v1")
app.include_router(monitoring_router_module.router, prefix="/api/v1", tags=["Monitoring"])

# New unified v1 authentication routers (replacing old scattered auth endpoints)
app.include_router(v1_auth_router.router, prefix="/api/v1", tags=["Authentication v1"])
# Secret tags router removed in PBI-4 Stage 2
# if settings.ENABLE_SECRET_TAGS:
#     app.include_router(v1_secret_tags_router.router, prefix="/api/v1", tags=["Secret Tags v1"])

# Existing v1 endpoints 
app.include_router(vault_router_module.router, prefix="/api/vault", tags=["Vault Storage"])
app.include_router(audit_router_module.router, prefix="/api/audit", tags=["Security Audit"])
# Session router disabled in PBI-4 Stage 2 (OpaqueSession model removed)
# app.include_router(session_router_module.router, prefix="/api/session", tags=["Session Management"])

# Legacy endpoints (non-authentication - preserved)
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(journals_router, prefix="/api/journals", tags=["Journals"])
app.include_router(reminders_router, prefix="/api/reminders", tags=["Reminders"])
app.include_router(tags_router, prefix="/api/tags", tags=["Tags"])
app.include_router(speech_router_module.router, prefix="/api/speech", tags=["Speech"])

# New v1 journals endpoints
app.include_router(v1_journal_router_module.router, prefix="/api/v1/journals", tags=["Journals v1"])

# Share templates endpoints
app.include_router(share_templates_router_module.router, prefix="/api/v1/share-templates", tags=["Share Templates"])

# Shares endpoints
app.include_router(shares_router_module.router, prefix="/api/v1/shares", tags=["Shares"])

# Template import endpoints
app.include_router(template_import_router_module.router, prefix="/api/v1/template-import", tags=["Template Import"])

# Legacy OPAQUE endpoints removed - replaced by V1 implementation

# WebSocket endpoints
app.include_router(speech_websocket_router.router, prefix="/ws", tags=["WebSockets"])


@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "environment": settings.ENVIRONMENT}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG
    )
