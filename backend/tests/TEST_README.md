# Speech Service Tests

This directory contains pytest-based tests for Google Cloud Speech V2 API integration.

## Test Files

### `test_speech_config.py`
**Purpose**: Tests Google Cloud Speech V2 configuration and setup.

**Test Classes**:
- `TestSpeechConfiguration`: Configuration validation tests

**What it tests**:
- Google Cloud project and location settings
- Multi-language support availability  
- Speech service initialization
- Language validation settings
- Supported language codes format

**When to use**:
- Configuration issues
- Location-specific feature problems
- Initial setup verification
- Multi-language support troubleshooting

### `test_speech_functionality.py`
**Purpose**: Tests speech service functionality and methods.

**Test Classes**:
- `TestSpeechFunctionality`: Core functionality tests

**What it tests**:
- Language validation logic
- Recognition configuration building
- Streaming configuration setup
- Code phrase detection
- Method structure and error handling

**When to use**:
- Speech service method testing
- Language validation issues
- Configuration building problems
- Code phrase functionality verification

## Running Tests

### Run All Speech Tests
```bash
cd backend
pytest tests/test_speech_config.py tests/test_speech_functionality.py -v
```

### Run Specific Test Class
```bash
cd backend
pytest tests/test_speech_config.py::TestSpeechConfiguration -v
```

### Run Specific Test Method
```bash
cd backend
pytest tests/test_speech_config.py::TestSpeechConfiguration::test_google_cloud_settings -v
```

### Run with Coverage
```bash
cd backend
pytest tests/test_speech_config.py tests/test_speech_functionality.py --cov=app.services.speech_service --cov-report=html
```

## Test Environment

- **Framework**: pytest
- **Async Support**: pytest-asyncio for async tests
- **Mocking**: Tests use minimal audio data and mock objects where appropriate
- **Credentials**: Tests handle missing Google Cloud credentials gracefully
- **Focus**: Configuration correctness and method structure rather than actual API calls

## Notes

- Tests are designed to work without requiring actual Google Cloud API access
- Async tests use `@pytest.mark.asyncio` decorator
- Tests include proper error handling for missing credentials
- All tests follow pytest conventions and integrate with existing test suite
- Tests can be run individually or as part of the full test suite

## Integration with CI/CD

These tests are designed to be run in CI/CD environments where:
- Google Cloud credentials may not be available
- Tests focus on code structure and configuration validation
- Actual API connectivity is tested separately in integration tests

## Troubleshooting Common Issues

1. **"Model does not exist"**: Check if the model is available in your location
2. **"Permission denied"**: Verify Google Cloud credentials and IAM permissions
3. **"Multi-language not supported"**: Ensure location is one of: eu, global, us
4. **"Invalid resource id"**: Check recognizer configuration and location setup 