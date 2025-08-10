"""
Entry Processor Service - DISABLED in PBI-4 Stage 2

This service was disabled when secret-tag schema was removed.
The SecretTag model and related functionality no longer exist after Stage 2 cleanup.
"""

import logging

logger = logging.getLogger(__name__)

class EntryProcessingError(Exception):
    """Exception raised during entry processing."""
    pass

class DisabledEntryProcessor:
    """Disabled entry processor - secret tag functionality removed."""
    
    def __init__(self, *args, **kwargs):
        logger.warning("Entry processor is disabled - SecretTag models removed in PBI-4 Stage 2")
    
    async def process_entry_submission(self, *args, **kwargs):
        """Always falls back to regular entry creation since secret tag processing is removed."""
        from .journal_service import journal_service
        
        # Extract basic parameters for fallback
        entry_request = args[0] if args else kwargs.get('entry_request')
        user_id = args[1] if len(args) > 1 else kwargs.get('user_id')
        db = kwargs.get('db')
        
        if not entry_request or not user_id or not db:
            raise EntryProcessingError("Required parameters missing for fallback entry creation")
        
        # Create regular entry without secret tag processing
        return journal_service.create_with_user(
            db=db,
            obj_in=entry_request,
            user_id=user_id
        )

def create_entry_processor(db):
    """Create a disabled entry processor instance."""
    return DisabledEntryProcessor(db)
