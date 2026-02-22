/**
 * Schema validation for workout spreadsheet
 * Validates that the spreadsheet has the expected structure
 */

const EXPECTED_SCHEMA = {
  sheets: ['Exercises', 'WorkoutLog'],
  headers: {
    Exercises: ['Exercise', 'VideoLink'],
    WorkoutLog: ['Date', 'Section', 'Section Prescription', 'Exercise', 'Notes']
  }
};

/**
 * Validates the spreadsheet schema
 * @param {Object} gapi - Google API client
 * @param {string} sheetId - Spreadsheet ID
 * @returns {Promise<{valid: boolean, errors: string[], sheetHeaders?: Record<string, string[]>}>}
 */
export async function validateSpreadsheetSchema(gapi, sheetId) {
  const errors = [];
  const sheetHeaders = {};

  // 1. Get spreadsheet metadata to check sheet names
  // This is outside try/catch to let auth/permission errors bubble up
  const metadataResponse = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties'
  });

  const sheets = metadataResponse.result.sheets || [];
  const sheetNames = sheets.map(sheet => sheet.properties.title);

  // 2. Check that all expected sheets exist
  for (const expectedSheet of EXPECTED_SCHEMA.sheets) {
    if (!sheetNames.includes(expectedSheet)) {
      errors.push(`Missing required sheet: "${expectedSheet}"`);
    }
  }

  // If sheets are missing, no point checking headers
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 3. Check headers for each sheet (parallelized)
  const headerChecks = await Promise.all(
    Object.entries(EXPECTED_SCHEMA.headers).map(async ([sheetName, expectedHeaders]) => {
      try {
        const headerResponse = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${sheetName}!1:1`
        });

        return {
          sheetName,
          expectedHeaders,
          actualHeaders: headerResponse.result.values?.[0] || [],
          error: null
        };
      } catch (err) {
        return { sheetName, expectedHeaders, actualHeaders: [], error: err };
      }
    })
  );

  for (const { sheetName, expectedHeaders, actualHeaders, error } of headerChecks) {
    if (error) {
      errors.push(`Failed to read headers from sheet "${sheetName}": ${error.message}`);
      continue;
    }

    sheetHeaders[sheetName] = actualHeaders;

    for (const expectedHeader of expectedHeaders) {
      if (!actualHeaders.includes(expectedHeader)) {
        errors.push(`Sheet "${sheetName}" is missing required column: "${expectedHeader}"`);
      }
    }

    if (actualHeaders.length === 0) {
      errors.push(`Sheet "${sheetName}" appears to be empty (no headers found)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sheetHeaders
  };
}

/**
 * Formats validation errors into a user-friendly message
 * @param {string[]} errors - Array of error messages
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(errors) {
  if (errors.length === 0) {
    return '';
  }

  // If it's an authentication error, return it directly without the validation prefix
  if (errors.length === 1 && errors[0] === 'Login expired. Login again') {
    return errors[0];
  }

  return `Spreadsheet validation failed:\n\n${errors.map(err => `• ${err}`).join('\n')}`;
}
