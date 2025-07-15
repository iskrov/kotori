#!/usr/bin/env python3

import sys
import os
sys.path.append('backend')

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import uuid
from datetime import datetime

from backend.app.main import app
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.core.security import get_password_hash, verify_password

# Test configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "TestPassword123!"

# Create global database session
engine = create_engine(TEST_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
global_db = SessionLocal()

def get_test_db():
    """Override database dependency to use our test database."""
    try:
        yield global_db
    finally:
        pass  # Don't close the global session

# Override the dependency globally
app.dependency_overrides[get_db] = get_test_db

def test_auth():
    # Create test client
    client = TestClient(app)
    
    try:
        # Clean up any existing user
        existing_user = global_db.query(User).filter(User.email == TEST_USER_EMAIL).first()
        if existing_user:
            global_db.delete(existing_user)
            global_db.commit()
        
        # Create test user using the same session
        hashed_password = get_password_hash(TEST_USER_PASSWORD)
        user = User(
            id=str(uuid.uuid4()),
            email=TEST_USER_EMAIL,
            hashed_password=hashed_password,
            is_active=True,
            created_at=datetime.utcnow()
        )
        global_db.add(user)
        global_db.commit()
        global_db.refresh(user)
        
        print(f"Created user: {user.email}, ID: {user.id}, Active: {user.is_active}")
        print(f"Password hash: {user.hashed_password[:50]}...")
        
        # Verify password works
        print(f"Password verification: {verify_password(TEST_USER_PASSWORD, user.hashed_password)}")
        
        # Test authentication
        response = client.post(
            "/api/auth/login",
            data={
                "username": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        
        print(f"Login response status: {response.status_code}")
        print(f"Login response content: {response.text}")
        
        if response.status_code == 200:
            print("Authentication successful!")
            token = response.json()["access_token"]
            print(f"Access token: {token[:50]}...")
        else:
            print("Authentication failed!")
            
    finally:
        # Clean up
        global_db.close()

if __name__ == "__main__":
    test_auth() 