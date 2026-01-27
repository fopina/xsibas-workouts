# Workout Planner

This is a simple web application that allows users to view their workout plan from a Google Sheet.

## Environment Variables

To run this project, you will need to create a `.env` file in the root of the project and add the following environment variables:

*   `VITE_GOOGLE_CLIENT_ID`: Your Google Cloud project's OAuth 2.0 Client ID.
*   `VITE_GOOGLE_SHEET_ID`: The ID of the Google Sheet containing the workout data.

## Getting Started

1.  Install the dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```

## Technologies Used

*   [Vite](https://vitejs.dev/)
*   [Preact](https://preactjs.com/)
*   [Google API](https://developers.google.com/gsuite/guides/overview)

## Project Structure

```
/
├── .env
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── node_modules/
├── public/
│   └── vite.svg
└── src/
    ├── app.css
    ├── app.jsx
    ├── index.css
    ├── main.jsx
    ├── assets/
    │   └── preact.svg
    └── components/
        ├── auth.jsx
        └── workoutLog.jsx
```
