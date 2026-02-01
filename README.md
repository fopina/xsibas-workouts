# Workout Planner

A web application that displays workout plans from a Google Sheet with an intuitive calendar interface. Features week and month views with color-coded workout days.

## Features

- Google OAuth authentication with persistent login
- Week and month calendar views
- Color-coded days (green for workout days, gray for rest days)
- Responsive design for mobile and desktop
- Sheet selection via URL or direct input

## Environment Variables

To run this project, you will need to create a `.env` file in the root of the project and add the following environment variable:

*   `VITE_GOOGLE_CLIENT_ID`: Your Google Cloud project's OAuth 2.0 Client ID.

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

3. Open the application in your browser and log in with Google.

4. Enter your Google Sheet ID or paste the full Google Sheets URL:
   - Full URL example: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`
   - Direct ID: `YOUR_SHEET_ID`

   Alternatively, you can access a sheet directly via URL parameter:
   ```
   http://localhost:5173/?sheet=YOUR_SHEET_ID
   ```

## Sheet Format

The application expects a Google Sheet with a tab named "WorkoutLog" containing workout data with columns including at least a "Date" column in YYYY-MM-DD format.

## Technologies Used

*   [Vite](https://vitejs.dev/)
*   [Preact](https://preactjs.com/)
*   [Google API](https://developers.google.com/gsuite/guides/overview)

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
