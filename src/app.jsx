import { useState, useEffect } from 'preact/hooks';
import Auth from './components/auth';
import WorkoutLog from './components/workoutLog';
import './app.css';

const gapi = window.gapi;

export function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [inputValue, setInputValue] = useState('');

  // Extract sheet ID from Google Sheets URL or return as-is if already an ID
  const extractSheetId = (input) => {
    const trimmed = input.trim();
    // Check if it's a URL
    if (trimmed.includes('docs.google.com/spreadsheets')) {
      const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : '';
    }
    // Otherwise assume it's a sheet ID
    return trimmed;
  };

  const handleSheetSubmit = (e) => {
    e.preventDefault();
    const extractedId = extractSheetId(inputValue);
    if (extractedId) {
      setSheetId(extractedId);
      // Update URL with sheet parameter
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('sheet', extractedId);
      window.history.pushState({}, '', newUrl);
    }
  };

  useEffect(() => {
    // Extract sheet ID from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const urlSheetId = params.get('sheet');
    if (urlSheetId) {
      setSheetId(urlSheetId);
    }
  }, []);

  useEffect(() => {
    // This effect handles the loading of the GAPI client library
    const checkGapiReady = setInterval(() => {
      if (window.gapi) {
        clearInterval(checkGapiReady);
        gapi.load('client', () => {
          setIsGapiLoaded(true);
        });
      }
    }, 100);
     return () => clearInterval(checkGapiReady);
  }, []);

  const handleAuthChange = (token) => {
    setAccessToken(token);
  };

  return (
    <div class="app-container">
      <header>
        <h1>Workout Planner</h1>
        <Auth onAuthChange={handleAuthChange} />
      </header>
      <main>
        {!sheetId ? (
          <div style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
            <h3 style={{ fontSize: '1.3em' }}>Enter Google Sheet</h3>
            <p style={{ color: '#888', fontSize: '0.9em', marginBottom: '1em' }}>
              Paste your Google Sheets URL or Sheet ID below:
            </p>
            <form onSubmit={handleSheetSubmit}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Sheet URL or ID"
                style={{
                  width: '100%',
                  padding: '0.75em',
                  fontSize: '0.9em',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  backgroundColor: '#1a1a1a',
                  color: '#fff',
                  marginBottom: '1em',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.75em',
                  fontSize: '1em'
                }}
              >
                Load Workout Sheet
              </button>
            </form>
            <p style={{ color: '#666', fontSize: '0.8em', marginTop: '1em', wordBreak: 'break-all' }}>
              Example: https://docs.google.com/spreadsheets/d/1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE/edit
            </p>
          </div>
        ) : accessToken && isGapiLoaded ? (
          <WorkoutLog accessToken={accessToken} sheetId={sheetId} />
        ) : (
          <p>Please log in with Google to view your workout plan.</p>
        )}
        {accessToken && !isGapiLoaded && (
            <p>Loading Google API client...</p>
        )}
      </main>
    </div>
  );
}
