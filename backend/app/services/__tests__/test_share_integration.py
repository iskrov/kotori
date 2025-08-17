"""
Integration tests for share functionality including Gemini AI summary generation.
This test validates the complete end-to-end sharing workflow.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.services.share_service import ShareService
from app.services.gemini_service import GeminiService
from app.models.journal_entry import JournalEntry
from app.models.share import Share
from app.models.share_template import ShareTemplate


class TestShareIntegration:
    """Integration tests for share functionality."""

    @pytest.fixture
    def sample_journal_entries(self) -> List[Dict[str, Any]]:
        """Create sample journal entries for testing."""
        base_date = datetime.now() - timedelta(days=7)
        return [
            {
                "id": "entry-1",
                "content": "Today I felt anxious about work. The presentation went well though.",
                "mood": "anxious",
                "energy_level": 6,
                "created_at": base_date,
                "tags": ["work", "anxiety", "presentation"]
            },
            {
                "id": "entry-2", 
                "content": "Had a great day with friends. Feeling much better and more optimistic.",
                "mood": "happy",
                "energy_level": 8,
                "created_at": base_date + timedelta(days=1),
                "tags": ["friends", "social", "optimistic"]
            },
            {
                "id": "entry-3",
                "content": "Struggled with sleep again. Feeling tired and unmotivated.",
                "mood": "tired",
                "energy_level": 3,
                "created_at": base_date + timedelta(days=2),
                "tags": ["sleep", "tired", "low-energy"]
            },
            {
                "id": "entry-4",
                "content": "Productive day at work. Completed the project milestone successfully.",
                "mood": "accomplished",
                "energy_level": 7,
                "created_at": base_date + timedelta(days=3),
                "tags": ["work", "productive", "milestone"]
            },
            {
                "id": "entry-5",
                "content": "Feeling grateful for my support system. Family dinner was wonderful.",
                "mood": "grateful",
                "energy_level": 8,
                "created_at": base_date + timedelta(days=4),
                "tags": ["family", "grateful", "support"]
            }
        ]

    @pytest.fixture
    def wellness_template(self) -> Dict[str, Any]:
        """Create a wellness check template for testing."""
        return {
            "template_id": "wellness-check-v1",
            "name": "Regular Wellness Check",
            "description": "A comprehensive wellness assessment",
            "questions": [
                "How has your overall mood been this week?",
                "What activities brought you the most joy?", 
                "What challenges did you face and how did you handle them?",
                "How would you rate your energy levels?",
                "What are you most grateful for right now?"
            ]
        }

    @pytest.fixture
    def gemini_service(self) -> GeminiService:
        """Create GeminiService instance."""
        return GeminiService()

    @pytest.fixture
    def share_service(self, gemini_service) -> ShareService:
        """Create ShareService instance with GeminiService."""
        return ShareService(gemini_service=gemini_service)

    @pytest.mark.asyncio
    async def test_gemini_service_initialization(self, gemini_service):
        """Test that GeminiService initializes correctly in production environment."""
        # This test verifies that the service can initialize without throwing errors
        assert gemini_service is not None
        
        # Check if client initialization works
        try:
            gemini_service.initialize_client()
            # If we get here without exception, initialization succeeded
            assert True
        except Exception as e:
            pytest.fail(f"GeminiService initialization failed: {e}")

    @pytest.mark.asyncio
    async def test_share_generation_with_real_gemini(self, share_service, sample_journal_entries, wellness_template):
        """Test complete share generation workflow with real Gemini API."""
        # Prepare the share request
        share_request = {
            "entries": sample_journal_entries,
            "template": wellness_template,
            "period": "weekly",
            "target_language": "en-CA",
            "consent_acknowledged": True
        }
        
        try:
            # Generate the share
            result = await share_service.generate_share(
                entries=share_request["entries"],
                template_id=share_request["template"]["template_id"],
                period=share_request["period"],
                target_language=share_request["target_language"],
                consent_acknowledged=share_request["consent_acknowledged"]
            )
            
            # Validate the result
            assert result is not None
            assert "share_id" in result
            assert "summary" in result
            assert "answers" in result
            
            # Validate the summary structure
            summary = result["summary"]
            assert isinstance(summary, dict)
            assert "questions" in summary
            assert isinstance(summary["questions"], list)
            assert len(summary["questions"]) > 0
            
            # Validate each question has required fields
            for question in summary["questions"]:
                assert "question" in question
                assert "answer" in question
                assert isinstance(question["question"], str)
                assert isinstance(question["answer"], str)
                assert len(question["answer"]) > 0
                
            print(f"✅ Share generation successful! Share ID: {result['share_id']}")
            print(f"✅ Generated {len(summary['questions'])} Q&A pairs")
            
        except Exception as e:
            # Print detailed error information for debugging
            print(f"❌ Share generation failed: {e}")
            
            # Check if it's a permission error
            if "403" in str(e) or "Permission" in str(e):
                pytest.fail(f"Permission error - check GCP IAM roles: {e}")
            elif "aiplatform.endpoints.predict" in str(e):
                pytest.fail(f"Vertex AI prediction permission denied: {e}")
            else:
                pytest.fail(f"Unexpected error during share generation: {e}")

    @pytest.mark.asyncio
    async def test_gemini_service_direct_call(self, gemini_service, sample_journal_entries, wellness_template):
        """Test GeminiService directly to isolate Gemini API issues."""
        try:
            # Test direct Gemini service call
            result = await gemini_service.generate_share_summary(
                entries=sample_journal_entries,
                template=wellness_template,
                target_language="en-CA"
            )
            
            # Validate the result
            assert result is not None
            assert hasattr(result, 'answers')
            assert isinstance(result.answers, list)
            assert len(result.answers) > 0
            
            # Validate structure
            for qa in result.answers:
                assert hasattr(qa, 'question_text')
                assert hasattr(qa, 'answer')
                assert isinstance(qa.question_text, str)
                assert isinstance(qa.answer, str)
                
            print(f"✅ Direct Gemini call successful! Generated {len(result.answers)} Q&A pairs")
            
        except Exception as e:
            print(f"❌ Direct Gemini call failed: {e}")
            
            # Provide specific error guidance
            if "403" in str(e):
                pytest.fail(f"Gemini API permission error - check service account roles: {e}")
            elif "API key" in str(e).lower():
                pytest.fail(f"Gemini API key configuration error: {e}")
            elif "aiplatform" in str(e):
                pytest.fail(f"Vertex AI configuration error: {e}")
            else:
                pytest.fail(f"Unexpected Gemini service error: {e}")

    @pytest.mark.asyncio
    async def test_share_template_processing(self, wellness_template):
        """Test that share templates are processed correctly."""
        # Validate template structure
        assert "template_id" in wellness_template
        assert "name" in wellness_template
        assert "questions" in wellness_template
        assert isinstance(wellness_template["questions"], list)
        assert len(wellness_template["questions"]) > 0
        
        # Validate each question is a non-empty string
        for question in wellness_template["questions"]:
            assert isinstance(question, str)
            assert len(question.strip()) > 0
            
        print(f"✅ Template validation successful: {wellness_template['name']}")
        print(f"✅ Template has {len(wellness_template['questions'])} questions")


if __name__ == "__main__":
    """
    Run this test directly to quickly check Gemini functionality:
    
    cd backend
    python -m pytest app/services/__tests__/test_share_integration.py -v -s
    """
    import sys
    import os
    
    # Add the backend directory to the path
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    
    # Run the tests
    pytest.main([__file__, "-v", "-s"])
