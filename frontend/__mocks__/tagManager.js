// Mock for tagManager module
module.exports = {
  createTag: jest.fn(() => Promise.resolve({ id: 'mock-tag-id' })),
  getTag: jest.fn(() => Promise.resolve({ id: 'mock-tag-id', name: 'mock-tag' })),
  deleteTag: jest.fn(() => Promise.resolve()),
  listTags: jest.fn(() => Promise.resolve([])),
  updateTag: jest.fn(() => Promise.resolve({ id: 'mock-tag-id' })),
}; 