import { beforeEach, vi } from 'vitest';

// Mock window.gapi globally
global.gapi = {
  load: vi.fn(),
  client: {
    init: vi.fn(),
    sheets: {
      spreadsheets: {
        get: vi.fn(),
        values: {
          get: vi.fn(),
          update: vi.fn()
        }
      }
    }
  }
};

// Mock google globally for picker
global.google = {
  accounts: {
    oauth2: {
      initTokenClient: vi.fn(),
      revoke: vi.fn()
    }
  },
  picker: {
    PickerBuilder: vi.fn(),
    DocsView: vi.fn(),
    ViewId: {
      SPREADSHEETS: 'spreadsheets'
    },
    DocsViewMode: {
      LIST: 'list'
    },
    Action: {
      PICKED: 'picked'
    }
  }
};

// Mock console methods to reduce test noise
beforeEach(() => {
  vi.clearAllMocks();
});
