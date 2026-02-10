/**
 * Integration test for Google Sheets API
 *
 * This test requires a service account with access to a test spreadsheet.
 *
 * Setup:
 * 1. Create a test spreadsheet with sheets "Exercises" and "WorkoutLog"
 * 2. Set up a service account in Google Cloud Console
 * 3. Download the service account key JSON
 * 4. Set environment variables:
 *    - GOOGLE_SERVICE_ACCOUNT_EMAIL: Service account email
 *    - GOOGLE_PRIVATE_KEY: Private key (base64 encoded or direct)
 *    - TEST_SPREADSHEET_ID: ID of test spreadsheet
 *    - TEST_SPREADSHEET_ID_INVALID: ID of spreadsheet without proper schema
 *    - TEST_SPREADSHEET_ID_PUBLIC: ID of a public spreadsheet (optional)
 * 5. Share the test spreadsheet with the service account email (editor access)
 *
 * To run:
 *   npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { google } from 'googleapis';

describe('Google Sheets API Integration', () => {
  let sheets;
  let testSpreadsheetId;
  let invalidSpreadsheetId;
  let publicSpreadsheetId;

  beforeAll(async () => {
    // Load environment variables
    testSpreadsheetId = process.env.TEST_SPREADSHEET_ID;
    invalidSpreadsheetId = process.env.TEST_SPREADSHEET_ID_INVALID;
    publicSpreadsheetId = process.env.TEST_SPREADSHEET_ID_PUBLIC;

    if (!testSpreadsheetId) {
      throw new Error('TEST_SPREADSHEET_ID environment variable is required');
    }

    // Set up service account authentication
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKeyEncoded = process.env.GOOGLE_PRIVATE_KEY;

    if (!serviceAccountEmail || !privateKeyEncoded) {
      throw new Error('Service account credentials are required: GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY');
    }

    // Decode private key if it's base64 encoded
    let privateKey = privateKeyEncoded;
    try {
      privateKey = Buffer.from(privateKeyEncoded, 'base64').toString('utf-8');
    } catch (e) {
      // If decoding fails, assume it's already in plain text
      console.log('Using private key as-is (not base64 encoded)');
    }

    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    sheets = google.sheets({ version: 'v4', auth });
  });

  describe('Schema Validation', () => {
    it('should successfully read spreadsheet metadata', async () => {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheetId,
        fields: 'sheets.properties'
      });

      expect(response.data).toBeDefined();
      expect(response.data.sheets).toBeDefined();
      expect(Array.isArray(response.data.sheets)).toBe(true);
    });

    it('should find required sheets (Exercises and WorkoutLog)', async () => {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheetId,
        fields: 'sheets.properties'
      });

      const sheetNames = response.data.sheets.map(sheet => sheet.properties.title);

      expect(sheetNames).toContain('Exercises');
      expect(sheetNames).toContain('WorkoutLog');
    });

    it('should read headers from Exercises sheet', async () => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheetId,
        range: 'Exercises!1:1'
      });

      const headers = response.data.values?.[0] || [];

      expect(headers).toContain('Exercise');
      expect(headers).toContain('VideoLink');
    });

    it('should read headers from WorkoutLog sheet', async () => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheetId,
        range: 'WorkoutLog!1:1'
      });

      const headers = response.data.values?.[0] || [];

      expect(headers).toContain('Date');
      expect(headers).toContain('Section');
      expect(headers).toContain('Section Prescription');
      expect(headers).toContain('Exercise');
      expect(headers).toContain('Notes');
    });

    it('should read workout data from WorkoutLog', async () => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheetId,
        range: 'WorkoutLog!A1:E10'
      });

      expect(response.data.values).toBeDefined();
      expect(response.data.values.length).toBeGreaterThan(0);

      // First row should be headers
      const headers = response.data.values[0];
      expect(headers[0]).toBe('Date');
    });

    it('should handle invalid spreadsheet ID gracefully', async () => {
      const invalidId = 'invalid-spreadsheet-id-12345';

      await expect(
        sheets.spreadsheets.get({
          spreadsheetId: invalidId,
          fields: 'sheets.properties'
        })
      ).rejects.toThrow();
    });

    if (process.env.TEST_SPREADSHEET_ID_INVALID) {
      it('should detect missing sheets in invalid spreadsheet', async () => {
        const response = await sheets.spreadsheets.get({
          spreadsheetId: invalidSpreadsheetId,
          fields: 'sheets.properties'
        });

        const sheetNames = response.data.sheets.map(sheet => sheet.properties.title);

        // This should not have both required sheets
        const hasRequiredSheets = sheetNames.includes('Exercises') && sheetNames.includes('WorkoutLog');
        expect(hasRequiredSheets).toBe(false);
      });
    }
  });

  describe('Data Format Validation', () => {
    it('should have valid date format in WorkoutLog', async () => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheetId,
        range: 'WorkoutLog!A2:A10'
      });

      const dates = response.data.values?.flat().filter(Boolean) || [];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      if (dates.length > 0) {
        dates.forEach(date => {
          expect(date).toMatch(dateRegex);
        });
      } else {
        console.warn('No date data found in test spreadsheet');
      }
    });

    it('should read exercise data from Exercises sheet', async () => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheetId,
        range: 'Exercises!A1:B10'
      });

      expect(response.data.values).toBeDefined();
      expect(response.data.values.length).toBeGreaterThan(0);

      // First row should be headers
      const headers = response.data.values[0];
      expect(headers[0]).toBe('Exercise');
      expect(headers[1]).toBe('VideoLink');
    });
  });

  describe('Public Spreadsheet Access', () => {
    if (process.env.TEST_SPREADSHEET_ID_PUBLIC) {
      it('should be able to read public spreadsheet', async () => {
        const response = await sheets.spreadsheets.get({
          spreadsheetId: publicSpreadsheetId,
          fields: 'sheets.properties'
        });

        expect(response.data).toBeDefined();
        expect(response.data.sheets).toBeDefined();
      });

      it('should read data from public spreadsheet', async () => {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: publicSpreadsheetId,
          range: 'A1:E10'
        });

        expect(response.data.values).toBeDefined();
      });
    } else {
      it.skip('should be able to read public spreadsheet (TEST_SPREADSHEET_ID_PUBLIC not set)', () => {});
    }
  });

  describe('API Response Structure', () => {
    it('should return spreadsheet properties with title', async () => {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheetId,
        fields: 'properties.title'
      });

      expect(response.data.properties).toBeDefined();
      expect(response.data.properties.title).toBeDefined();
      expect(typeof response.data.properties.title).toBe('string');
    });

    it('should handle range with sheet name', async () => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheetId,
        range: 'WorkoutLog!A1:A1'
      });

      expect(response.data.range).toContain('WorkoutLog');
      expect(response.data.values).toBeDefined();
    });

    it('should return major dimension for values', async () => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheetId,
        range: 'WorkoutLog!A1:E1'
      });

      expect(response.data.majorDimension).toBe('ROWS');
    });
  });

  describe('Error Handling', () => {
    it('should handle permission denied gracefully', async () => {
      // Try to access a spreadsheet without proper permissions
      const unauthorizedId = 'unauthorized-spreadsheet-id';

      await expect(
        sheets.spreadsheets.get({
          spreadsheetId: unauthorizedId
        })
      ).rejects.toThrow();
    });

    it('should handle non-existent sheet name', async () => {
      await expect(
        sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheetId,
          range: 'NonExistentSheet!A1:A10'
        })
      ).rejects.toThrow();
    });

    it('should handle invalid range format', async () => {
      await expect(
        sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheetId,
          range: 'WorkoutLog!InvalidRange'
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete metadata request in reasonable time', async () => {
      const start = Date.now();

      await sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheetId,
        fields: 'sheets.properties'
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it('should complete values request in reasonable time', async () => {
      const start = Date.now();

      await sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheetId,
        range: 'WorkoutLog!A1:E100'
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });
  });
});
