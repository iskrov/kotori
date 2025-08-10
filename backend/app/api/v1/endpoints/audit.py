"""
Security Audit Logging API Endpoints

This module provides FastAPI routes for security audit logging operations,
metrics collection, and integrity verification.
"""

import asyncio
from fastapi import APIRouter, HTTPException, Depends, status, Request, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import logging

from app.dependencies import get_db, get_current_active_user_from_session, get_current_active_superuser
from app.models.user import User
from app.services.audit_service import audit_service, AuditServiceError, AuditIntegrityError
from app.schemas.audit import (
    AuditLogRequest,
    AuditLogResponse,
    AuditLogEntry,
    AuditLogListRequest,
    AuditLogListResponse,
    SecurityMetricsRequest,
    SecurityMetricsResponse,
    SecurityMetric,
    SecurityAlertRequest,
    SecurityAlert,
    SecurityAlertsResponse,
    AuditIntegrityRequest,
    AuditIntegrityResponse,
    AuditIntegrityResult,
    AuditErrorResponse,
    EventCategory,
    EventSeverity
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/log", response_model=AuditLogResponse)
async def create_audit_log(
    request: AuditLogRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user_from_session)
):
    """
    Create a new audit log entry
    
    Creates a security audit log entry with privacy protection and integrity verification.
    Only authenticated users can create audit logs.
    """
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Extract client information
        forwarded_for = http_request.headers.get("x-forwarded-for")
        if forwarded_for:
            ip_address = forwarded_for.split(",")[0].strip()
        else:
            ip_address = http_request.headers.get("x-real-ip", "")
        if not ip_address:
            ip_address = getattr(http_request.client, "host", "")
        
        user_agent = http_request.headers.get("user-agent", "")
        
        # Create audit log entry
        log_entry = audit_service.log_event(
            db=db,
            event_type=request.event_type,
            event_category=request.event_category.value,
            severity=request.severity.value,
            message=request.message,
            user_id=request.user_id or str(current_user.id),
            session_id=request.session_id,
            correlation_id=request.correlation_id,
            request_id=request.request_id,
            ip_address=ip_address,
            user_agent=user_agent,
            event_data=request.event_data,
            success=request.success,
            error_code=request.error_code,
            processing_time_ms=request.processing_time_ms,
            is_sensitive=request.is_sensitive
        )
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < 50:  # Minimum 50ms response time
            await asyncio.sleep((50 - elapsed) / 1000)
        
        if log_entry:
            return AuditLogResponse(
                success=True,
                log_id=log_entry.id,
                correlation_id=log_entry.correlation_id,
                message="Audit log entry created successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create audit log entry"
            )
        
    except AuditServiceError as e:
        logger.error(f"Audit service error: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < 50:
            await asyncio.sleep((50 - elapsed) / 1000)
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audit logging failed: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error creating audit log: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < 50:
            await asyncio.sleep((50 - elapsed) / 1000)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    event_category: Optional[EventCategory] = Query(None, description="Filter by event category"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[EventSeverity] = Query(None, description="Filter by severity"),
    start_time: Optional[datetime] = Query(None, description="Filter by start time"),
    end_time: Optional[datetime] = Query(None, description="Filter by end time"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user_from_session)
):
    """
    List audit log entries with filtering and pagination
    
    Returns audit log entries based on filtering criteria. Users can only access
    their own audit logs unless they are superusers.
    """
    try:
        # Security check: regular users can only access their own logs
        if not current_user.is_superuser:
            if user_id and user_id != str(current_user.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot access other users' audit logs"
                )
            user_id = str(current_user.id)
        
        # Retrieve audit logs
        logs = audit_service.get_audit_logs(
            db=db,
            user_id=user_id,
            event_category=event_category.value if event_category else None,
            event_type=event_type,
            severity=severity.value if severity else None,
            start_time=start_time,
            end_time=end_time,
            limit=limit,
            offset=offset
        )
        
        # Convert to response format
        log_entries = []
        for log in logs:
            event_data = None
            if log.event_data:
                try:
                    import json
                    event_data = json.loads(log.event_data)
                except:
                    event_data = {"error": "Invalid JSON data"}
            
            log_entries.append(AuditLogEntry(
                id=log.id,
                event_type=log.event_type,
                event_category=log.event_category,
                severity=log.severity,
                user_id_hash=log.user_id_hash,
                session_id_hash=log.session_id_hash,
                correlation_id=log.correlation_id,
                request_id=log.request_id,
                event_message=log.event_message,
                event_data=event_data,
                success=log.success,
                error_code=log.error_code,
                processing_time_ms=log.processing_time_ms,
                timestamp=log.timestamp,
                is_sensitive=log.is_sensitive
            ))
        
        # Calculate pagination info
        total_count = len(log_entries) + offset  # Simplified count
        has_more = len(log_entries) == limit
        
        return AuditLogListResponse(
            logs=log_entries,
            total_count=total_count,
            has_more=has_more
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing audit logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/metrics", response_model=SecurityMetricsResponse)
async def get_security_metrics(
    metric_names: Optional[List[str]] = Query(None, description="Specific metrics to retrieve"),
    time_window: str = Query("1h", description="Time window for metrics"),
    start_time: Optional[datetime] = Query(None, description="Start time for metrics"),
    end_time: Optional[datetime] = Query(None, description="End time for metrics"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)  # Only superusers can access metrics
):
    """
    Get security metrics and statistics
    
    Returns aggregated security metrics for monitoring and alerting.
    Only superusers can access security metrics.
    """
    try:
        # Set default time range if not provided
        if not end_time:
            end_time = datetime.now(timezone.utc)
        if not start_time:
            # Parse time window
            if time_window == "1m":
                start_time = end_time - timedelta(minutes=1)
            elif time_window == "5m":
                start_time = end_time - timedelta(minutes=5)
            elif time_window == "15m":
                start_time = end_time - timedelta(minutes=15)
            elif time_window == "1h":
                start_time = end_time - timedelta(hours=1)
            elif time_window == "24h":
                start_time = end_time - timedelta(hours=24)
            else:
                start_time = end_time - timedelta(hours=1)
        
        # For now, return sample metrics (would be implemented with real aggregation)
        metrics = [
            SecurityMetric(
                metric_name="auth_attempts",
                metric_type="counter",
                time_window=time_window,
                value=150,
                max_value=25,
                min_value=0,
                avg_value=6,
                window_start=start_time,
                window_end=end_time
            ),
            SecurityMetric(
                metric_name="auth_failures",
                metric_type="counter",
                time_window=time_window,
                value=12,
                max_value=3,
                min_value=0,
                avg_value=1,
                window_start=start_time,
                window_end=end_time
            ),
            SecurityMetric(
                metric_name="session_creations",
                metric_type="counter",
                time_window=time_window,
                value=85,
                max_value=15,
                min_value=0,
                avg_value=4,
                window_start=start_time,
                window_end=end_time
            )
        ]
        
        # Filter by requested metric names
        if metric_names:
            metrics = [m for m in metrics if m.metric_name in metric_names]
        
        return SecurityMetricsResponse(
            metrics=metrics,
            time_range={"start": start_time, "end": end_time}
        )
        
    except Exception as e:
        logger.error(f"Error getting security metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/alerts", response_model=SecurityAlertsResponse)
async def list_security_alerts(
    alert_type: Optional[str] = Query(None, description="Filter by alert type"),
    severity: Optional[EventSeverity] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)  # Only superusers can access alerts
):
    """
    List security alerts
    
    Returns security alerts for monitoring and incident response.
    Only superusers can access security alerts.
    """
    try:
        # For now, return sample alerts (would be implemented with real alert system)
        sample_alerts = [
            SecurityAlert(
                id="alert-12345678-1234-1234-1234-123456789012",
                alert_type="brute_force_attack",
                severity="critical",
                status="active",
                title="Brute Force Attack Detected",
                description="Multiple failed authentication attempts detected from same IP",
                detection_rule="auth_failure_threshold",
                user_id_hash="a1b2c3d4e5f6...",
                correlation_id="corr-12345678-1234-1234-1234-123456789012",
                first_seen=datetime.now(timezone.utc) - timedelta(minutes=15),
                last_seen=datetime.now(timezone.utc) - timedelta(minutes=2),
                event_count=8,
                confidence_score=95
            )
        ]
        
        # Apply filters
        filtered_alerts = sample_alerts
        if alert_type:
            filtered_alerts = [a for a in filtered_alerts if a.alert_type == alert_type]
        if severity:
            filtered_alerts = [a for a in filtered_alerts if a.severity == severity.value]
        if status:
            filtered_alerts = [a for a in filtered_alerts if a.status == status]
        
        # Apply pagination
        paginated_alerts = filtered_alerts[offset:offset + limit]
        
        # Count active alerts
        active_count = len([a for a in filtered_alerts if a.status == "active"])
        
        return SecurityAlertsResponse(
            alerts=paginated_alerts,
            total_count=len(filtered_alerts),
            active_count=active_count
        )
        
    except Exception as e:
        logger.error(f"Error listing security alerts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/verify-integrity", response_model=AuditIntegrityResponse)
async def verify_audit_integrity(
    request: AuditIntegrityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)  # Only superusers can verify integrity
):
    """
    Verify audit log integrity
    
    Verifies the cryptographic integrity of audit log entries.
    Only superusers can perform integrity verification.
    """
    try:
        results = []
        valid_count = 0
        invalid_count = 0
        
        for log_id in request.log_ids:
            try:
                is_valid = audit_service.verify_log_integrity(db, log_id)
                if is_valid:
                    valid_count += 1
                else:
                    invalid_count += 1
                
                results.append(AuditIntegrityResult(
                    log_id=log_id,
                    is_valid=is_valid,
                    error_message=None if is_valid else "Signature verification failed"
                ))
                
            except Exception as e:
                invalid_count += 1
                results.append(AuditIntegrityResult(
                    log_id=log_id,
                    is_valid=False,
                    error_message=f"Verification error: {str(e)}"
                ))
        
        return AuditIntegrityResponse(
            results=results,
            total_checked=len(request.log_ids),
            valid_count=valid_count,
            invalid_count=invalid_count
        )
        
    except Exception as e:
        logger.error(f"Error verifying audit integrity: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/detect-threats")
