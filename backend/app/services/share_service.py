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
from ..services.journal_service import journal_service
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

        # Build entry_data either from client-provided plaintext entries (preferred when present)
        entry_data: list[dict[str, Any]] = []

        if request.entries is not None:
            if len(request.entries) == 0:
                raise ValueError("No plaintext entries provided for processing")
            # Use plaintext entries provided by the client after consent
            for e in request.entries:
                entry_data.append({
                    "id": str(e.id) if e.id else None,
                    "content": e.content,
                    "entry_date": e.entry_date.isoformat() if e.entry_date else None,
                    "title": e.title or None,
                })
            entries = []  # Not needed further when plaintext provided

        # Otherwise fetch entries by ids/date range and use stored content (may be empty if encrypted)
        elif request.entry_ids:
            # Use specific entry IDs
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
            
            if len(entries) != len(request.entry_ids):
                logger.warning(f"Only found {len(entries)} of {len(request.entry_ids)} requested entries")
        else:
            # Use date range to fetch entries
            if not request.date_range:
                raise ValueError("Missing date_range when entries and entry_ids are not provided")
            start_date = datetime.fromisoformat(request.date_range['start'].replace('Z', '+00:00')).date()
            end_date = datetime.fromisoformat(request.date_range['end'].replace('Z', '+00:00')).date()
            
            # Get entries using journal service
            journal_entries = journal_service.get_multi_by_user(
                db=db,
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                limit=1000  # Large limit to get all entries in range
            )
            
            if not journal_entries:
                raise ValueError("No journal entries found in the specified date range")
            
            # Convert journal service entries back to ORM models for processing
            entry_ids = [entry.id for entry in journal_entries]
            entries = (
                db.query(JournalEntry)
                .filter(
                    and_(
                        JournalEntry.user_id == user_id,
                        JournalEntry.id.in_(entry_ids)
                    )
                )
                .all()
            )
        
        if not request.entries:
            if not entries:
                raise ValueError("No accessible journal entries found")

            # Prepare entries for Gemini from database content (empty if encrypted)
            for entry in entries:
                content = entry.content or ""
                entry_data.append({
                    "id": str(entry.id),
                    "content": content,
                    "entry_date": entry.entry_date.isoformat() if entry.entry_date else None,
                    "title": entry.title
                })

        # Prepare a minimal, safe template payload for LLM
        try:
            raw_questions = getattr(template, 'questions', []) or []
            questions_list: list[dict[str, Any]] = []
            for q in raw_questions:
                if not isinstance(q, dict):
                    continue
                qid = q.get('id')
                qtext = q.get('text') or {}
                # Resolve localized text
                text_value = None
                if isinstance(qtext, dict):
                    text_value = qtext.get(request.target_language) or qtext.get('en')
                elif isinstance(qtext, str):
                    text_value = qtext
                if qid and text_value:
                    questions_list.append({
                        'id': qid,
                        'text': text_value,
                    })
        except Exception:
            questions_list = []

        template_payload = {
            'template_id': template.template_id,
            'name': template.name,
            'version': template.version,
            'questions': questions_list,
        }

        # Generate summary using Gemini
        try:
            gemini_response = await gemini_service.generate_share_summary(
                entries=entry_data,
                template=template_payload,
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
            
            # Determine appropriate fallback message based on the situation
            # Build a human-readable timeframe label safely
            timeframe_label = "selected period"
            try:
                if request.date_range:
                    timeframe_label = f"{request.date_range['start']} to {request.date_range['end']}"
                elif request.entries:
                    dates = [e.entry_date for e in request.entries if e and getattr(e, 'entry_date', None)]
                    if dates:
                        timeframe_label = f"{min(dates).isoformat()} to {max(dates).isoformat()}"
            except Exception:
                pass

            if len(entry_data) == 0:
                fallback_answer = (
                    f"No journal entries found for the {timeframe_label}. "
                    f"Try selecting a different date range or add some journal entries first."
                )
            elif not request.entries and all(not entry.content for entry in entries):
                fallback_answer = "Your journal entries are encrypted and cannot be automatically processed for AI summary generation. You can manually edit the answers below before sharing."
            else:
                # Generic AI service failure
                error_str = str(e).lower()
                if 'no journal entries' in error_str or 'no accessible journal entries' in error_str:
                    fallback_answer = (
                        f"No accessible journal entries found for the {timeframe_label}. "
                        f"You may need to add entries for {request.period or 'selected'} summaries."
                    )
                elif 'network' in error_str or 'connection' in error_str or 'timeout' in error_str:
                    fallback_answer = "Unable to connect to the AI service. Please check your internet connection and try again."
                elif 'schema' in error_str or 'unknown field' in error_str:
                    fallback_answer = "The AI service is experiencing technical difficulties with content analysis. You can manually edit the answers below and still create your share."
                else:
                    fallback_answer = f"AI summary generation encountered an issue. You can manually edit the answers below before sharing. Technical details: {str(e)[:100]}..."
            
            # Fallback: create basic summary without AI processing
            qa_pairs = []
            for question in questions_list:
                qa_pairs.append(ShareQuestionAnswer(
                    question_id=question.get("id", "unknown"),
                    question_text=question.get("text", ""),
                    answer=fallback_answer,
                    confidence=0.0
                ))
            
            gemini_response = type('MockResponse', (), {
                'source_language': 'en',
                'target_language': request.target_language,
                'entry_count': len(entry_data),
                'processing_notes': f"Fallback used - {str(e)}"
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
            entry_count=len(entry_data),
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
            content=content.model_dump(mode='json'),  # Use model_dump with json mode for proper datetime serialization
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
        
        # Record consent/audit if plaintext entries were provided
        try:
            if request.entries and request.consent_acknowledged:
                timeframe_start = None
                timeframe_end = None
                try:
                    dates = [e.entry_date for e in request.entries if e.entry_date]
                    if dates:
                        timeframe_start = min(dates)
                        timeframe_end = max(dates)
                except Exception:
                    timeframe_start = None
                    timeframe_end = None

                audit = ShareAccess(
                    share_id=db_share.id,
                    access_type="consent",
                    consent_timeframe_start=timeframe_start,
                    consent_timeframe_end=timeframe_end,
                    consent_entry_count=len(request.entries),
                    consent_acknowledged=True,
                )
                db.add(audit)
                db.commit()
        except Exception as e:
            logger.warning(f"Failed to record consent audit: {e}")

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
