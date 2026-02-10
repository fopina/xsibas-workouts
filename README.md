# Workout Planner

A web application that displays workout plans from a Google Sheet with an intuitive calendar interface. Features week and month views with color-coded workout days.

## Features

- **Anonymous access** to public Google Sheets (no login required)
- **Optional authentication** for private sheets and editing
- Week and month calendar views
- Color-coded days (green for workout days, gray for rest days)
- Editable workout notes (requires authentication)
- Responsive design for mobile and desktop
- Sheet selection via URL or direct input

## Environment Variables

To run this project, you will need to create a `.env` file in the root of the project and add the following environment variables:

*   `VITE_GOOGLE_CLIENT_ID`: Your Google Cloud project's OAuth 2.0 Client ID (required for authenticated access to private sheets and editing)
*   `VITE_GOOGLE_API_KEY`: Your Google Cloud project's API Key (required for anonymous access to public sheets)

### Setting up the API Key

**IMPORTANT:** The API key should be restricted to prevent unauthorized usage:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create or select your API key
3. Under **"API restrictions"**, select "Restrict key"
   - Enable only:
     - **Google Sheets API**
     - **Google Picker API**
4. Under **"Application restrictions"**, select "HTTP referrers (websites)"
   - Add your production origin(s):
     - `https://xsibas.pages.dev/*`
     - `https://*.xsibas.pages.dev/*`
   - For local development, also add:
     - `http://localhost:5173/*`
     - `https://localhost:5173/*`
     - `https://<your-lan-ip>:5173/*` (if using `npm run dev:lan`)

These restrictions ensure the API key can only:
- Access the required APIs (Sheets + Picker), not other Google services
- Be used from your specified origins (prevents unauthorized usage from other websites)

## Authentication Modes

### Anonymous Access (Public Sheets)
Users can view **public Google Sheets** without logging in. The application uses an API key to access publicly shared sheets in read-only mode. No authentication is required, providing instant access to workout plans.

### Authenticated Access (Private Sheets & Editing)
For private sheets or to edit workout notes, users must authenticate with their Google account.

**OAuth Scopes Used:**
- `https://www.googleapis.com/auth/spreadsheets` - Full access to read and write spreadsheet data
- `https://www.googleapis.com/auth/drive.file` - Access to files selected via Google Picker
- `https://www.googleapis.com/auth/userinfo.profile` - Display user's name when logged in

**Why spreadsheets instead of spreadsheets.readonly:**

The full `spreadsheets` scope (not just readonly) is required because the app allows users to update workout notes directly in their spreadsheets.

**Privacy and Security:**

The application **only accesses spreadsheets that users explicitly provide** either by:
- Direct sheet URL/ID input
- Selection through the Google Picker interface (authenticated users only)

The code can be reviewed to verify that it only opens specific files provided by the user and does not access any other spreadsheets in the user's Google Drive.

## Getting Started

1.  Install the dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```

    For LAN access (access from other devices on your network):
    ```bash
    npm run dev:lan
    ```

3. Open the application in your browser.

4. Enter your Google Sheet ID or paste the full Google Sheets URL:
   - Full URL example: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`
   - Direct ID: `YOUR_SHEET_ID`

   Alternatively, you can access a sheet directly via URL parameter:
   ```
   http://localhost:5173/?sheet=YOUR_SHEET_ID
   ```

5. **When to log in:**
   - If your sheet is **public**, you can view it immediately without logging in
   - If your sheet is **private**, you'll be prompted to log in
   - To **edit workout notes**, you must be logged in (even on public sheets)

## Sheet Format

The application expects a Google Sheet with a tab named "WorkoutLog" containing workout data with columns including at least a "Date" column in YYYY-MM-DD format.

## Testing

This project includes comprehensive unit and integration tests. See [TESTING.md](TESTING.md) for detailed testing documentation.

### Quick Start

```bash
# Run unit tests
npm run test:unit

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run integration tests (requires service account setup)
npm run test:integration
```

## Technologies Used

*   [Vite](https://vitejs.dev/)
*   [Preact](https://preactjs.com/)
*   [Google API](https://developers.google.com/gsuite/guides/overview)
*   [Vitest](https://vitest.dev/) - Testing framework

## Project Structure

```
/
├── .env
├── .gitignore
├── CLAUDE.md
├── index.html
├── package.json
├── vite.config.js
├── node_modules/
├── public/
│   └── vite.svg
└── src/
    ├── app.css              # Global styles and responsive design
    ├── app.jsx              # Main app component with sheet ID input
    ├── index.css
    ├── main.jsx
    ├── assets/
    │   └── preact.svg
    └── components/
        ├── auth.jsx         # Google OAuth with localStorage persistence
        └── workoutLog.jsx   # Calendar views (week/month) for workouts
```
