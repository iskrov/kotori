# PBI-18: User-Specific Custom Sharing Templates

[View in Backlog](../backlog.md#user-content-18)

## Overview

Enhance the sharing template system to support user-specific custom templates while maintaining the existing global system templates. This creates a hybrid architecture where users can access both system-provided templates and create their own personalized templates for sharing journal summaries.

## Problem Statement

Currently, all sharing templates are global and managed at the system level. While this ensures consistency, it limits user personalization and doesn't accommodate specific needs that individual users may have for their caregivers, healthcare providers, or support networks. Users cannot:

- Create templates tailored to their specific conditions or situations
- Customize existing templates to better fit their communication needs
- Organize templates according to their personal workflow
- Have private templates for sensitive or specialized sharing scenarios

## User Stories

### Primary User Stories
- **As a user**, I want to create my own custom sharing templates so I can tailor questions to my specific health conditions and care team needs
- **As a user**, I want to copy and modify system templates as a starting point for my personal templates
- **As a user**, I want to organize my templates separately from system templates so I can easily find and manage them
- **As a user**, I want my personal templates to remain private and not visible to other users

### Secondary User Stories
- **As a user**, I want to edit and update my personal templates as my needs change over time
- **As a user**, I want to deactivate personal templates I no longer need without losing historical shares
- **As an admin**, I want to maintain global system templates that serve as good defaults for all users

## Technical Approach

### Database Schema Changes
```sql
-- Add user ownership to templates (nullable for global templates)
ALTER TABLE share_templates ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE share_templates ADD COLUMN is_global BOOLEAN DEFAULT false NOT NULL;

-- Add indexes for performance
CREATE INDEX ix_share_templates_user_id ON share_templates(user_id);
CREATE INDEX ix_share_templates_global ON share_templates(is_global);
CREATE INDEX ix_share_templates_user_active ON share_templates(user_id, is_active) WHERE user_id IS NOT NULL;
```

### Backend Architecture
- **Hybrid Query Strategy**: Template endpoints return both global templates (`is_global=true`) and user-specific templates (`user_id=current_user.id`)
- **Template Ownership**: Global templates have `user_id=NULL` and `is_global=true`; personal templates have `user_id` set and `is_global=false`
- **Backward Compatibility**: Existing templates become global templates via migration
- **Validation**: Personal templates follow same validation rules as global templates

### API Enhancements
- **GET `/api/v1/share-templates/`**: Returns global + user templates, with `template_type` field indicating "global" or "personal"
- **POST `/api/v1/share-templates/`**: Creates personal templates (no admin requirement for personal templates)
- **POST `/api/v1/share-templates/{template_id}/copy`**: Copies existing template as personal template
- **Template Response Schema**: Add `template_type`, `is_editable` fields to distinguish template types

## UX/UI Considerations

### Template Organization
- **Section Headers**: "System Templates" and "My Templates" in template selection UI
- **Visual Distinction**: Subtle visual indicators (icons, badges) to differentiate template types
- **Template Management**: Dedicated "Manage My Templates" section in settings/profile
- **Copy Workflow**: "Customize" button on system templates to copy and edit

### Template Creation Flow
1. **Entry Points**: "Create Template" button in template list, "Customize" on system templates
2. **Template Builder**: Form-based interface for adding/editing questions with preview
3. **Question Management**: Add, remove, reorder questions with drag-and-drop
4. **Validation**: Real-time validation with helpful error messages
5. **Save Options**: Save as draft, activate immediately, test with sample data

### Mobile Considerations
- **Responsive Design**: Template management works well on mobile devices
- **Touch Interactions**: Large tap targets for template selection and management
- **Progressive Disclosure**: Collapsible sections for better mobile navigation

## Acceptance Criteria

### Core Functionality
- [ ] Users can create personal sharing templates with custom questions
- [ ] Users can copy system templates and modify them as personal templates
- [ ] Template selection UI clearly distinguishes between system and personal templates
- [ ] Personal templates are private to the creating user
- [ ] System templates remain available to all users unchanged

### Data Integrity
- [ ] Existing shares continue working with their original templates
- [ ] Database migration preserves all existing template data
- [ ] Template IDs remain unique across global and personal templates
- [ ] Soft deletion preserves template references for historical shares

### User Experience
- [ ] Template management interface is intuitive and accessible
- [ ] Template creation flow includes validation and preview functionality
- [ ] Users can edit, deactivate, and reactivate their personal templates
- [ ] Clear visual distinction between template types throughout the UI

### Performance & Security
- [ ] Template queries perform efficiently with proper indexing
- [ ] Personal templates are properly isolated between users
- [ ] API endpoints include appropriate authorization checks
- [ ] Template validation prevents malformed or malicious content

## Dependencies

- **Prerequisite**: PBI-10 (sharing feature) must be completed and stable
- **Database Migration**: Requires careful migration to add new columns without downtime
- **Frontend Dependency**: Requires updates to sharing screens and template management UI
- **Testing Dependency**: Comprehensive testing of hybrid template system

## Open Questions

1. **Template Limits**: Should there be a limit on personal templates per user? (Proposed: 25 templates max)
2. **Template Sharing**: Future consideration - should users be able to share templates with each other?
3. **Template Import**: Should users be able to import/export personal templates?
4. **Admin Override**: Should admins be able to view/manage user templates for support purposes?

## Related Tasks

Tasks will be created in `docs/delivery/18/tasks.md` when this PBI moves to "Agreed" status.

Estimated task breakdown:
1. Database migration and model updates (1 day)
2. Backend service layer enhancements (2 days)
3. API endpoint modifications (1 day)
4. Frontend template management UI (2-3 days)
5. Template creation/editing interface (2-3 days)
6. Integration testing and bug fixes (1 day)

**Total Estimated Effort**: 9-11 days

## Success Metrics

- Users create and actively use personal templates
- Template selection completion rates remain high or improve
- No regression in share creation success rates
- Positive user feedback on template customization capabilities
- System performance remains stable with hybrid template queries

---

*Created: January 28, 2025*  
*Status: Proposed*  
*Complexity: Medium*  
*Priority: Future Enhancement*
