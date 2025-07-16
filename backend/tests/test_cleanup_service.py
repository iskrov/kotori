"""
Tests for Cleanup and Maintenance Service

Tests comprehensive cleanup operations including session cleanup, vault maintenance,
database optimization, and security hygiene operations.
"""

import pytest
import time
from datetime import datetime, timedelta, UTC
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.services.cleanup_service import (
    CleanupService,
    create_cleanup_service,
    get_cleanup_service,
    CleanupServiceError,
    MaintenanceOperationError
)
from app.models import SecretTag, WrappedKey, OpaqueSession, User


class TestCleanupService:
    """Test suite for Cleanup Service."""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return Mock(spec=Session)
    
    @pytest.fixture
    def mock_session_service(self):
        """Mock session service."""
        mock = Mock()
        mock.cleanup_expired_sessions = Mock(return_value=5)
        return mock
    
    @pytest.fixture
    def mock_vault_service(self):
        """Mock vault service."""
        mock = Mock()
        mock.get_vault_stats = Mock(return_value=Mock(total_size=1024, total_blobs=5))
        return mock
    
    @pytest.fixture
    def mock_audit_service(self):
        """Mock audit service."""
        mock = Mock()
        mock.audit_context = Mock()
        mock.audit_context.return_value.__enter__ = Mock(return_value="test-correlation-id")
        mock.audit_context.return_value.__exit__ = Mock(return_value=None)
        mock.log_security_event = Mock()
        mock.get_service_health = Mock(return_value={"status": "healthy"})
        return mock
    
    @pytest.fixture
    def mock_key_store(self):
        """Mock secure key store."""
        mock = Mock()
        mock.cleanup_expired = Mock(return_value=3)
        mock.list_keys = Mock(return_value=[])
        return mock
    
    @pytest.fixture
    def mock_session_key_manager(self):
        """Mock session key manager."""
        mock = Mock()
        mock.end_session = Mock(return_value=2)
        mock.cleanup_expired_sessions = Mock(return_value=1)
        mock._sessions = {}
        return mock
    
    @pytest.fixture
    def cleanup_service(self, mock_db, mock_session_service, mock_vault_service, 
                       mock_audit_service, mock_key_store, mock_session_key_manager):
        """Create cleanup service with mocked dependencies."""
        with patch('app.services.cleanup_service.session_service', mock_session_service), \
             patch('app.services.cleanup_service.audit_service', mock_audit_service), \
             patch('app.services.cleanup_service.SecureKeyStore', return_value=mock_key_store), \
             patch('app.services.cleanup_service.SessionKeyManager', return_value=mock_session_key_manager):
            
            service = CleanupService(mock_db)
            service._vault_service = mock_vault_service
            return service

    def test_service_initialization(self, mock_db):
        """Test cleanup service initialization."""
        with patch('app.services.cleanup_service.session_service'), \
             patch('app.services.cleanup_service.audit_service'), \
             patch('app.services.cleanup_service.SecureKeyStore'), \
             patch('app.services.cleanup_service.SessionKeyManager'):
            
            service = CleanupService(
                db=mock_db,
                batch_size=50,
                session_retention_days=14,
                audit_retention_days=180,
                vault_orphan_days=60
            )
            
            assert service.db == mock_db
            assert service.batch_size == 50
            assert service.session_retention_days == 14
            assert service.audit_retention_days == 180
            assert service.vault_orphan_days == 60

    def test_cleanup_expired_sessions_success(self, cleanup_service, mock_db):
        """Test successful session cleanup."""
        # Mock expired sessions
        mock_sessions = [Mock(session_id="session1"), Mock(session_id="session2")]
        mock_db.query.return_value.filter.return_value.limit.return_value.all.side_effect = [
            mock_sessions,
            []  # Second call returns empty to end batching
        ]
        mock_db.commit = Mock()
        
        # Mock orphaned keys cleanup
        with patch.object(cleanup_service, '_cleanup_orphaned_wrapped_keys', return_value=3):
            result = cleanup_service.cleanup_expired_sessions()
        
        assert result['opaque_sessions'] == 2
        assert result['session_keys'] >= 2  # From session key manager
        assert result['wrapped_keys'] == 3
        assert result['total_cleaned'] > 0
        
        # Verify database operations
        assert mock_db.delete.call_count == 2
        mock_db.commit.assert_called()

    def test_cleanup_expired_sessions_database_error(self, cleanup_service, mock_db):
        """Test session cleanup with database error."""
        mock_db.query.side_effect = SQLAlchemyError("Database error")
        mock_db.rollback = Mock()
        
        with pytest.raises(MaintenanceOperationError, match="Session cleanup failed"):
            cleanup_service.cleanup_expired_sessions()
        
        mock_db.rollback.assert_called_once()

    def test_cleanup_orphaned_vault_data_success(self, cleanup_service, mock_db):
        """Test successful vault data cleanup."""
        # Mock orphaned keys cleanup
        with patch.object(cleanup_service, '_cleanup_orphaned_wrapped_keys', return_value=5), \
             patch.object(cleanup_service, '_cleanup_vault_database_records', return_value=2):
            
            result = cleanup_service.cleanup_orphaned_vault_data()
        
        assert result['orphaned_keys'] == 5
        assert result['vault_data_cleaned'] == 2
        assert result['total_cleaned'] == 7

    def test_cleanup_database_records_success(self, cleanup_service, mock_db):
        """Test successful database cleanup."""
        with patch.object(cleanup_service, '_cleanup_audit_logs', return_value=10), \
             patch.object(cleanup_service, '_cleanup_expired_database_records', return_value=5), \
             patch.object(cleanup_service, '_optimize_database', return_value=True):
            
            result = cleanup_service.cleanup_database_records()
        
        assert result['audit_logs_cleaned'] == 10
        assert result['expired_records_cleaned'] == 5
        assert result['database_optimized'] is True
        assert result['total_cleaned'] == 15

    def test_perform_security_hygiene_success(self, cleanup_service):
        """Test successful security hygiene operations."""
        with patch('app.crypto.secure_memory.SecureMemoryManager') as mock_memory_manager, \
             patch.object(cleanup_service, '_perform_security_checks', return_value=3):
            
            mock_memory_instance = Mock()
            mock_memory_manager.return_value = mock_memory_instance
            
            result = cleanup_service.perform_security_hygiene()
        
        assert result['memory_cleanup'] is True
        assert result['key_store_cleanup'] == 3  # From mock key store
        assert result['security_checks'] == 3
        assert result['total_operations'] == 7  # 1 + 3 + 3

    def test_perform_security_hygiene_memory_error(self, cleanup_service):
        """Test security hygiene with memory cleanup error."""
        with patch('app.crypto.secure_memory.SecureMemoryManager', 
                  side_effect=Exception("Memory error")), \
             patch.object(cleanup_service, '_perform_security_checks', return_value=3):
            
            result = cleanup_service.perform_security_hygiene()
        
        # Should handle memory cleanup error gracefully
        assert result['memory_cleanup'] is False
        assert result['key_store_cleanup'] == 3
        assert result['security_checks'] == 3

    def test_perform_comprehensive_cleanup_success(self, cleanup_service):
        """Test successful comprehensive cleanup."""
        with patch.object(cleanup_service, 'cleanup_expired_sessions', 
                         return_value={'total_cleaned': 10}), \
             patch.object(cleanup_service, 'cleanup_orphaned_vault_data', 
                         return_value={'total_cleaned': 5}), \
             patch.object(cleanup_service, 'cleanup_database_records', 
                         return_value={'total_cleaned': 15}), \
             patch.object(cleanup_service, 'perform_security_hygiene', 
                         return_value={'total_operations': 8}):
            
            result = cleanup_service.perform_comprehensive_cleanup()
        
        assert result['success'] is True
        assert result['session_cleanup']['total_cleaned'] == 10
        assert result['vault_cleanup']['total_cleaned'] == 5
        assert result['database_cleanup']['total_cleaned'] == 15
        assert result['security_hygiene']['total_operations'] == 8
        assert 'total_duration' in result

    def test_perform_comprehensive_cleanup_partial_failure(self, cleanup_service):
        """Test comprehensive cleanup with partial failure."""
        with patch.object(cleanup_service, 'cleanup_expired_sessions', 
                         return_value={'total_cleaned': 10}), \
             patch.object(cleanup_service, 'cleanup_orphaned_vault_data', 
                         side_effect=MaintenanceOperationError("Vault cleanup failed")):
            
            with pytest.raises(MaintenanceOperationError, match="Comprehensive cleanup failed"):
                cleanup_service.perform_comprehensive_cleanup()

    def test_get_cleanup_statistics_success(self, cleanup_service, mock_db):
        """Test getting cleanup statistics."""
        # Mock database queries
        mock_db.query.return_value.count.return_value = 100
        mock_db.query.return_value.filter.return_value.count.return_value = 50
        
        result = cleanup_service.get_cleanup_statistics()
        
        assert 'cleanup_statistics' in result
        assert 'current_counts' in result
        assert 'key_manager_stats' in result
        assert 'configuration' in result
        assert 'timestamp' in result
        
        # Check current counts
        assert result['current_counts']['total_sessions'] == 100
        assert result['current_counts']['active_sessions'] == 50

    def test_get_cleanup_statistics_database_error(self, cleanup_service, mock_db):
        """Test getting statistics with database error."""
        mock_db.query.side_effect = SQLAlchemyError("Database error")
        
        with pytest.raises(CleanupServiceError, match="Failed to get statistics"):
            cleanup_service.get_cleanup_statistics()

    def test_get_service_health_healthy(self, cleanup_service, mock_db, mock_audit_service):
        """Test service health check when all dependencies are healthy."""
        from sqlalchemy import text
        mock_db.execute = Mock()
        
        health = cleanup_service.get_service_health()
        
        assert health['service'] == 'cleanup_service'
        assert health['status'] == 'healthy'
        assert health['dependencies']['database']['status'] == 'healthy'
        assert health['dependencies']['audit_service']['status'] == 'healthy'

    def test_get_service_health_database_unhealthy(self, cleanup_service, mock_db):
        """Test service health check with database issues."""
        mock_db.execute.side_effect = SQLAlchemyError("Database connection failed")
        
        health = cleanup_service.get_service_health()
        
        assert health['service'] == 'cleanup_service'
        assert health['status'] == 'degraded'
        assert health['dependencies']['database']['status'] == 'unhealthy'

    def test_cleanup_orphaned_wrapped_keys_success(self, cleanup_service, mock_db):
        """Test cleanup of orphaned wrapped keys."""
        # Mock orphaned keys
        mock_keys = [Mock(), Mock(), Mock()]
        mock_db.query.return_value.outerjoin.return_value.filter.return_value.limit.return_value.all.return_value = mock_keys
        mock_db.commit = Mock()
        
        result = cleanup_service._cleanup_orphaned_wrapped_keys()
        
        assert result == 3
        assert mock_db.delete.call_count == 3
        mock_db.commit.assert_called_once()

    def test_cleanup_orphaned_wrapped_keys_database_error(self, cleanup_service, mock_db):
        """Test orphaned keys cleanup with database error."""
        mock_db.query.side_effect = SQLAlchemyError("Database error")
        mock_db.rollback = Mock()
        
        result = cleanup_service._cleanup_orphaned_wrapped_keys()
        
        assert result == 0
        mock_db.rollback.assert_called_once()

    def test_cleanup_context_success(self, cleanup_service):
        """Test cleanup context manager for successful operations."""
        start_time = time.time()
        
        with cleanup_service._cleanup_context("test_operation") as correlation_id:
            time.sleep(0.01)  # Small delay to test timing
            assert correlation_id.startswith("cleanup_test_operation_")
        
        # Should complete without exception

    def test_cleanup_context_exception_handling(self, cleanup_service, mock_audit_service):
        """Test cleanup context manager exception handling."""
        test_error = Exception("Test error")
        
        with pytest.raises(Exception, match="Test error"):
            with cleanup_service._cleanup_context("test_operation"):
                raise test_error
        
        # Should log the failure
        mock_audit_service.log_security_event.assert_called()

    def test_factory_function(self, mock_db):
        """Test cleanup service factory function."""
        with patch('app.services.cleanup_service.session_service'), \
             patch('app.services.cleanup_service.audit_service'), \
             patch('app.services.cleanup_service.SecureKeyStore'), \
             patch('app.services.cleanup_service.SessionKeyManager'):
            
            service = create_cleanup_service(mock_db, batch_size=200)
            
            assert isinstance(service, CleanupService)
            assert service.batch_size == 200

    def test_global_service_instance(self, mock_db):
        """Test global cleanup service instance management."""
        with patch('app.services.cleanup_service.session_service'), \
             patch('app.services.cleanup_service.audit_service'), \
             patch('app.services.cleanup_service.SecureKeyStore'), \
             patch('app.services.cleanup_service.SessionKeyManager'):
            
            # Reset global instance
            import app.services.cleanup_service
            app.services.cleanup_service.cleanup_service = None
            
            service1 = get_cleanup_service(mock_db)
            service2 = get_cleanup_service(mock_db)
            
            assert service1 is service2  # Should return same instance


