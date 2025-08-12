from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
import logging
import json
import time
from datetime import datetime, timedelta, timezone
import uuid

from ....dependencies import get_db, get_current_user
from ....models.user import User
from ....schemas.template_import import (
    TemplateImportRequest,
    TemplateImportResponse,
    TemplateImportConfirmRequest,
    TemplateImportStatus,
    TemplateImportError,
    DocumentInfo,
    ExtractedQuestion
)
from ....services.document_parser_service import document_parser_service, DocumentParsingError
from ....services.gemini_service import gemini_service, GeminiError
from ....services.share_template_service import share_template_service
from ....schemas.share_template import ShareTemplateCreate

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory storage for import sessions (in production, use Redis or database)
import_sessions = {}

def cleanup_expired_sessions():
    """Clean up expired import sessions"""
    now = datetime.now(timezone.utc)
    expired_sessions = [
        session_id for session_id, session_data in import_sessions.items()
        if session_data.get('expires_at', now) < now
    ]
    for session_id in expired_sessions:
        del import_sessions[session_id]
    
    if expired_sessions:
        logger.info(f"Cleaned up {len(expired_sessions)} expired import sessions")


@router.post("/", response_model=TemplateImportResponse)
async def import_template_from_file(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    file: UploadFile = File(...),
    request_data: str = Form(None)  # JSON string of TemplateImportRequest
) -> Any:
    """
    Import a template by uploading a PDF or DOCX file.
    
    The file will be parsed and processed with Gemini to extract questions
    and create a structured template. The result is stored temporarily
    for review before confirmation.
    """
    start_time = time.time()
    
    # Clean up expired sessions
    cleanup_expired_sessions()
    
    try:
        # Parse request data
        request_params = TemplateImportRequest()
        if request_data:
            try:
                request_dict = json.loads(request_data)
                request_params = TemplateImportRequest(**request_dict)
            except (json.JSONDecodeError, ValueError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid request data: {e}"
                )
        
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must have a filename"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Validate file size
        if not document_parser_service.validate_file_size(file_content, max_size_mb=10):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds 10MB limit"
            )
        
        # Validate file type
        content_type = file.content_type or ""
        if not document_parser_service.is_supported_type(content_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {content_type}. Supported types: PDF, DOCX"
            )
        
        # Parse document
        try:
            parsed_doc = document_parser_service.parse_file(
                file_content=file_content,
                content_type=content_type,
                filename=file.filename
            )
        except DocumentParsingError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Document parsing failed: {e}"
            )
        
        # Extract template using Gemini
        try:
            gemini_response = await gemini_service.extract_template_from_document(
                document_text=parsed_doc['text'],
                document_type=parsed_doc['document_type']
            )
        except GeminiError as e:
            logger.error(f"Gemini template extraction failed: {e}")
            # Create fallback response
            fallback_questions = [
                {
                    "id": "q1",
                    "text": {"en": "Please describe your main concerns or symptoms."},
                    "type": "open",
                    "required": True,
                    "help_text": "Extracted from uploaded document - please review and edit"
                }
            ]
            
            gemini_response = type('FallbackResponse', (), {
                'template_id': f"imported-{uuid.uuid4().hex[:8]}",
                'name': f"Imported Template - {file.filename}",
                'description': "Template imported from document with fallback extraction",
                'category': request_params.target_category or "imported",
                'questions': fallback_questions,
                'extraction_confidence': 0.3,
                'extraction_notes': f"AI extraction failed: {e}. Using fallback template."
            })()
        
        # Process extracted questions
        extracted_questions = []
        for i, question_data in enumerate(gemini_response.questions):
            # Ensure proper structure
            question_text = question_data.get('text', {})
            if isinstance(question_text, str):
                question_text = {"en": question_text}
            
            extracted_question = ExtractedQuestion(
                id=question_data.get('id', f'q{i+1}'),
                text=question_text,
                type=question_data.get('type', 'open'),
                required=question_data.get('required', True),
                options=question_data.get('options'),
                help_text=question_data.get('help_text'),
                confidence=question_data.get('confidence', 0.8),
                original_text=question_data.get('original_text')
            )
            extracted_questions.append(extracted_question)
        
        # Limit questions if requested
        if len(extracted_questions) > request_params.max_questions:
            extracted_questions = extracted_questions[:request_params.max_questions]
        
        # Create document info
        document_info = DocumentInfo(
            filename=file.filename,
            document_type=parsed_doc['document_type'],
            file_size_mb=len(file_content) / (1024 * 1024),
            word_count=parsed_doc['word_count'],
            character_count=parsed_doc['character_count'],
            metadata=parsed_doc['metadata']
        )
        
        # Create import session
        import_id = str(uuid.uuid4())
        session_data = {
            'user_id': current_user.id,
            'document_info': document_info.dict(),
            'extracted_template': {
                'template_id': gemini_response.template_id,
                'name': request_params.custom_name or gemini_response.name,
                'description': gemini_response.description,
                'category': request_params.target_category or gemini_response.category,
                'version': '1.0',
                'questions': [q.dict() for q in extracted_questions]
            },
            'extraction_confidence': gemini_response.extraction_confidence,
            'extraction_notes': gemini_response.extraction_notes,
            'created_at': datetime.now(timezone.utc),
            'expires_at': datetime.now(timezone.utc) + timedelta(hours=24),
            'is_confirmed': False
        }
        
        import_sessions[import_id] = session_data
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Create response
        response = TemplateImportResponse(
            import_id=import_id,
            document_info=document_info,
            extracted_template=session_data['extracted_template'],
            questions=extracted_questions,
            extraction_confidence=gemini_response.extraction_confidence,
            extraction_notes=gemini_response.extraction_notes,
            processing_time_ms=processing_time_ms,
            created_at=session_data['created_at']
        )
        
        logger.info(f"Template import completed for user {current_user.id}: {import_id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template import error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Template import failed"
        )


