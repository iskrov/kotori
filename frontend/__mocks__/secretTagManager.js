// Mock for secretTagManager module
module.exports = {
  createSecretTag: jest.fn(() => Promise.resolve({ id: 'mock-tag-id' })),
  getSecretTag: jest.fn(() => Promise.resolve({ id: 'mock-tag-id', phrase: 'mock-phrase' })),
  deleteSecretTag: jest.fn(() => Promise.resolve()),
  listSecretTags: jest.fn(() => Promise.resolve([])),
  validateSecretTag: jest.fn(() => Promise.resolve(true)),
}; 