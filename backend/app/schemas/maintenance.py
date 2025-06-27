"""
Maintenance and Cleanup Schemas

Pydantic schemas for maintenance and cleanup API requests and responses.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class CleanupStatsResponse(BaseModel):
    """Response schema for cleanup statistics."""
    
    cleanup_statistics: Dict[str, Any] = Field(
        ...,
        description="Historical cleanup statistics"
    )
    
    current_counts: Dict[str, int] = Field(
        ...,
        description="Current system counts"
    )
    
    key_manager_stats: Dict[str, int] = Field(
        ...,
        description="Key manager statistics"
    )
    
    configuration: Dict[str, Any] = Field(
        ...,
        description="Cleanup service configuration"
    )
    
    timestamp: str = Field(
        ...,
        description="Timestamp of statistics generation"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "cleanup_statistics": {
                    "sessions_cleaned": 150,
                    "vault_data_cleaned": 25,
                    "database_records_cleaned": 300,
                    "keys_cleaned": 75,
                    "last_cleanup": "2025-06-27T03:30:00",
                    "total_cleanup_operations": 12
                },
                "current_counts": {
                    "total_sessions": 45,
                    "active_sessions": 23,
                    "secret_tags": 156,
                    "wrapped_keys": 234
                },
                "key_manager_stats": {
                    "active_keys": 12,
                    "active_sessions": 8
                },
                "configuration": {
                    "batch_size": 100,
                    "session_retention_days": 7,
                    "audit_retention_days": 90,
                    "vault_orphan_days": 30
                },
                "timestamp": "2025-06-27T03:30:00"
            }
        }


class SessionCleanupResponse(BaseModel):
    """Response schema for session cleanup operations."""
    
    success: bool = Field(..., description="Whether cleanup was successful")
    sessions_cleaned: int = Field(..., description="Total number of session-related items cleaned")
    opaque_sessions_cleaned: int = Field(..., description="Number of OPAQUE sessions cleaned")
    session_keys_cleaned: int = Field(..., description="Number of session keys cleaned")
    wrapped_keys_cleaned: int = Field(..., description="Number of wrapped keys cleaned")
    message: str = Field(..., description="Cleanup status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "sessions_cleaned": 45,
                "opaque_sessions_cleaned": 15,
                "session_keys_cleaned": 25,
                "wrapped_keys_cleaned": 5,
                "message": "Cleaned up 45 session-related items"
            }
        }


class VaultCleanupResponse(BaseModel):
    """Response schema for vault cleanup operations."""
    
    success: bool = Field(..., description="Whether cleanup was successful")
    vault_data_cleaned: int = Field(..., description="Total number of vault-related items cleaned")
    orphaned_vaults_cleaned: int = Field(..., description="Number of orphaned vaults cleaned")
    orphaned_keys_cleaned: int = Field(..., description="Number of orphaned keys cleaned")
    vault_records_cleaned: int = Field(..., description="Number of vault database records cleaned")
    message: str = Field(..., description="Cleanup status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "vault_data_cleaned": 12,
                "orphaned_vaults_cleaned": 3,
                "orphaned_keys_cleaned": 8,
                "vault_records_cleaned": 1,
                "message": "Cleaned up 12 vault-related items"
            }
        }


class DatabaseCleanupResponse(BaseModel):
    """Response schema for database cleanup operations."""
    
    success: bool = Field(..., description="Whether cleanup was successful")
    records_cleaned: int = Field(..., description="Total number of database records cleaned")
    audit_logs_cleaned: int = Field(..., description="Number of audit log records cleaned")
    expired_records_cleaned: int = Field(..., description="Number of expired records cleaned")
    database_optimized: bool = Field(..., description="Whether database optimization was performed")
    message: str = Field(..., description="Cleanup status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "records_cleaned": 150,
                "audit_logs_cleaned": 100,
                "expired_records_cleaned": 50,
                "database_optimized": True,
                "message": "Cleaned up 150 database records"
            }
        }


class SecurityHygieneResponse(BaseModel):
    """Response schema for security hygiene operations."""
    
    success: bool = Field(..., description="Whether security hygiene was successful")
    operations_performed: int = Field(..., description="Total number of security operations performed")
    memory_cleanup_performed: bool = Field(..., description="Whether memory cleanup was performed")
    key_store_keys_cleaned: int = Field(..., description="Number of keys cleaned from key store")
    security_checks_performed: int = Field(..., description="Number of security checks performed")
    message: str = Field(..., description="Security hygiene status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "operations_performed": 5,
                "memory_cleanup_performed": True,
                "key_store_keys_cleaned": 3,
                "security_checks_performed": 3,
                "message": "Performed 5 security hygiene operations"
            }
        }


class ComprehensiveCleanupResponse(BaseModel):
    """Response schema for comprehensive cleanup operations."""
    
    success: bool = Field(..., description="Whether comprehensive cleanup was successful")
    total_items_cleaned: int = Field(..., description="Total number of items cleaned across all operations")
    session_cleanup_stats: Dict[str, int] = Field(..., description="Session cleanup statistics")
    vault_cleanup_stats: Dict[str, int] = Field(..., description="Vault cleanup statistics")
    database_cleanup_stats: Dict[str, int] = Field(..., description="Database cleanup statistics")
    security_hygiene_stats: Dict[str, int] = Field(..., description="Security hygiene statistics")
    total_duration_seconds: float = Field(..., description="Total duration of cleanup in seconds")
    message: str = Field(..., description="Comprehensive cleanup status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "total_items_cleaned": 212,
                "session_cleanup_stats": {
                    "total_cleaned": 45,
                    "opaque_sessions": 15,
                    "session_keys": 25,
                    "wrapped_keys": 5
                },
                "vault_cleanup_stats": {
                    "total_cleaned": 12,
                    "orphaned_vaults": 3,
                    "orphaned_keys": 8,
                    "vault_data_cleaned": 1
                },
                "database_cleanup_stats": {
                    "total_cleaned": 150,
                    "audit_logs_cleaned": 100,
                    "expired_records_cleaned": 50
                },
                "security_hygiene_stats": {
                    "total_operations": 5,
                    "key_store_cleanup": 3,
                    "security_checks": 3
                },
                "total_duration_seconds": 12.45,
                "message": "Comprehensive cleanup completed: 212 items processed in 12.45s"
            }
        }


class MaintenanceHealthResponse(BaseModel):
    """Response schema for maintenance service health."""
    
    service: str = Field(..., description="Service name")
    status: str = Field(..., description="Overall service status")
    timestamp: str = Field(..., description="Health check timestamp")
    dependencies: Dict[str, Dict[str, Any]] = Field(..., description="Dependency health status")
    statistics: Dict[str, Any] = Field(..., description="Service statistics")
    
    class Config:
        schema_extra = {
            "example": {
                "service": "cleanup_service",
                "status": "healthy",
                "timestamp": "2025-06-27T03:30:00",
                "dependencies": {
                    "database": {"status": "healthy"},
                    "audit_service": {"status": "healthy"}
                },
                "statistics": {
                    "sessions_cleaned": 150,
                    "vault_data_cleaned": 25,
                    "database_records_cleaned": 300,
                    "keys_cleaned": 75,
                    "last_cleanup": "2025-06-27T03:25:00",
                    "total_cleanup_operations": 12
                }
            }
        }


class MaintenanceScheduleRequest(BaseModel):
    """Request schema for scheduling maintenance operations."""
    
    operation_type: str = Field(
        ...,
        description="Type of maintenance operation",
        pattern="^(sessions|vault|database|security|comprehensive)$"
    )
    
    schedule_cron: Optional[str] = Field(
        None,
        description="Cron expression for scheduling (optional)"
    )
    
    immediate: bool = Field(
        default=False,
        description="Whether to run the operation immediately"
    )
    
    configuration: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional configuration overrides"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "operation_type": "comprehensive",
                "schedule_cron": "0 2 * * *",
                "immediate": False,
                "configuration": {
                    "batch_size": 200,
                    "session_retention_days": 14
                }
            }
        }


class MaintenanceScheduleResponse(BaseModel):
    """Response schema for maintenance scheduling operations."""
    
    success: bool = Field(..., description="Whether scheduling was successful")
    operation_type: str = Field(..., description="Type of operation scheduled")
    schedule_id: str = Field(..., description="Unique identifier for the scheduled operation")
    next_run: Optional[str] = Field(None, description="Next scheduled run time")
    configuration: Dict[str, Any] = Field(..., description="Operation configuration")
    message: str = Field(..., description="Scheduling status message")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "operation_type": "comprehensive",
                "schedule_id": "cleanup_comp_001",
                "next_run": "2025-06-28T02:00:00",
                "configuration": {
                    "batch_size": 200,
                    "session_retention_days": 14
                },
                "message": "Comprehensive cleanup scheduled successfully"
            }
        } 