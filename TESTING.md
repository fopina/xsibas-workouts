# Testing Guide

This project includes comprehensive unit and integration tests to ensure code quality and reliability.

## Table of Contents

- [Quick Start](#quick-start)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [GitHub Actions](#github-actions)
- [Coverage](#coverage)
- [Writing Tests](#writing-tests)

## Quick Start

```bash
# Install dependencies
npm install

# Run all unit tests
npm run test:unit

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run integration tests (requires service account setup)
npm run test:integration
```

## Unit Tests

Unit tests cover individual functions and components in isolation using mocked dependencies.

### What's Tested

- **Schema Validator** (`src/utils/schemaValidator.test.js`)
  - Spreadsheet structure validation
  - Missing sheets detection
  - Header validation
  - Error handling
  - Error message formatting

- **Wake Lock Hook** (`src/hooks/useWakeLock.test.js`)
  - Wake Lock API support detection
  - Enable/disable functionality
  - localStorage persistence
  - Visibility change handling
  - Error handling (NotSupportedError, NotAllowedError)

- **App Utilities** (`src/app.test.js`)
  - Sheet ID extraction from URLs
  - Sheet ID truncation for display
  - Relative time formatting
  - localStorage sheet history management

### Running Unit Tests

```bash
# Run once
npm run test:unit

# Watch mode (automatically re-runs on file changes)
npm run test:watch

# With UI (interactive test runner)
npm run test:ui

# With coverage report
npm run test:coverage
```

### Test Coverage

Coverage reports are generated in the `coverage/` directory and include:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

View the HTML report by opening `coverage/index.html` in your browser after running `npm run test:coverage`.

## Integration Tests

Integration tests verify that the application works correctly with the actual Google Sheets API using a service account.

### Setup

#### 1. Create a Test Spreadsheet

Create a Google Spreadsheet with the following structure:

**Sheet: Exercises**
- Column A: Exercise
- Column B: VideoLink

**Sheet: WorkoutLog**
- Column A: Date (YYYY-MM-DD format)
- Column B: Section
- Column C: Section Prescription
- Column D: Exercise
- Column E: Notes

#### 2. Set Up Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Give it a name (e.g., "workout-tests")
   - Click "Create and Continue"
   - Skip role assignment (optional)
   - Click "Done"
5. Create a key for the service account:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Download the key file

#### 3. Share Spreadsheet with Service Account

1. Open your test spreadsheet
2. Click "Share" button
3. Add the service account email (found in the JSON key file)
4. Give it "Editor" or "Viewer" access
5. Click "Send"

#### 4. Set Environment Variables

Create a `.env.test` file or export environment variables:

```bash
# Service account credentials
export GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"

# Private key (base64 encoded or raw)
# To base64 encode: cat key.json | jq -r .private_key | base64 -w 0
export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# OR base64 encoded:
# export GOOGLE_PRIVATE_KEY="LS0tLS1CRUdJTi..."

# Test spreadsheet IDs
export TEST_SPREADSHEET_ID="your-valid-spreadsheet-id"
export TEST_SPREADSHEET_ID_INVALID="spreadsheet-without-proper-schema"
export TEST_SPREADSHEET_ID_PUBLIC="public-spreadsheet-id" # Optional
```

### Running Integration Tests

```bash
# Load environment variables (if using .env.test)
source .env.test

# Run integration tests
npm run test:integration
```

### What's Tested

- Schema validation against real spreadsheet
- Reading spreadsheet metadata
- Reading headers from sheets
- Reading workout data
- Invalid spreadsheet handling
- Public spreadsheet access
- API response structure
- Error handling (permissions, invalid ranges, etc.)
- Performance (response times)

## GitHub Actions

### Unit Tests Workflow

**Trigger:** Runs on every push and pull request to any branch

**Location:** `.github/workflows/unit-tests.yml`

**What it does:**
- Installs dependencies
- Runs unit tests
- Generates coverage report
- Comments test results on PRs (optional)
- Uploads coverage to Codecov (if configured)

### Integration Tests Workflow

**Trigger:**
- Manual dispatch (on-demand)
- Daily at 2 AM UTC

**Location:** `.github/workflows/integration-tests.yml`

**What it does:**
- Runs integration tests with service account
- Creates GitHub issue if scheduled run fails
- Uploads test results as artifacts

#### Setting Up GitHub Secrets

For integration tests to run in GitHub Actions, add these secrets to your repository:

1. Go to repository Settings > Secrets and variables > Actions
2. Add the following secrets:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account email
   - `GOOGLE_PRIVATE_KEY`: Private key (base64 encoded or raw)
   - `TEST_SPREADSHEET_ID`: Your test spreadsheet ID
   - `TEST_SPREADSHEET_ID_INVALID`: (Optional) Invalid spreadsheet ID
   - `TEST_SPREADSHEET_ID_PUBLIC`: (Optional) Public spreadsheet ID

#### Running Integration Tests Manually

1. Go to Actions tab in GitHub
2. Select "Integration Tests" workflow
3. Click "Run workflow"
4. Optionally provide a specific spreadsheet ID
5. Click "Run workflow" button

## Coverage

### Viewing Coverage Reports

After running `npm run test:coverage`:

```bash
# Open HTML report in browser
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Coverage Goals

- **Lines:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Statements:** > 80%

## Writing Tests

### Test Structure

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Mocking

```javascript
// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue('mocked value');

// Mock a module
vi.mock('./module', () => ({
  default: vi.fn()
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn()
};
global.localStorage = localStorageMock;
```

### Testing Preact Components

```javascript
import { render, fireEvent } from '@testing-library/preact';

it('should render and interact', () => {
  const { getByText } = render(<MyComponent />);
  const button = getByText('Click me');

  fireEvent.click(button);

  expect(getByText('Clicked!')).toBeTruthy();
});
```

### Testing Hooks

```javascript
import { renderHook, act } from '@testing-library/preact';

it('should manage state', () => {
  const { result } = renderHook(() => useMyHook());

  expect(result.current.value).toBe(0);

  act(() => {
    result.current.increment();
  });

  expect(result.current.value).toBe(1);
});
```

## Troubleshooting

### Tests Failing Locally

1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Clear test cache:
   ```bash
   npx vitest --clearCache
   ```

### Integration Tests Failing

1. Verify service account has access to spreadsheet
2. Check that spreadsheet has correct schema
3. Verify environment variables are set correctly
4. Check that private key is properly formatted (with `\n` for newlines)

### Coverage Not Generated

Make sure you have the coverage provider installed:
```bash
npm install -D @vitest/coverage-v8
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Preact](https://testing-library.com/docs/preact-testing-library/intro/)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Service Account Authentication](https://cloud.google.com/iam/docs/service-accounts)