@router.post("/confirm", response_model=dict)
async def confirm_imported_template(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: TemplateImportConfirmRequest
) -> Any:
    """
    Confirm and save an imported template.
    
    This creates a permanent template from the imported data
    after user review and any edits.
    """
    try:
        # Get import session
        session_data = import_sessions.get(request.import_id)
        if not session_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import session not found or expired"
            )
        
        # Verify ownership
        if session_data['user_id'] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Check if already confirmed
        if session_data.get('is_confirmed'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Template already confirmed and saved"
            )
        
        # Check expiration
        if datetime.now(timezone.utc) > session_data['expires_at']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Import session has expired"
            )
        
        # Create template
        template_create = ShareTemplateCreate(
            template_id=request.template_id,
            name=request.name,
            description=request.description,
            category=request.category,
            version="1.0",
            questions=request.questions,
            is_active=True
        )
        
        # Save template
        try:
            template = share_template_service.create_template(db, obj_in=template_create)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        
        # Mark session as confirmed
        session_data['is_confirmed'] = True
        session_data['confirmed_template_id'] = template.id
        
        logger.info(f"Confirmed imported template {template.template_id} for user {current_user.id}")
        
        return {
            "success": True,
            "template_id": template.template_id,
            "template_uuid": str(template.id),
            "message": f"Template '{request.name}' created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template confirmation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Template confirmation failed"
        )


@router.get("/{import_id}/status", response_model=TemplateImportStatus)
def get_import_status(
    *,
    current_user: User = Depends(get_current_user),
    import_id: str
) -> Any:
    """
    Get the status of a template import session.
    """
    try:
        session_data = import_sessions.get(import_id)
        if not session_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import session not found"
            )
        
        # Verify ownership
        if session_data['user_id'] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Determine status
        now = datetime.now(timezone.utc)
        if now > session_data['expires_at']:
            status_text = "expired"
        elif session_data.get('is_confirmed'):
            status_text = "confirmed"
        else:
            status_text = "pending"
        
        return TemplateImportStatus(
            import_id=import_id,
            status=status_text,
            document_filename=session_data['document_info']['filename'],
            questions_extracted=len(session_data['extracted_template']['questions']),
            created_at=session_data['created_at'],
            expires_at=session_data['expires_at'],
            is_confirmed=session_data.get('is_confirmed', False)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting import status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get import status"
        )


@router.get("/supported-types")
def get_supported_file_types(
    *,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get information about supported file types for template import.
    """
    return document_parser_service.get_supported_types_info()
