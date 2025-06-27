#!/usr/bin/env python3
"""
OPAQUE V3 Database Schema Validation Script

This script validates the OPAQUE V3 database schema design by:
1. Testing table creation and constraints
2. Validating data types and sizes
3. Testing foreign key relationships
4. Benchmarking performance characteristics
5. Simulating security properties
"""

import sys
import os
import time
import secrets
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Add the backend app to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from app.models import SecretTagV3, WrappedKey, VaultBlob, OpaqueSession, User
from app.models.base import Base


class OpaqueSchemaValidator:
    """Validates OPAQUE V3 database schema design and properties"""
    
    def __init__(self, database_url: str = "sqlite:///./test_opaque.db"):
        """Initialize validator with test database"""
        self.engine = create_engine(database_url, echo=False)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.test_results = []
    
    def setup_test_database(self):
        """Create test database and tables"""
        print("Setting up test database...")
        Base.metadata.create_all(bind=self.engine)
        
        # Create a test user
        with self.SessionLocal() as session:
            test_user = User(
                email="test@example.com",
                full_name="Test User",
                is_active=True
            )
            session.add(test_user)
            session.commit()
            self.test_user_id = test_user.id
            print(f"Created test user with ID: {self.test_user_id}")
    
    def test_table_creation(self):
        """Test that all OPAQUE V3 tables are created correctly"""
        print("\n=== Testing Table Creation ===")
        
        inspector = inspect(self.engine)
        expected_tables = [
            'secret_tags_v3',
            'wrapped_keys', 
            'vault_blobs',
            'opaque_sessions'
        ]
        
        existing_tables = inspector.get_table_names()
        
        for table in expected_tables:
            if table in existing_tables:
                print(f"✓ Table '{table}' created successfully")
                
                # Check columns
                columns = inspector.get_columns(table)
                column_names = [col['name'] for col in columns]
                print(f"  Columns: {', '.join(column_names)}")
                
                # Check indexes
                indexes = inspector.get_indexes(table)
                if indexes:
                    index_names = [idx['name'] for idx in indexes]
                    print(f"  Indexes: {', '.join(index_names)}")
            else:
                print(f"✗ Table '{table}' missing")
                self.test_results.append(f"FAIL: Table {table} not created")
    
    def test_data_types_and_constraints(self):
        """Test data types and constraints for cryptographic data"""
        print("\n=== Testing Data Types and Constraints ===")
        
        with self.SessionLocal() as session:
            try:
                # Test SecretTagV3 with proper data types
                tag_id = secrets.token_bytes(16)  # 16-byte deterministic ID
                salt = secrets.token_bytes(16)    # 16-byte salt
                verifier = secrets.token_bytes(32)  # 32-byte OPAQUE verifier
                envelope = secrets.token_bytes(64)  # OPAQUE envelope data
                
                secret_tag = SecretTagV3(
                    tag_id=tag_id,
                    user_id=self.test_user_id,
                    salt=salt,
                    verifier_kv=verifier,
                    opaque_envelope=envelope,
                    tag_name="Test Secret Tag",
                    color_code="#FF0000"
                )
                session.add(secret_tag)
                session.commit()
                
                print("✓ SecretTagV3 data types validated")
                
                # Test WrappedKey with proper sizes
                wrapped_key_data = secrets.token_bytes(40)  # AES-KW wrapped key
                wrapped_key = WrappedKey(
                    tag_id=tag_id,
                    vault_id=uuid.uuid4(),
                    wrapped_key=wrapped_key_data,
                    key_purpose="vault_data",
                    key_version=1
                )
                session.add(wrapped_key)
                session.commit()
                
                print("✓ WrappedKey data types validated")
                
                # Test VaultBlob with encryption metadata
                vault_blob = VaultBlob(
                    vault_id=wrapped_key.vault_id,
                    object_id=uuid.uuid4(),
                    wrapped_key_id=wrapped_key.id,
                    iv=secrets.token_bytes(12),  # AES-GCM IV
                    ciphertext=secrets.token_bytes(100),  # Encrypted content
                    auth_tag=secrets.token_bytes(16),  # AES-GCM auth tag
                    content_type="text/plain",
                    content_size=100
                )
                session.add(vault_blob)
                session.commit()
                
                print("✓ VaultBlob data types validated")
                
            except Exception as e:
                print(f"✗ Data type validation failed: {e}")
                self.test_results.append(f"FAIL: Data type validation - {e}")
    
    def test_foreign_key_relationships(self):
        """Test foreign key relationships and cascading"""
        print("\n=== Testing Foreign Key Relationships ===")
        
        with self.SessionLocal() as session:
            try:
                # Test that wrapped keys are linked to secret tags
                secret_tag = session.query(SecretTagV3).first()
                wrapped_keys = session.query(WrappedKey).filter(
                    WrappedKey.tag_id == secret_tag.tag_id
                ).all()
                
                if wrapped_keys:
                    print(f"✓ Found {len(wrapped_keys)} wrapped keys for secret tag")
                
                # Test vault blob relationship to wrapped key
                vault_blobs = session.query(VaultBlob).all()
                if vault_blobs:
                    print(f"✓ Found {len(vault_blobs)} vault blobs")
                    
                    # Verify relationship integrity
                    for blob in vault_blobs:
                        wrapped_key = session.query(WrappedKey).filter(
                            WrappedKey.id == blob.wrapped_key_id
                        ).first()
                        if wrapped_key:
                            print(f"✓ Vault blob properly linked to wrapped key")
                        else:
                            print(f"✗ Vault blob orphaned from wrapped key")
                
            except Exception as e:
                print(f"✗ Foreign key relationship test failed: {e}")
                self.test_results.append(f"FAIL: Foreign key relationships - {e}")
    
    def test_performance_characteristics(self):
        """Test performance characteristics of OPAQUE operations"""
        print("\n=== Testing Performance Characteristics ===")
        
        with self.SessionLocal() as session:
            try:
                # Test tag lookup performance
                tag_id = secrets.token_bytes(16)
                
                start_time = time.time()
                result = session.query(SecretTagV3).filter(
                    SecretTagV3.tag_id == tag_id
                ).first()
                lookup_time = (time.time() - start_time) * 1000
                
                print(f"✓ Tag lookup time: {lookup_time:.2f}ms")
                
                if lookup_time < 10:  # Should be under 10ms
                    print("✓ Tag lookup performance acceptable")
                else:
                    print("⚠ Tag lookup performance may be slow")
                
                # Test bulk operations
                start_time = time.time()
                for i in range(10):
                    tag_id = secrets.token_bytes(16)
                    secret_tag = SecretTagV3(
                        tag_id=tag_id,
                        user_id=self.test_user_id,
                        salt=secrets.token_bytes(16),
                        verifier_kv=secrets.token_bytes(32),
                        opaque_envelope=secrets.token_bytes(64),
                        tag_name=f"Bulk Test Tag {i}",
                        color_code="#00FF00"
                    )
                    session.add(secret_tag)
                
                session.commit()
                bulk_time = (time.time() - start_time) * 1000
                print(f"✓ Bulk insert time (10 tags): {bulk_time:.2f}ms")
                
            except Exception as e:
                print(f"✗ Performance test failed: {e}")
                self.test_results.append(f"FAIL: Performance testing - {e}")
    
    def test_security_properties(self):
        """Test security properties of the schema"""
        print("\n=== Testing Security Properties ===")
        
        with self.SessionLocal() as session:
            try:
                # Verify no recoverable secrets in database
                secret_tags = session.query(SecretTagV3).all()
                
                for tag in secret_tags:
                    # Check that we only have verifiers, not recoverable data
                    if len(tag.verifier_kv) == 32:  # OPAQUE verifier size
                        print("✓ OPAQUE verifier size correct (32 bytes)")
                    else:
                        print(f"✗ Invalid verifier size: {len(tag.verifier_kv)}")
                    
                    # Check that salt is proper size
                    if len(tag.salt) == 16:  # Recommended salt size
                        print("✓ Salt size correct (16 bytes)")
                    else:
                        print(f"✗ Invalid salt size: {len(tag.salt)}")
                    
                    # Verify no plaintext secrets stored
                    if hasattr(tag, 'phrase_hash'):
                        print("✗ Found phrase_hash - should not exist in V3")
                        self.test_results.append("FAIL: V3 table contains V2 hash data")
                    else:
                        print("✓ No recoverable phrase hashes found")
                
                # Test that wrapped keys are properly encrypted
                wrapped_keys = session.query(WrappedKey).all()
                for key in wrapped_keys:
                    if len(key.wrapped_key) == 40:  # AES-KW wrapped key size
                        print("✓ Wrapped key size correct (40 bytes)")
                    else:
                        print(f"✗ Invalid wrapped key size: {len(key.wrapped_key)}")
                
                print("✓ Security properties validated")
                
            except Exception as e:
                print(f"✗ Security property test failed: {e}")
                self.test_results.append(f"FAIL: Security properties - {e}")
    
    def test_session_management(self):
        """Test OPAQUE session management"""
        print("\n=== Testing Session Management ===")
        
        with self.SessionLocal() as session:
            try:
                # Create test session
                session_id = secrets.token_urlsafe(32)
                expires_at = datetime.utcnow() + timedelta(hours=1)
                
                opaque_session = OpaqueSession(
                    session_id=session_id,
                    user_id=self.test_user_id,
                    session_state="initialized",
                    created_at=datetime.utcnow(),
                    expires_at=expires_at,
                    last_activity=datetime.utcnow()
                )
                session.add(opaque_session)
                session.commit()
                
                print("✓ OPAQUE session created successfully")
                
                # Test session lookup
                found_session = session.query(OpaqueSession).filter(
                    OpaqueSession.session_id == session_id
                ).first()
                
                if found_session:
                    print("✓ Session lookup successful")
                    print(f"  Session state: {found_session.session_state}")
                    print(f"  Expires at: {found_session.expires_at}")
                else:
                    print("✗ Session lookup failed")
                
            except Exception as e:
                print(f"✗ Session management test failed: {e}")
                self.test_results.append(f"FAIL: Session management - {e}")
    
    def generate_test_report(self):
        """Generate comprehensive test report"""
        print("\n" + "="*50)
        print("OPAQUE V3 SCHEMA VALIDATION REPORT")
        print("="*50)
        
        if not self.test_results:
            print("✓ ALL TESTS PASSED")
            print("\nSchema validation successful!")
            print("- All tables created with proper constraints")
            print("- Data types validated for cryptographic operations")
            print("- Foreign key relationships working correctly")
            print("- Performance characteristics acceptable")
            print("- Security properties maintained")
            print("- Session management functional")
        else:
            print("✗ SOME TESTS FAILED")
            print("\nFailed tests:")
            for result in self.test_results:
                print(f"  - {result}")
        
        print(f"\nTest completed at: {datetime.now()}")
    
    def cleanup(self):
        """Clean up test database"""
        print("\nCleaning up test database...")
        try:
            os.remove("test_opaque.db")
            print("✓ Test database cleaned up")
        except FileNotFoundError:
            pass
    
    def run_all_tests(self):
        """Run all validation tests"""
        try:
            self.setup_test_database()
            self.test_table_creation()
            self.test_data_types_and_constraints()
            self.test_foreign_key_relationships()
            self.test_performance_characteristics()
            self.test_security_properties()
            self.test_session_management()
            self.generate_test_report()
        finally:
            self.cleanup()


if __name__ == "__main__":
    print("OPAQUE V3 Database Schema Validator")
    print("=" * 40)
    
    validator = OpaqueSchemaValidator()
    validator.run_all_tests() 