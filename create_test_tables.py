#!/usr/bin/env python3

import sys
import os
sys.path.append('backend')

from sqlalchemy import create_engine
from backend.app.models.base import Base

# Test configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"

def create_tables():
    # Create engine
    engine = create_engine(TEST_DATABASE_URL)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("All tables created successfully!")

if __name__ == "__main__":
    create_tables() 