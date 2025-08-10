"""
Vault Service - DISABLED in PBI-4 Stage 2

This service was disabled when secret-tag schema was removed.
The VaultBlob, WrappedKey, and SecretTag models no longer exist after Stage 2 cleanup.
"""

import logging

logger = logging.getLogger(__name__)

class VaultServiceError(Exception):
    """Exception raised by vault service operations."""
    pass

class VaultBlobStorageError(VaultServiceError):
    """Exception raised during blob storage operations."""
    pass

class VaultAccessError(VaultServiceError):
    """Exception raised during vault access operations."""
    pass

class VaultQuotaError(VaultServiceError):
    """Exception raised when vault quota is exceeded."""
    pass

class VaultService:
    """Disabled vault service - secret tag functionality removed."""
    
    def __init__(self, *args, **kwargs):
        logger.warning("Vault service is disabled - VaultBlob/WrappedKey models removed in PBI-4 Stage 2")
    
    def store_blob(self, *args, **kwargs):
        raise NotImplementedError("Vault service disabled in PBI-4 Stage 2 - VaultBlob model removed")
    
    def retrieve_blob(self, *args, **kwargs):
        raise NotImplementedError("Vault service disabled in PBI-4 Stage 2 - VaultBlob model removed")
    
    def delete_blob(self, *args, **kwargs):
        raise NotImplementedError("Vault service disabled in PBI-4 Stage 2 - VaultBlob model removed")

# Create disabled service instance
vault_service = VaultService()
