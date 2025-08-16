import pytest
import os
from unittest.mock import Mock, patch, MagicMock
import json
import base64
from app.services.gemini_service import GeminiService, GeminiError
from pydantic import BaseModel
import asyncio


class TestGeminiService:
    """Test cases for GeminiService authentication methods"""

    @patch('app.services.gemini_service.genai')
    @patch('app.services.gemini_service.service_account')
    @patch('app.services.gemini_service.settings')
    def test_initialize_with_service_account_credentials(self, mock_settings, mock_service_account, mock_genai):
        """Test initialization with service account credentials"""
        # Setup
        mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "../.keys/kotori-gemini-keys.json"
        mock_settings.GEMINI_API_KEY = None
        
        mock_credentials = Mock()
        mock_service_account.Credentials.from_service_account_file.return_value = mock_credentials
        
        mock_model = Mock()
        mock_genai.GenerativeModel.return_value = mock_model
        
        # Mock file existence
        with patch('os.path.exists', return_value=True):
            # Execute
            service = GeminiService()
            
            # Verify
            mock_genai.configure.assert_called_once_with(credentials=mock_credentials)
            mock_genai.GenerativeModel.assert_called_once_with('gemini-2.5-flash')
            assert service.model == mock_model

    @patch('app.services.gemini_service.genai')
    @patch('app.services.gemini_service.settings')
    def test_initialize_with_api_key_fallback(self, mock_settings, mock_genai):
        """Test fallback to API key when service account is not available"""
        # Setup
        mock_settings.GOOGLE_APPLICATION_CREDENTIALS = None
        mock_settings.GEMINI_API_KEY = "test-api-key"
        
        mock_model = Mock()
        mock_genai.GenerativeModel.return_value = mock_model
        
        # Execute
        service = GeminiService()
        
        # Verify
        mock_genai.configure.assert_called_once_with(api_key="test-api-key")
        mock_genai.GenerativeModel.assert_called_once_with('gemini-2.5-flash')
        assert service.model == mock_model

    @patch('app.services.gemini_service.genai')
    @patch('app.services.gemini_service.settings')
    def test_initialize_with_no_credentials(self, mock_settings, mock_genai):
        """Test initialization when no credentials are available"""
        # Setup
        mock_settings.GOOGLE_APPLICATION_CREDENTIALS = None
        mock_settings.GEMINI_API_KEY = None
        
        # Execute
        service = GeminiService()
        
        # Verify
        mock_genai.configure.assert_not_called()
        mock_genai.GenerativeModel.assert_not_called()
        assert service.model is None

    @patch('app.services.gemini_service.genai')
    @patch('app.services.gemini_service.service_account')
    @patch('app.services.gemini_service.settings')
    def test_service_account_file_not_found(self, mock_settings, mock_service_account, mock_genai):
        """Test handling when service account file doesn't exist"""
        # Setup
        mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "../.keys/missing-file.json"
        mock_settings.GEMINI_API_KEY = "fallback-api-key"
        
        mock_model = Mock()
        mock_genai.GenerativeModel.return_value = mock_model
        
        # Mock file doesn't exist
        with patch('os.path.exists', return_value=False):
            # Execute
            service = GeminiService()
            
            # Verify fallback to API key
            mock_service_account.Credentials.from_service_account_file.assert_not_called()
            mock_genai.configure.assert_called_once_with(api_key="fallback-api-key")

    @patch('app.services.gemini_service.genai')
    @patch('app.services.gemini_service.service_account')
    @patch('app.services.gemini_service.settings')
    def test_service_account_loading_error(self, mock_settings, mock_service_account, mock_genai):
        """Test handling when service account loading fails"""
        # Setup
        mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "../.keys/kotori-gemini-keys.json"
        mock_settings.GEMINI_API_KEY = "fallback-api-key"
        
        mock_service_account.Credentials.from_service_account_file.side_effect = Exception("Invalid credentials")
        
        mock_model = Mock()
        mock_genai.GenerativeModel.return_value = mock_model
        
        # Mock file exists
        with patch('os.path.exists', return_value=True):
            # Execute
            service = GeminiService()
            
            # Verify fallback to API key
            mock_genai.configure.assert_called_once_with(api_key="fallback-api-key")

    @patch('app.services.gemini_service.genai')
    @patch('app.services.gemini_service.settings')
    def test_gemini_initialization_error(self, mock_settings, mock_genai):
        """Test handling of Gemini initialization errors"""
        # Setup
        mock_settings.GOOGLE_APPLICATION_CREDENTIALS = None
        mock_settings.GEMINI_API_KEY = "test-api-key"
        
        mock_genai.configure.side_effect = Exception("API key invalid")
        
        # Execute & Verify
        with pytest.raises(GeminiError, match="Gemini initialization failed"):
            GeminiService()

    def test_credentials_path_resolution(self):
        """Test that credentials path is resolved correctly"""
        # This test verifies the path resolution logic matches speech_service.py
        service = GeminiService()
        
        # Mock the settings and file system
        with patch('app.services.gemini_service.settings') as mock_settings:
            mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "../.keys/kotori-gemini-keys.json"
            
            with patch('os.path.exists', return_value=False):
                credentials = service._get_credentials()
                assert credentials is None  # Should return None when file doesn't exist

    @patch('app.services.gemini_service.service_account')
    def test_service_account_scopes(self, mock_service_account):
        """Test that correct scopes are used for service account credentials"""
        service = GeminiService()
        
        with patch('app.services.gemini_service.settings') as mock_settings:
            mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "../.keys/kotori-gemini-keys.json"
            
            with patch('os.path.exists', return_value=True):
                service._get_credentials()
                
                # Verify a call was made with the expected scopes at least once
                expected_scope = ['https://www.googleapis.com/auth/cloud-platform']
                calls = mock_service_account.Credentials.from_service_account_file.call_args_list
                matched = False
                for c in calls:
                    args, kwargs = c
                    if kwargs.get('scopes') == expected_scope:
                        matched = True
                        break
                assert matched, f"Expected a call with scopes {expected_scope}, got: {calls}"

    @pytest.mark.asyncio
    async def test_vertex_structured_output_without_text_raises(self):
        """When using Vertex with structured output, response.text may be unavailable; ensure we surface a clear error."""
        service = GeminiService()
        # Force Vertex path
        service.vertex_backend = True
        # Mock model to return a response without .text
        class NoTextResponse:
            @property
            def text(self):
                raise Exception("Cannot get the response text")
        model = MagicMock()
        model.generate_content.return_value = NoTextResponse()
        service.model = model

        class DummySchema(BaseModel):
            foo: str

        with pytest.raises(GeminiError, match="API call failed: Cannot get the response text"):
            await service._generate_with_structured_output(
                prompt="test",
                response_schema=DummySchema,
                temperature=0.1,
                max_output_tokens=10,
            )

    @pytest.mark.asyncio
    async def test_vertex_structured_output_from_candidates_parts_text(self):
        """Simulate Vertex response where JSON appears in candidates[0].content.parts[0].text."""
        service = GeminiService()
        service.vertex_backend = True

        class Part:
            def __init__(self, text):
                self.text = text

        class Content:
            def __init__(self, parts):
                self.parts = parts

        class Candidate:
            def __init__(self, content):
                self.content = content

        class Resp:
            def __init__(self, candidates):
                self.candidates = candidates

        payload = {"foo": "bar"}
        json_text = json.dumps(payload)
        resp = Resp([Candidate(Content([Part(json_text)]))])

        model = MagicMock()
        model.generate_content.return_value = resp
        service.model = model

        class DummySchema(BaseModel):
            foo: str

        result = await service._generate_with_structured_output(
            prompt="test",
            response_schema=DummySchema,
            temperature=0.1,
            max_output_tokens=10,
        )
        assert result.foo == "bar"

    @pytest.mark.asyncio
    async def test_vertex_structured_output_from_inline_data_base64(self):
        """Simulate Vertex response where JSON is in inline_data base64 with JSON mime type."""
        service = GeminiService()
        service.vertex_backend = True

        class Inline:
            def __init__(self, mime_type, data):
                self.mime_type = mime_type
                self.data = data

        class Part:
            def __init__(self, inline_data):
                self.inline_data = inline_data

        class Content:
            def __init__(self, parts):
                self.parts = parts

        class Candidate:
            def __init__(self, content):
                self.content = content

        class Resp:
            def __init__(self, candidates):
                self.candidates = candidates

        payload = {"foo": "baz"}
        data_b64 = base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
        resp = Resp([Candidate(Content([Part(Inline("application/json", data_b64))]))])

        model = MagicMock()
        model.generate_content.return_value = resp
        service.model = model

        class DummySchema(BaseModel):
            foo: str

        result = await service._generate_with_structured_output(
            prompt="test",
            response_schema=DummySchema,
            temperature=0.1,
            max_output_tokens=10,
        )
        assert result.foo == "baz"

    @pytest.mark.asyncio
    async def test_max_tokens_triggers_batching_fallback(self):
        """Test that MAX_TOKENS finish_reason triggers batching fallback in generate_share_summary."""
        service = GeminiService()
        service.vertex_backend = True

        # Mock a response that indicates MAX_TOKENS
        class MaxTokensCandidate:
            def __init__(self):
                self.finish_reason = "MAX_TOKENS"

        class MaxTokensResponse:
            def __init__(self):
                self.candidates = [MaxTokensCandidate()]
                self.usage_metadata = None

        # Mock the _generate_full_template_summary to fail with MAX_TOKENS first, then succeed on batches
        call_count = 0
        
        async def mock_generate_full(entries, template, target_language, summary_override=None):
            nonlocal call_count
            call_count += 1
            
            if call_count == 1:
                # First call (full template) fails with MAX_TOKENS
                response = MaxTokensResponse()
                service._check_finish_reason_and_log_usage(response)
                # This should raise GeminiMaxTokensError
                return None
            else:
                # Subsequent calls (batches) succeed
                from app.services.gemini_service import ShareSummaryResponse, QuestionAnswer
                return ShareSummaryResponse(
                    answers=[
                        QuestionAnswer(
                            question_id=f"q{call_count}",
                            question_text="Test question",
                            answer="Test answer",
                            confidence=0.8
                        )
                    ],
                    source_language="en",
                    target_language=target_language,
                    entry_count=len(entries),
                    processing_notes="Batch test"
                )

        service._generate_full_template_summary = mock_generate_full

        # Create test data
        entries = [{"content": "test entry", "entry_date": "2024-01-01"}]
        template = {
            "template_id": "test-template",
            "questions": [
                {"id": "q1", "text": {"en": "Question 1"}},
                {"id": "q2", "text": {"en": "Question 2"}},
                {"id": "q3", "text": {"en": "Question 3"}},
                {"id": "q4", "text": {"en": "Question 4"}},  # 4 questions to trigger batching
            ]
        }

        # This should trigger the batching fallback
        result = await service.generate_share_summary(entries, template, "en")
        
        # Should have succeeded with batching
        assert result is not None
        assert "batching" in result.processing_notes.lower()
        assert len(result.answers) > 0  # Should have some answers from batches
