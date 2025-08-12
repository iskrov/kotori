# PBI-8: Kotori App-Wide Visual Refresh

## Overview

Transform the entire Kotori app to match the new website's calm, low-stimulation design while maintaining all existing functionality and navigation flows. This refresh will establish a consistent, accessible, and neurodiversity-friendly visual system across all screens.

## Problem Statement

The current Kotori app uses an inconsistent purple-based color scheme with high contrast elements that don't align with our calm, minimal brand identity. Users need a cohesive, low-stimulation visual experience that reduces cognitive load and promotes focus during journaling sessions.

## User Stories

1. **As a user**, I want a calm, consistent visual experience across all screens so I can focus on journaling without visual distractions.
2. **As a user with sensory sensitivities**, I want soft colors and minimal contrast so the app doesn't cause eye strain or overwhelm.
3. **As a user with accessibility needs**, I want proper touch targets, screen reader support, and keyboard navigation throughout the app.
4. **As a returning user**, I want the app's visual design to match the website so I have a seamless brand experience.

## Technical Approach

### Phase 1: Design System Foundation
- Create a centralized theme system in `frontend/src/styles/theme.ts`
- Define color tokens, typography scales, spacing units, and shadow styles
- Establish component-level style patterns for reuse

### Phase 2: Screen-by-Screen Updates
Update screens in priority order:
1. **HomeScreen** - Main dashboard cards and layout
2. **JournalScreen** - Entry cards and metadata styling
3. **CalendarScreen** - Calendar selection states and day indicators
4. **SettingsScreen** - Settings cards and sections
5. **ProfileScreen** - Profile information display

### Phase 3: Navigation Components
- **BottomTabNavigator** - Touch targets (48px), teal active state, remove shadows
- Ensure consistency with already-updated AuthNavigator

## UX/UI Considerations

### Color System
- **Primary**: #2DA6A0 (teal) replacing #7D4CDB (purple)
- **Text**: 
  - Headings: #0E1726
  - Body: #3C4A5E
  - Muted: #8FA0B2
- **Backgrounds**:
  - Main: #F7F9FB
  - Cards: #FFFFFF
  - Chips/tags: #E8F6F5

### Visual Patterns
- **Cards**: 16px border radius, 1px border #E6ECF1, soft shadow `0 8px 24px rgba(14,23,38,0.06)`
- **Typography**: Inter/Nunito system fonts, 1.5-1.6 line height for readability
- **Interactive Elements**: 
  - 48px minimum touch targets
  - 2px focus outline with 2px offset
  - 14-16px border radius for buttons

### Calendar-Specific Design
- Selected day: soft outline ring + #E8F6F5 fill
- Today: thin dashed ring in #2DA6A0
- Days with entries: small dot below number
- Full keyboard navigation support

## Acceptance Criteria

1. ✅ **Visual Consistency**
   - All screens use the new teal color system
   - Typography matches website (Inter/Nunito fonts)
   - Consistent spacing and component patterns

2. ✅ **Accessibility**
   - WCAG AA contrast (≥4.5:1) for all text/icons
   - Screen reader labels properly implemented
   - Keyboard navigation fully supported
   - prefers-reduced-motion respected

3. ✅ **Component Quality**
   - Soft shadows throughout (no harsh edges)
   - Proper touch targets (48px minimum)
   - Focus states clearly visible
   - Hover/press states provide feedback

4. ✅ **Technical Requirements**
   - No functionality regressions
   - Bundle size increase < 15KB
   - Responsive behavior maintained
   - Existing auth/API flows unchanged

## Dependencies

- Existing auth screens (LoginScreen, RegisterScreen) already updated
- All OPAQUE authentication must remain functional
- API calls and data flows must not be modified

## Open Questions

None - design specifications are complete based on website implementation.

## Related Tasks

See [Task List](./tasks.md) for detailed implementation breakdown.
