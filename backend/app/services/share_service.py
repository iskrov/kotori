import logging
import secrets
import hashlib
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from ..models.share import Share, ShareAccess
from ..models.journal_entry import JournalEntry
from ..schemas.share import ShareCreateRequest, ShareContent, ShareQuestionAnswer
from ..services.gemini_service import gemini_service
from ..services.share_template_service import share_template_service
from .base import BaseService

logger = logging.getLogger(__name__)


class ShareService(BaseService[Share, ShareCreateRequest, dict]):
    """Service for managing journal entry shares"""

    def generate_share_token(self) -> str:
        """Generate a secure random token for share access"""
        return secrets.token_urlsafe(32)

    def hash_sensitive_data(self, data: str) -> str:
        """Hash sensitive data for privacy-preserving storage"""
        if not data:
            return ""
        return hashlib.sha256(data.encode()).hexdigest()

    async def create_share(
        self,
        db: Session,
        *,
        user_id: UUID,
        request: ShareCreateRequest
    ) -> Share:
        """Create a new share by processing journal entries with Gemini"""
        
        # Get the template
        template = share_template_service.get_by_template_id(db, template_id=request.template_id)
        if not template:
            raise ValueError(f"Template '{request.template_id}' not found")
        
        if not template.is_active:
            raise ValueError(f"Template '{request.template_id}' is not active")

        # Get journal entries for the user
        entries = (
            db.query(JournalEntry)
            .filter(
                and_(
                    JournalEntry.user_id == user_id,
                    JournalEntry.id.in_(request.entry_ids)
                )
            )
            .all()
        )
        
        if not entries:
            raise ValueError("No accessible journal entries found")
        
        if len(entries) != len(request.entry_ids):
            logger.warning(f"Only found {len(entries)} of {len(request.entry_ids)} requested entries")

        # Prepare entries for Gemini (this would need decryption in real usage)
        entry_data = []
        for entry in entries:
            # In a real implementation, you'd decrypt the content here
            # For now, we'll use the content as-is or indicate it needs decryption
            content = entry.content or "[Encrypted content - would be decrypted client-side]"
            entry_data.append({
                "id": str(entry.id),
                "content": content,
                "entry_date": entry.entry_date.isoformat() if entry.entry_date else None,
                "title": entry.title
            })

        # Generate summary using Gemini
        try:
            gemini_response = await gemini_service.generate_share_summary(
                entries=entry_data,
                template=template.__dict__,
                target_language=request.target_language
            )
            
            # Convert Gemini response to our format
            qa_pairs = [
                ShareQuestionAnswer(
                    question_id=qa.question_id,
                    question_text=qa.question_text,
                    answer=qa.answer,
                    confidence=qa.confidence
                )
                for qa in gemini_response.answers
            ]
            
        except Exception as e:
            logger.error(f"Failed to generate summary with Gemini: {e}")
            # Fallback: create basic summary without AI processing
            qa_pairs = []
            for question in template.questions:
                qa_pairs.append(ShareQuestionAnswer(
                    question_id=question["id"],
                    question_text=question["text"].get(request.target_language, question["text"]["en"]),
                    answer="Summary generation temporarily unavailable. Please check with your care provider for manual summary.",
                    confidence=0.0
                ))
            
            gemini_response = type('MockResponse', (), {
                'source_language': 'en',
                'target_language': request.target_language,
                'entry_count': len(entries),
                'processing_notes': f"AI processing failed: {str(e)}"
            })()

        # Create share content
        content = ShareContent(
            answers=qa_pairs,
            template_info={
                "template_id": template.template_id,
                "name": template.name,
                "description": template.description,
                "category": template.category,
                "version": template.version
            },
            generation_metadata={
                "processing_notes": getattr(gemini_response, 'processing_notes', None),
                "ai_model": "gemini-2.5-flash",
                "generation_method": "structured_output"
            },
            source_language=getattr(gemini_response, 'source_language', 'en'),
            target_language=request.target_language,
            entry_count=len(entries),
            generated_at=datetime.now(timezone.utc)
        )

        # Generate title if not provided
        title = request.title or f"{template.name} - {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        
        # Calculate expiration
        expires_at = datetime.now(timezone.utc) + timedelta(days=request.expires_in_days)

        # Create share record
        db_share = Share(
            share_token=self.generate_share_token(),
            title=title,
            content=content.dict(),
            template_id=request.template_id,
            target_language=request.target_language,
            entry_count=len(entries),
            user_id=user_id,
            expires_at=expires_at,
            is_active=True,
            access_count=0
        )
        
        db.add(db_share)
        db.commit()
        db.refresh(db_share)
        
        logger.info(f"Created share {db_share.id} for user {user_id} with {len(qa_pairs)} Q&A pairs")
        return db_share

    def get_by_token(self, db: Session, *, token: str) -> Optional[Share]:
        """Get share by public token"""
        return db.query(Share).filter(Share.share_token == token).first()

    def get_user_shares(
        self,
        db: Session,
        *,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[Share]:
        """Get shares for a specific user"""
        query = db.query(Share).filter(Share.user_id == user_id)
        
        if active_only:
            query = query.filter(Share.is_active == True)
            
        return (
            query
            .order_by(desc(Share.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def access_share(
        self,
        db: Session,
        *,
        share: Share,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        referrer: Optional[str] = None,
        access_type: str = "view"
    ) -> Share:
        """Record share access and update counters"""
        
        # Check if share is expired or inactive
        if not share.is_active:
            raise ValueError("Share is no longer active")
            
        if share.is_expired:
            raise ValueError("Share has expired")

        # Update share access count and timestamp
        share.access_count += 1
        share.last_accessed_at = datetime.now(timezone.utc)
        
        # Create access log
        access_log = ShareAccess(
            share_id=share.id,
            ip_address_hash=self.hash_sensitive_data(ip_address) if ip_address else None,
            user_agent_hash=self.hash_sensitive_data(user_agent) if user_agent else None,
            referrer=referrer[:255] if referrer else None,  # Truncate if too long
            access_type=access_type
        )
        
        db.add(access_log)
        db.commit()
        db.refresh(share)
        
        logger.info(f"Recorded {access_type} access to share {share.id}")
        return share

    def deactivate_share(self, db: Session, *, share_id: UUID, user_id: UUID) -> Optional[Share]:
        """Deactivate a share (soft delete)"""
        share = (
            db.query(Share)
            .filter(and_(Share.id == share_id, Share.user_id == user_id))
            .first()
        )
        
        if not share:
            return None
            
        share.is_active = False
        db.commit()
        db.refresh(share)
        
        logger.info(f"Deactivated share {share_id}")
        return share

    def cleanup_expired_shares(self, db: Session) -> int:
        """Clean up expired shares (run as background task)"""
        now = datetime.now(timezone.utc)
        
        # Find expired shares
        expired_shares = (
            db.query(Share)
            .filter(
                and_(
                    Share.expires_at < now,
                    Share.is_active == True
                )
            )
            .all()
        )
        
        # Deactivate expired shares
        for share in expired_shares:
            share.is_active = False
            
        if expired_shares:
            db.commit()
            logger.info(f"Deactivated {len(expired_shares)} expired shares")
            
        return len(expired_shares)

    def get_share_stats(self, db: Session, *, user_id: UUID) -> Dict[str, Any]:
        """Get share statistics for a user"""
        shares = self.get_user_shares(db, user_id=user_id, active_only=False, limit=1000)
        
        active_shares = [s for s in shares if s.is_active and not s.is_expired]
        total_accesses = sum(s.access_count for s in shares)
        
        # Group by template
        by_template = {}
        for share in shares:
            template_id = share.template_id
            by_template[template_id] = by_template.get(template_id, 0) + 1
        
        # Group by language
        by_language = {}
        for share in shares:
            lang = share.target_language
            by_language[lang] = by_language.get(lang, 0) + 1
        
        # Recent activity (last 10 shares)
        recent_activity = []
        for share in shares[:10]:
            recent_activity.append({
                "id": str(share.id),
                "title": share.title,
                "created_at": share.created_at.isoformat(),
                "access_count": share.access_count,
                "is_active": share.is_active
            })
        
        return {
            "total_shares": len(shares),
            "active_shares": len(active_shares),
            "total_accesses": total_accesses,
            "shares_by_template": by_template,
            "shares_by_language": by_language,
            "recent_activity": recent_activity
        }


# Create service instance
share_service = ShareService(Share)
