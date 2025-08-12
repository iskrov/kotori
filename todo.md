# Current Tasks

## PBI-8: Kotori App-Wide Visual Refresh
Status: 📋 **PROPOSED** - Ready for implementation

Transform the entire Kotori app to match the new website's calm, low-stimulation design while maintaining all existing functionality.

### Next Steps:
1. **Task 8-1**: Create Design System Foundation
   - Set up `frontend/src/styles/theme.ts`
   - Define color tokens (teal primary #2DA6A0)
   - Establish typography and spacing

2. **Task 8-2**: Update HomeScreen Visual Design
   - Apply new card styles
   - Update dashboard layout

3. **Task 8-3**: Update JournalScreen Visual Design
   - Redesign entry cards
   - Update metadata displays

4. **Task 8-4**: Update CalendarScreen Visual Design
   - Implement accessible selection states
   - Add entry indicators

5. **Task 8-5**: Update Settings and Profile Screens
   - Apply consistent styling
   - Update controls and toggles

6. **Task 8-6**: Update Bottom Navigation
   - Implement 48px touch targets
   - Add teal active states

7. **Task 8-7**: E2E Visual and Accessibility Testing
   - Verify WCAG AA compliance
   - Complete accessibility audit

### Success Criteria:
- All screens use consistent teal color system
- Soft shadows and proper spacing throughout
- WCAG AA accessibility compliance
- Bundle size increase < 15KB
- No functionality regressions

---

## Completed Today
- ✅ Auth screens restyling (LoginScreen and RegisterScreen)
- ✅ Created PBI-8 with comprehensive task breakdown

## Notes
- Auth screens already updated with calm design - can be used as reference
- Design system foundation (Task 8-1) should be completed first
- Each screen update can be done independently after Task 8-1