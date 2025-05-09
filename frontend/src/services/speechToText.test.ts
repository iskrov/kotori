// Jest integration tests for SpeechToTextService 
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios'; // Mock the base axios
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system'; // If testing native path

// Mock the modules
jest.mock('@react-native-async-storage/async-storage');
// jest.mock('axios'); // Remove previous partial mock
// jest.mock('expo-file-system'); // Remove basic mock

// Mock expo-file-system more thoroughly, including EncodingType
jest.mock('expo-file-system', () => ({
  __esModule: true,
  ...jest.requireActual('expo-file-system'), // Keep actual implementation for other parts if needed
  EncodingType: {
    UTF8: 'utf8', // Provide a mock value for UTF8
    // Add other encoding types if used
  },
  getInfoAsync: jest.fn(), // Mock functions used by the service
  // Mock other FileSystem functions if needed (readAsStringAsync, writeAsStringAsync, etc.)
}));

// Mock Platform specifically for web tests
Platform.OS = 'web';

// Mock global fetch used for blobs
global.fetch = jest.fn();

// Mock Blob for Node.js environment
if (typeof Blob === 'undefined') {
  global.Blob = class MockBlob {
    _data: any[];
    _options: any;
    size: number;
    type: string;

    constructor(data: any[], options?: any) {
      this._data = data;
      this._options = options;
      this.size = data.reduce((acc, chunk) => acc + (chunk?.length || 0), 0);
      this.type = options?.type || '';
    }
    // Add any other methods Blob methods your code might use, e.g., slice(), text()
  } as any;
}

// Mock FormData for Node.js environment
if (typeof FormData === 'undefined') {
  global.FormData = class MockFormData {
    _data: Record<string, any> = {};
    append(key: string, value: any, fileName?: string) {
      // Simple mock: just store the key/value
      // A more complex mock could handle file-like objects
      this._data[key] = value;
    }
    // Add other methods if needed (get, delete, etc.)
  } as any;
}

// --- Full Axios Mock --- 
// Mock the entire axios module, including direct methods like .post
jest.mock('axios', () => ({
  __esModule: true, // Use this property to indicate it's an ES Module mock
  default: {
    // Mock methods used directly (axios.post)
    post: jest.fn(),
    get: jest.fn(), 
    // Add other methods if needed
    create: jest.fn(() => ({
      // Mock methods used by the instance (axiosInstance.post)
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() },
      },
      defaults: { headers: { common: {} } },
    })),
  },
  // Optionally mock named exports if you use them directly
  // e.g., isAxiosError: jest.fn(),
}));
// --- End Full Axios Mock ---

// Import the service *after* mocks are set up
import speechToTextService from './speechToText';
// NOTE: Assuming the relative path is correct from within src/services/
// If tests are run from the root, the path might need adjustment (e.g., './src/services/speechToText')

// We also need to mock the axios instance used internally if it's separate
// If speechToTextService imports { api as axiosInstance }, mock that too.
jest.mock('./api', () => ({
  api: { // Assuming the instance is named 'api' in api.ts
    post: jest.fn(),
    // Mock other methods if used by the service (e.g., get, put)
    defaults: { headers: { common: {} } }, // Mock defaults structure
  },
}));
import { api as axiosInstance } from './api'; // Import the mocked instance

// Type assertion for mocked base axios
const mockedAxios = axios as jest.Mocked<typeof axios>;
// Type assertion for mocked instance - NOTE: may need adjustment based on the new mock structure
const mockedAxiosInstance = axiosInstance as jest.Mocked<any>; // Use 'any' or a more specific mock type

