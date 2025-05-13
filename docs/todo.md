# Todo List

## Phase 1: Project Setup and Architecture
- [x] Create basic project structure
- [x] Set up React Native frontend project  
  - [x] Initialize React Native project  
  - [x] Configure navigation  
  - [x] Set up basic component structure  
- [x] Set up FastAPI backend  
  - [x] Create FastAPI application structure  
  - [x] Set up project dependencies  
  - [x] Create API router structure  
- [ ] Configure PostgreSQL database  
  - [x] Define initial schema  
  - [x] Set up migration system  
  - [x] Create initial migration  
- [x] Create environment configurations  
  - [x] Development environment  
  - [x] Testing environment  
  - [x] Production environment  

## Phase 2: Core Functionality Development
- [x] Implement user authentication system  
  - [x] Google Sign-In integration  
  - [x] User session management  
- [x] Develop voice-recording interface  
  - [x] Create audio-recording component  
  - [x] Implement permission handling  
- [x] Integrate Voice-to-Text functionality  
  - [x] Modify backend to load `GOOGLE_SPEECH_API_KEY` from `.env`  
  - [x] Create backend endpoint (`/api/speech/transcribe`) to handle transcription  
  - [x] Implement transcription-service logic in the backend  
  - [x] Modify frontend (`speechToText.ts`) to call backend endpoint for transcription  
- [x] Create journal-entry management  
  - [x] Design database models  
  - [x] Implement CRUD operations  
  - [x] Develop frontend components  

## Phase 3: User Interface and Experience
- [x] Implement main navigation structure  
  - [x] Create tab navigation  
  - [x] Set up authentication flow  
- [x] Develop authentication screens  
  - [x] Login screen  
  - [x] Registration screen  
- [x] Create journal interfaces  
  - [x] Journal list screen  
  - [x] Journal entry detail screen  
  - [x] Journal entry form screen  
- [x] Implement tag management  
  - [x] Create tag component  
  - [x] Integrate tag filtering  
- [x] Basic settings screen  
- [x] Calendar-screen placeholder  

## Phase 4: Recording & Transcription Enhancements

### Sub-Phase 4.1 — Faster Recording Initiation
- [x] Decided existing central 'Record' tab meets global quick record button needs
- [x] Implement proactive permission handling
  - [x] Request microphone permissions earlier in app flow (in MainNavigator)
- [x] Streamline recording logic (frontend – permissions, state, loading)
  - [x] Optimize Audio.setAudioModeAsync configuration (in MainNavigator)

### Sub-Phase 4.2 — Multi-language Speech Support
- [ ] Research Google Cloud STT multi-language options (backend)
- [ ] Implement backend changes for multi-language `RecognitionConfig`
- [ ] Adjust backend transcription-result processing
- [ ] Update database schema for language info (if needed)
- [ ] Ensure frontend displays mixed-language transcriptions correctly

### Sub-Phase 4.3 — Async Transcription Foundation (Optional)
- [ ] Ensure reliable local audio file storage
  - [ ] Move temporary recordings to persistent app storage
  - [ ] Implement proper file naming/organization
- [ ] Add transcription status field to journal entry schema
  - [ ] Update database models and migrations
  - [ ] Modify frontend components to display status
- [ ] Create placeholder UI elements for pending transcriptions
  - [ ] Add status indicators to journal entries
  - [ ] Design loading states for pending transcriptions

### Sub-Phase 4.4 — Testing & Refinement
- [ ] Test recording-speed improvements (compare vs baseline)
- [ ] Test multi-language transcription accuracy (diverse samples)
- [ ] Perform regression testing
- [ ] Iterate on implementations based on test results

## Phase 5: Hidden Mode & Data Protection
### Threat-Model & UX
- [ ] Design invisible unlock UI flow

### Crypto Layer
- [ ] Generate per-device master key (secure enclave / Keystore)
- [ ] Implement AES-256-GCM encryption helper (backend & mobile)
- [ ] Add encryption middleware to journal CRUD

### Code-Phrase Recognition
- [ ] Extend transcription service: SHA-256 hash comparison
- [ ] Store hash → action map (unlock / decoy / delete / freeze) encrypted
- [ ] Implement constant-time hash checks

### Private-Entry Store
- [ ] Add encrypted `is_private` flag to DB schema
- [ ] Update ORM models & migrations
- [ ] Secure API routes with secondary-auth gate

### Decoy Profile
- [ ] Implement decoy DB context
- [ ] Switch context on decoy phrase

### Self-Destruct & Freeze
- [ ] Panic phrase deletes ciphertext rows + wipes keys
- [ ] Optional 10-second undo overlay

### Cross-Platform Key Management
- [ ] Android Keystore integration
- [ ] iOS Secure Enclave integration

### Testing & Validation
- [ ] Unit-test encryption/decryption round-trip
- [ ] Simulate border-inspection scenario (no private entries visible)
- [ ] Security penetration-test pass

## Phase 6: Further Core Functionality (Next Up)
- [ ] Complete voice-recording functionality  
  - [ ] Integrate with actual device recording (verify full functionality)  
  - [ ] Implement real-time transcription (frontend WebSocket integration)  
    - [ ] Modify `AudioRecorder.tsx` to connect to WebSocket endpoint (`/ws/transcribe`)  
    - [ ] Implement logic to send audio chunks over WebSocket  
    - [ ] Implement logic to receive & display interim/final transcripts from WebSocket  
  - [ ] Implement playback controls for recorded audio  
- [ ] Enhanced calendar view  
  - [ ] Implement date filtering  
  - [ ] Add visual indicators for entries  
- [ ] Reminder-system implementation  

## Phase 7: Testing, Optimization & Deployment
- [ ] Testing & optimization  
  - [ ] Unit testing (backend & frontend)  
  - [ ] Integration testing (backend & frontend)  
  - [ ] Performance optimization  
- [ ] Deployment  
  - [ ] Backend deployment (GCP setup)  
  - [ ] Mobile-app publishing (App Store / Play Store setup)  

## Additional Tasks / Backlog
- Implement backend email-notifications system  
- Add a calendar view for journal entries  
- Implement data-export functionality (PDF, CSV)  
- Add search functionality for journal entries  
- Implement reminders for regular journaling  
- Add custom themes and styling options  
- Create user onboarding tutorial  
- Add social-sharing options  
- Implement offline mode (consider for journal viewing/creation)  
- Optimize app performance  
- Add analytics for usage patterns  
- Create admin dashboard  
- Implement user feedback system  
- Add support for image attachments in entries  
- Implement tagging system for better organization  
- Add mood-tracking functionality  
- **Privacy enhancements:**  
  - Add "SOS" voice trigger to freeze app for 24 h  
  - Research homomorphic encryption for remote backups of private entries 