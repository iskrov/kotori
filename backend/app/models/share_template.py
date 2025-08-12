import uuid
from sqlalchemy import Boolean, Column, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from .base import Base, TimestampMixin


class ShareTemplate(Base, TimestampMixin):
    """
    Share templates define the structure of questions for generating
    journal entry summaries for sharing with caregivers/clinicians.
    """
    __tablename__ = "share_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    template_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True, index=True)
    version = Column(String(20), nullable=False)
    questions = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    def __repr__(self):
        return f"<ShareTemplate(template_id={self.template_id}, name={self.name}, version={self.version})>"

    @property
    def question_count(self) -> int:
        """Get the number of questions in this template."""
        if isinstance(self.questions, list):
            return len(self.questions)
        return 0

    def get_question_by_id(self, question_id: str) -> dict:
        """Get a specific question by its ID."""
        if isinstance(self.questions, list):
            for question in self.questions:
                if question.get('id') == question_id:
                    return question
        return None
