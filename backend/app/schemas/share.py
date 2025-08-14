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


class ShareInputEntry(BaseModel):
    """Plaintext journal entry provided by the client after consent"""
    id: Optional[uuid.UUID] = Field(None, description="Journal entry UUID (optional)")
    content: str = Field(..., description="Decrypted plaintext content of the entry")
    entry_date: Optional[datetime] = Field(None, description="Entry timestamp")
    title: Optional[str] = Field(None, description="Entry title")


class ShareCreateRequest(BaseModel):
    """Request to create a new share"""
    template_id: str = Field(..., description="Template ID to use")
    entry_ids: Optional[List[uuid.UUID]] = Field(None, description="Specific journal entry IDs to include")
    entries: Optional[List[ShareInputEntry]] = Field(
        None, description="Plaintext entries provided by client after consent"
    )
    date_range: Optional[Dict[str, str]] = Field(None, description="Date range to fetch entries from")
    period: Optional[str] = Field(None, description="Period type: daily, weekly, monthly")
    target_language: str = Field("en", description="Target language for output")
    title: Optional[str] = Field(None, max_length=255, description="Custom title for the share")
    expires_in_days: int = Field(7, ge=1, le=30, description="Expiration in days (1-30)")
    consent_acknowledged: bool = Field(False, description="User consent acknowledged for plaintext processing")
    
    @validator('date_range')
    def validate_date_range(cls, v, values):
        if v is not None:
            if 'start' not in v or 'end' not in v:
                raise ValueError('date_range must contain start and end keys')
            # Validate date format
            from datetime import datetime
            try:
                datetime.fromisoformat(v['start'].replace('Z', '+00:00'))
                datetime.fromisoformat(v['end'].replace('Z', '+00:00'))
            except ValueError:
                raise ValueError('Invalid date format in date_range')
        return v
    
    @validator('period')
    def validate_period(cls, v):
        if v is not None:
            allowed_periods = ['daily', 'weekly', 'monthly']
            if v not in allowed_periods:
                raise ValueError(f'Period must be one of: {allowed_periods}')
        return v
    
    @validator('entry_ids')
    def validate_selection_inputs(cls, v, values):
        date_range = values.get('date_range')
        entries = values.get('entries')
        # Allow plaintext entries OR selection via ids/date_range
        if (v is None and date_range is None) and not entries:
            raise ValueError('Provide either entries (plaintext) or entry_ids/date_range')
        if entries and (v is not None or date_range is not None):
            raise ValueError('Cannot mix plaintext entries with entry_ids/date_range')
        return v

    @validator('consent_acknowledged')
    def validate_consent(cls, v, values):
        if values.get('entries') and not v:
            raise ValueError('Consent must be acknowledged when providing plaintext entries')
        return v
    
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
