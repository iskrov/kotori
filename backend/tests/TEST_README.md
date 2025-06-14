# Vibes Test Suite

This directory contains comprehensive tests for the Vibes voice journaling application, including the complete secret tags system implementation.

## Test Categories

### Core Application Tests

#### `test_speech_config.py`
**Purpose**: Tests Google Cloud Speech V2 configuration and setup.

**Test Classes**:
- `TestSpeechConfiguration`: Configuration validation tests

**What it tests**:
- Google Cloud project and location settings
- Multi-language support availability  
- Speech service initialization
- Language validation settings
- Supported language codes format

#### `test_speech_functionality.py`
**Purpose**: Tests speech service functionality and methods.

**Test Classes**:
- `TestSpeechFunctionality`: Core functionality tests

**What it tests**:
- Language validation logic
- Recognition configuration building
- Streaming configuration setup
- Code phrase detection
- Method structure and error handling

### Secret Tags System Tests

#### `test_secret_tags.py`
**Purpose**: Comprehensive tests for the secret tags functionality.

**Test Classes**:
- `TestSecretTagModel`: Secret tag model operations and validation
- `TestSecretTagJournalIntegration`: Integration with journal entries
- `TestSecretTagAPI`: API endpoint testing
- `TestSpeechServiceSecretTags`: Speech service integration
- `TestSecretTagDataIntegrity`: Data integrity and constraints
- `TestSecretTagZeroKnowledgeCompliance`: Zero-knowledge compliance verification

**What it tests**:
- Secret tag creation, validation, and relationships
- Encrypted journal entry handling
- API endpoints for tag activation
- Voice phrase detection integration
- Database constraints and data integrity
- Zero-knowledge encryption compliance

#### `test_secret_tags_integration.py`
**Purpose**: End-to-end integration tests for complete secret tags workflows.

**Test Classes**:
- `TestSecretTagsIntegration`: Complete workflow testing
- `TestSecretTagsBackwardCompatibility`: Backward compatibility verification

**What it tests**:
- Complete user workflows (create tag → create entry → retrieve entry)
- Multi-user isolation and security
- Entry filtering with multiple secret tags
- Speech transcription with secret tag detection
- Zero-knowledge compliance across the system
- Performance with multiple tags and entries
- Backward compatibility with existing public entries

#### `test_secret_tags_ci.py`
**Purpose**: CI/CD optimized tests for automated testing pipelines.

**Test Classes**:
- `TestSecretTagsCICD`: Fast, mock-based tests for CI/CD
- `TestSecretTagsCICoverage`: Additional coverage tests

**What it tests**:
- Model validation without external dependencies
- API endpoint structure validation
- Database schema compliance
- Performance benchmarks
- Error handling coverage
- Migration compatibility

## Running Tests

### Quick Test Commands

#### Run All Tests
```bash
cd backend
pytest -v
```

#### Run Secret Tags Tests Only
```bash
cd backend
pytest -m secret_tags -v
```

#### Run CI/CD Tests (Fast, No External Dependencies)
```bash
cd backend
pytest -m ci -v
```

#### Run Integration Tests
```bash
cd backend
pytest -m integration -v
```

#### Run with Coverage Report
```bash
cd backend
pytest --cov=app --cov-report=html --cov-report=term-missing
```

### Specific Test Categories

#### Speech Service Tests
```bash
cd backend
pytest tests/test_speech_config.py tests/test_speech_functionality.py -v
```

#### Secret Tags Unit Tests
```bash
cd backend
pytest tests/test_secret_tags.py -v
```

#### Secret Tags Integration Tests
```bash
cd backend
pytest tests/test_secret_tags_integration.py -v
```

#### Secret Tags CI Tests
```bash
cd backend
pytest tests/test_secret_tags_ci.py -v
```

### Performance and Benchmarking
```bash
cd backend
pytest -m performance -v --durations=10
```

### Zero-Knowledge Compliance Tests
```bash
cd backend
pytest -m zero_knowledge -v
```

## Frontend Tests

### Running Frontend Tests
```bash
cd frontend
npm test
```

### Frontend Test Coverage
```bash
cd frontend
npm run test:coverage
```

### Frontend Test Files
- `src/services/__tests__/secretTagManager.test.js`: SecretTagManager service tests
- `src/services/__tests__/speechToText.test.js`: Speech service with secret tag integration
- `src/services/__tests__/encryptedJournalService.test.js`: Encrypted journal service tests
- `src/components/__tests__/`: Component tests

## Test Environment

### Backend
- **Framework**: pytest with asyncio support
- **Database**: SQLite in-memory for tests
- **Mocking**: Comprehensive mocking for external services
- **Coverage**: Minimum 80% coverage required
- **CI/CD**: Optimized tests for automated pipelines

### Frontend
- **Framework**: Jest with React Native Testing Library
- **Mocking**: AsyncStorage, SecureStore, and API services
- **Coverage**: 70% global, 80% for services
- **Environment**: jsdom for web compatibility

## CI/CD Integration

### GitHub Actions / CI Pipeline
```yaml
# Example CI configuration
- name: Run Backend Tests
  run: |
    cd backend
    pytest -m ci --cov=app --cov-report=xml

- name: Run Frontend Tests
  run: |
    cd frontend
    npm test -- --coverage --watchAll=false
```

### Test Categories for CI/CD
- **`@pytest.mark.ci`**: Fast tests without external dependencies
- **`@pytest.mark.integration`**: Full integration tests
- **`@pytest.mark.performance`**: Performance benchmarks
- **`@pytest.mark.zero_knowledge`**: Zero-knowledge compliance tests

## Security Testing

### Zero-Knowledge Compliance
Tests verify that:
- No plaintext sensitive data is stored in the database
- All encryption happens client-side
- Server only stores non-reversible hashes
- Secret tag phrases never leave the client

### Data Isolation
Tests verify that:
- Users can only access their own secret tags
- Cross-user data leakage is prevented
- Authentication is properly enforced

## Performance Testing

### Benchmarks
- Secret tag creation: < 5 seconds for 100 tags
- Query performance: < 1 second for user tag lookup
- Entry retrieval: < 5 seconds with multiple active tags
- Filtering: < 3 seconds with multiple tag hashes

## Troubleshooting

### Common Issues
1. **"Model does not exist"**: Check if the model is available in your location
2. **"Permission denied"**: Verify Google Cloud credentials and IAM permissions
3. **"Secret tag not found"**: Ensure tag belongs to authenticated user
4. **"Encryption key not loaded"**: Verify secret tag encryption is initialized
5. **Test failures in CI**: Use `pytest -m ci` for CI-optimized tests

### Debug Commands
```bash
# Run tests with verbose output
pytest -v -s

# Run specific test with debugging
pytest tests/test_secret_tags.py::TestSecretTagModel::test_secret_tag_creation -v -s

# Check test coverage
pytest --cov=app --cov-report=term-missing

# Run only fast tests
pytest -m "not slow" -v
``` 