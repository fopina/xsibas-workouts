# xsibas-workouts

## Project Overview

- **Type**: Vite + Preact web application
- **Purpose**: Workout planner with Google authentication and Google Sheets integration
- **Dev Server**: `npm run dev` (runs on http://localhost:5173/)
- **Build**: `npm run build`

## Key Components

- `src/app.jsx` - Main app component with Google API integration
- `src/components/auth.jsx` - Google authentication component
- `src/components/workoutLog.jsx` - Workout logging interface

## Dependencies

- Preact ^10.27.2
- Vite ^7.2.4
- @preact/preset-vite ^2.10.2
- Google API (gapi) - loaded via CDN
