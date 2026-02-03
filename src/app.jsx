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
  const saveSheetToHistory = (sheetIdToSave, title = null) => {
    const history = getSheetsHistory();
    const now = new Date().toISOString();

    if (history[sheetIdToSave]) {
      // Update last opened time and title if provided
      history[sheetIdToSave].lastOpened = now;
      if (title) {
        history[sheetIdToSave].title = title;
      }
    } else {
      // Add new sheet
      history[sheetIdToSave] = {
        firstAdded: now,
        lastOpened: now,
        title: title || null
      };
    }

    localStorage.setItem(SHEETS_HISTORY_KEY, JSON.stringify(history));
  };

  // Update sheet title in history
  const updateSheetTitle = (sheetIdToUpdate, title) => {
    saveSheetToHistory(sheetIdToUpdate, title);
  };

  // Truncate sheet ID for display
  const truncateSheetId = (id) => {
    if (id.length <= 8) return id;
    return `${id.substring(0, 4)}…${id.substring(id.length - 4)}`;
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

  const unloadSheet = () => {
    setSheetId('');
    // Remove sheet parameter from URL
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('sheet');
    window.history.pushState({}, '', newUrl);
  };

  const deleteSheetFromHistory = (sheetIdToDelete) => {
    const history = getSheetsHistory();
    delete history[sheetIdToDelete];
    localStorage.setItem(SHEETS_HISTORY_KEY, JSON.stringify(history));
    // Force re-render by toggling sheet selector
    setShowSheetSelector(false);
    setTimeout(() => setShowSheetSelector(true), 0);
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

  const openPicker = () => {
    console.log('Opening picker...');
    // Load the Picker API
    gapi.load('picker', () => {
      console.log('Picker API loaded');
      const ownedView = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setMimeTypes('application/vnd.google-apps.spreadsheet')
        .setIncludeFolders(true)
        .setMode(google.picker.DocsViewMode.LIST)
        .setOwnedByMe(true);

      const sharedView = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setMimeTypes('application/vnd.google-apps.spreadsheet')
        .setIncludeFolders(true)
        .setMode(google.picker.DocsViewMode.LIST)
        .setOwnedByMe(false);

      const pickerBuilder = new google.picker.PickerBuilder()
        .addView(ownedView)
        .addView(sharedView)
        .setOAuthToken(accessToken)
        .setCallback((data) => {
          console.log('Picker callback - action:', data.action);
          console.log('Picker callback - full data:', data);
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            console.log('Selected document:', doc);
            console.log('Document ID:', doc.id);
            const pickedSheetId = doc.id;
            console.log('Calling loadSheet with ID:', pickedSheetId);
            loadSheet(pickedSheetId);
          }
        });

      // Add developer key if available (required for proper drive.file authorization)
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') {
        console.log('Setting developer key for picker');
        pickerBuilder.setDeveloperKey(apiKey);
      } else {
        console.warn('No API key configured - shared file access may not work properly');
      }

      const picker = pickerBuilder.build();
      console.log('Picker built, showing...');
      picker.setVisible(true);
    });
  };

  const SheetSelector = () => {
    const history = getSheetsHistory();
    const currentSheetData = sheetId ? history[sheetId] : null;
    const sortedSheets = Object.entries(history)
      .filter(([id]) => id !== sheetId) // Exclude current sheet
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5em' }}>
              <p style={{ margin: 0, fontSize: '0.9em', color: '#aaa' }}>
                Currently open:
              </p>
              <button
                onClick={unloadSheet}
                style={{
                  padding: '0.3em 0.6em',
                  fontSize: '0.75em',
                  backgroundColor: '#933',
                  color: '#fff',
                  border: '1px solid #a44',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Unload
              </button>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div>
                <div style={{ fontSize: '1em', color: '#8bc34a', marginBottom: '0.25em' }}>
                  {currentSheetData?.title || 'Untitled Sheet'}
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '0.75em',
                  color: '#666'
                }}>
                  {truncateSheetId(sheetId)}
                </div>
              </div>
              {currentSheetData && (
                <div style={{ fontSize: '0.75em', color: '#666', whiteSpace: 'nowrap' }}>
                  {formatRelativeTime(currentSheetData.lastOpened)}
                </div>
              )}
            </div>
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
                style={{
                  padding: '0.75em',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '5px',
                  marginBottom: '0.5em',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div
                  onClick={() => loadSheet(id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9em', marginBottom: '0.25em' }}>
                      {data.title || 'Untitled Sheet'}
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '0.75em',
                      color: '#666'
                    }}>
                      {truncateSheetId(id)}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75em', color: '#666', whiteSpace: 'nowrap' }}>
                    {formatRelativeTime(data.lastOpened)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSheetFromHistory(id);
                  }}
                  style={{
                    padding: '0.3em 0.6em',
                    fontSize: '0.75em',
                    backgroundColor: '#333',
                    color: '#999',
                    border: '1px solid #444',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#933';
                    e.target.style.color = '#fff';
                    e.target.style.borderColor = '#a44';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#333';
                    e.target.style.color = '#999';
                    e.target.style.borderColor = '#444';
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {accessToken && (
          <div style={{ marginBottom: '1.5em' }}>
            <button
              onClick={openPicker}
              style={{
                width: '100%',
                padding: '0.75em',
                fontSize: '0.9em',
                backgroundColor: '#1a1a1a',
                border: '1px solid #555',
                borderRadius: '5px',
                cursor: 'pointer',
                color: '#8bc34a'
              }}
            >
              📁 Pick from Google Drive
            </button>
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
        <h1>XSibas</h1>
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
          <WorkoutLog
            accessToken={accessToken}
            sheetId={sheetId}
            onSheetTitleLoaded={updateSheetTitle}
          />
        ) : (
          <p>Please log in with Google to view your workout plan.</p>
        )}
        {accessToken && !isGapiLoaded && (
            <p>Loading Google API client...</p>
        )}
      </main>
      <footer style={{
        textAlign: 'center',
        padding: '1em',
        marginTop: '2em',
        borderTop: '1px solid #333',
        fontSize: '0.9em',
        color: '#666'
      }}>
        <a href="/privacy/" style={{ color: '#8bc34a', textDecoration: 'none' }}>
          Privacy Policy
        </a>
      </footer>
    </div>
  );
}
