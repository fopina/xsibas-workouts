import { useState, useEffect } from 'preact/hooks';
import Auth from './components/auth';
import WorkoutLog from './components/workoutLog';
import './app.css';

const gapi = window.gapi;

const SHEETS_HISTORY_KEY = 'workout_sheets_history';

export function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showSheetSelector, setShowSheetSelector] = useState(false);

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

  // Get sheets history from localStorage
  const getSheetsHistory = () => {
    try {
      const stored = localStorage.getItem(SHEETS_HISTORY_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  // Save sheet to history
  const saveSheetToHistory = (sheetIdToSave) => {
    const history = getSheetsHistory();
    const now = new Date().toISOString();

    if (history[sheetIdToSave]) {
      // Update last opened time
      history[sheetIdToSave].lastOpened = now;
    } else {
      // Add new sheet
      history[sheetIdToSave] = {
        firstAdded: now,
        lastOpened: now
      };
    }

    localStorage.setItem(SHEETS_HISTORY_KEY, JSON.stringify(history));
  };

  const handleSheetSubmit = (e) => {
    e.preventDefault();
    const extractedId = extractSheetId(inputValue);
    if (extractedId) {
      setSheetId(extractedId);
      saveSheetToHistory(extractedId);
      // Update URL with sheet parameter
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('sheet', extractedId);
      window.history.pushState({}, '', newUrl);
      setShowSheetSelector(false);
      setInputValue('');
    }
  };

  const loadSheet = (sheetIdToLoad) => {
    setSheetId(sheetIdToLoad);
    saveSheetToHistory(sheetIdToLoad);
    // Update URL with sheet parameter
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('sheet', sheetIdToLoad);
    window.history.pushState({}, '', newUrl);
    setShowSheetSelector(false);
  };

  useEffect(() => {
    // Extract sheet ID from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const urlSheetId = params.get('sheet');
    if (urlSheetId) {
      setSheetId(urlSheetId);
      saveSheetToHistory(urlSheetId);
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

  const SheetSelector = () => {
    const history = getSheetsHistory();
    const sortedSheets = Object.entries(history)
      .sort(([, a], [, b]) => new Date(b.lastOpened) - new Date(a.lastOpened));

    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5em' }}>
          <h3 style={{ fontSize: '1.3em', margin: 0 }}>Select Workout Sheet</h3>
          {sheetId && (
            <button
              onClick={() => setShowSheetSelector(false)}
              style={{
                padding: '0.5em 1em',
                fontSize: '0.9em',
                backgroundColor: '#333',
                border: '1px solid #555'
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {sheetId && (
          <div style={{
            padding: '1em',
            backgroundColor: '#1a1a1a',
            borderRadius: '5px',
            border: '2px solid #8bc34a',
            marginBottom: '1.5em'
          }}>
            <p style={{ margin: 0, fontSize: '0.9em', color: '#aaa' }}>
              Currently open:
            </p>
            <p style={{
              margin: '0.5em 0 0 0',
              fontFamily: 'monospace',
              fontSize: '0.85em',
              wordBreak: 'break-all',
              color: '#8bc34a'
            }}>
              {sheetId}
            </p>
          </div>
        )}

        {sortedSheets.length > 0 && (
          <div style={{ marginBottom: '1.5em' }}>
            <h4 style={{ fontSize: '1em', color: '#aaa', marginBottom: '0.75em' }}>
              Recent Sheets
            </h4>
            {sortedSheets.map(([id, data]) => (
              <div
                key={id}
                onClick={() => loadSheet(id)}
                style={{
                  padding: '0.75em',
                  backgroundColor: id === sheetId ? '#1a3a1a' : '#1a1a1a',
                  border: id === sheetId ? '1px solid #8bc34a' : '1px solid #333',
                  borderRadius: '5px',
                  marginBottom: '0.5em',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = id === sheetId ? '#1a3a1a' : '#252525'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = id === sheetId ? '#1a3a1a' : '#1a1a1a'}
              >
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '0.85em',
                  wordBreak: 'break-all',
                  marginBottom: '0.3em'
                }}>
                  {id}
                </div>
                <div style={{ fontSize: '0.75em', color: '#666' }}>
                  Last opened: {new Date(data.lastOpened).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <h4 style={{ fontSize: '1em', color: '#aaa', marginBottom: '0.75em' }}>
            Load New Sheet
          </h4>
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
      </div>
    );
  };

  return (
    <div class="app-container">
      <header>
        <h1>Workout Planner</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {sheetId && (
            <button
              onClick={() => setShowSheetSelector(true)}
              style={{
                padding: '0.5em 1em',
                fontSize: '0.9em',
                backgroundColor: '#333',
                border: '1px solid #555',
                cursor: 'pointer'
              }}
            >
              Sheet
            </button>
          )}
          <Auth onAuthChange={handleAuthChange} />
        </div>
      </header>
      <main>
        {showSheetSelector || !sheetId ? (
          <SheetSelector />
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
