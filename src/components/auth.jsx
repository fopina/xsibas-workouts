import { useState, useEffect } from 'preact/hooks';

const STORAGE_KEY = 'google_access_token';

const Auth = ({ onAuthChange }) => {
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  // Restore token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY);
    if (storedToken) {
      console.log('Restored token from localStorage');
      setAccessToken(storedToken);
      onAuthChange(storedToken);
    }
  }, [onAuthChange]);

  useEffect(() => {
    const initializeGis = () => {
      if (window.google && window.google.accounts) {
        console.log('Initializing Google Identity Services');
        console.log('Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/spreadsheets',
          callback: (tokenResponse) => {
            console.log('Token response received:', tokenResponse);
            if (tokenResponse && tokenResponse.access_token) {
              setAccessToken(tokenResponse.access_token);
              localStorage.setItem(STORAGE_KEY, tokenResponse.access_token);
              onAuthChange(tokenResponse.access_token);
            }
          },
        });
        setTokenClient(client);
        console.log('Token client initialized');
      }
    };

    // The GIS script is loaded asynchronously. We need to wait for it.
    // A simple timeout is used here, but a more robust solution could be implemented.
    const checkGisReady = setInterval(() => {
      if (window.google && window.google.accounts) {
        clearInterval(checkGisReady);
        initializeGis();
      }
    }, 100);

    return () => clearInterval(checkGisReady);
  }, [onAuthChange]);

  const handleLogin = () => {
    console.log('Login button clicked');
    console.log('Token client available:', !!tokenClient);
    if (tokenClient) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      console.log('Requesting access token...');
      tokenClient.requestAccessToken();
    } else {
      console.error('Token client not initialized');
    }
  };

  const handleLogout = () => {
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken, () => {
        setAccessToken(null);
        localStorage.removeItem(STORAGE_KEY);
        onAuthChange(null);
      });
    }
  };

  return (
    <div>
      {!accessToken && (
        <button onClick={handleLogin}>Log In with Google</button>
      )}
      {accessToken && (
        <button onClick={handleLogout} style={{ fontSize: '0.85em', padding: '0.4em 0.8em' }}>
          Log Out
        </button>
      )}
    </div>
  );
};

export default Auth;
