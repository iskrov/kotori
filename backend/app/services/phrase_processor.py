"""
Phrase Processor Service - DISABLED in PBI-4 Stage 2

This service was disabled when secret-tag schema was removed.
The SecretTag model and related functionality no longer exist after Stage 2 cleanup.
"""

import logging

logger = logging.getLogger(__name__)

class SecretPhraseProcessor:
    """Disabled phrase processor - secret tag functionality removed."""
    
    def __init__(self, *args, **kwargs):
        logger.warning("Phrase processor is disabled - SecretTag models removed in PBI-4 Stage 2")
    
    def process_entry_for_secret_phrases(self, *args, **kwargs):
        """Always returns no authentication since secret tags are removed."""
        return False, None, [], None
    
    def decrypt_entry_content(self, *args, **kwargs):
        """Returns None since secret tag decryption is no longer available."""
        return None

def create_phrase_processor(db):
    """Create a disabled phrase processor instance."""
    return SecretPhraseProcessor(db)
