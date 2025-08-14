import pytest
import os
from unittest.mock import Mock, patch, MagicMock
from backend.app.services.gemini_service import GeminiService, GeminiError


class TestGeminiService:
    """Test cases for GeminiService authentication methods"""

    @patch('backend.app.services.gemini_service.genai')
    @patch('backend.app.services.gemini_service.service_account')
    @patch('backend.app.services.gemini_service.settings')
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

    @patch('backend.app.services.gemini_service.genai')
    @patch('backend.app.services.gemini_service.settings')
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

    @patch('backend.app.services.gemini_service.genai')
    @patch('backend.app.services.gemini_service.settings')
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

    @patch('backend.app.services.gemini_service.genai')
    @patch('backend.app.services.gemini_service.service_account')
    @patch('backend.app.services.gemini_service.settings')
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

    @patch('backend.app.services.gemini_service.genai')
    @patch('backend.app.services.gemini_service.service_account')
    @patch('backend.app.services.gemini_service.settings')
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

    @patch('backend.app.services.gemini_service.genai')
    @patch('backend.app.services.gemini_service.settings')
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
        with patch('backend.app.services.gemini_service.settings') as mock_settings:
            mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "../.keys/kotori-gemini-keys.json"
            
            with patch('os.path.exists', return_value=False):
                credentials = service._get_credentials()
                assert credentials is None  # Should return None when file doesn't exist

    @patch('backend.app.services.gemini_service.service_account')
    def test_service_account_scopes(self, mock_service_account):
        """Test that correct scopes are used for service account credentials"""
        service = GeminiService()
        
        with patch('backend.app.services.gemini_service.settings') as mock_settings:
            mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "../.keys/kotori-gemini-keys.json"
            
            with patch('os.path.exists', return_value=True):
                service._get_credentials()
                
                # Verify correct scopes are used
                mock_service_account.Credentials.from_service_account_file.assert_called_once()
                call_args = mock_service_account.Credentials.from_service_account_file.call_args
                assert call_args[1]['scopes'] == ['https://www.googleapis.com/auth/generative-language']
