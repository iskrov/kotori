import logging
import json
import hashlib
from typing import List, Dict, Optional, Any
from functools import lru_cache
import asyncio
from datetime import datetime

import google.generativeai as genai
from pydantic import BaseModel, Field

from ..core.config import settings
from ..schemas.share_template import TemplateQuestion

logger = logging.getLogger(__name__)


class QuestionAnswer(BaseModel):
    """Individual Q&A pair for structured output"""
    question_id: str = Field(..., description="Unique question identifier")
    question_text: str = Field(..., description="Question text in target language")
    answer: str = Field(..., description="Generated answer based on journal entries")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score for the answer")
    source_entries: Optional[List[str]] = Field(None, description="IDs of journal entries used")


class ShareSummaryResponse(BaseModel):
    """Structured response from Gemini for share summary generation"""
    answers: List[QuestionAnswer] = Field(..., description="List of Q&A pairs")
    source_language: str = Field(..., description="Detected language of journal entries")
    target_language: str = Field(..., description="Target language for output")
    entry_count: int = Field(..., description="Number of journal entries processed")
    processing_notes: Optional[str] = Field(None, description="Any processing notes or warnings")


class TemplateExtractionResponse(BaseModel):
    """Structured response for template extraction from documents"""
    template_id: str = Field(..., description="Generated template identifier")
    name: str = Field(..., description="Template name/title")
    description: Optional[str] = Field(None, description="Template description")
    category: Optional[str] = Field(None, description="Template category")
    questions: List[Dict[str, Any]] = Field(..., description="Extracted questions in template format")
    extraction_confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in extraction quality")
    extraction_notes: Optional[str] = Field(None, description="Notes about extraction process")


class GeminiError(Exception):
    """Base exception for Gemini service"""
    pass


class GeminiRateLimitError(GeminiError):
    """Rate limit exceeded"""
    pass


class GeminiInvalidResponseError(GeminiError):
    """Invalid response format from API"""
    pass


