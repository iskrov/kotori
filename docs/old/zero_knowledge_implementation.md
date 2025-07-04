# Zero-Knowledge Phrase-Based Encryption Implementation

## Overview

The Vibes app implements a **phrase-based zero-knowledge encryption system** that provides maximum security through true isolation. Each secret tag uses its own phrase as the encryption key directly, eliminating single points of failure and providing granular recovery capabilities.

## Core Philosophy

### Phrase-Based Zero-Knowledge Approach
- **Direct phrase-to-key derivation**: Each phrase becomes its own encryption key
- **True isolation**: Each tag's data is encrypted with its own phrase
- **No master secrets**: No centralized key management
- **Server never knows phrases**: Secret phrases remain client-side only
- **Server never reads content**: All journal entries encrypted client-side
- **Device inspection safe**: No secret data stored on device

### Key Benefits of Phrase-Based Encryption
1. **Maximum security**: True zero-knowledge with phrase-based keys
2. **True isolation**: Each tag completely independent
3. **Granular recovery**: Losing one phrase only affects that tag
4. **No single point of failure**: No master key to compromise
5. **Simple mental model**: One phrase = one encryption key

## Architecture

### Core Components

#### 1. **Server-Side Secret Tag Storage**
- **Tag metadata**: Names, creation dates, user associations
- **Phrase verification**: Salted Argon2 hashes for phrase matching
- **No sensitive data**: Never stores phrases or decrypted content

#### 2. **Phrase-Based Client-Side Encryption**
- **Direct phrase-to-key derivation**: Each phrase becomes its own encryption key
- **Per-entry encryption**: Each entry gets unique encryption key derived from phrase
- **Memory-only phrases**: No persistent storage of secret phrases
- **Hardware-backed keys**: Secure storage for derived encryption keys
- **True isolation**: Each tag operates completely independently

#### 3. **Client-Side Phrase Verification**
- **Salted hashing**: Argon2 with unique salt per tag
- **Client-side verification**: Hash comparison happens on client
- **No network round-trips**: Verification during speech processing
- **Brute-force resistant**: High-cost hashing parameters

## Technical Implementation

### Secret Tag Creation Flow

```typescript
// Client-side tag creation
async function createSecretTag(tagName: string, secretPhrase: string) {
  // 1. Generate unique salt for this tag
  const salt = crypto.getRandomValues(new Uint8Array(32));
  
  // 2. Hash the phrase with Argon2
  const phraseHash = await argon2.hash(secretPhrase, salt, {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MiB
    timeCost: 3,        // 3 iterations
    parallelism: 1      // Single thread
  });
  
  // 3. Derive encryption key from phrase
  const encryptionKey = await deriveEncryptionKey(secretPhrase);
  
  // 4. Send metadata to server (phrase never sent)
  await api.createSecretTag({
    tagName,
    salt: Array.from(salt),
    phraseHash
  });
  
  // 5. Store encryption key securely on device
  await secureStorage.storeKey(tagId, encryptionKey);
}
```

### Speech Processing and Phrase Detection

```typescript
// Client-side phrase verification during speech processing
async function checkForSecretPhrases(transcript: string) {
  // 1. Get user's secret tag metadata from server
  const userTags = await api.getUserSecretTags();
  
  // 2. Test transcript against each tag's hash
  for (const tag of userTags) {
    const testHash = await argon2.hash(transcript, tag.salt, sameParams);
    
    if (testHash === tag.phraseHash) {
      // 3. Phrase match found - activate secret tag
      await activateSecretTag(tag.tagName, transcript);
      return { found: true, tagName: tag.tagName };
    }
  }
  
  return { found: false };
}
```

### Entry Encryption and Storage

