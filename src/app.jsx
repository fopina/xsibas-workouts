import { useState, useEffect } from 'preact/hooks';
import Auth from './components/auth';
import WorkoutLog from './components/workoutLog';
import Landing from './components/landing';
import { useWakeLock } from './hooks/useWakeLock';
import './app.css';

const gapi = window.gapi;

const SHEETS_HISTORY_KEY = 'workout_sheets_history';
const LAST_VIEW_KEY = 'workout_last_view';
const getCurrentRoute = () => `${window.location.pathname}${window.location.search}`;

export function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [forceLogoutVersion, setForceLogoutVersion] = useState(0);
  const [authUiMessage, setAuthUiMessage] = useState('');
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showSheetSelector, setShowSheetSelector] = useState(false);
  const [currentPath, setCurrentPath] = useState(getCurrentRoute());
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalonePwa, setIsStandalonePwa] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  // Simple router: keep state in sync for popstate + pushState/replaceState.
  useEffect(() => {
    const syncCurrentPath = () => {
      setCurrentPath(getCurrentRoute());
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    const dispatchLocationChange = () => window.dispatchEvent(new Event('locationchange'));

    window.history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      dispatchLocationChange();
      return result;
    };

    window.history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      dispatchLocationChange();
      return result;
    };

    const persistLastView = () => {
      if (window.location.pathname !== '/') {
        localStorage.setItem(LAST_VIEW_KEY, getCurrentRoute());
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistLastView();
      }
    };

    window.addEventListener('popstate', syncCurrentPath);
    window.addEventListener('locationchange', syncCurrentPath);
    window.addEventListener('pagehide', persistLastView);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', syncCurrentPath);
      window.removeEventListener('locationchange', syncCurrentPath);
      window.removeEventListener('pagehide', persistLastView);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Navigate function
  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(getCurrentRoute());
  };

  // Detect if running as standalone PWA
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone ||
                         document.referrer.includes('android-app://');

    setIsStandalonePwa(Boolean(isStandalone));

    const hasBeenDismissed = localStorage.getItem('installBannerDismissed') === 'true';

    if (isStandalone && window.location.pathname === '/') {
      const lastView = localStorage.getItem(LAST_VIEW_KEY);
      if (lastView && lastView !== '/') {
        window.history.replaceState({}, '', lastView);
        setCurrentPath(getCurrentRoute());
      }
    }

    if (!isStandalone && !hasBeenDismissed) {
      setShowInstallBanner(true);
    }
  }, []);

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('installBannerDismissed', 'true');
  };

  const showShareFeedback = (message) => {
    setShareMessage(message);
    setTimeout(() => setShareMessage(''), 2000);
  };

  const shareCurrentUrl = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title || 'Workout Planner',
          url
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showShareFeedback('Link copied');
        return;
      }

      window.prompt('Copy this URL:', url);
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
      console.error('Failed to share URL:', error);
      showShareFeedback('Share failed');
    }
  };

  // Prevent screen sleep throughout the app
  console.log('[App] Calling useWakeLock hook');
  const { isSupported, isActive, isEnabled, isRequesting, needsUserGesture, errorMessage, lastEvent, toggleWakeLock } = useWakeLock();
  console.log('[App] useWakeLock returned - isSupported:', isSupported, 'isActive:', isActive, 'isEnabled:', isEnabled);

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
      navigate(`/workout?sheet=${extractedId}`);
      setShowSheetSelector(false);
      setInputValue('');
    }
  };

  const loadSheet = (sheetIdToLoad) => {
    setSheetId(sheetIdToLoad);
    saveSheetToHistory(sheetIdToLoad);
    navigate(`/workout?sheet=${sheetIdToLoad}`);
    setShowSheetSelector(false);
  };

  const unloadSheet = () => {
    setSheetId('');
    navigate('/workout');
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
    // Persist last non-root route so standalone PWA can restore it on reopen.
    if (window.location.pathname !== '/') {
      localStorage.setItem(LAST_VIEW_KEY, getCurrentRoute());
    }

    // Keep selected sheet in sync with URL whenever route/query changes.
    const params = new URLSearchParams(window.location.search);
    const urlSheetId = params.get('sheet');
    if (urlSheetId) {
      setSheetId(urlSheetId);
      saveSheetToHistory(urlSheetId);
    } else {
      setSheetId('');
    }
  }, [currentPath]);

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
    if (token) {
      setAuthUiMessage('');
    }
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
        .setOwnedByMe(true)
        .setLabel('My Spreadsheets');

      const sharedView = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setMimeTypes('application/vnd.google-apps.spreadsheet')
        .setIncludeFolders(true)
        .setMode(google.picker.DocsViewMode.LIST)
        .setOwnedByMe(false)
        .setLabel('Shared with me');

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

  const openInGoogleSheets = (id) => {
    window.open(`https://docs.google.com/spreadsheets/d/${id}`, '_blank', 'noopener,noreferrer');
  };

  const SheetSelector = () => {
    const history = getSheetsHistory();
    const currentSheetData = sheetId ? history[sheetId] : null;
    const sortedSheets = Object.entries(history)
      .filter(([id]) => id !== sheetId) // Exclude current sheet
      .sort(([, a], [, b]) => new Date(b.lastOpened) - new Date(a.lastOpened));

    return (
      <div>
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
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => openInGoogleSheets(sheetId)}
                  style={{
                    padding: '0.3em 0.6em',
                    fontSize: '0.75em',
                    backgroundColor: '#333',
                    color: '#8bc34a',
                    border: '1px solid #555',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  GSheets
                </button>
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
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openInGoogleSheets(id);
                    }}
                    style={{
                      padding: '0.3em 0.6em',
                      fontSize: '0.75em',
                      backgroundColor: '#333',
                      color: '#8bc34a',
                      border: '1px solid #555',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    GSheets
                  </button>
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
              onInput={(e) => setInputValue(e.target.value)}
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
            Demo:{' '}
            <a
              href="/workout?sheet=1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE&date=2026-02-11"
              style={{ color: '#8bc34a', textDecoration: 'none' }}
            >
              /workout?sheet=1VB5ncABedr88ucuxfE6UdLv9OFKo0foTSJD0Qel6OtE&date=2026-02-11
            </a>
          </p>
        </div>
      </div>
    );
  };

  // Show landing page for root path
  if (new URL(currentPath, window.location.origin).pathname === '/') {
    return (
      <div class="app-container">
        <main>
          <Landing
            onGetStarted={() => navigate('/workout')}
            isLoggedIn={!!accessToken}
          />
        </main>
        <footer style={{
          textAlign: 'center',
          padding: '1em',
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

  // Show main app for /workout path
  return (
    <div class="app-container">
      <header>
        <img
          src="/xsibas300.png"
          alt="Workout Planner"
          onClick={() => navigate('/')}
          style={{
            height: '40px',
            width: 'auto',
            objectFit: 'contain',
            cursor: 'pointer'
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isStandalonePwa && (
            <button
              onClick={shareCurrentUrl}
              style={{
                padding: '0.4em 0.7em',
                fontSize: '0.8em',
                backgroundColor: '#333',
                border: '1px solid #555',
                cursor: 'pointer'
              }}
            >
              Share
            </button>
          )}
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
          <Auth accessToken={accessToken} onAuthChange={handleAuthChange} forceLogoutVersion={forceLogoutVersion} />
        </div>
      </header>
      <main>
        {shareMessage && (
          <div style={{
            backgroundColor: '#1a2a1a',
            border: '1px solid #4a7c4a',
            borderRadius: '4px',
            padding: '0.5em 0.75em',
            marginBottom: '0.75em',
            fontSize: '0.85em',
            color: '#8bc34a',
            textAlign: 'center'
          }}>
            {shareMessage}
          </div>
        )}

        {authUiMessage && (
          <div style={{
            backgroundColor: '#2a1a1a',
            border: '1px solid #a44',
            borderRadius: '4px',
            padding: '0.75em',
            marginBottom: '1em',
            fontSize: '0.9em',
            color: '#ffb3b3'
          }}>
            <div>{authUiMessage}</div>
            <div style={{ marginTop: '0.35em', fontSize: '0.8em', color: '#aaa' }}>
              stored email hint: {localStorage.getItem('google_user_email') || 'none'}
            </div>
          </div>
        )}

        {/* Install to home screen banner */}
        {showInstallBanner && (
          <div style={{
            backgroundColor: '#2a4a2a',
            border: '1px solid #4a7c4a',
            borderRadius: '4px',
            padding: '0.75em',
            marginBottom: '1em',
            fontSize: '0.9em',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1em'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flex: 1 }}>
              <span style={{ fontSize: '1.2em' }}>📱</span>
              <span style={{ color: '#d4f4d4' }}>
                Add to Home Screen for the best experience
              </span>
            </div>
            <button
              onClick={dismissInstallBanner}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#8bc34a',
                cursor: 'pointer',
                fontSize: '1.4em',
                padding: '0',
                lineHeight: 1,
                minWidth: '24px',
                minHeight: '24px'
              }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Wake Lock control banner - always visible */}
        {!isSupported ? (
          <div style={{
            backgroundColor: '#2a1a1a',
            border: '1px solid #a44',
            borderRadius: '4px',
            padding: '0.75em',
            marginBottom: '1em',
            fontSize: '0.9em',
            color: '#ff6b6b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1em'
          }}>
            <span>⚠️ Screen auto-lock cannot be disabled - adjust device settings for better workout experience</span>
          </div>
        ) : (
          <div style={{
            backgroundColor: isActive ? '#1a2a1a' : '#2a2a1a',
            border: `1px solid ${isActive ? '#4a7c4a' : '#555'}`,
            borderRadius: '4px',
            padding: '0.75em',
            marginBottom: '1em',
            fontSize: '0.9em',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1em'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
              <span style={{ color: isActive ? '#8bc34a' : '#999' }}>
                {isActive ? '✓' : '○'} Keep screen awake
              </span>
              {needsUserGesture ? (
                <span style={{ color: '#ffb347', fontSize: '0.85em' }}>
                  (tap to re-enable)
                </span>
              ) : errorMessage ? (
                <span style={{ color: '#ff6b6b', fontSize: '0.85em' }}>
                  ({errorMessage})
                </span>
              ) : isEnabled && !isActive && (
                <span style={{ color: '#666', fontSize: '0.85em' }}>
                  ({isRequesting ? 'activating...' : 'waiting...'})
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25em' }}>
              {!errorMessage && !needsUserGesture && isEnabled && !isActive && lastEvent && (
                <span style={{ color: '#888', fontSize: '0.75em' }}>
                  state: {lastEvent}
                </span>
              )}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: '0.5em'
              }}>
                <span style={{ fontSize: '0.85em', color: '#999' }}>
                  {isEnabled && !needsUserGesture ? 'ON' : 'OFF'}
                </span>
                <div
                  onClick={toggleWakeLock}
                  style={{
                    width: '44px',
                    height: '24px',
                    backgroundColor: isEnabled && !needsUserGesture ? '#8bc34a' : '#555',
                    borderRadius: '12px',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: isEnabled && !needsUserGesture ? '22px' : '2px',
                    transition: 'left 0.2s'
                  }} />
                </div>
              </label>
            </div>
          </div>
        )}

        {showSheetSelector || !sheetId ? (
          <SheetSelector />
        ) : isGapiLoaded ? (
          <WorkoutLog
            accessToken={accessToken}
            sheetId={sheetId}
            onSheetTitleLoaded={updateSheetTitle}
            onSessionExpired={() => {
              setAuthUiMessage('Login expired. Login again');
              setAccessToken(null);
              setForceLogoutVersion(v => v + 1);
            }}
            onAuthRequired={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : (
          <div class="loading-state">
            <div class="loading-spinner large" aria-hidden="true" />
            <div>Loading Google API client...</div>
          </div>
        )}
      </main>
      <footer style={{
        textAlign: 'center',
        padding: '1em',
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
