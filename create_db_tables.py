#!/usr/bin/env python3
"""
Create database tables directly using SQLAlchemy
This script will be run in the backend container to create all required tables
"""

import os
import sys

# Set up the environment to use production database
os.environ['DATABASE_URL'] = os.environ.get('DATABASE_URL', '')
os.environ['ENVIRONMENT'] = 'production'

# Add the backend directory to Python path
sys.path.insert(0, '/app')

try:
    from app.database import get_database_url, create_engine_from_url
    from app.models import Base
    
    # Import all models to ensure they're registered
    from app.models.user import User
    from app.models.journal_entry import JournalEntry
    from app.models.tag import Tag, JournalEntryTag
    from app.models.reminder import Reminder
    from app.models.opaque_auth import OpaqueSession
    from app.models.opaque_server_config import OpaqueServerConfig
    
    print("🚀 Starting database table creation...")
    
    # Get database URL and create engine
    database_url = get_database_url()
    print(f"📍 Connecting to database...")
    
    engine = create_engine_from_url(database_url)
    
    # Create all tables
    print("🏗️  Creating all tables from SQLAlchemy models...")
    Base.metadata.create_all(engine)
    
    print("✅ All tables created successfully!")
    print("📊 Tables that should now exist:")
    print("   - users")
    print("   - journal_entries") 
    print("   - tags")
    print("   - journal_entry_tags")
    print("   - reminders")
    print("   - opaque_sessions")
    print("   - opaque_server_configs")
    
    # Test a simple query
    print("🧪 Testing database connection...")
    with engine.connect() as conn:
        result = conn.execute("SELECT 1 as test")
        test_value = result.fetchone()[0]
        if test_value == 1:
            print("✅ Database connection test successful!")
        else:
            print("❌ Database connection test failed!")
    
    engine.dispose()
    print("🎉 Database setup completed successfully!")
    
except Exception as e:
    print(f"❌ Error creating database tables: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
