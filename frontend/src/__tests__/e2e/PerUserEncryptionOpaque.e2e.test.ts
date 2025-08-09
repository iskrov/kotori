/**
 * PBI-3 E2E CoS Test (3-4): Per-user encryption with OPAQUE auth (no secret tags)
 *
 * Flow:
 * - Register user via OPAQUE
 * - Login via OPAQUE and initialize opaqueKeyManager
 * - Create per-user encrypted journal entry (content cleared server-side)
 * - Fetch the entry and verify encrypted fields + is_encrypted=true
 * - Update entry with new content (per-user encryption path)
 * - Delete entry
 */

import { opaqueAuth } from '../../services/opaqueAuth';
import { opaqueKeyManager } from '../../services/opaqueKeyManager';
import { clientEncryption } from '../../services/clientEncryption';
import { JournalAPI, api } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { areSecretTagsEnabled } from '../../config/featureFlags';

describe('E2E: Per-user encryption with OPAQUE (PBI-3)', () => {
  const email = `e2e-user-${Date.now()}@example.com`;
  const password = 'CorrectHorseBatteryStaple-123!';
  let accessToken: string | null = null;
  let createdId: string | null = null;

  beforeAll(async () => {
    // Ensure secret tags are disabled for this run
    expect(areSecretTagsEnabled()).toBe(false);
  });

  it('registers via OPAQUE', async () => {
    // Start -> Finish registration
    await opaqueAuth.register('E2E Test User', email, password);
  }, 20000);

  it('logs in via OPAQUE and initializes key manager', async () => {
    const result = await opaqueAuth.login(email, password);
    expect(result.success).toBe(true);
    expect(result.sessionKey).toBeTruthy();
    expect(result.exportKey).toBeTruthy();

    // Initialize key manager (accepts base64/url strings)
    opaqueKeyManager.initialize({
      sessionKey: result.sessionKey,
      exportKey: result.exportKey,
      finishLoginRequest: '' as any,
    });

    accessToken = result.token;
    // Persist token for axios interceptor and set default header
    await (AsyncStorage.setItem as any)('access_token', accessToken);
    (api.defaults.headers as any).common = (api.defaults.headers as any).common || {};
    (api.defaults.headers as any).common.Authorization = `Bearer ${accessToken}`;
  }, 20000);

  it('creates per-user encrypted journal entry', async () => {
    const plaintext = 'PBI-3 E2E: Hello encrypted world';
    const enc = await clientEncryption.encryptPerUser(plaintext);

    const response = await JournalAPI.createEntry({
      title: 'E2E Entry',
      content: '',
      entry_date: new Date().toISOString(),
      encrypted_content: enc.encryptedContent,
      encryption_iv: enc.iv,
      encrypted_key: enc.wrappedKey!,
      encryption_wrap_iv: enc.wrapIv!,
      encryption_algorithm: enc.algorithm || 'AES-GCM',
      tags: [],
    } as any);

    const entry = response.data;
    expect(entry).toBeTruthy();
    expect(entry.id).toBeTruthy();
    expect(entry.is_encrypted).toBe(true);
    expect(entry.content ?? '').toBe('');
    expect(entry.encrypted_content).toBeTruthy();
    expect(entry.encryption_iv).toBeTruthy();
    createdId = entry.id;
  }, 20000);

  it('fetches entry and verifies encrypted fields', async () => {
    expect(createdId).toBeTruthy();
    const response = await JournalAPI.getEntry(createdId!);
    const entry = response.data;
    expect(entry.id).toBe(createdId);
    expect(entry.is_encrypted).toBe(true);
    expect(entry.encrypted_content).toBeTruthy();
    expect(entry.encryption_iv).toBeTruthy();
  }, 10000);

  it('updates entry with per-user encryption', async () => {
    expect(createdId).toBeTruthy();
    const updated = 'PBI-3 E2E: Updated encrypted content';
    const enc = await clientEncryption.encryptPerUser(updated);

    const response = await JournalAPI.updateEntry(createdId!, {
      content: '',
      encrypted_content: enc.encryptedContent,
      encryption_iv: enc.iv,
      encrypted_key: enc.wrappedKey!,
      encryption_wrap_iv: enc.wrapIv!,
      encryption_algorithm: enc.algorithm || 'AES-GCM',
    } as any);

    const entry = response.data;
    expect(entry.id).toBe(createdId);
    expect(entry.is_encrypted).toBe(true);
  }, 20000);

  it('deletes entry', async () => {
    expect(createdId).toBeTruthy();
    await JournalAPI.deleteEntry(createdId!);
  }, 10000);
});


