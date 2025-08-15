from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
import uuid


class QuestionText(BaseModel):
    """Multi-language question text"""
    en: str = Field(..., description="English text")
    es: Optional[str] = Field(None, description="Spanish text")
    fr: Optional[str] = Field(None, description="French text")
    de: Optional[str] = Field(None, description="German text")
    pt: Optional[str] = Field(None, description="Portuguese text")
    it: Optional[str] = Field(None, description="Italian text")
    ja: Optional[str] = Field(None, description="Japanese text")
    ko: Optional[str] = Field(None, description="Korean text")
    zh: Optional[str] = Field(None, description="Chinese text")
    ar: Optional[str] = Field(None, description="Arabic text")
    hi: Optional[str] = Field(None, description="Hindi text")
    ru: Optional[str] = Field(None, description="Russian text")


class TemplateQuestion(BaseModel):
    """Individual question within a template"""
    id: str = Field(..., description="Unique question identifier within template")
    text: QuestionText = Field(..., description="Question text in multiple languages")
    type: str = Field(..., description="Question type: open, single_choice, multi_choice, scale")
    required: bool = Field(True, description="Whether this question is required")
    options: Optional[List[str]] = Field(None, description="Options for choice questions")
    help_text: Optional[str] = Field(None, description="Additional help text")
    
    @validator('type')
    def validate_question_type(cls, v):
        allowed_types = ['open', 'single_choice', 'multi_choice', 'scale']
        if v not in allowed_types:
            raise ValueError(f'Question type must be one of: {allowed_types}')
        return v
    
    @validator('options')
    def validate_options(cls, v, values):
        question_type = values.get('type')
        if question_type in ['single_choice', 'multi_choice'] and not v:
            raise ValueError(f'Options are required for {question_type} questions')
        return v


class ShareTemplateBase(BaseModel):
    """Base schema for share templates"""
    template_id: str = Field(..., description="Unique template identifier")
    name: str = Field(..., max_length=255, description="Template display name")
    description: Optional[str] = Field(None, description="Template description")
    category: Optional[str] = Field(None, max_length=50, description="Template category")
    version: str = Field(..., max_length=20, description="Template version")
    questions: List[TemplateQuestion] = Field(..., min_items=1, description="List of questions")
    is_active: bool = Field(True, description="Whether template is active")
    
    @validator('questions')
    def validate_unique_question_ids(cls, v):
        question_ids = [q.id for q in v]
        if len(question_ids) != len(set(question_ids)):
            raise ValueError('Question IDs must be unique within a template')
        return v


class ShareTemplateCreate(ShareTemplateBase):
    """Schema for creating a new share template"""
    pass


class ShareTemplateUpdate(BaseModel):
    """Schema for updating a share template"""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None)
    category: Optional[str] = Field(None, max_length=50)
    version: Optional[str] = Field(None, max_length=20)
    questions: Optional[List[TemplateQuestion]] = Field(None, min_items=1)
    is_active: Optional[bool] = Field(None)
    
    @validator('questions')
    def validate_unique_question_ids(cls, v):
        if v is not None:
            question_ids = [q.id for q in v]
            if len(question_ids) != len(set(question_ids)):
                raise ValueError('Question IDs must be unique within a template')
        return v


class ShareTemplate(ShareTemplateBase):
    """Schema for share template responses"""
    id: uuid.UUID = Field(..., description="Database UUID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        from_attributes = True


class ShareTemplateList(BaseModel):
    """Schema for paginated template lists"""
    templates: List[ShareTemplate] = Field(..., description="List of templates")
    total: int = Field(..., description="Total number of templates")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")


class ShareTemplateSummary(BaseModel):
    """Lightweight template summary for dropdowns"""
    id: uuid.UUID
    template_id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    question_count: int
    
    class Config:
        from_attributes = True
