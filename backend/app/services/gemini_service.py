import logging
import json
import hashlib
import os
import base64
from typing import List, Dict, Optional, Any
from functools import lru_cache
import asyncio
from datetime import datetime

import google.generativeai as genai
from google.oauth2 import service_account

# Optional Vertex AI imports (prefer Vertex when project/location are configured)
try:
    import vertexai
    from vertexai.generative_models import GenerativeModel as VertexGenerativeModel
    from vertexai.generative_models import GenerationConfig as VertexGenerationConfig
    VERTEX_AVAILABLE = True
except Exception:
    VERTEX_AVAILABLE = False
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


class GeminiMaxTokensError(GeminiError):
    """Generation stopped due to max tokens limit"""
    pass


class GeminiService:
    """Service for Gemini API integration with structured output"""

    def __init__(self):
        self.model = None
        self.vertex_backend = False
        self.rate_limiter = GeminiRateLimiter()
        self.initialize_client()

    def initialize_client(self):
        """Initialize Gemini client with either service account credentials or API key"""
        try:
            # Prefer Vertex AI if available and project/location are configured
            project_id = settings.GOOGLE_CLOUD_PROJECT
            location = settings.GOOGLE_CLOUD_LOCATION
            credentials = self._get_credentials()

            if VERTEX_AVAILABLE and project_id and location:
                try:
                    # Use explicit credentials if provided; otherwise rely on ADC (Cloud Run SA)
                    if credentials:
                        vertexai.init(project=project_id, location=location, credentials=credentials)
                        auth_mode = "service_account_file"
                    else:
                        vertexai.init(project=project_id, location=location)
                        auth_mode = "adc_service_account"
                    self.model = VertexGenerativeModel('gemini-2.5-flash')
                    self.vertex_backend = True
                    logger.info(
                        "Vertex AI initialized with gemini-2.5-flash model (project=%s, location=%s, auth=%s)",
                        project_id,
                        location,
                        auth_mode,
                    )
                    return
                except Exception as e:
                    logger.warning(f"Vertex AI initialization failed, falling back to direct Gemini API: {e}")

            # Fallback: direct Gemini API
            if credentials:
                genai.configure(credentials=credentials)
                logger.info("Gemini client initialized with service account credentials")
            elif settings.GEMINI_API_KEY:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                logger.info("Gemini client initialized with API key")
            else:
                logger.warning("Neither GOOGLE_APPLICATION_CREDENTIALS nor GEMINI_API_KEY configured - sharing features will be disabled")
                return

            self.model = genai.GenerativeModel('gemini-2.5-flash')
            self.vertex_backend = False
            logger.info("Gemini client initialized successfully with gemini-2.5-flash model (direct API)")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            raise GeminiError(f"Gemini initialization failed: {e}")

    def _get_credentials(self):
        """Load service account credentials from file if specified, otherwise returns None"""
        if not settings.GOOGLE_APPLICATION_CREDENTIALS:
            logger.debug("GOOGLE_APPLICATION_CREDENTIALS not set, will try API key authentication")
            return None

        try:
            # Path is relative to the project root
            # Similar pattern to speech_service.py
            project_root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            credentials_path = os.path.join(
                project_root_dir,
                settings.GOOGLE_APPLICATION_CREDENTIALS,
            )
            credentials_path = os.path.abspath(credentials_path)
            
            logger.info(f"Attempting to load Gemini credentials from: {credentials_path}")
            
            if not os.path.exists(credentials_path):
                logger.error(f"Credentials file not found at {credentials_path}")
                raise GeminiError(f"Specified GOOGLE_APPLICATION_CREDENTIALS file not found: {credentials_path}")
            
            # Use cloud-platform scope to support Vertex AI
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )
            logger.info("Service account credentials loaded successfully for Vertex/GCP")
            return credentials
            
        except Exception as e:
            logger.error(f"Failed to load service account credentials: {e}")
            logger.info("Falling back to API key authentication if available")
            return None

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
            # Heuristic summarization for very long inputs
            total_chars = sum(len(e.get('content') or '') for e in entries)
            summary_text: Optional[str] = None
            if total_chars > 15000:
                summary_text = await self._summarize_entries(entries=entries, target_language=target_language)

            # Try full template generation first
            try:
                response = await self._generate_full_template_summary(
                    entries=entries,
                    template=template,
                    target_language=target_language,
                    summary_override=summary_text
                )
                
                # Confidence-aware escalation to Pro for weak answers
                improved_response = await self._maybe_escalate_low_confidence(
                    original=response,
                    entries=entries,
                    template=template,
                    target_language=target_language,
                    summary_override=summary_text
                )

                logger.info(f"Generated share summary with {len(improved_response.answers)} Q&A pairs (escalation applied={improved_response is not response})")
                return improved_response
                
            except GeminiMaxTokensError as token_error:
                logger.warning(f"Full template generation hit token limit, falling back to batching: {token_error}")
                
                # Fallback: Generate in batches to avoid token limits
                response = await self._generate_batched_template_summary(
                    entries=entries,
                    template=template,
                    target_language=target_language,
                    summary_override=summary_text
                )
                
                logger.info(f"Generated share summary using batching with {len(response.answers)} Q&A pairs")
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
        max_output_tokens: int = 2000,
        model_name_override: Optional[str] = None
    ) -> BaseModel:
        """
        Generate content with structured output using Gemini's response schema feature
        """
        try:
            # Convert Pydantic model to JSON schema for Gemini
            json_schema = response_schema.model_json_schema()
            
            # Remove $defs and inline definitions for Gemini compatibility
            if '$defs' in json_schema:
                defs = json_schema.pop('$defs')
                json_schema = self._inline_definitions(json_schema, defs)

            # Remove combinators (anyOf/oneOf/allOf) and nullable wrappers
            json_schema = self._remove_schema_combinators(json_schema)

            # Prune unsupported JSON Schema keywords
            json_schema = self._prune_schema_keywords(json_schema)
            
            # Generate content with structured output
            if self.vertex_backend:
                # Vertex AI path
                model = self.model
                if model_name_override and isinstance(model, VertexGenerativeModel):
                    model = VertexGenerativeModel(model_name_override)
                response = await asyncio.to_thread(
                    model.generate_content,
                    prompt,
                    generation_config=VertexGenerationConfig(
                        response_mime_type="application/json",
                        response_schema=json_schema,
                        temperature=temperature,
                        max_output_tokens=max_output_tokens,
                    )
                )
            else:
                # Direct Gemini API path
                model = self.model
                if model_name_override and isinstance(model, genai.GenerativeModel):
                    model = genai.GenerativeModel(model_name_override)
                response = await asyncio.to_thread(
                    model.generate_content,
                    prompt,
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        response_schema=json_schema,
                        temperature=temperature,
                        max_output_tokens=max_output_tokens,
                    )
                )
            
            # Check for token limit issues before parsing
            self._check_finish_reason_and_log_usage(response)
            
            # Parse the structured response (robust across SDKs and backends)
            structured_text = self._extract_structured_json_text(response)
            response_data = json.loads(structured_text)
            return response_schema(**response_data)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            raise GeminiInvalidResponseError(f"Invalid JSON response: {e}")
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise GeminiError(f"API call failed: {e}")

    def _extract_structured_json_text(self, response: Any) -> str:
        """Extract JSON text from a Gemini/Vertex response regardless of backend shape.

        Tries, in order:
        1) response.text
        2) candidates[*].content.parts[*].text
        3) candidates[*].content.parts[*].inline_data (base64 JSON)
        4) Fallback: scan response.to_dict() for a JSON-looking string
        """
        # 1) response.text
        try:
            if hasattr(response, "text"):
                txt = response.text  # may raise in some SDKs
                if isinstance(txt, str) and txt.strip():
                    return txt
        except Exception:
            # Continue to alternative extraction paths
            pass

        # Helper to safely get attribute or dict key
        def get(obj: Any, name: str, default: Any = None) -> Any:
            if obj is None:
                return default
            if isinstance(obj, dict):
                return obj.get(name, default)
            return getattr(obj, name, default)

        # 2) candidates -> content -> parts -> text
        try:
            candidates = get(response, "candidates") or []
            for cand in candidates:
                content = get(cand, "content")
                parts = get(content, "parts") or []
                for part in parts:
                    txt = get(part, "text")
                    if isinstance(txt, str) and txt.strip():
                        # Ensure this looks like JSON
                        s = txt.strip()
                        if s.startswith("{") or s.startswith("["):
                            return s
        except Exception:
            pass

        # 3) candidates -> content -> parts -> inline_data (base64 JSON)
        try:
            candidates = get(response, "candidates") or []
            for cand in candidates:
                content = get(cand, "content")
                parts = get(content, "parts") or []
                for part in parts:
                    inline = get(part, "inline_data")
                    if inline:
                        mime = get(inline, "mime_type")
                        data_b64 = get(inline, "data")
                        if data_b64 and isinstance(data_b64, str):
                            try:
                                raw = base64.b64decode(data_b64)
                                s = raw.decode("utf-8", errors="ignore").strip()
                                if (mime and "json" in str(mime)) or s.startswith("{") or s.startswith("["):
                                    return s
                            except Exception:
                                pass
        except Exception:
            pass

        # 4) Fallback: scan to_dict for JSON-looking strings
        try:
            to_dict = getattr(response, "to_dict", None)
            if callable(to_dict):
                d = to_dict()
                stack = [d]
                while stack:
                    cur = stack.pop()
                    if isinstance(cur, dict):
                        for v in cur.values():
                            stack.append(v)
                    elif isinstance(cur, list):
                        stack.extend(cur)
                    elif isinstance(cur, str):
                        s = cur.strip()
                        if s.startswith("{") or s.startswith("["):
                            # Verify it's valid JSON
                            try:
                                json.loads(s)
                                return s
                            except Exception:
                                continue
        except Exception:
            pass

        # Nothing worked
        raise GeminiError("API call failed: Cannot get the response text")

    def _check_finish_reason_and_log_usage(self, response: Any) -> None:
        """Check response finish_reason and log usage metadata for debugging."""
        try:
            # Helper to safely get attribute or dict key
            def get(obj: Any, name: str, default: Any = None) -> Any:
                if obj is None:
                    return default
                if isinstance(obj, dict):
                    return obj.get(name, default)
                return getattr(obj, name, default)

            # Extract usage metadata if available
            usage_metadata = get(response, "usage_metadata")
            if usage_metadata:
                prompt_tokens = get(usage_metadata, "prompt_token_count", 0)
                completion_tokens = get(usage_metadata, "candidates_token_count", 0)
                total_tokens = get(usage_metadata, "total_token_count", 0)
                logger.info(f"Gemini usage: prompt={prompt_tokens}, completion={completion_tokens}, total={total_tokens}")
            
            # Check candidates for finish_reason
            candidates = get(response, "candidates") or []
            for i, candidate in enumerate(candidates):
                finish_reason = get(candidate, "finish_reason")
                if finish_reason:
                    logger.info(f"Gemini candidate {i} finish_reason: {finish_reason}")
                    
                    # Check for specific problematic finish reasons
                    if str(finish_reason).upper() in ["MAX_TOKENS", "LENGTH"]:
                        raise GeminiMaxTokensError(f"Generation stopped due to token limit (finish_reason: {finish_reason})")
                    elif str(finish_reason).upper() in ["SAFETY", "RECITATION"]:
                        logger.warning(f"Generation blocked by safety filters (finish_reason: {finish_reason})")
                        raise GeminiError(f"Generation blocked by safety filters (finish_reason: {finish_reason})")

        except GeminiMaxTokensError:
            raise  # Re-raise token limit errors
        except GeminiError:
            raise  # Re-raise other Gemini errors
        except Exception as e:
            # Don't fail the whole request if we can't parse metadata
            logger.debug(f"Could not parse response metadata: {e}")
            pass

    async def _generate_full_template_summary(
        self,
        entries: List[Dict[str, Any]],
        template: Dict[str, Any],
        target_language: str,
        summary_override: Optional[str] = None
    ) -> ShareSummaryResponse:
        """Generate summary for all template questions in a single call."""
        # Create structured prompt for Q&A generation
        prompt = self._create_qa_generation_prompt(entries, template, target_language, summary_override=summary_override)

        # Generate content with structured output (Flash default)
        response = await self._generate_with_structured_output(
            prompt=prompt,
            response_schema=ShareSummaryResponse,
            temperature=0.4,
            max_output_tokens=8192,  # Increased from 2000 to prevent JSON truncation
            model_name_override=None
        )
        
        return response

    async def _generate_batched_template_summary(
        self,
        entries: List[Dict[str, Any]],
        template: Dict[str, Any],
        target_language: str,
        summary_override: Optional[str] = None
    ) -> ShareSummaryResponse:
        """Generate summary by batching questions to avoid token limits."""
        questions = template.get('questions', [])
        if not questions:
            # Return empty response if no questions
            return ShareSummaryResponse(
                answers=[],
                source_language='en',
                target_language=target_language,
                entry_count=len(entries),
                processing_notes="No questions in template"
            )
        
        # Split questions into batches of 3-4 questions each
        BATCH_SIZE = 3
        question_batches = [questions[i:i + BATCH_SIZE] for i in range(0, len(questions), BATCH_SIZE)]
        
        all_answers = []
        batch_count = len(question_batches)
        
        logger.info(f"Processing {len(questions)} questions in {batch_count} batches of up to {BATCH_SIZE} questions each")
        
        for batch_idx, question_batch in enumerate(question_batches):
            logger.info(f"Processing batch {batch_idx + 1}/{batch_count} with {len(question_batch)} questions")
            
            # Create a mini-template for this batch
            batch_template = {
                'template_id': template.get('template_id'),
                'name': template.get('name'),
                'version': template.get('version'),
                'questions': question_batch
            }
            
            try:
                # Generate for this batch
                batch_response = await self._generate_full_template_summary(
                    entries=entries,
                    template=batch_template,
                    target_language=target_language,
                    summary_override=summary_override
                )
                
                # Collect answers from this batch
                all_answers.extend(batch_response.answers)
                
            except Exception as e:
                logger.error(f"Failed to process batch {batch_idx + 1}: {e}")
                
                # Create fallback answers for this batch
                for question in question_batch:
                    q_raw = question.get('text')
                    if isinstance(q_raw, dict):
                        q_text = q_raw.get(target_language) or q_raw.get('en') or 'No question text'
                    else:
                        q_text = q_raw or 'No question text'
                    
                    fallback_answer = QuestionAnswer(
                        question_id=question.get('id', 'unknown'),
                        question_text=q_text,
                        answer=f"Unable to generate answer due to processing error: {str(e)[:100]}",
                        confidence=0.0,
                        source_entries=None
                    )
                    all_answers.append(fallback_answer)
        
        # Combine all batch results into final response
        return ShareSummaryResponse(
            answers=all_answers,
            source_language='en',  # Default, could be improved with detection
            target_language=target_language,
            entry_count=len(entries),
            processing_notes=f"Generated using batching ({batch_count} batches)"
        )

    def _inline_definitions(self, schema: Dict[str, Any], defs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Inline $defs references in the schema for Gemini compatibility
        """
        def replace_refs(obj):
            if isinstance(obj, dict):
                if '$ref' in obj:
                    ref_path = obj['$ref']
                    if ref_path.startswith('#/$defs/'):
                        def_name = ref_path.split('/')[-1]
                        if def_name in defs:
                            return replace_refs(defs[def_name])
                return {k: replace_refs(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [replace_refs(item) for item in obj]
            return obj
        
        return replace_refs(schema)

    def _prune_schema_keywords(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Remove JSON Schema keywords not supported by Gemini structured output.
        Currently prunes: title, description, examples, default, $schema, $id, minimum, maximum, anyOf, oneOf, allOf, not
        """
        unsupported_keys = {"title", "description", "examples", "default", "$schema", "$id", "minimum", "maximum", "anyOf", "oneOf", "allOf", "not"}

        def prune(obj: Any) -> Any:
            if isinstance(obj, dict):
                return {k: prune(v) for k, v in obj.items() if k not in unsupported_keys}
            if isinstance(obj, list):
                return [prune(v) for v in obj]
            return obj

        return prune(schema)

    def _remove_schema_combinators(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Replace anyOf/oneOf/allOf patterns with a single non-null subschema where possible.
        This is required because Gemini's structured output does not support JSON Schema combinators.
        """
        def is_null_schema(obj: Any) -> bool:
            if isinstance(obj, dict):
                t = obj.get("type")
                if t == "null":
                    return True
                # Some schemas express nullability as {"type": ["string","null"]}
                if isinstance(t, list) and "null" in t:
                    return True
            return False

        def pick_non_null(options: List[Any]) -> Any:
            for opt in options:
                if not is_null_schema(opt):
                    return opt
            return options[0] if options else {}

        def transform(obj: Any) -> Any:
            if isinstance(obj, dict):
                # Flatten type arrays like ["string","null"] to single non-null type
                if isinstance(obj.get("type"), list):
                    types = [t for t in obj["type"] if t != "null"]
                    obj["type"] = types[0] if types else obj["type"][0]

                if "anyOf" in obj:
                    chosen = pick_non_null(obj["anyOf"]) 
                    return transform(chosen)
                if "oneOf" in obj:
                    chosen = pick_non_null(obj["oneOf"]) 
                    return transform(chosen)
                if "allOf" in obj:
                    # Conservative: take the first element
                    chosen = obj["allOf"][0] if obj["allOf"] else {}
                    return transform(chosen)

                return {k: transform(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [transform(v) for v in obj]
            return obj

        return transform(schema)

    def _create_qa_generation_prompt(
        self,
        entries: List[Dict[str, Any]],
        template: Dict[str, Any],
        target_language: str,
        summary_override: Optional[str] = None
    ) -> str:
        """Create optimized prompt for Q&A generation with structured output"""
        
        # Prepare entries text (limit content to avoid token limits)
        entries_text = ""
        if summary_override:
            entries_text = f"SUMMARY OF ENTRIES (model generated):\n{summary_override}\n\n"
        else:
            for i, entry in enumerate(entries[:20]):  # Limit to 20 entries
                content = entry.get('content', '')
                if len(content) > 500:  # Truncate long entries
                    content = content[:500] + "..."
                entries_text += f"Entry {i+1} ({entry.get('entry_date', 'unknown date')}):\n{content}\n\n"

        # Prepare questions
        questions_text = ""
        for question in template.get('questions', []):
            q_raw = question.get('text')
            if isinstance(q_raw, dict):
                q_text = q_raw.get(target_language) or q_raw.get('en') or 'No question text'
            else:
                q_text = q_raw or 'No question text'
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
3. Generate a concise, helpful answer (50-100 words) based on the entries
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

    async def _summarize_entries(self, entries: List[Dict[str, Any]], target_language: str) -> str:
        """Summarize a large set of entries into a concise bullet list for downstream QA."""
        try:
            # Lightweight instruction, JSON not required
            joined_text = "\n\n".join(
                [
                    f"[{e.get('entry_date','unknown')}] { (e.get('content') or '')[:800] }"
                    for e in entries[:50]
                ]
            )
            prompt = (
                "You are a helpful assistant. Summarize the following journal entries into a concise bullet list "
                f"in {target_language}. Focus on symptoms, mood, activities, notable events, and any health-related mentions.\n\n"
                f"ENTRIES:\n{joined_text}"
            )
            # Use Flash for speed, plain text output
            if self.vertex_backend:
                model = self.model
                response = await asyncio.to_thread(
                    model.generate_content,
                    prompt,
                    generation_config=VertexGenerationConfig(
                        temperature=0.3,
                        max_output_tokens=800,
                    ),
                )
            else:
                model = self.model
                response = await asyncio.to_thread(
                    model.generate_content,
                    prompt,
                    generation_config=genai.GenerationConfig(
                        temperature=0.3,
                        max_output_tokens=800,
                    ),
                )
            return (response.text or "").strip()
        except Exception as e:
            logger.warning(f"Entry summarization failed, proceeding without summary: {e}")
            return ""

    async def _maybe_escalate_low_confidence(
        self,
        original: ShareSummaryResponse,
        entries: List[Dict[str, Any]],
        template: Dict[str, Any],
        target_language: str,
        summary_override: Optional[str]
    ) -> ShareSummaryResponse:
        """Escalate low-confidence answers to gemini-2.5-pro on a per-question basis."""
        try:
            CONF_THRESHOLD = 0.6
            MAX_ESCALATIONS = 3
            low_confidence = [qa for qa in original.answers if qa.confidence is not None and qa.confidence < CONF_THRESHOLD]
            if not low_confidence:
                return original
            to_refine = low_confidence[:MAX_ESCALATIONS]

            refined_answers: Dict[str, QuestionAnswer] = {}
            for qa in to_refine:
                single_prompt = self._create_single_question_prompt(
                    entries=entries, question_id=qa.question_id, question_text=qa.question_text or "", target_language=target_language, summary_override=summary_override
                )
                # Use the same schema but expect a single answer wrapper
                class SingleAnswerResponse(BaseModel):
                    question_id: str
                    question_text: str
                    answer: str
                    confidence: float
                    source_entries: Optional[List[str]] = None

                result = await self._generate_with_structured_output(
                    prompt=single_prompt,
                    response_schema=SingleAnswerResponse,
                    temperature=0.3,
                    max_output_tokens=2048,  # Increased from 800 for Pro model
                    model_name_override='gemini-2.5-pro'
                )
                refined_answers[qa.question_id] = QuestionAnswer(
                    question_id=result.question_id,
                    question_text=result.question_text,
                    answer=result.answer,
                    confidence=result.confidence,
                    source_entries=result.source_entries,
                )

            # Merge
            merged = []
            for qa in original.answers:
                merged.append(refined_answers.get(qa.question_id, qa))

            return ShareSummaryResponse(
                answers=merged,
                source_language=original.source_language,
                target_language=original.target_language,
                entry_count=original.entry_count,
                processing_notes=(original.processing_notes or "") + (" | escalated low-confidence answers" if refined_answers else "")
            )
        except Exception as e:
            logger.warning(f"Escalation step failed, returning original answers: {e}")
            return original

    def _create_single_question_prompt(
        self,
        entries: List[Dict[str, Any]],
        question_id: str,
        question_text: str,
        target_language: str,
        summary_override: Optional[str]
    ) -> str:
        # Prepare entries text
        entries_text = ""
        if summary_override:
            entries_text = f"SUMMARY OF ENTRIES (model generated):\n{summary_override}\n\n"
        else:
            for i, entry in enumerate(entries[:20]):
                content = entry.get('content', '')
                if len(content) > 800:
                    content = content[:800] + "..."
                entries_text += f"Entry {i+1} ({entry.get('entry_date','unknown date')}):\n{content}\n\n"

        prompt = f"""
You are a careful assistant. Answer the SINGLE question below based strictly on the journal entries.

JOURNAL ENTRIES:
{entries_text}

QUESTION:
- {question_id}: {question_text}

INSTRUCTIONS:
1. Provide a concise answer (up to 100 words) in {target_language}.
2. If there is insufficient information, answer "Unknown" and set confidence near 0.0.
3. Return valid JSON ONLY that matches the expected schema.
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
