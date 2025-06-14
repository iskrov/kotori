# Voice-Controlled Journaling Application (Vibes) - Original Concept


## Original Vision

Enable users to journal their thoughts, ideas, and daily events through voice commands.

Ensure smooth and real-time transcription of voice inputs.

Automatically organize notes by date and time, facilitating effortless navigation.

Provide access to notes via both a traditional list view and a calendar view for easy chronological navigation.

Allow users to set and customize reminders to encourage consistent journaling.

Provide flexibility in notification timing, frequency, and alert styles to suit individual preferences.

Deliver analytical summaries or visualizations, including daily, weekly, monthly, and yearly overviews of journal entries. For example, it can use Duolingo-style gamification in terms of streaks.

## Privacy & Hidden‑Entry Features

Invisible Protected Entries – users can mark an entry as private. Private entries are stored encrypted and are completely absent from the normal UI unless unlocked.

Code‑Phrase Trigger – while creating a new voice entry, the user may speak a secret phrase. When the transcription exactly matches the hashed phrase, Vibes silently switches to Hidden Mode and reveals private entries (or executes another secret action such as decoy or self‑destruct).

Decoy Profile – an alternate, harmless journal that is shown when a decoy phrase is spoken.

Self‑Destruct Command – an optional "panic phrase" that irreversibly deletes all private data after a 10‑second undo window.

On‑Device Encryption – private entries are encrypted with a key stored only in the platform secure enclave (Android Keystore / iOS Secure Enclave).  Keys never leave the device.

These features must be completely invisible to any casual examiner, even if the phone is unlocked and the app is open.

---

## Implementation Update ✅

**The original concept has been fully implemented with enhancements:**

- ✅ **Voice-controlled journaling** with Google Speech-to-Text V2
- ✅ **Real-time transcription** with quality indicators and multi-language support
- ✅ **Automatic organization** by date and time with calendar view
- ✅ **List and calendar views** for easy navigation
- ✅ **Analytics and streaks** with gamification elements
- ✅ **Phrase-based secret tags** (evolved from hidden entries) providing superior security
- ✅ **Voice-phrase activation** during recording for seamless privacy
- ✅ **True zero-knowledge encryption** with complete isolation between secret tags
- ✅ **Hardware-backed security** using device secure enclave
- ✅ **Device inspection safety** with invisible secret functionality

**Current Status: Production ready with phrase-based secret tags system**  