import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSpreadsheetSchema, formatValidationErrors } from './schemaValidator';

describe('schemaValidator', () => {
  describe('validateSpreadsheetSchema', () => {
    let mockGapi;

    beforeEach(() => {
      mockGapi = {
        client: {
          sheets: {
            spreadsheets: {
              get: vi.fn(),
              values: {
                get: vi.fn()
              }
            }
          }
        }
      };
    });

    it('should return valid when schema is correct', async () => {
      // Mock spreadsheet metadata with correct sheets
      mockGapi.client.sheets.spreadsheets.get.mockResolvedValue({
        result: {
          sheets: [
            { properties: { title: 'Exercises' } },
            { properties: { title: 'WorkoutLog' } }
          ]
        }
      });

      // Mock headers for Exercises sheet
      mockGapi.client.sheets.spreadsheets.values.get
        .mockResolvedValueOnce({
          result: {
            values: [['Exercise', 'VideoLink']]
          }
        })
        // Mock headers for WorkoutLog sheet
        .mockResolvedValueOnce({
          result: {
            values: [['Date', 'Section', 'Section Prescription', 'Exercise', 'Notes']]
          }
        });

      const result = await validateSpreadsheetSchema(mockGapi, 'test-sheet-id');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing sheets', async () => {
      // Mock spreadsheet with only one sheet
      mockGapi.client.sheets.spreadsheets.get.mockResolvedValue({
        result: {
          sheets: [
            { properties: { title: 'Exercises' } }
          ]
        }
      });

      const result = await validateSpreadsheetSchema(mockGapi, 'test-sheet-id');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required sheet: "WorkoutLog"');
    });

    it('should detect missing headers in Exercises sheet', async () => {
      mockGapi.client.sheets.spreadsheets.get.mockResolvedValue({
        result: {
          sheets: [
            { properties: { title: 'Exercises' } },
            { properties: { title: 'WorkoutLog' } }
          ]
        }
      });

      // Mock missing 'VideoLink' header
      mockGapi.client.sheets.spreadsheets.values.get
        .mockResolvedValueOnce({
          result: {
            values: [['Exercise']]
          }
        })
        .mockResolvedValueOnce({
          result: {
            values: [['Date', 'Section', 'Section Prescription', 'Exercise', 'Notes']]
          }
        });

      const result = await validateSpreadsheetSchema(mockGapi, 'test-sheet-id');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sheet "Exercises" is missing required column: "VideoLink"');
    });

    it('should detect missing headers in WorkoutLog sheet', async () => {
      mockGapi.client.sheets.spreadsheets.get.mockResolvedValue({
        result: {
          sheets: [
            { properties: { title: 'Exercises' } },
            { properties: { title: 'WorkoutLog' } }
          ]
        }
      });

      mockGapi.client.sheets.spreadsheets.values.get
        .mockResolvedValueOnce({
          result: {
            values: [['Exercise', 'VideoLink']]
          }
        })
        // Mock missing 'Notes' header
        .mockResolvedValueOnce({
          result: {
            values: [['Date', 'Section', 'Section Prescription', 'Exercise']]
          }
        });

      const result = await validateSpreadsheetSchema(mockGapi, 'test-sheet-id');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sheet "WorkoutLog" is missing required column: "Notes"');
    });

    it('should detect empty sheets', async () => {
      mockGapi.client.sheets.spreadsheets.get.mockResolvedValue({
        result: {
          sheets: [
            { properties: { title: 'Exercises' } },
            { properties: { title: 'WorkoutLog' } }
          ]
        }
      });

      // Mock empty sheet (no headers)
      mockGapi.client.sheets.spreadsheets.values.get
        .mockResolvedValueOnce({
          result: {
            values: [[]]
          }
        })
        .mockResolvedValueOnce({
          result: {
            values: [['Date', 'Section', 'Section Prescription', 'Exercise', 'Notes']]
          }
        });

      const result = await validateSpreadsheetSchema(mockGapi, 'test-sheet-id');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sheet "Exercises" appears to be empty (no headers found)');
    });

    it('should handle errors when reading headers', async () => {
      mockGapi.client.sheets.spreadsheets.get.mockResolvedValue({
        result: {
          sheets: [
            { properties: { title: 'Exercises' } },
            { properties: { title: 'WorkoutLog' } }
          ]
        }
      });

      // Mock error when reading headers
      mockGapi.client.sheets.spreadsheets.values.get
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce({
          result: {
            values: [['Date', 'Section', 'Section Prescription', 'Exercise', 'Notes']]
          }
        });

      const result = await validateSpreadsheetSchema(mockGapi, 'test-sheet-id');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Failed to read headers from sheet "Exercises": Permission denied');
    });

    it('should handle no sheets in spreadsheet', async () => {
      mockGapi.client.sheets.spreadsheets.get.mockResolvedValue({
        result: {
          sheets: []
        }
      });

      const result = await validateSpreadsheetSchema(mockGapi, 'test-sheet-id');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Missing required sheet: "Exercises"');
      expect(result.errors).toContain('Missing required sheet: "WorkoutLog"');
    });

    it('should allow authentication errors to bubble up', async () => {
      const authError = new Error('Auth required');
      mockGapi.client.sheets.spreadsheets.get.mockRejectedValue(authError);

      await expect(validateSpreadsheetSchema(mockGapi, 'test-sheet-id'))
        .rejects.toThrow('Auth required');
    });
  });

  describe('formatValidationErrors', () => {
    it('should return empty string for no errors', () => {
      const result = formatValidationErrors([]);
      expect(result).toBe('');
    });

    it('should return auth error directly without formatting', () => {
      const errors = ['Login expired. Login again'];
      const result = formatValidationErrors(errors);
      expect(result).toBe('Login expired. Login again');
    });

    it('should format single validation error', () => {
      const errors = ['Missing required sheet: "WorkoutLog"'];
      const result = formatValidationErrors(errors);
      expect(result).toContain('Spreadsheet validation failed:');
      expect(result).toContain('• Missing required sheet: "WorkoutLog"');
    });

    it('should format multiple validation errors', () => {
      const errors = [
        'Missing required sheet: "WorkoutLog"',
        'Sheet "Exercises" is missing required column: "VideoLink"'
      ];
      const result = formatValidationErrors(errors);
      expect(result).toContain('Spreadsheet validation failed:');
      expect(result).toContain('• Missing required sheet: "WorkoutLog"');
      expect(result).toContain('• Sheet "Exercises" is missing required column: "VideoLink"');
    });

    it('should use bullet points for all errors', () => {
      const errors = [
        'Error 1',
        'Error 2',
        'Error 3'
      ];
      const result = formatValidationErrors(errors);
      const bullets = result.match(/•/g);
      expect(bullets).toHaveLength(3);
    });
  });
});
