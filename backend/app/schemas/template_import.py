from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
import uuid


class TemplateImportRequest(BaseModel):
    """Request for importing a template from uploaded file"""
    document_type: Optional[str] = Field(None, description="Document type hint (pdf, docx)")
    max_questions: int = Field(20, ge=1, le=50, description="Maximum number of questions to extract")
    target_category: Optional[str] = Field(None, description="Target category for the template")
    custom_name: Optional[str] = Field(None, max_length=255, description="Custom name for the template")


class DocumentInfo(BaseModel):
    """Information about the uploaded document"""
    filename: str = Field(..., description="Original filename")
    document_type: str = Field(..., description="Detected document type")
    file_size_mb: float = Field(..., description="File size in MB")
    word_count: int = Field(..., description="Total word count")
    character_count: int = Field(..., description="Total character count")
    metadata: Dict[str, Any] = Field(..., description="Document metadata")


class ExtractedQuestion(BaseModel):
    """A question extracted from the document"""
    id: str = Field(..., description="Generated question ID")
    text: Dict[str, str] = Field(..., description="Question text (multi-language)")
    type: str = Field(..., description="Question type")
    required: bool = Field(True, description="Whether question is required")
    options: Optional[List[str]] = Field(None, description="Options for choice questions")
    help_text: Optional[str] = Field(None, description="Additional help text")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Extraction confidence")
    original_text: Optional[str] = Field(None, description="Original text from document")


class TemplateImportResponse(BaseModel):
    """Response from template import process"""
    import_id: str = Field(..., description="Unique import session ID")
    document_info: DocumentInfo = Field(..., description="Document information")
    extracted_template: Dict[str, Any] = Field(..., description="Extracted template data")
    questions: List[ExtractedQuestion] = Field(..., description="Extracted questions")
    extraction_confidence: float = Field(..., ge=0.0, le=1.0, description="Overall extraction confidence")
    extraction_notes: Optional[str] = Field(None, description="Notes about the extraction process")
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")
    created_at: datetime = Field(..., description="Import timestamp")


class TemplateImportConfirmRequest(BaseModel):
    """Request to confirm and save an imported template"""
    import_id: str = Field(..., description="Import session ID")
    template_id: str = Field(..., description="Template ID for the new template")
    name: str = Field(..., max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    category: Optional[str] = Field(None, max_length=50, description="Template category")
    questions: List[Dict[str, Any]] = Field(..., min_items=1, description="Final questions list")
    
    @validator('questions')
    def validate_questions(cls, v):
        if not v:
            raise ValueError('At least one question is required')
        
        # Validate question structure
        for i, question in enumerate(v):
            if 'id' not in question:
                raise ValueError(f'Question {i+1} missing required field: id')
            if 'text' not in question:
                raise ValueError(f'Question {i+1} missing required field: text')
            if 'type' not in question:
                raise ValueError(f'Question {i+1} missing required field: type')
        
        return v


class TemplateImportStatus(BaseModel):
    """Status of a template import session"""
    import_id: str = Field(..., description="Import session ID")
    status: str = Field(..., description="Import status")
    document_filename: str = Field(..., description="Original document filename")
    questions_extracted: int = Field(..., description="Number of questions extracted")
    created_at: datetime = Field(..., description="Import timestamp")
    expires_at: datetime = Field(..., description="Session expiration")
    is_confirmed: bool = Field(..., description="Whether template was confirmed and saved")


class TemplateImportError(BaseModel):
    """Error response for template import"""
    error_type: str = Field(..., description="Type of error")
    error_message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    suggestions: Optional[List[str]] = Field(None, description="Suggestions to resolve the error")


class ImportedTemplatePreview(BaseModel):
    """Preview of an imported template before confirmation"""
    template_info: Dict[str, Any] = Field(..., description="Template metadata")
    questions: List[ExtractedQuestion] = Field(..., description="Extracted questions")
    document_info: DocumentInfo = Field(..., description="Source document info")
    extraction_quality: Dict[str, Any] = Field(..., description="Quality metrics")
    recommended_edits: Optional[List[str]] = Field(None, description="Recommended edits before saving")
