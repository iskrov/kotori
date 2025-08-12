from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta
import uuid


class ShareQuestionAnswer(BaseModel):
    """Individual Q&A pair in a share"""
    question_id: str = Field(..., description="Question identifier")
    question_text: str = Field(..., description="Question text in target language")
    answer: str = Field(..., description="Generated answer")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Answer confidence score")


class ShareCreateRequest(BaseModel):
    """Request to create a new share"""
    template_id: str = Field(..., description="Template ID to use")
    entry_ids: List[uuid.UUID] = Field(..., min_items=1, description="Journal entry IDs to include")
    target_language: str = Field("en", description="Target language for output")
    title: Optional[str] = Field(None, max_length=255, description="Custom title for the share")
    expires_in_days: int = Field(7, ge=1, le=30, description="Expiration in days (1-30)")
    
    @validator('target_language')
    def validate_language(cls, v):
        # Basic language code validation (ISO 639-1)
        if len(v) < 2 or len(v) > 5:
            raise ValueError('Language code must be 2-5 characters')
        return v.lower()


class ShareContent(BaseModel):
    """Content structure for a share"""
    answers: List[ShareQuestionAnswer] = Field(..., description="Q&A pairs")
    template_info: Dict[str, Any] = Field(..., description="Template metadata")
    generation_metadata: Dict[str, Any] = Field(..., description="Generation metadata")
    source_language: str = Field(..., description="Detected source language")
    target_language: str = Field(..., description="Target output language")
    entry_count: int = Field(..., description="Number of entries processed")
    generated_at: datetime = Field(..., description="Generation timestamp")


class ShareResponse(BaseModel):
    """Response when creating or retrieving a share"""
    id: uuid.UUID = Field(..., description="Share UUID")
    share_token: str = Field(..., description="Public access token")
    title: str = Field(..., description="Share title")
    template_id: str = Field(..., description="Template used")
    target_language: str = Field(..., description="Target language")
    entry_count: int = Field(..., description="Number of entries processed")
    question_count: int = Field(..., description="Number of questions answered")
    created_at: datetime = Field(..., description="Creation timestamp")
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")
    access_count: int = Field(..., description="Number of times accessed")
    is_active: bool = Field(..., description="Whether share is active")
    
    class Config:
        from_attributes = True


class ShareDetailResponse(ShareResponse):
    """Detailed share response including content"""
    content: ShareContent = Field(..., description="Share content")
    last_accessed_at: Optional[datetime] = Field(None, description="Last access timestamp")


class ShareListResponse(BaseModel):
    """Response for listing user's shares"""
    shares: List[ShareResponse] = Field(..., description="List of shares")
    total: int = Field(..., description="Total number of shares")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Items per page")


class SharePublicResponse(BaseModel):
    """Public response for accessing a share via token (no sensitive data)"""
    title: str = Field(..., description="Share title")
    content: ShareContent = Field(..., description="Share content")
    created_at: datetime = Field(..., description="Creation timestamp")
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")
    is_expired: bool = Field(..., description="Whether share has expired")


class ShareAccessCreate(BaseModel):
    """Create share access log entry"""
    share_id: uuid.UUID = Field(..., description="Share UUID")
    ip_address: Optional[str] = Field(None, description="Client IP address")
    user_agent: Optional[str] = Field(None, description="Client user agent")
    referrer: Optional[str] = Field(None, description="HTTP referrer")
    access_type: str = Field("view", description="Type of access")
    
    @validator('access_type')
    def validate_access_type(cls, v):
        allowed_types = ['view', 'download', 'email']
        if v not in allowed_types:
            raise ValueError(f'Access type must be one of: {allowed_types}')
        return v


class ShareUpdate(BaseModel):
    """Update share settings"""
    title: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = Field(None)
    expires_at: Optional[datetime] = Field(None)


class ShareStats(BaseModel):
    """Share usage statistics"""
    total_shares: int = Field(..., description="Total shares created")
    active_shares: int = Field(..., description="Currently active shares")
    total_accesses: int = Field(..., description="Total access count")
    shares_by_template: Dict[str, int] = Field(..., description="Shares grouped by template")
    shares_by_language: Dict[str, int] = Field(..., description="Shares grouped by language")
    recent_activity: List[Dict[str, Any]] = Field(..., description="Recent share activity")