async def detect_security_threats(
    user_id: Optional[str] = Query(None, description="User ID to check for threats"),
    ip_address: Optional[str] = Query(None, description="IP address to check"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)  # Only superusers can run threat detection
):
    """
    Run security threat detection
    
    Analyzes audit logs for security threats and suspicious patterns.
    Only superusers can run threat detection.
    """
    try:
        threats_detected = []
        
        # Check for brute force attacks
        if user_id:
            brute_force_detected = audit_service.detect_brute_force_attack(
                db=db,
                user_id=user_id,
                ip_address=ip_address,
                time_window_minutes=15,
                failure_threshold=5
            )
            
            if brute_force_detected:
                threats_detected.append({
                    "threat_type": "brute_force_attack",
                    "severity": "critical",
                    "description": "Brute force attack detected",
                    "user_id": user_id,
                    "ip_address": ip_address
                })
        
        return {
            "threats_detected": threats_detected,
            "total_threats": len(threats_detected),
            "scan_time": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error detecting security threats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/cleanup")
async def cleanup_audit_logs(
    retention_days: int = Query(90, ge=1, le=365, description="Number of days to retain logs"),
    dry_run: bool = Query(True, description="Whether to perform a dry run"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)  # Only superusers can cleanup logs
):
    """
    Clean up old audit logs
    
    Removes old audit logs based on retention policy.
    Only superusers can perform log cleanup.
    """
    try:
        if dry_run:
            # Calculate how many logs would be deleted
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
            from app.models.secret_tag_opaque import SecurityAuditLog
            
            count = db.query(SecurityAuditLog).filter(
                SecurityAuditLog.timestamp < cutoff_date,
                SecurityAuditLog.is_sensitive == False
            ).count()
            
            return {
                "dry_run": True,
                "logs_to_delete": count,
                "retention_days": retention_days,
                "cutoff_date": cutoff_date.isoformat()
            }
        else:
            # Perform actual cleanup
            deleted_count = audit_service.cleanup_old_logs(
                db=db,
                retention_days=retention_days,
                batch_size=1000
            )
            
            return {
                "dry_run": False,
                "logs_deleted": deleted_count,
                "retention_days": retention_days
            }
        
    except Exception as e:
        logger.error(f"Error cleaning up audit logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/health")
async def audit_health_check():
    """
    Health check endpoint for audit logging system
    
    Returns the health status of the audit logging system.
    """
    return {
        "status": "healthy",
        "service": "security_audit_logging",
        "features": {
            "audit_logging": True,
            "integrity_verification": True,
            "threat_detection": True,
            "metrics_collection": True,
            "log_cleanup": True,
            "zero_knowledge_compliance": True,
            "tamper_evidence": True
        },
        "privacy_protection": {
            "user_id_hashing": audit_service.HASH_USER_IDS,
            "ip_address_hashing": audit_service.HASH_IP_ADDRESSES,
            "user_agent_hashing": audit_service.HASH_USER_AGENTS,
            "sensitive_data_sanitization": True
        }
    } 