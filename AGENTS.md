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

### OAuth Scope: `drive.file`
**IMPORTANT**: This project uses `https://www.googleapis.com/auth/drive.file` scope exclusively.

**Why `drive.file` and NOT `spreadsheets.readonly`:**
- `spreadsheets.readonly` is a **restricted scope** requiring annual Google verification/review
- Future features will require **write operations** which would need the even more restricted `spreadsheets` scope
- `drive.file` is a **non-sensitive scope** with simpler verification process
- Provides better privacy model: per-file access rather than access to all spreadsheets

**How `drive.file` Works:**
- Grants access only to files the user explicitly opens/selects through the app
- When user selects a file via Google Picker, the picker grants the app access to that specific file
- No access to other files in user's Drive unless explicitly selected
- Supports both read and write operations on authorized files

### Google Picker API Key Requirement

The Google Picker API requires both an OAuth token AND an API key (Developer Key) to function properly with the `drive.file` scope.

**Why API Key is Required:**
- Google's authorization mechanism uses the API key to verify the picker is running on a known origin
- Without the API key, shared files may display in the picker but fail to load (404 errors)
- The API key enables the picker to properly grant `drive.file` access when user selects a file

**Configuration:**
```javascript
const picker = new google.picker.PickerBuilder()
  .setOAuthToken(accessToken)           // OAuth token for user authentication
  .setDeveloperKey(apiKey)              // API key for authorization mechanism
  .addView(/* ... */)
  .build();
```

**Environment Variables Required:**
- `VITE_GOOGLE_CLIENT_ID` - OAuth 2.0 Client ID
- `VITE_GOOGLE_API_KEY` - Browser API Key (no restrictions needed)

### Critical File Access Scenarios

The application must support three distinct file access scenarios:

#### 1. Owned Files (Files created/owned by the user)
- **Description**: Files that the user created or owns in their Google Drive
- **Access Method**: Google Picker selection OR manual URL/ID input
- **Expected Behavior**: Should work seamlessly with `drive.file` scope
- **Current Status**: ✅ Working
- **Technical Notes**: User has full control, picker selection grants access automatically

#### 2. Public Files (Files with "Anyone with the link" sharing)
- **Description**: Files with public sharing settings enabled
- **Access Method**: Manual URL/ID input (may not appear in picker)
- **Expected Behavior**: Should be accessible with just the link/ID
- **Current Status**: ❓ Needs testing
- **Technical Notes**: Public sharing means minimal auth required, may work without OAuth in some cases

#### 3. Shared Files (Files shared directly with the user)
- **Description**: Files where owner explicitly shared with user's email address
- **Access Method**: Manual URL/ID input (picker selection currently unreliable)
- **Expected Behavior**: Should work when user has view/edit permissions
- **Current Status**: ⚠️ Picker selection fails with 404, manual input may work
- **Technical Notes**:
  - Files appear in user's "Shared with me" in Google Drive
  - Picker can display them but `drive.file` scope may not grant access upon selection
  - Manual URL/ID input is the recommended approach for shared files
  - Requires proper sharing permissions from file owner

### Known Limitations
- **Shared files via picker**: The `drive.file` scope has known issues granting access to pre-existing shared files selected through the picker, even with API key configured
- **Recommended workaround**: Use manual URL/ID input for shared files instead of picker selection
- First-time access to any file requires appropriate sharing permissions from the owner
- The `drive.file` scope does not grant access to files until they are opened/selected through the app or accessed via manual input

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