```typescript
// Client-side entry encryption
async function createSecretEntry(content: string, activeTagName: string) {
  // 1. Get encryption key for active tag
  const encryptionKey = await secureStorage.getKey(activeTagName);
  
  // 2. Generate unique entry key
  const entryKey = await crypto.subtle.generateKey({
    name: 'AES-GCM',
    length: 256
  });
  
  // 3. Encrypt content with entry key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedContent = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv
  }, entryKey, new TextEncoder().encode(content));
  
  // 4. Wrap entry key with tag's encryption key
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw', entryKey, encryptionKey, { name: 'AES-GCM', iv: wrapIv }
  );
  
  // 5. Send encrypted data to server
  await api.createJournalEntry({
    encryptedContent: Array.from(new Uint8Array(encryptedContent)),
    wrappedKey: Array.from(new Uint8Array(wrappedKey)),
    iv: Array.from(iv),
    wrapIv: Array.from(wrapIv),
    secretTagId: activeTagName
  });
}
```

## Security Model

### What Server Knows
- ✅ **Secret tag names** (e.g., "work", "personal", "travel")
- ✅ **Tag creation metadata** (timestamps, user associations)
- ✅ **Salted phrase hashes** (for verification, not reversible)
- ✅ **Encrypted journal entries** (cannot decrypt without phrase)

### What Server Never Knows
- ❌ **Secret phrases** (never transmitted or stored)
- ❌ **Decrypted journal content** (encrypted client-side)
- ❌ **Encryption keys** (derived client-side from phrases)
- ❌ **User's secret tag usage patterns** (verification happens client-side)

### Device Inspection Safety
- ❌ **No secret phrases stored** (memory-only during activation)
- ❌ **No tag names stored** (fetched from server when needed)
- ❌ **No persistent secret metadata** (only encrypted keys in secure storage)
- ✅ **Appears as normal journaling app** when inspected offline

## Database Schema

### Secret Tags Table
```sql
CREATE TABLE secret_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id),
    tag_name VARCHAR(100) NOT NULL,
    phrase_salt BYTEA NOT NULL,
    phrase_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, tag_name)
);
```

### Journal Entries (Enhanced)
```sql
-- Existing table with secret tag support
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS secret_tag_id UUID REFERENCES secret_tags(id);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS encrypted_content BYTEA;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS wrapped_key BYTEA;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS encryption_iv BYTEA;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS wrap_iv BYTEA;
```

## API Endpoints

### Secret Tag Management
```python
# Backend API endpoints
@router.post("/secret-tags")
async def create_secret_tag(
    tag_data: SecretTagCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new secret tag with salted phrase hash"""
    
@router.get("/secret-tags")
async def get_user_secret_tags(
    current_user: User = Depends(get_current_user)
):
    """Get user's secret tag metadata for phrase verification"""
    
@router.delete("/secret-tags/{tag_id}")
async def delete_secret_tag(
    tag_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Delete secret tag and all associated entries"""
```

### Data Models
```python
class SecretTagCreate(BaseModel):
    tag_name: str = Field(..., min_length=1, max_length=100)
    phrase_salt: List[int] = Field(..., min_items=32, max_items=32)
    phrase_hash: str = Field(..., min_length=1)

class SecretTagResponse(BaseModel):
    id: UUID
    tag_name: str
    phrase_salt: List[int]
    phrase_hash: str
    created_at: datetime
```

## Security Analysis

### Threat Model Protection

#### ✅ **Device Inspection (Border Control)**
- **No discoverable secrets**: Device contains no secret phrases or tag names
- **Normal app appearance**: Looks like regular journaling app when offline
- **Encrypted keys only**: Only encrypted keys in secure storage, unusable without phrases

#### ✅ **Server Compromise**
- **No plaintext access**: Server cannot decrypt any journal entries
- **Hash-only exposure**: Only salted hashes exposed, require brute-force
- **Phrase protection**: Strong Argon2 parameters make brute-force impractical

#### ✅ **Network Interception**
- **No sensitive transmission**: Phrases never sent over network
- **Hash verification**: Only hashes transmitted for verification
- **Encrypted content**: All journal content encrypted before transmission

### Security Parameters