class TestCleanupServiceIntegration:
    """Integration tests for cleanup service with real dependencies."""
    
    def test_cleanup_service_with_real_database(self, db_session: Session):
        """Test cleanup service with real database session."""
        service = create_cleanup_service(db_session)
        
        # Test basic functionality
        assert isinstance(service, CleanupService)
        
        # Test statistics retrieval
        stats = service.get_cleanup_statistics()
        assert 'cleanup_statistics' in stats
        assert 'current_counts' in stats

    def test_session_cleanup_with_real_sessions(self, db_session: Session):
        """Test session cleanup with real session data."""
        service = create_cleanup_service(db_session)
        
        # Create test expired session
        expired_session = OpaqueSession(
            session_id="test_expired_session",
            user_id="test_user",
            phrase_hash=b"test_tag_id_123456",
            session_state="expired",
            expires_at=datetime.now(UTC) - timedelta(hours=1),
            session_data=b"test_session_data",
            last_activity=datetime.now(UTC) - timedelta(hours=2)
        )
        
        db_session.add(expired_session)
        db_session.commit()
        
        # Run cleanup
        result = service.cleanup_expired_sessions()
        
        # Verify cleanup occurred
        assert result['opaque_sessions'] >= 1
        
        # Verify session was removed
        remaining_session = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == "test_expired_session"
        ).first()
        assert remaining_session is None