class GeminiService:
    """Service for Gemini API integration with structured output"""

    def __init__(self):
        self.model = None
        self.rate_limiter = GeminiRateLimiter()
        self.initialize_client()

    def initialize_client(self):
        """Initialize Gemini client with API key from settings"""
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not configured - sharing features will be disabled")
            return

        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            logger.info("Gemini client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            raise GeminiError(f"Gemini initialization failed: {e}")

    def _check_availability(self):
        """Check if Gemini service is available"""
        if not self.model:
            raise GeminiError("Gemini service not available - check API key configuration")

    async def generate_share_summary(
        self,
        entries: List[Dict[str, Any]],
        template: Dict[str, Any],
        target_language: str = "en"
    ) -> ShareSummaryResponse:
        """
        Generate a structured summary by mapping journal entries to template questions
        
        Args:
            entries: List of journal entries (decrypted content)
            template: Template with questions to answer
            target_language: Target language for output
            
        Returns:
            ShareSummaryResponse with structured Q&A pairs
        """
        self._check_availability()
        await self.rate_limiter.check_rate_limit()

        try:
            # Create structured prompt for Q&A generation
            prompt = self._create_qa_generation_prompt(entries, template, target_language)
            
            # Generate content with structured output
            response = await self._generate_with_structured_output(
                prompt=prompt,
                response_schema=ShareSummaryResponse,
                temperature=0.7,
                max_output_tokens=2000
            )
            
            logger.info(f"Generated share summary with {len(response.answers)} Q&A pairs")
            return response

        except Exception as e:
            logger.error(f"Failed to generate share summary: {e}")
            raise GeminiError(f"Share summary generation failed: {e}")

    async def extract_template_from_document(
        self,
        document_text: str,
        document_type: str = "unknown"
    ) -> TemplateExtractionResponse:
        """
        Extract a structured template from document text
        
        Args:
            document_text: Text content of the document
            document_type: Type of document (pdf, docx, etc.)
            
        Returns:
            TemplateExtractionResponse with extracted template
        """
        self._check_availability()
        await self.rate_limiter.check_rate_limit()

        try:
            # Create prompt for template extraction
            prompt = self._create_template_extraction_prompt(document_text, document_type)
            
            # Generate content with structured output
            response = await self._generate_with_structured_output(
                prompt=prompt,
                response_schema=TemplateExtractionResponse,
                temperature=0.3,  # Lower temperature for more consistent extraction
                max_output_tokens=3000
            )
            
            logger.info(f"Extracted template with {len(response.questions)} questions")
            return response

        except Exception as e:
            logger.error(f"Failed to extract template from document: {e}")
            raise GeminiError(f"Template extraction failed: {e}")

    async def _generate_with_structured_output(
        self,
        prompt: str,
        response_schema: BaseModel,
        temperature: float = 0.7,
        max_output_tokens: int = 2000
    ) -> BaseModel:
        """
        Generate content with structured output using Gemini's response schema feature
        """
        try:
            # Convert Pydantic model to JSON schema for Gemini
            json_schema = response_schema.model_json_schema()
            
            # Generate content with structured output
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=json_schema,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                )
            )
            
            # Parse the structured response
            response_data = json.loads(response.text)
            return response_schema(**response_data)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            raise GeminiInvalidResponseError(f"Invalid JSON response: {e}")
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise GeminiError(f"API call failed: {e}")

    def _create_qa_generation_prompt(
        self,
        entries: List[Dict[str, Any]],
        template: Dict[str, Any],
        target_language: str
    ) -> str:
        """Create optimized prompt for Q&A generation with structured output"""
        
        # Prepare entries text (limit content to avoid token limits)
        entries_text = ""
        for i, entry in enumerate(entries[:20]):  # Limit to 20 entries
            content = entry.get('content', '')
            if len(content) > 500:  # Truncate long entries
                content = content[:500] + "..."
            entries_text += f"Entry {i+1} ({entry.get('entry_date', 'unknown date')}):\n{content}\n\n"

        # Prepare questions
        questions_text = ""
        for question in template.get('questions', []):
            q_text = question.get('text', {}).get('en', 'No question text')
            questions_text += f"- {question.get('id')}: {q_text}\n"

        prompt = f"""
You are a helpful AI assistant that creates structured summaries for healthcare and wellness sharing.

TASK: Create answers to specific questions based on journal entries.

JOURNAL ENTRIES:
{entries_text}

QUESTIONS TO ANSWER:
{questions_text}

INSTRUCTIONS:
1. Read the journal entries carefully
2. For each question, find relevant information from the entries
3. Generate a concise, helpful answer (100-300 words) based on the entries
4. If no relevant information exists for a question, respond with "No information available in the selected entries"
5. Provide a confidence score (0.0-1.0) for each answer based on how well the entries address the question
6. Translate all questions and answers to {target_language} if different from the source language
7. Maintain a supportive, professional tone appropriate for healthcare sharing
8. Focus on factual information from the entries, avoid speculation

IMPORTANT: 
- Only use information explicitly mentioned in the journal entries
- Maintain user privacy by being general rather than overly specific about personal details
- If entries mention concerning symptoms or mental health issues, acknowledge them appropriately
- Ensure answers are suitable for sharing with healthcare providers or caregivers
"""

        return prompt

    def _create_template_extraction_prompt(
        self,
        document_text: str,
        document_type: str
    ) -> str:
        """Create prompt for extracting template from document text"""
        
        # Truncate document if too long
        if len(document_text) > 5000:
            document_text = document_text[:5000] + "... [document truncated]"

        prompt = f"""
You are an AI assistant that extracts structured questionnaires from documents.

TASK: Extract questions from the following document and create a structured template.

DOCUMENT TYPE: {document_type}
DOCUMENT CONTENT:
{document_text}

INSTRUCTIONS:
1. Identify all questions, prompts, or fields that require user input
2. For each question, determine the appropriate type:
   - "open": Open-ended text response
   - "single_choice": Single selection from options
   - "multi_choice": Multiple selections from options  
   - "scale": Numeric rating scale
3. Extract any provided options for choice questions
4. Generate a descriptive template name based on the document content
5. Categorize the template (e.g., "medical", "wellness", "mental_health", "assessment")
6. Provide a confidence score for the extraction quality
7. Include any extraction notes about challenges or assumptions made

TEMPLATE STRUCTURE:
- Each question should have a unique ID (q1, q2, etc.)
- Question text should be in English with multi-language support structure
- Include whether each question is required (default: true for main questions)
- Extract help text or instructions if available

IMPORTANT:
- Focus on questions that would be relevant for healthcare or wellness sharing
- Ignore administrative fields (name, date, signature) unless specifically relevant
- If the document contains multiple sections, organize questions logically
- Ensure question IDs are unique and meaningful
- Set extraction_confidence based on document clarity and completeness
"""

        return prompt

    @lru_cache(maxsize=100)
    def _cache_key(self, entries_hash: str, template_id: str, language: str) -> str:
        """Generate cache key for responses"""
        return hashlib.sha256(
            f"{entries_hash}:{template_id}:{language}".encode()
        ).hexdigest()


class GeminiRateLimiter:
    """Simple rate limiter for Gemini API calls"""
    
    def __init__(self, requests_per_minute: int = 60):
        self.rpm = requests_per_minute
        self.request_times = []
        self.lock = asyncio.Lock()

    async def check_rate_limit(self):
        """Check if we can make a request without exceeding rate limits"""
        async with self.lock:
            now = datetime.now()
            
            # Remove requests older than 1 minute
            self.request_times = [
                req_time for req_time in self.request_times
                if (now - req_time).total_seconds() < 60
            ]
            
            # Check if we're at the limit
            if len(self.request_times) >= self.rpm:
                wait_time = 60 - (now - self.request_times[0]).total_seconds()
                if wait_time > 0:
                    logger.warning(f"Rate limit reached, waiting {wait_time:.2f} seconds")
                    await asyncio.sleep(wait_time)
                    # Retry the check
                    return await self.check_rate_limit()
            
            # Record this request
            self.request_times.append(now)


# Create service instance
gemini_service = GeminiService()
