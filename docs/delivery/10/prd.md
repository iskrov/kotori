# PBI-10: Template-Based Journal Sharing with Multi-Language Support

## Overview

Enable users to share summaries of their journal entries with caregivers, clinicians, or family members using template-based questions, with automatic translation to any language. The shared content will be explicitly non-encrypted (with user consent) and can be exported as PDF or sent via email.

## Problem Statement

Users need to share relevant journal information with their care team or loved ones in a structured, understandable format. Current challenges include:
- Language barriers between users and caregivers
- Difficulty extracting relevant information from free-form journal entries
- No standardized format for sharing mental health or wellness updates
- Privacy concerns about what information is shared

## User Stories

1. **As a user**, I want to select recent journal entries and generate a summary based on template questions, so I can share relevant information with my care team.

2. **As a user**, I want to preview and edit the generated summary before sharing, so I have full control over what information is disclosed.

3. **As a user**, I want to export the summary as a PDF or send it via email, so I can share through my preferred communication channel.

4. **As a caregiver**, I want to receive structured summaries in my preferred language, so I can better understand and support the user.

## Technical Approach

### Architecture Overview
```
User Device                      Backend                              External Services
-----------                      -------                              -----------------
[Decrypt entries]         →    [Template API]                    
[Select timeframe]        →    [Gemini Service]                →    [Google Gemini API]
[Choose or Import form]   →    [Template Extractor]            →    [Google Gemini API]
[Preview/Edit]            →    [PDF Generator]                  →    [PDF Library]
[Confirm share]           →    [Email Service]                  →    [SendGrid API]
                           
Optional (for future OCR scope):
[Upload scan/image]       →    [OCR (Vision API/Tesseract)]    →    [Text] → [Template Extractor]
```

### Key Components

1. **Template System**
   - Predefined question templates (mental health, medical visit, daily wellness)
   - Template storage in backend (JSON format initially)
   - Template versioning for consistency

2. **Gemini Integration**
   - Map journal entries to template questions
   - Generate concise, relevant answers
   - Translate to target language
   - Maintain context and nuance across languages

3. **Share Generation Flow**
   - Client decrypts selected entries locally
   - User explicitly consents to non-encrypted sharing
   - Backend processes with Gemini
   - User previews and edits results
   - Final artifact stored temporarily (7-day TTL)

4. **Export Options**
   - PDF generation with clean formatting
   - Native share sheet integration (iOS/Android/Web)
   - Optional email sending via SendGrid

5. **Imported Templates from Files**
   - Users can upload structured documents (PDF/DOCX) containing surveys/forms
   - Backend parses text and uses Gemini to extract a strict JSON template (questions, types, options)
   - User previews/edits extracted questions before generating answers
   - MVP supports digital PDFs/DOCX (no OCR); OCR for scans/images is a follow-up PBI

## UX/UI Considerations

### Share Flow
1. **Entry Point**: "Share Summary" button on Journal screen
2. **Configuration Screen**:
   - Date range selector (last week, last month, custom)
   - Template selector (dropdown with descriptions) or "Import template from file"
   - Target language selector
   - Recipient info (optional, for email)
   - File upload (PDF/DOCX) when importing a form
3. **Processing Screen**: 
   - Loading state with progress indicator
   - "Generating summary..." message
   - When importing, steps include: "Parsing document → Extracting questions with AI"
4. **Preview Screen**:
   - Editable text fields for each Q&A pair
   - Language toggle to see original/translated
   - Consent notice about non-encrypted sharing
   - When importing, allow editing question text/order/types before answering
5. **Share Screen**:
   - Download PDF button
   - Send via email button (if configured)
   - Copy link button (for future use)
   - Success confirmation

### Visual Design
- Maintain calm, low-stimulation aesthetic
- Clear consent messaging with info icon
- Teal accent for action buttons
- Soft shadows on cards
- WCAG AA compliant contrast

## Acceptance Criteria

