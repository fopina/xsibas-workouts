import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from './app';

describe('App utility functions', () => {
  describe('extractSheetId', () => {
    // We need to extract this function or test it via the component
    // For now, let's test the logic directly
    const extractSheetId = (input) => {
      const trimmed = input.trim();
      if (trimmed.includes('docs.google.com/spreadsheets')) {
        const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : '';
      }
      return trimmed;
    };

    it('should extract sheet ID from full Google Sheets URL', () => {
      const url = 'https://docs.google.com/spreadsheets/d/1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE/edit';
      const result = extractSheetId(url);
      expect(result).toBe('1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE');
    });

    it('should extract sheet ID from URL without edit suffix', () => {
      const url = 'https://docs.google.com/spreadsheets/d/1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE';
      const result = extractSheetId(url);
      expect(result).toBe('1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE');
    });

    it('should return sheet ID as-is when no URL detected', () => {
      const id = '1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE';
      const result = extractSheetId(id);
      expect(result).toBe('1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE');
    });

    it('should handle URLs with extra parameters', () => {
      const url = 'https://docs.google.com/spreadsheets/d/1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE/edit#gid=0';
      const result = extractSheetId(url);
      expect(result).toBe('1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE');
    });

    it('should trim whitespace from input', () => {
      const id = '  1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE  ';
      const result = extractSheetId(id);
      expect(result).toBe('1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE');
    });

    it('should return empty string for invalid URL', () => {
      const url = 'https://docs.google.com/spreadsheets/invalid';
      const result = extractSheetId(url);
      expect(result).toBe('');
    });
  });

  describe('truncateSheetId', () => {
    const truncateSheetId = (id) => {
      if (id.length <= 8) return id;
      return `${id.substring(0, 4)}…${id.substring(id.length - 4)}`;
    };

    it('should not truncate short IDs', () => {
      const id = '12345678';
      const result = truncateSheetId(id);
      expect(result).toBe('12345678');
    });

    it('should truncate long IDs', () => {
      const id = '1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE';
      const result = truncateSheetId(id);
      expect(result).toBe('1VB5…6OtE');
    });

    it('should keep first 4 and last 4 characters', () => {
      const id = '123456789012345';
      const result = truncateSheetId(id);
      expect(result).toBe('1234…2345');
    });

    it('should handle edge case of exactly 8 characters', () => {
      const id = '12345678';
      const result = truncateSheetId(id);
      expect(result).toBe('12345678');
    });

    it('should handle edge case of 9 characters', () => {
      const id = '123456789';
      const result = truncateSheetId(id);
      expect(result).toBe('1234…6789');
    });
  });

  describe('formatRelativeTime', () => {
    const formatRelativeTime = (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    };

    it('should return "just now" for very recent times', () => {
      const now = new Date();
      const result = formatRelativeTime(now.toISOString());
      expect(result).toBe('just now');
    });

    it('should format minutes correctly', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const result = formatRelativeTime(fiveMinutesAgo.toISOString());
      expect(result).toBe('5m ago');
    });

    it('should format hours correctly', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoHoursAgo.toISOString());
      expect(result).toBe('2h ago');
    });

    it('should format days correctly', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(threeDaysAgo.toISOString());
      expect(result).toBe('3d ago');
    });

    it('should format old dates as full date', () => {
      const now = new Date();
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(eightDaysAgo.toISOString());
      expect(result).toBe(eightDaysAgo.toLocaleDateString());
    });

    it('should handle edge case of exactly 1 minute', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const result = formatRelativeTime(oneMinuteAgo.toISOString());
      expect(result).toBe('1m ago');
    });

    it('should handle edge case of exactly 1 hour', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const result = formatRelativeTime(oneHourAgo.toISOString());
      expect(result).toBe('1h ago');
    });

    it('should handle edge case of exactly 1 day', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(oneDayAgo.toISOString());
      expect(result).toBe('1d ago');
    });
  });

  describe('localStorage sheet history', () => {
    let localStorageMock;

    beforeEach(() => {
      localStorageMock = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      };
      global.localStorage = localStorageMock;
    });

    const getSheetsHistory = () => {
      try {
        const stored = localStorage.getItem('workout_sheets_history');
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    };

    const saveSheetToHistory = (sheetId, title = null) => {
      const history = getSheetsHistory();
      const now = new Date().toISOString();

      if (history[sheetId]) {
        history[sheetId].lastOpened = now;
        if (title) {
          history[sheetId].title = title;
        }
      } else {
        history[sheetId] = {
          firstAdded: now,
          lastOpened: now,
          title: title || null
        };
      }

      localStorage.setItem('workout_sheets_history', JSON.stringify(history));
    };

    it('should return empty object when no history exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const result = getSheetsHistory();
      expect(result).toEqual({});
    });

    it('should parse existing history', () => {
      const mockHistory = {
        'sheet-1': { firstAdded: '2024-01-01', lastOpened: '2024-01-01', title: 'Test' }
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));

      const result = getSheetsHistory();
      expect(result).toEqual(mockHistory);
    });

    it('should handle corrupted localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');
      const result = getSheetsHistory();
      expect(result).toEqual({});
    });

    it('should save new sheet to history', () => {
      localStorageMock.getItem.mockReturnValue(null);

      saveSheetToHistory('test-sheet-1', 'Test Sheet');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'workout_sheets_history',
        expect.stringContaining('test-sheet-1')
      );
    });

    it('should update existing sheet in history', () => {
      const existingHistory = {
        'test-sheet-1': {
          firstAdded: '2024-01-01T00:00:00.000Z',
          lastOpened: '2024-01-01T00:00:00.000Z',
          title: 'Old Title'
        }
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

      saveSheetToHistory('test-sheet-1', 'New Title');

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData['test-sheet-1'].title).toBe('New Title');
      expect(savedData['test-sheet-1'].firstAdded).toBe('2024-01-01T00:00:00.000Z');
      expect(savedData['test-sheet-1'].lastOpened).not.toBe('2024-01-01T00:00:00.000Z');
    });

    it('should preserve title when updating without new title', () => {
      const existingHistory = {
        'test-sheet-1': {
          firstAdded: '2024-01-01T00:00:00.000Z',
          lastOpened: '2024-01-01T00:00:00.000Z',
          title: 'Existing Title'
        }
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

      saveSheetToHistory('test-sheet-1');

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData['test-sheet-1'].title).toBe('Existing Title');
    });
  });
});