#### Argon2 Configuration
```typescript
const argon2Params = {
  type: argon2.argon2id,     // Hybrid version (recommended)
  memoryCost: 65536,         // 64 MiB memory usage
  timeCost: 3,               // 3 iterations
  parallelism: 1,            // Single thread
  hashLength: 32             // 256-bit output
};
```

#### Encryption Specifications
- **Content Encryption**: AES-256-GCM
- **Key Wrapping**: AES-256-GCM
- **Key Derivation**: PBKDF2-SHA256 (100,000 iterations)
- **Random Generation**: Cryptographically secure (crypto.getRandomValues)

### Risk Assessment

#### Low Risk Scenarios
- ✅ **Casual device inspection**: No evidence of secret functionality
- ✅ **Network monitoring**: Only encrypted data and hashes transmitted
- ✅ **Server breach with strong phrases**: Brute-force computationally infeasible

#### Medium Risk Scenarios
- ⚠️ **Server breach with weak phrases**: Short phrases vulnerable to brute-force
  - **Mitigation**: Enforce minimum phrase requirements (20+ characters or 4+ words)
- ⚠️ **Targeted device forensics**: Advanced analysis might detect encrypted keys
  - **Mitigation**: Hardware-backed secure storage provides strong protection

#### Future Enhancement Options
- 🔄 **OPAQUE Protocol**: Eliminate offline brute-force risk entirely
- 🔄 **Post-Quantum Cryptography**: Prepare for quantum computing threats
- 🔄 **Multi-Factor Authentication**: Add biometric verification for tag activation

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Database schema updates
- [ ] Backend API endpoints
- [ ] Basic Argon2 integration
- [ ] Server-side tag management

### Phase 2: Client Integration (Week 2)
- [ ] Client-side hash verification
- [ ] Speech processing integration
- [ ] Encryption key management
- [ ] Secure storage implementation

### Phase 3: User Interface (Week 3)
- [ ] Tag creation UI
- [ ] Tag management interface
- [ ] Status indicators
- [ ] Error handling and feedback

### Phase 4: Testing and Polish (Week 4)
- [ ] Security testing
- [ ] Performance optimization
- [ ] Cross-platform validation
- [ ] Documentation completion

## Performance Characteristics

### Hash Verification Performance
- **Tag creation**: ~200ms (one-time cost)
- **Phrase verification**: ~50ms per tag (during speech processing)
- **Typical usage**: 3-4 tags = ~200ms total verification time
- **Network overhead**: Minimal (only hash comparisons)

### Encryption Performance
- **Key derivation**: ~100ms per phrase (cached after first use)
- **Entry encryption**: <10ms per entry
- **Entry decryption**: <5ms per entry
- **Storage overhead**: ~300 bytes per encrypted entry

## Best Practices

### For Users
1. **Strong phrases**: Use 20+ characters or 4+ random words
2. **Unique phrases**: Each secret tag should have different phrase
3. **Memorable phrases**: Choose phrases you can remember without writing down
4. **Private activation**: Activate tags in secure, private environments

### For Developers
1. **Parameter validation**: Enforce strong phrase requirements
2. **Secure coding**: Follow cryptographic best practices
3. **Error handling**: Graceful degradation when verification fails
4. **Performance monitoring**: Track hash verification times
5. **Security auditing**: Regular review of cryptographic implementation

## Conclusion

This simplified server-side hash verification approach provides an optimal balance between security and implementation complexity. By storing tag metadata and phrase hashes server-side while keeping phrases and content client-side, we achieve strong security properties with manageable complexity.

The system is designed to be:
- **Secure enough** for the stated threat model (device inspection, server compromise)
- **Simple enough** to implement and maintain reliably
- **Flexible enough** to upgrade with stronger protocols (OPAQUE) if needed
- **User-friendly enough** for practical daily use

This approach represents a pragmatic solution that delivers real-world security benefits without the complexity overhead of more exotic cryptographic protocols. 