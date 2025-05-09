import logging
import time
import traceback

from fastapi import FastAPI
from fastapi import Request
from fastapi import status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.endpoints import speech as speech_router_module
from app.core.config import settings
from app.routers import auth_router
from app.routers import journals_router
from app.routers import reminders_router
from app.routers import users_router
from app.websockets import speech as speech_websocket_router

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Vibes API",
    description="API for Vibes: Voice-Controlled Journaling Application",
    version="0.1.0",
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

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": error_details},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    logger.error(traceback.format_exc())

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # 24 hours
)


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
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(journals_router, prefix="/api/journals", tags=["Journals"])
app.include_router(reminders_router, prefix="/api/reminders", tags=["Reminders"])
app.include_router(speech_router_module.router, prefix="/api/speech", tags=["Speech"])
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
