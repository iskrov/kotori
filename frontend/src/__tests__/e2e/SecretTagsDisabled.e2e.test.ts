import { setupE2ETestEnvironment, cleanupE2ETestEnvironment, resetTestState } from './setup/TestSetup';
import speechToText from '../../services/speechToText';

// Force secret tags disabled for this E2E test context
jest.mock('../../config/featureFlags', () => ({
  areSecretTagsEnabled: () => false,
}));

describe('E2E: Core flows with secret tags disabled', () => {
  beforeAll(async () => {
    await setupE2ETestEnvironment();
  });

  afterAll(async () => {
    await cleanupE2ETestEnvironment();
  });

  beforeEach(async () => {
    await resetTestState();
  });

  test('Transcription response is processed with detection disabled', async () => {
    const anySpeech: any = speechToText as any;
    const data = { transcript: 'hello world', detected_language_code: 'en', confidence: 0.95 };
    const result = await anySpeech._processTranscriptionResponse(data, true);
    expect(result).toBeTruthy();
    expect(result.transcript).toBe('hello world');
    expect(result.secret_tag_detected?.found).toBe(false);
  });
});


