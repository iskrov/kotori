# Test Suite Documentation

This document describes the clean, CI/CD-ready test suite for the Vibes application.

## 🎯 Test Philosophy

- **No Mocking for Security-Critical Components**: All OPAQUE authentication tests use real cryptographic operations
- **Real Database Integration**: Tests use actual database operations with proper cleanup
- **Comprehensive Coverage**: Tests cover the complete API request/response cycles
- **CI/CD Optimized**: Tests are categorized and can be run selectively based on environment capabilities

## 📁 Test Structure

```
tests/
├── 🔐 OPAQUE Tests (No Mocking)
│   ├── test_opaque_user_auth.py           # User registration & login (599 lines)
│   ├── test_opaque_secret_tags.py         # Secret tag operations (743 lines)
│   └── test_opaque_integration.py         # End-to-end workflows (771 lines)
├── 🌐 API Tests
│   ├── test_api.py                        # General API endpoints
│   └── test_services.py                   # Service layer tests
├── ⚙️ Configuration Tests
│   ├── test_config.py                     # Application configuration
│   └── test_speech_config.py              # Speech service configuration
├── 🎤 Feature Tests
│   └── test_speech_functionality.py       # Speech-to-text functionality
├── 🛠️ Test Infrastructure
│   ├── conftest.py                        # Test configuration & fixtures
│   ├── pytest.ini                        # Pytest configuration
│   ├── run_ci_tests.py                    # CI/CD test runner
│   └── utils/                            # Test utilities
└── 📊 Test Data
    ├── fixtures/                          # Test data fixtures
    └── schema/                           # Schema validation tests
```

## 🏷️ Test Categories (Markers)

Tests are categorized using pytest markers for selective execution:

- `@pytest.mark.unit`: Fast unit tests with no external dependencies
- `@pytest.mark.integration`: Integration tests requiring database
- `@pytest.mark.opaque`: OPAQUE authentication tests (requires Node.js)
- `@pytest.mark.oauth`: OAuth authentication tests
- `@pytest.mark.e2e`: End-to-end system tests
- `@pytest.mark.slow`: Tests that may take >30 seconds

## 🚀 Running Tests

### Prerequisites

1. **Database**: PostgreSQL running with test database
2. **Node.js**: Required for OPAQUE tests
3. **OPAQUE Library**: `npm install @serenity-kit/opaque`

### Quick Start

```bash
# Run all tests
python tests/run_ci_tests.py all

# Run only unit tests (fast)
python tests/run_ci_tests.py unit

# Run integration tests
python tests/run_ci_tests.py integration

# Run OPAQUE tests only
python tests/run_ci_tests.py opaque

# Run slow/comprehensive tests
python tests/run_ci_tests.py slow
```

### Direct Pytest Usage

```bash
# Run specific test categories
pytest -m "unit"                    # Unit tests only
pytest -m "integration and not slow" # Fast integration tests
pytest -m "opaque"                   # OPAQUE tests only
pytest -m "slow"                     # Comprehensive tests

# Run specific test files
pytest tests/test_opaque_user_auth.py
pytest tests/test_api.py

# Run with coverage
pytest --cov=app --cov-report=html
```

## 🔐 OPAQUE Test Details

Our OPAQUE tests are comprehensive and use **real cryptographic operations**:

### User Authentication Tests (`test_opaque_user_auth.py`)
- ✅ Complete user registration flow (start → finish)
- ✅ Complete user login flow (start → finish)
- ✅ JWT token generation and validation
- ✅ Database persistence verification
- ✅ Session management and cleanup
- ✅ Base64/Base64URL encoding compatibility
- ✅ Error handling and edge cases
- ✅ Duplicate user handling
- ✅ Session expiration testing

### Secret Tag Tests (`test_opaque_secret_tags.py`)
- ✅ Complete secret tag registration flow
- ✅ Complete secret tag authentication flow
- ✅ Tag handle validation (32-byte random identifiers)
- ✅ Cross-user security boundaries
- ✅ Integration with user authentication tokens
- ✅ Base64 encoding format compatibility
- ✅ Session management and cleanup
- ✅ Error scenarios (wrong phrases, nonexistent tags)

### Integration Tests (`test_opaque_integration.py`)
- ✅ Complete OPAQUE user → secret tag workflows
- ✅ OAuth user + OPAQUE secret tag workflows
- ✅ Mixed authentication scenarios
- ✅ Cross-user security boundary validation
- ✅ Session persistence across operations
- ✅ Complex error handling scenarios
- ✅ Authentication persistence testing

## 🎯 Why These Tests Catch Issues

Our real OPAQUE tests would have caught all the issues we manually discovered:

1. **Base64 Encoding Issues** ✅
   - Tests validate both standard and URL-safe base64
   - Tests verify proper padding handling
   - Would catch "number of data characters cannot be 1 more than a multiple of 4" errors

2. **Field Name Mismatches** ✅
   - Tests verify complete API request/response cycles
   - Would catch `registrationResponse` vs `opaque_registration_response` mismatches
   - Tests validate all JSON field names match schemas

3. **Session State Issues** ✅
   - Tests verify database column constraints
   - Would catch 20-character limit on `session_state`
   - Tests validate session cleanup

4. **Cryptographic Issues** ✅
   - Tests use real cryptographic operations
   - Would catch BLAKE2s length limit errors
   - Tests verify actual zero-knowledge proofs

5. **Import/Module Issues** ✅
   - Integration tests verify all components work together
   - Would catch missing module imports

## 🔧 CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run unit tests
        run: python tests/run_ci_tests.py unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test_pass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install OPAQUE
        run: npm install @serenity-kit/opaque
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run OPAQUE tests
        run: python tests/run_ci_tests.py opaque
```

## 📊 Test Metrics

- **Total Test Files**: 8 core test files
- **Total Test Lines**: ~2,100 lines of real test code
- **OPAQUE Test Coverage**: 2,113 lines (no mocking)
- **Test Categories**: 6 distinct categories
- **Expected Runtime**: 
  - Unit tests: <30 seconds
  - Integration tests: 1-3 minutes
  - OPAQUE tests: 2-5 minutes
  - Full suite: 5-10 minutes

## 🛡️ Security Testing

Our test suite specifically validates security boundaries:

- **Cross-user access prevention**: Users cannot access each other's secret tags
- **Session isolation**: OPAQUE sessions are properly isolated and cleaned up
- **Cryptographic integrity**: Real zero-knowledge proofs are verified
- **Token validation**: JWT tokens are properly generated and validated
- **Database security**: Proper data isolation and cleanup

## 📝 Adding New Tests

When adding new tests:

1. **Use appropriate markers**: Mark tests with `@pytest.mark.unit`, `@pytest.mark.integration`, etc.
2. **Follow naming conventions**: Test files should start with `test_`
3. **Include cleanup**: Use fixtures for proper setup/teardown
4. **Document purpose**: Include docstrings explaining what the test validates
5. **Consider CI/CD**: Ensure tests can run in automated environments

## 🔍 Debugging Tests

For debugging failed tests:

```bash
# Run with verbose output and stop on first failure
pytest -vvv -x tests/test_opaque_user_auth.py

# Run with pdb debugger
pytest --pdb tests/test_opaque_user_auth.py::TestOpaqueUserAuth::test_opaque_user_registration_complete_flow

# Show test durations
pytest --durations=10

# Run with coverage and open HTML report
pytest --cov=app --cov-report=html
open htmlcov/index.html
```

This test suite provides comprehensive, production-ready validation of our OPAQUE authentication system with real cryptographic operations and no shortcuts. 