# End-to-End Testing for Share Workflow

This directory contains comprehensive end-to-end tests for the sharing feature using Detox for React Native.

## Overview

The e2e tests cover the complete sharing workflow from share creation to delivery, including:

- **Complete Workflow Tests**: Full user journey testing
- **Error Scenario Tests**: Network errors, server errors, validation failures
- **Performance Tests**: Generation speed, UI responsiveness, memory usage
- **Accessibility Tests**: Screen reader compatibility, keyboard navigation, reduced motion

## Test Structure

```
e2e/
├── __tests__/                 # Test files
│   ├── shareWorkflow.e2e.ts   # Main workflow tests
│   ├── errorScenarios.e2e.ts  # Error handling tests
│   ├── performance.e2e.ts     # Performance benchmarks
│   └── accessibility.e2e.ts   # Accessibility compliance
├── pageObjects/               # Page object models
│   ├── ShareScreenPO.ts       # Share screen interactions
│   ├── SharePreviewPO.ts      # Preview screen interactions
│   └── ShareOptionsPO.ts      # Share options modal
├── utils/                     # Test utilities
│   └── shareTestUtils.ts      # Share-specific utilities
├── config.json               # Jest configuration
├── setup.ts                  # Global test setup
└── README.md                 # This file
```

## Prerequisites

### iOS Testing
```bash
# Install iOS dependencies
npm install -g detox-cli
cd ios && pod install

# Build iOS app for testing
npm run detox:build:ios
```

### Android Testing
```bash
# Install Android dependencies
npm install -g detox-cli

# Ensure Android emulator is running
# Build Android app for testing
npm run detox:build:android
```

## Running Tests

### All Tests
```bash
# Run all e2e tests
npm run e2e:all

# Run on specific platform
npm run detox:test:ios
npm run detox:test:android
```

### Specific Test Suites
```bash
# Main workflow tests
npm run e2e:workflow

# Error scenario tests
npm run e2e:errors

# Performance tests
npm run e2e:performance

# Accessibility tests
npm run e2e:accessibility
```

### Individual Test Files
```bash
# Run specific test file
detox test e2e/__tests__/shareWorkflow.e2e.ts --configuration ios.sim.debug

# Run with specific test name pattern
detox test --testNamePattern="should create and download" --configuration ios.sim.debug
```

## Test Configuration

### Detox Configuration
The `.detoxrc.json` file configures:
- Device simulators (iOS/Android)
- App binary paths
- Test runner settings

### Jest Configuration
The `e2e/config.json` file configures:
- Test timeout (120 seconds)
- Test file patterns
- Coverage settings
- Setup files

## Test Categories

### 1. Workflow Tests (`shareWorkflow.e2e.ts`)

**Happy Path Scenarios:**
- Complete share creation and PDF download
- Native app sharing
- Email sharing
- Answer editing functionality

**Navigation Tests:**
- Back button functionality
- Screen transitions
- State preservation

**Performance Benchmarks:**
- Share generation within time limits
- UI responsiveness during operations

### 2. Error Scenarios (`errorScenarios.e2e.ts`)

**Network Error Handling:**
- Network disconnection during generation
- Network disconnection during PDF download
- Intermittent connectivity issues

**Server Error Handling:**
- 500 server errors
- API rate limiting
- Timeout scenarios

**Validation Errors:**
- Missing template selection
- Invalid date ranges
- Data validation failures

### 3. Performance Tests (`performance.e2e.ts`)

**Generation Performance:**
- Daily shares: < 15 seconds
- Weekly shares: < 25 seconds  
- Monthly shares: < 35 seconds

**PDF Performance:**
- PDF generation: < 10 seconds
- Multiple PDF generations
- Memory stability

**UI Responsiveness:**
- Interaction response times: < 1 second
- UI updates during generation
- Concurrent operation handling

### 4. Accessibility Tests (`accessibility.e2e.ts`)

**Screen Reader Compatibility:**
- VoiceOver/TalkBack navigation
- Accessibility label verification
- Announcement testing

**Visual Accessibility:**
- Dark mode support
- Large text support
- Color contrast validation

**Alternative Input:**
- Keyboard navigation
- Voice control support
- Reduced motion preferences

## Performance Benchmarks

