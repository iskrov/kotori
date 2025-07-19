"""
OPAQUE Server Configuration Model

Stores the OPAQUE server setup configuration that must persist across server restarts.
This is critical for OPAQUE authentication to work correctly.
"""

from sqlalchemy import Column, String, DateTime, Text, Boolean
from datetime import datetime, UTC
from .base import Base


class OpaqueServerConfig(Base):
    """
    OPAQUE Server Configuration
    
    Stores the server setup that is used for all OPAQUE operations.
    This must be persistent across server restarts or users won't be able to login.
    """
    __tablename__ = "opaque_server_configs"

    # Use a fixed ID since we only need one server config
    id = Column(String, primary_key=True, default="default")
    
    # The OPAQUE server setup (base64 encoded)
    server_setup = Column(Text, nullable=False)
    
    # When this config was created
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    
    # When this config was last updated
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    
    # Whether this config is active
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Optional description for this config
    description = Column(String(255), nullable=True, default="Default OPAQUE server configuration") 