describe('SpeechToTextService', () => {
  const MOCK_AUDIO_URI = 'blob:http://localhost:19006/mock-audio-blob';
  const MOCK_TRANSCRIPT = 'This is a test transcript.';
  const EXPIRED_TOKEN = 'expired-token';
  const VALID_REFRESH_TOKEN = 'valid-refresh-token';
  const NEW_ACCESS_TOKEN = 'new-access-token';

  // Helper to mock fetch for blobs
  const mockFetchBlob = (ok = true) => {
    const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
    const mockResponse = {
      ok: ok,
      statusText: ok ? 'OK' : 'Not Found',
      blob: jest.fn().mockResolvedValue(mockBlob),
    };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Default mock for fetch returning a blob successfully
    mockFetchBlob();
    // Ensure the mocked instance also has its post method reset/available
    mockedAxiosInstance.post.mockClear(); 
  });

  it('should transcribe successfully on the first attempt', async () => {
    // Arrange
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('valid-token'); // Access token
    // Mock the *instance* post call for the first attempt
    mockedAxiosInstance.post.mockResolvedValueOnce({ 
      data: { transcript: MOCK_TRANSCRIPT },
      status: 200,
    });

    // Act
    const result = await speechToTextService.transcribeAudio(MOCK_AUDIO_URI);

    // Assert
    expect(result).toEqual({ transcript: MOCK_TRANSCRIPT });
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('access_token');
    expect(mockedAxiosInstance.post).toHaveBeenCalledTimes(1);
    expect(mockedAxiosInstance.post).toHaveBeenCalledWith(
      '/api/speech/transcribe', // Uses relative path via instance
      expect.any(FormData), // Check that FormData was passed
      expect.objectContaining({
        headers: { Authorization: 'Bearer valid-token' },
      })
    );
    // Ensure direct axios post (refresh/retry) was NOT called
    expect(mockedAxios.post).not.toHaveBeenCalled(); 
    expect(global.fetch).toHaveBeenCalledTimes(1); // Fetch called once for initial FormData
  });

  it('should refresh token and retry successfully on 401 error', async () => {
    // Arrange
    // 1. Initial token request returns expired token
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(EXPIRED_TOKEN);
    // 2. Refresh token request returns valid refresh token
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(VALID_REFRESH_TOKEN);

    // 3. Mock the first POST call (using instance) to fail with 401
    mockedAxiosInstance.post.mockRejectedValueOnce({ 
      response: { status: 401, data: { detail: 'Token expired' } },
      config: { url: '/api/speech/transcribe' }, 
      message: 'Request failed with status code 401'
    });

    // 4. Mock the refresh POST call (using direct axios) to succeed
    mockedAxios.post.mockResolvedValueOnce({ 
      data: { access_token: NEW_ACCESS_TOKEN, refresh_token: 'new-refresh-token' }, 
      status: 200,
    });

    // 5. Mock the retry POST call (using direct axios) to succeed
    mockedAxios.post.mockResolvedValueOnce({ 
      data: { transcript: MOCK_TRANSCRIPT }, 
      status: 200,
    });

    // Act
    const result = await speechToTextService.transcribeAudio(MOCK_AUDIO_URI);

    // Assert
    expect(result).toEqual({ transcript: MOCK_TRANSCRIPT });

    // Check AsyncStorage calls
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('access_token'); // First attempt
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('refresh_token'); // For refresh
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('access_token', NEW_ACCESS_TOKEN); // Saving new token
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('refresh_token', 'new-refresh-token'); // Saving new refresh token

    // Check axios calls
    expect(mockedAxiosInstance.post).toHaveBeenCalledTimes(1); // Initial attempt via instance
    expect(mockedAxios.post).toHaveBeenCalledTimes(2); // Refresh + Retry via direct axios

    // Verify initial failed attempt (instance)
    expect(mockedAxiosInstance.post).toHaveBeenCalledWith(
      '/api/speech/transcribe',
      expect.any(FormData),
      expect.objectContaining({ headers: { Authorization: `Bearer ${EXPIRED_TOKEN}` } })
    );

    // Verify refresh call (direct axios)
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8001/api/auth/refresh',
      { refresh_token: VALID_REFRESH_TOKEN }
    );

    // Verify successful retry call (direct axios)
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8001/api/speech/transcribe',
      expect.any(FormData), // Check it's FormData again
      expect.objectContaining({ headers: { Authorization: `Bearer ${NEW_ACCESS_TOKEN}` } })
    );

    // Check FormData recreation (fetch called twice)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw an error if refresh token is missing during 401 retry', async () => {
     // Arrange
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(EXPIRED_TOKEN); // Access token
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null); // NO refresh token

     mockedAxiosInstance.post.mockRejectedValueOnce({ // Initial 401 via instance
      response: { status: 401 },
      config: {}, message: '401'
    });

     // Act & Assert
     await expect(speechToTextService.transcribeAudio(MOCK_AUDIO_URI))
            .rejects.toThrow('No refresh token available for retry'); // Error from manual logic

     expect(mockedAxiosInstance.post).toHaveBeenCalledTimes(1); // Only initial attempt
     expect(mockedAxios.post).not.toHaveBeenCalled(); // No direct axios calls
     expect(global.fetch).toHaveBeenCalledTimes(1); // Fetch for initial FormData
  });

   it('should throw an error if token refresh fails during 401 retry', async () => {
     // Arrange
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(EXPIRED_TOKEN);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(VALID_REFRESH_TOKEN);

     mockedAxiosInstance.post.mockRejectedValueOnce({ // Initial 401 via instance
      response: { status: 401 },
      config: {}, message: '401'
    });
     mockedAxios.post.mockRejectedValueOnce({ // Refresh call fails (direct axios)
      response: { status: 500 },
      message: 'Refresh failed miserably'
     });

     // Act & Assert
     await expect(speechToTextService.transcribeAudio(MOCK_AUDIO_URI))
            // Error message comes from the manual refresh catch block
            .rejects.toThrow(/Transcription retry failed:.*Refresh failed miserably/); 

     expect(mockedAxiosInstance.post).toHaveBeenCalledTimes(1); // Initial attempt
     expect(mockedAxios.post).toHaveBeenCalledTimes(1); // Failed Refresh
     expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/refresh'), expect.anything());
     expect(global.fetch).toHaveBeenCalledTimes(1); // Fetch for initial FormData
  });

  // Add more tests for non-401 errors, invalid response structure, etc.
}); 