### Functional Requirements
- [ ] User can select journal entries from a date range
- [ ] At least 3 predefined templates available (wellness check, medical visit, mood tracking)
- [ ] Gemini successfully maps entries to template questions in 90%+ of cases
- [ ] Translation maintains meaning across supported languages
- [ ] User can edit all generated content before sharing
- [ ] PDF generation works on all platforms
- [ ] Email sending works when configured (optional)
- [ ] Shared content has 7-day TTL by default
- [ ] Users can upload a PDF or DOCX of a questionnaire to auto-extract a template with Gemini (clean digital docs)
- [ ] Extracted template is shown for review/edit before use
- [ ] If extraction fails, user gets a clear error and can fall back to predefined templates

### Non-Functional Requirements
- [ ] Gemini processing completes in <10 seconds for typical use
- [ ] PDF generation completes in <3 seconds
- [ ] Clear consent UI that shared data is not encrypted
- [ ] No PII logged in backend except for audit trail
- [ ] Rate limiting: max 10 shares per user per day
- [ ] Accessibility: screen reader compatible, keyboard navigable
- [ ] Template extraction from PDF/DOCX completes in <10 seconds for typical (≤5 pages) digital documents
- [ ] Upload size limit enforced (e.g., 5–10 MB) with friendly error messages

### Security Requirements
- [ ] Explicit user consent before sending data to Gemini
- [ ] Shared artifacts use signed tokens for access control
- [ ] Audit logging for all share operations
- [ ] Data retention policy clearly communicated
- [ ] No automatic sharing without user action
- [ ] Uploaded files stored ephemerally and deleted after processing (≤24h)
- [ ] Content scanning/validation to prevent malicious payloads (basic MIME/type checks)

## Dependencies

### External Services
- Google Gemini API (for LLM processing)
- SendGrid or similar (for email, optional)
- PDF generation library (e.g., jsPDF for frontend or puppeteer for backend)
 - (Future OCR) Cloud Vision API or Tesseract for scanned forms

### Internal Dependencies
- Existing journal entry encryption/decryption
- Authentication system
- GCP infrastructure (Secret Manager for API keys)

## Open Questions

1. MVP supports predefined templates and file import for clean PDFs/DOCX; should we add end-user saved custom templates now or later?
2. What's the preferred PDF library for React Native + Web compatibility?
3. Should email configuration be user-specific or app-wide?
4. Do we need share analytics in MVP?
5. Acceptable file types/sizes for import? Any HIPAA/GDPR constraints for medical forms?
6. Do we need OCR support in MVP, or plan as separate PBI (recommended)?

## Success Metrics

- User engagement: 20% of active users try sharing within first month
- Completion rate: 80% of started shares are completed
- User satisfaction: 4+ star rating for sharing feature
- Performance: 95% of shares complete in <15 seconds total

## Related Tasks

See [Tasks](./tasks.md) for the original task breakdown.
See [Updated Tasks](./tasks_updated.md) for the comprehensive implementation plan including frontend.

### Implementation Status
- **Backend Tasks (10-1 to 10-4, 10-9)**: ✅ COMPLETED
- **Frontend Tasks (10-10 to 10-20)**: 📋 PLANNED & READY

The backend infrastructure is fully implemented and production-ready. Frontend tasks have been carefully designed to minimize changes to the existing app while providing a seamless sharing experience through a single "Share" button addition to the bottom navigation.

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini API costs | High | Implement caching, rate limiting, prompt optimization |
| Poor translation quality | Medium | User preview/edit, feedback mechanism |
| PII exposure | High | Explicit consent, audit logs, data retention limits |
| Platform PDF issues | Medium | Fallback to HTML export, server-side generation |

## Timeline

Target: 2 weeks (10 business days) from start to MVP launch

- Week 1: Backend services, Gemini integration, templates, file import (PDF/DOCX) extraction flow
- Week 2: Frontend UI, PDF generation, testing, deployment

[View in Backlog](../backlog.md#user-content-10)