class TestCleanupServiceErrorHandling:
    """Test error handling scenarios for cleanup service."""
    
    @pytest.fixture
    def cleanup_service_with_errors(self, mock_db):
        """Create cleanup service that simulates various error conditions."""
        with patch('app.services.cleanup_service.session_service'), \
             patch('app.services.cleanup_service.audit_service'), \
             patch('app.services.cleanup_service.SecureKeyStore'), \
             patch('app.services.cleanup_service.SessionKeyManager'):
            
            return CleanupService(mock_db)

    def test_database_connection_error(self, cleanup_service_with_errors, mock_db):
        """Test handling of database connection errors."""
        mock_db.query.side_effect = SQLAlchemyError("Connection lost")
        mock_db.rollback = Mock()
        
        with pytest.raises(MaintenanceOperationError):
            cleanup_service_with_errors.cleanup_expired_sessions()
        
        mock_db.rollback.assert_called()

    def test_audit_service_error(self, cleanup_service_with_errors):
        """Test handling of audit service errors."""
        with patch.object(cleanup_service_with_errors, '_audit_service') as mock_audit:
            mock_audit.audit_context.side_effect = Exception("Audit service error")
            
            with pytest.raises(Exception, match="Audit service error"):
                cleanup_service_with_errors.cleanup_expired_sessions()

    def test_memory_cleanup_error_handling(self, cleanup_service_with_errors):
        """Test graceful handling of memory cleanup errors."""
        with patch('app.crypto.secure_memory.SecureMemoryManager', 
                  side_effect=Exception("Memory cleanup failed")):
            
            # Should not raise exception, just log warning
            result = cleanup_service_with_errors.perform_security_hygiene()
            assert result['memory_cleanup'] is False

    def test_partial_cleanup_success(self, cleanup_service_with_errors, mock_db):
        """Test partial cleanup success when some operations fail."""
        # Mock some operations to succeed and others to fail
        mock_db.query.return_value.filter.return_value.limit.return_value.all.return_value = []
        
        with patch.object(cleanup_service_with_errors, '_cleanup_orphaned_wrapped_keys', 
                         side_effect=Exception("Key cleanup failed")):
            
            # Should still return some results for successful operations
            result = cleanup_service_with_errors.cleanup_expired_sessions()
            assert 'opaque_sessions' in result


if __name__ == "__main__":
    pytest.main([__file__]) 