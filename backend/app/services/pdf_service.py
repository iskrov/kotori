import logging
import io
import tempfile
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

logger = logging.getLogger(__name__)


class PDFGenerationError(Exception):
    """Exception raised when PDF generation fails"""
    pass


class PDFService:
    """Service for generating PDF documents from share content"""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Setup custom paragraph styles for consistent formatting"""
        
        # Title style
        self.styles.add(ParagraphStyle(
            name='ShareTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            spaceAfter=20,
            textColor=colors.HexColor('#2D5A87'),  # Kotori teal-like color
            alignment=TA_CENTER
        ))
        
        # Subtitle style
        self.styles.add(ParagraphStyle(
            name='ShareSubtitle',
            parent=self.styles['Heading2'],
            fontSize=12,
            spaceAfter=12,
            textColor=colors.HexColor('#666666'),
            alignment=TA_CENTER
        ))
        
        # Question style
        self.styles.add(ParagraphStyle(
            name='Question',
            parent=self.styles['Heading3'],
            fontSize=12,
            spaceBefore=16,
            spaceAfter=8,
            textColor=colors.HexColor('#2D5A87'),
            leftIndent=0
        ))
        
        # Answer style
        self.styles.add(ParagraphStyle(
            name='Answer',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=12,
            alignment=TA_JUSTIFY,
            leftIndent=20,
            rightIndent=20,
            leading=14
        ))
        
        # Footer style
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#999999'),
            alignment=TA_CENTER,
            spaceBefore=20
        ))
        
        # Metadata style
        self.styles.add(ParagraphStyle(
            name='Metadata',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#666666'),
            spaceAfter=6
        ))

    def generate_share_pdf(
        self,
        share_content: Dict[str, Any],
        title: str,
        created_at: datetime,
        expires_at: Optional[datetime] = None
    ) -> bytes:
        """
        Generate a PDF document from share content
        
        Args:
            share_content: Share content dictionary with answers and metadata
            title: Share title
            created_at: Share creation timestamp
            expires_at: Optional expiration timestamp
            
        Returns:
            PDF document as bytes
        """
        try:
            # Create PDF in memory
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=A4,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=72,
                title=title
            )
            
            # Build document content
            story = []
            
            # Add header
            self._add_header(story, title, share_content, created_at, expires_at)
            
            # Add Q&A content
            self._add_qa_content(story, share_content)
            
            # Add footer
            self._add_footer(story, share_content, created_at)
            
            # Build PDF
            doc.build(story)
            
            # Get PDF bytes
            pdf_bytes = buffer.getvalue()
            buffer.close()
            
            logger.info(f"Generated PDF with {len(pdf_bytes)} bytes")
            return pdf_bytes
            
        except Exception as e:
            logger.error(f"Failed to generate PDF: {e}")
            raise PDFGenerationError(f"PDF generation failed: {e}")

    def _add_header(
        self,
        story: list,
        title: str,
        content: Dict[str, Any],
        created_at: datetime,
        expires_at: Optional[datetime]
    ):
        """Add header section to PDF"""
        
        # Main title
        story.append(Paragraph(title, self.styles['ShareTitle']))
        
        # Template info
        template_info = content.get('template_info', {})
        template_name = template_info.get('name', 'Unknown Template')
        template_desc = template_info.get('description', '')
        
        subtitle = f"Based on: {template_name}"
        if template_desc:
            subtitle += f" - {template_desc}"
        story.append(Paragraph(subtitle, self.styles['ShareSubtitle']))
        
        # Metadata table
        metadata_data = [
            ['Generated:', created_at.strftime('%B %d, %Y at %I:%M %p')],
            ['Language:', content.get('target_language', 'en').upper()],
            ['Entries Processed:', str(content.get('entry_count', 0))],
        ]
        
        if expires_at:
            metadata_data.append(['Expires:', expires_at.strftime('%B %d, %Y')])
        
        metadata_table = Table(metadata_data, colWidths=[1.5*inch, 4*inch])
        metadata_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        
        story.append(Spacer(1, 12))
        story.append(metadata_table)
        story.append(Spacer(1, 20))

    def _add_qa_content(self, story: list, content: Dict[str, Any]):
        """Add Q&A content to PDF"""
        
        answers = content.get('answers', [])
        
        if not answers:
            story.append(Paragraph("No content available.", self.styles['Normal']))
            return
        
        for i, qa in enumerate(answers, 1):
            question_text = qa.get('question_text', 'Question not available')
            answer_text = qa.get('answer', 'No answer provided')
            confidence = qa.get('confidence', 0.0)
            
            # Question
            question_with_number = f"Q{i}: {question_text}"
            story.append(Paragraph(question_with_number, self.styles['Question']))
            
            # Answer
            story.append(Paragraph(answer_text, self.styles['Answer']))
            
            # Confidence indicator (if low confidence)
            if confidence < 0.7:
                confidence_note = f"<i>Note: This answer has lower confidence ({confidence:.1%}). Please verify with additional information.</i>"
                story.append(Paragraph(confidence_note, self.styles['Metadata']))
            
            # Add space between Q&A pairs
            if i < len(answers):
                story.append(Spacer(1, 12))

    def _add_footer(self, story: list, content: Dict[str, Any], created_at: datetime):
        """Add footer section to PDF"""
        
        story.append(Spacer(1, 30))
        
        # Generation info
        generation_info = content.get('generation_metadata', {})
        ai_model = generation_info.get('ai_model', 'AI Assistant')
        
        footer_text = f"""
        <para align="center">
        This summary was generated by {ai_model} on {created_at.strftime('%B %d, %Y')}.<br/>
        The content is based on journal entries and should be reviewed for accuracy.<br/>
        <b>Kotori - Voice Journaling for Wellness</b>
        </para>
        """
        
        story.append(Paragraph(footer_text, self.styles['Footer']))
        
        # Privacy notice
        privacy_text = """
        <para align="center">
        <i>This document contains personal health information. Please handle with appropriate confidentiality.</i>
        </para>
        """
        
        story.append(Spacer(1, 12))
        story.append(Paragraph(privacy_text, self.styles['Footer']))

    def generate_template_pdf(self, template_data: Dict[str, Any]) -> bytes:
        """
        Generate a PDF from an imported template for preview
        
        Args:
            template_data: Template data with questions
            
        Returns:
            PDF document as bytes
        """
        try:
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=A4,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=72,
                title=f"Template: {template_data.get('name', 'Imported Template')}"
            )
            
            story = []
            
            # Title
            title = template_data.get('name', 'Imported Template')
            story.append(Paragraph(title, self.styles['ShareTitle']))
            
            # Description
            description = template_data.get('description', '')
            if description:
                story.append(Paragraph(description, self.styles['ShareSubtitle']))
            
            story.append(Spacer(1, 20))
            
            # Questions
            questions = template_data.get('questions', [])
            for i, question in enumerate(questions, 1):
                question_text = question.get('text', {}).get('en', 'Question not available')
                question_type = question.get('type', 'open')
                required = question.get('required', True)
                
                # Question title
                req_indicator = " *" if required else ""
                question_title = f"Q{i}: {question_text}{req_indicator}"
                story.append(Paragraph(question_title, self.styles['Question']))
                
                # Question type info
                type_info = f"Type: {question_type.replace('_', ' ').title()}"
                if question_type in ['single_choice', 'multi_choice'] and question.get('options'):
                    options_text = ", ".join(question['options'])
                    type_info += f" | Options: {options_text}"
                
                story.append(Paragraph(type_info, self.styles['Metadata']))
                
                # Help text
                help_text = question.get('help_text')
                if help_text:
                    story.append(Paragraph(f"<i>{help_text}</i>", self.styles['Metadata']))
                
                story.append(Spacer(1, 12))
            
            # Footer
            footer_text = f"""
            <para align="center">
            Template extracted on {datetime.now().strftime('%B %d, %Y')}<br/>
            Total Questions: {len(questions)}<br/>
            <b>Kotori - Template Import Preview</b>
            </para>
            """
            
            story.append(Spacer(1, 20))
            story.append(Paragraph(footer_text, self.styles['Footer']))
            
            doc.build(story)
            
            pdf_bytes = buffer.getvalue()
            buffer.close()
            
            return pdf_bytes
            
        except Exception as e:
            logger.error(f"Failed to generate template PDF: {e}")
            raise PDFGenerationError(f"Template PDF generation failed: {e}")


# Create service instance
pdf_service = PDFService()