| Operation | Benchmark | Measurement |
|-----------|-----------|-------------|
| Daily Share Generation | < 15 seconds | Time to preview screen |
| Weekly Share Generation | < 25 seconds | Time to preview screen |
| Monthly Share Generation | < 35 seconds | Time to preview screen |
| PDF Generation | < 10 seconds | Time to download completion |
| UI Interaction Response | < 1 second | Button press to visual feedback |
| Screen Navigation | < 2 seconds | Screen transition time |

## Page Object Model

### ShareScreenPO
- Navigation to share screen
- Period selection (daily/weekly/monthly)
- Template selection
- Share generation triggering
- Validation and error handling

### SharePreviewPO
- Preview screen loading verification
- Q&A content validation
- Answer editing functionality
- Share options triggering
- Back navigation

### ShareOptionsPO
- Modal opening/closing
- PDF download testing
- Native sharing testing
- Email composition testing
- Success/error handling

## Utilities and Helpers

### ShareTestUtils
- Test data generation
- Performance measurement
- Network condition simulation
- Content verification
- Error recovery testing

### TestUtils (from setup.ts)
- Screenshot capture
- Element waiting utilities
- Network condition management
- UI state verification
- Accessibility testing helpers

## Debugging Tests

### Screenshots
Tests automatically capture screenshots at key points:
- Test start/end
- Before/after major operations
- Error states
- Success states

Screenshots are saved with descriptive names including timestamps.

### Logging
Comprehensive logging throughout tests:
```typescript
console.log('🚀 Starting test operation');
console.log('📱 Navigation completed');
console.log('⚙️ Generation in progress');
console.log('✅ Test completed successfully');
```

### Error Handling
Robust error handling with context:
```typescript
try {
  await sharePreview.waitForScreenToLoad();
} catch (error) {
  await TestUtils.takeScreenshot('generation-failed');
  console.error('❌ Share generation failed:', error);
  throw error;
}
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build iOS app
        run: npm run detox:build:ios
      - name: Run E2E tests
        run: npm run detox:test:ios

  e2e-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Setup Android
        uses: android-actions/setup-android@v2
      - name: Start Android Emulator
        run: |
          $ANDROID_HOME/emulator/emulator -avd Pixel_4_API_30 -no-window &
      - name: Install dependencies
        run: npm ci
      - name: Build Android app
        run: npm run detox:build:android
      - name: Run E2E tests
        run: npm run detox:test:android
```

## Test Data Management

### Test Scenarios
Predefined test scenarios for different templates:
```typescript
const testScenarios = {
  wellness: {
    period: 'weekly',
    expectedQuestions: ['How has your mood been?', 'Sleep patterns?'],
    expectedDuration: 25000
  },
  medical: {
    period: 'daily', 
    expectedQuestions: ['New symptoms?', 'Medication effects?'],
    expectedDuration: 15000
  }
};
```

### Data Cleanup
Automatic cleanup after each test:
- App state reset
- Test data removal
- Network restoration
- Accessibility service cleanup

## Troubleshooting

### Common Issues

**App Not Starting:**
```bash
# Clean and rebuild
npm run detox:build:ios --cleanup
```

**Tests Timing Out:**
- Check network connectivity
- Verify backend services are running
- Increase timeout values for slow operations

**Simulator Issues:**
```bash
# Reset iOS simulator
xcrun simctl erase all

# Restart Android emulator
adb reboot
```

**Element Not Found:**
- Verify testID attributes are present
- Check accessibility labels
- Use screenshot debugging

### Debug Mode
Run tests with debug output:
```bash
detox test --loglevel verbose --configuration ios.sim.debug
```

## Contributing

### Adding New Tests
1. Follow existing naming conventions
2. Use page object models for UI interactions
3. Include proper error handling and cleanup
4. Add performance benchmarks where appropriate
5. Document test scenarios and expected outcomes

### Test Quality Guidelines
- **Reliability**: Tests should pass consistently
- **Speed**: Optimize for reasonable execution time
- **Maintainability**: Use page objects and utilities
- **Coverage**: Test both happy paths and edge cases
- **Documentation**: Clear descriptions and comments

## Metrics and Reporting

### Test Coverage
- Workflow coverage: 100% of sharing features
- Error scenario coverage: Network, server, validation
- Performance coverage: All major operations
- Accessibility coverage: Screen reader, keyboard, visual

### Success Criteria
- All tests pass on iOS and Android
- Performance benchmarks met
- Accessibility compliance verified
- Error handling robust
- Zero flaky tests

The e2e test suite ensures the sharing feature works reliably across platforms and provides an excellent user experience for all users.
