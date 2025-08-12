# Tasks for PBI 10: Template-Based Journal Sharing (Updated)

This document lists all tasks associated with PBI 10, including comprehensive frontend implementation.

**Parent PBI**: [PBI 10: Template-Based Journal Sharing with Multi-Language Support](./prd.md)

## Task Summary

| Task ID | Name | Status | Description |
| :------ | :--- | :----- | :---------- |
| 10-1 | [Create share template models and API](./10-1.md) | Completed | Define database schema and REST endpoints for templates |
| 10-2 | [Implement Gemini integration service](./10-2.md) | Completed | Build service for LLM-based Q&A mapping and translation |
| 10-3 | [Build share generation backend](./10-3.md) | Completed | Create endpoints for share creation, storage, and retrieval |
| 10-4 | [Implement PDF generation service](./10-4.md) | Completed | Add PDF export capability with proper formatting |
| 10-9 | [Import template from file (PDF/DOCX)](./10-9.md) | Completed | Parse uploaded forms and extract questions with Gemini |
| 10-10 | [Add Share button to bottom navigation](./10-10.md) | Proposed | Add Share icon to main bottom menu maintaining existing layout |
| 10-11 | [Create ShareScreen main container](./10-11.md) | Proposed | Build main share screen with period selector and template list |
| 10-12 | [Implement period selector component](./10-12.md) | Proposed | Create daily/weekly/monthly selector with date range logic |
| 10-13 | [Build template selector component](./10-13.md) | Proposed | Display available templates with descriptions and icons |
| 10-14 | [Create share preview screen](./10-14.md) | Proposed | Show Q&A pairs with edit capability before sharing |
| 10-15 | [Implement share options modal](./10-15.md) | Proposed | PDF download and native share sheet integration |
| 10-16 | [Add share history view](./10-16.md) | Proposed | List previous shares with status and access counts |
| 10-17 | [Integrate share API with frontend](./10-17.md) | Proposed | Connect all UI components to backend APIs |
| 10-18 | [Add loading and error states](./10-18.md) | Proposed | Implement proper loading, error handling, and offline support |
| 10-19 | [Style consistency and animations](./10-19.md) | Proposed | Match existing app design system and add smooth transitions |
| 10-20 | [End-to-end testing](./10-20.md) | Proposed | Complete integration testing of full sharing workflow |

## Implementation Order

### Phase 1: Backend (Days 1-5) ✅ COMPLETED
- 10-1 through 10-4, 10-9: All backend infrastructure

### Phase 2: Frontend Navigation (Day 6)
1. **10-10**: Add Share button to bottom navigation (2 hours)
2. **10-11**: Create ShareScreen main container (3 hours)

### Phase 3: Core UI Components (Days 7-8)
3. **10-12**: Period selector component (3 hours)
4. **10-13**: Template selector component (4 hours)
5. **10-14**: Share preview screen (5 hours)

### Phase 4: Share Features (Days 9-10)
6. **10-15**: Share options modal (3 hours)
7. **10-16**: Share history view (3 hours)
8. **10-17**: API integration (4 hours)

### Phase 5: Polish & Testing (Days 11-12)
9. **10-18**: Loading and error states (3 hours)
10. **10-19**: Style consistency (2 hours)
11. **10-20**: End-to-end testing (4 hours)

## Frontend Architecture

### Navigation Flow
```
Bottom Navigation
    ↓
[Share Button] → ShareScreen
                     ↓
              [Period Selector]
                     ↓
              [Template List]
                     ↓
              [Generate Share] → Preview Screen
                                      ↓
                                 [Confirm] → Share Options
                                                ↓
                                          [PDF/Share Sheet]
```

### Component Structure
```
ShareScreen/
├── index.tsx                 # Main container
├── components/
│   ├── PeriodSelector.tsx   # Daily/Weekly/Monthly tabs
│   ├── TemplateCard.tsx     # Template display item
│   ├── TemplateList.tsx     # Template selector
│   ├── SharePreview.tsx     # Q&A preview/edit
│   ├── ShareOptions.tsx     # Share modal
│   └── ShareHistory.tsx     # Previous shares list
├── hooks/
│   ├── useShareTemplates.ts # Template fetching
│   ├── useShareGeneration.ts # Share creation
│   └── useShareHistory.ts   # History management
└── styles/
    └── ShareScreen.styles.ts # Consistent styling
```

### Key Design Principles
1. **Minimal Changes**: Only add Share button to existing navigation
2. **Consistent UI**: Reuse existing components (Button, Card, Modal)
3. **Simple Flow**: 3-step process (Select → Preview → Share)
4. **Offline Support**: Cache templates locally
5. **Error Recovery**: Graceful handling of API failures

## Risk Mitigation

- **Navigation Impact**: Share button addition tested across all screen sizes
- **Performance**: Lazy load share components to avoid main app impact
- **Styling**: Use existing theme variables and components
- **State Management**: Isolated share state to avoid conflicts

## Definition of Done

- [ ] Share button visible in bottom navigation
- [ ] Share screen accessible and functional
- [ ] Period selection works (daily/weekly/monthly)
- [ ] Templates load and display correctly
- [ ] Preview shows accurate Q&A pairs
- [ ] PDF generation works on all platforms
- [ ] Share sheet integration functional
- [ ] History displays past shares
- [ ] All screens match app design system
- [ ] No regression in existing features
- [ ] Tested on iOS, Android, and Web

## Notes

- Frontend implementation focuses on simplicity and minimal disruption
- Reuse existing CalendarService for date range calculations
- Leverage existing encryption/decryption flows for journal entries
- Share screen is self-contained with minimal dependencies
- Progressive enhancement: basic features first, then add advanced options

[Back to PBI](./prd.md)

