# AI Agents Context

## Project
Workout planner web app built with Preact and Vite that displays workout plans from Google Sheets with calendar interface.

## Tech Stack
- **Framework**: Preact 10.27
- **Build Tool**: Vite 7.2
- **Dev Server**: Configured for LAN access (0.0.0.0:5173, allowedHosts: true)
- **Authentication**: Google OAuth 2.0 with localStorage token persistence
- **Data Source**: Google Sheets API (read-only)

## Structure
- `src/components/auth.jsx` - Google OAuth authentication with token persistence
- `src/components/workoutLog.jsx` - Calendar views (week/month) and workout display
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
- Workouts grouped by Section with Section Prescription shown once per section
- UI removes redundant fields (Date, Day, Section, VideoLink) from individual exercises
- Exercise names are linked to VideoLink column if available

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
