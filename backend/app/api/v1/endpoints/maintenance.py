"""
Maintenance API Endpoints

Provides API endpoints for cleanup and maintenance operations including
session cleanup, vault maintenance, database optimization, and security hygiene.
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.dependencies import get_current_user
from app.services.cleanup_service import get_cleanup_service, CleanupServiceError, MaintenanceOperationError
from app.schemas.maintenance import (
    CleanupStatsResponse,
    SessionCleanupResponse,
    VaultCleanupResponse,
    DatabaseCleanupResponse,
    SecurityHygieneResponse,
    ComprehensiveCleanupResponse,
    MaintenanceHealthResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get(
    "/health",
    response_model=MaintenanceHealthResponse,
    summary="Get Maintenance Service Health",
    description="Get health status of the cleanup and maintenance service"
)
async def get_maintenance_health(
    db: Session = Depends(get_db)
) -> MaintenanceHealthResponse:
    """
    Get health status of the cleanup and maintenance service.
    
    Returns comprehensive health information including service status,
    dependency health, and cleanup statistics.
    """
    try:
        cleanup_svc = get_cleanup_service(db)
        health_data = cleanup_svc.get_service_health()
        
        return MaintenanceHealthResponse(**health_data)
        
    except Exception as e:
        logger.error(f"Error getting maintenance health: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get maintenance health"
        )


@router.get(
    "/statistics",
    response_model=CleanupStatsResponse,
    summary="Get Cleanup Statistics",
    description="Get detailed cleanup and maintenance statistics"
)
async def get_cleanup_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> CleanupStatsResponse:
    """
    Get detailed cleanup and maintenance statistics.
    
    Returns comprehensive statistics about cleanup operations,
    current system state, and configuration.
    """
    try:
        cleanup_svc = get_cleanup_service(db)
        stats_data = cleanup_svc.get_cleanup_statistics()
        
        return CleanupStatsResponse(**stats_data)
        
    except CleanupServiceError as e:
        logger.error(f"Cleanup service error getting statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting cleanup statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get cleanup statistics"
        )


@router.post(
    "/cleanup/sessions",
    response_model=SessionCleanupResponse,
    summary="Clean Up Expired Sessions",
    description="Clean up expired authentication sessions and related data"
)
async def cleanup_expired_sessions(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> SessionCleanupResponse:
    """
    Clean up expired authentication sessions and related data.
    
    Removes expired OPAQUE sessions, session keys, and orphaned
    wrapped keys to maintain system performance and security.
    """
    try:
        logger.info(f"Session cleanup requested by user {current_user.id}")
        
        cleanup_svc = get_cleanup_service(db)
        cleanup_stats = cleanup_svc.cleanup_expired_sessions()
        
        return SessionCleanupResponse(
            success=True,
            sessions_cleaned=cleanup_stats.get('total_cleaned', 0),
            opaque_sessions_cleaned=cleanup_stats.get('opaque_sessions', 0),
            session_keys_cleaned=cleanup_stats.get('session_keys', 0),
            wrapped_keys_cleaned=cleanup_stats.get('wrapped_keys', 0),
            message=f"Cleaned up {cleanup_stats.get('total_cleaned', 0)} session-related items"
        )
        
    except MaintenanceOperationError as e:
        logger.error(f"Maintenance operation error during session cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error during session cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session cleanup failed"
        )


@router.post(
    "/cleanup/vault",
    response_model=VaultCleanupResponse,
    summary="Clean Up Orphaned Vault Data",
    description="Clean up orphaned vault data and associated keys"
)
async def cleanup_orphaned_vault_data(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> VaultCleanupResponse:
    """
    Clean up orphaned vault data and associated keys.
    
    Removes vault data that no longer has corresponding secret tags
    and cleans up orphaned encryption keys.
    """
    try:
        logger.info(f"Vault cleanup requested by user {current_user.id}")
        
        cleanup_svc = get_cleanup_service(db)
        cleanup_stats = cleanup_svc.cleanup_orphaned_vault_data()
        
        return VaultCleanupResponse(
            success=True,
            vault_data_cleaned=cleanup_stats.get('total_cleaned', 0),
            orphaned_vaults_cleaned=cleanup_stats.get('orphaned_vaults', 0),
            orphaned_keys_cleaned=cleanup_stats.get('orphaned_keys', 0),
            vault_records_cleaned=cleanup_stats.get('vault_data_cleaned', 0),
            message=f"Cleaned up {cleanup_stats.get('total_cleaned', 0)} vault-related items"
        )
        
    except MaintenanceOperationError as e:
        logger.error(f"Maintenance operation error during vault cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error during vault cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Vault cleanup failed"
        )


@router.post(
    "/cleanup/database",
    response_model=DatabaseCleanupResponse,
    summary="Clean Up Database Records",
    description="Clean up expired database records and optimize database"
)
async def cleanup_database_records(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> DatabaseCleanupResponse:
    """
    Clean up expired database records and optimize database.
    
    Removes old audit logs, expired records, and performs
    database optimization operations.
    """
    try:
        logger.info(f"Database cleanup requested by user {current_user.id}")
        
        cleanup_svc = get_cleanup_service(db)
        cleanup_stats = cleanup_svc.cleanup_database_records()
        
        return DatabaseCleanupResponse(
            success=True,
            records_cleaned=cleanup_stats.get('total_cleaned', 0),
            audit_logs_cleaned=cleanup_stats.get('audit_logs_cleaned', 0),
            expired_records_cleaned=cleanup_stats.get('expired_records_cleaned', 0),
            database_optimized=cleanup_stats.get('database_optimized', False),
            message=f"Cleaned up {cleanup_stats.get('total_cleaned', 0)} database records"
        )
        
    except MaintenanceOperationError as e:
        logger.error(f"Maintenance operation error during database cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error during database cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database cleanup failed"
        )


@router.post(
    "/security/hygiene",
    response_model=SecurityHygieneResponse,
    summary="Perform Security Hygiene",
    description="Perform security hygiene operations including key cleanup and security checks"
)
async def perform_security_hygiene(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> SecurityHygieneResponse:
    """
    Perform security hygiene operations.
    
    Includes secure memory cleanup, key store cleanup,
    and security integrity checks.
    """
    try:
        logger.info(f"Security hygiene requested by user {current_user.id}")
        
        cleanup_svc = get_cleanup_service(db)
        hygiene_stats = cleanup_svc.perform_security_hygiene()
        
        return SecurityHygieneResponse(
            success=True,
            operations_performed=hygiene_stats.get('total_operations', 0),
            memory_cleanup_performed=hygiene_stats.get('memory_cleanup', False),
            key_store_keys_cleaned=hygiene_stats.get('key_store_cleanup', 0),
            security_checks_performed=hygiene_stats.get('security_checks', 0),
            message=f"Performed {hygiene_stats.get('total_operations', 0)} security hygiene operations"
        )
        
    except MaintenanceOperationError as e:
        logger.error(f"Maintenance operation error during security hygiene: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error during security hygiene: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Security hygiene failed"
        )


@router.post(
    "/cleanup/comprehensive",
    response_model=ComprehensiveCleanupResponse,
    summary="Perform Comprehensive Cleanup",
    description="Perform comprehensive cleanup of all system components"
)
async def perform_comprehensive_cleanup(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> ComprehensiveCleanupResponse:
    """
    Perform comprehensive cleanup of all system components.
    
    Executes session cleanup, vault maintenance, database cleanup,
    and security hygiene operations in sequence.
    """
    try:
        logger.info(f"Comprehensive cleanup requested by user {current_user.id}")
        
        cleanup_svc = get_cleanup_service(db)
        
        # Run comprehensive cleanup in background if requested
        def run_comprehensive_cleanup():
            try:
                return cleanup_svc.perform_comprehensive_cleanup()
            except Exception as e:
                logger.error(f"Background comprehensive cleanup failed: {e}")
                raise
        
        # For now, run synchronously for immediate response
        cleanup_stats = cleanup_svc.perform_comprehensive_cleanup()
        
        # Calculate total items cleaned
        total_cleaned = (
            cleanup_stats.get('session_cleanup', {}).get('total_cleaned', 0) +
            cleanup_stats.get('vault_cleanup', {}).get('total_cleaned', 0) +
            cleanup_stats.get('database_cleanup', {}).get('total_cleaned', 0) +
            cleanup_stats.get('security_hygiene', {}).get('total_operations', 0)
        )
        
        return ComprehensiveCleanupResponse(
            success=cleanup_stats.get('success', False),
            total_items_cleaned=total_cleaned,
            session_cleanup_stats=cleanup_stats.get('session_cleanup', {}),
            vault_cleanup_stats=cleanup_stats.get('vault_cleanup', {}),
            database_cleanup_stats=cleanup_stats.get('database_cleanup', {}),
            security_hygiene_stats=cleanup_stats.get('security_hygiene', {}),
            total_duration_seconds=cleanup_stats.get('total_duration', 0),
            message=f"Comprehensive cleanup completed: {total_cleaned} items processed in {cleanup_stats.get('total_duration', 0):.2f}s"
        )
        
    except MaintenanceOperationError as e:
        logger.error(f"Maintenance operation error during comprehensive cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error during comprehensive cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Comprehensive cleanup failed"
        )


@router.post(
    "/emergency",
    summary="Emergency Cleanup",
    description="Perform emergency cleanup operations for critical situations"
)
async def emergency_cleanup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Perform emergency cleanup operations for critical situations.
    
    This endpoint performs immediate cleanup of critical system resources
    and should only be used in emergency situations.
    """
    try:
        logger.warning(f"Emergency cleanup requested by user {current_user.id}")
        
        # Perform emergency memory cleanup
        from app.crypto.secure_memory import SecureMemoryManager
        memory_manager = SecureMemoryManager()
        memory_manager.emergency_cleanup()
        
        # Perform emergency key store cleanup
        cleanup_svc = get_cleanup_service(db)
        key_cleanup_count = cleanup_svc._secure_key_store.cleanup_expired()
        
        # Perform emergency session cleanup
        session_cleanup_stats = cleanup_svc.cleanup_expired_sessions()
        
        return {
            "success": True,
            "emergency_cleanup_performed": True,
            "memory_cleanup": True,
            "key_cleanup_count": key_cleanup_count,
            "session_cleanup_stats": session_cleanup_stats,
            "message": "Emergency cleanup completed successfully",
            "timestamp": cleanup_svc._cleanup_stats.get('last_cleanup')
        }
        
    except Exception as e:
        logger.error(f"Error during emergency cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Emergency cleanup failed"
        ) 