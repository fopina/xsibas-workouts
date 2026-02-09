# AI Agents Context

## Project
Workout planner web app built with Preact and Vite that displays workout plans from Google Sheets with calendar interface.

## Tech Stack
- **Framework**: Preact 10.27
- **Build Tool**: Vite 7.2
- **Dev Server**: Configured for LAN access (0.0.0.0:5173, allowedHosts: true)
- **Authentication**: Google OAuth 2.0 with localStorage token persistence
- **Data Source**: Google Sheets API (read-only)
- **File Selection**: Google Picker API for browsing and selecting spreadsheets

## Google API Configuration

### OAuth Scope: `spreadsheets`
**IMPORTANT**: This project uses `https://www.googleapis.com/auth/spreadsheets` scope (full read/write access).

**Why `spreadsheets` and NOT `drive.file`:**
- `drive.file` does **not grant access to the Google Sheets API** for reading spreadsheet content
- `drive.file` only allows reading file metadata, not the actual cell data through the Sheets API
- `spreadsheets` scope is required to use `gapi.client.sheets.spreadsheets.values.get()` and `values.update()` APIs
- The full scope (not readonly) is needed because the app allows users to update workout notes in their spreadsheets
- The application **only accesses spreadsheets explicitly provided by users** via direct URL/ID input or picker selection

**Privacy and Security:**
- The code can be reviewed to verify it only opens specific files provided by the user
- No access to other spreadsheets unless explicitly selected or provided by the user
- Write operations are limited to user-initiated actions (e.g., updating workout notes)

**Verification Requirements:**
- `spreadsheets` is a **restricted scope** requiring Google verification/review
- The verification process ensures the app meets Google's security and privacy standards

**Environment Variables Required:**
- `VITE_GOOGLE_CLIENT_ID` - OAuth 2.0 Client ID

### File Access Scenarios

The application supports accessing spreadsheets that users explicitly provide:

#### 1. Owned Files (Files created/owned by the user)
- **Description**: Files that the user created or owns in their Google Drive
- **Access Method**: Manual URL/ID input
- **Expected Behavior**: Works seamlessly with `spreadsheets.readonly` scope
- **Current Status**: ✅ Working
- **Technical Notes**: User has full control over their own files

#### 2. Public Files (Files with "Anyone with the link" sharing)
- **Description**: Files with public sharing settings enabled
- **Access Method**: Manual URL/ID input
- **Expected Behavior**: Should be accessible with just the link/ID
- **Current Status**: ✅ Working
- **Technical Notes**: Public sharing allows authenticated access via Sheets API

#### 3. Shared Files (Files shared directly with the user)
- **Description**: Files where owner explicitly shared with user's email address
- **Access Method**: Manual URL/ID input
- **Expected Behavior**: Works when user has view permissions
- **Current Status**: ✅ Working
- **Technical Notes**:
  - Files shared with the user's email address are accessible via Sheets API
  - Requires proper sharing permissions from file owner

### Known Limitations
- First-time access to any file requires appropriate sharing permissions from the owner
- The `spreadsheets.readonly` scope grants read-only access to all user's spreadsheets (hence the Google verification requirement)

## Wake Lock Implementation

The app uses the Screen Wake Lock API to prevent mobile devices from sleeping during workout sessions.

### Implementation Details
- **Location**: `src/hooks/useWakeLock.js` custom hook
- **Integrated in**: `WorkoutLog` component
- **Browser API**: `navigator.wakeLock.request('screen')`
- **Fallback**: User-friendly notification on unsupported browsers reminding them to disable auto-lock manually

### Behavior
- Wake lock activates when viewing a workout
- Automatically releases when:
  - User navigates away from workout
  - Tab becomes hidden
  - Component unmounts
- Re-acquires when tab becomes visible again

### Browser Support
- Chrome/Edge 84+
- Safari 16.4+
- Firefox: Not yet supported (as of 2025)

### User Experience
- **Supported browsers**: Wake lock silently activates, no UI changes
- **Unsupported browsers**: Orange tip message appears at top of workout view:
  > 💡 Tip: Disable auto-lock on your device for a better workout experience

### Testing
- Open workout on mobile device
- Screen should not auto-lock during viewing
- Switching tabs releases the lock
- Returning to tab re-acquires the lock
- Check console for "Wake Lock activated" or "Wake Lock API not supported" messages

## Structure
- `src/components/auth.jsx` - Google OAuth authentication with token persistence
- `src/components/workoutLog.jsx` - Calendar views (week/month) and workout display
- `src/hooks/useWakeLock.js` - Wake Lock API hook for preventing screen sleep
- `src/app.jsx` - Main app with sheet ID input form
- `src/app.css` - Global styles and responsive design
- `vite.config.js` - Vite configuration with LAN server settings

## Key Features
- Week and month calendar views with color-coded workout days
- Sheet ID via URL parameter (?sheet=SHEET_ID) or direct input
- Section-based workout organization with visual hierarchy
- Responsive design for mobile and desktop

## Data Patterns
- Google Sheet must have "WorkoutLog" tab with Date column (YYYY-MM-DD format)
- Google Sheet must have "Exercises" tab with Exercise and VideoLink columns
- Exercise names in WorkoutLog are mapped to VideoLink from Exercises tab
- Workouts grouped by Section with Section Prescription shown once per section
- UI removes redundant fields (Date, Day, Section) from individual exercises
- Exercise names are clickable links to their video URLs when available

## Commands
- `npm run dev` - Start dev server (localhost only)
- `npm run dev:lan` - Start dev server with network access
- `npm run build` - Production build
- `npm run preview` - Preview production build

## UI/UX Guidelines
- Clean, minimal interface without clutter
- Green color (#8bc34a) for workout indicators
- Section-based organization with clear visual hierarchy
- Remove redundant information in workout display
