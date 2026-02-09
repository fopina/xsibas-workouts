import { useState, useEffect } from 'preact/hooks';

const STORAGE_KEY = 'google_access_token';
const USER_NAME_KEY = 'google_user_name';

// OAuth configuration
const OAUTH_REDIRECT_URI = import.meta.env.VITE_OAUTH_REDIRECT_URI || 'https://xsibas-workouts.pages.dev/oauth/callback';
const OAUTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const OAUTH_SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';

// Detect if we should use the redirect proxy (for feature branches) or GIS (for production)
const USE_REDIRECT_PROXY = import.meta.env.VITE_USE_OAUTH_PROXY === 'true' ||
  window.location.hostname.includes('--') || // Cloudflare Pages preview branches use --
  window.location.hostname.includes('localhost'); // Local dev

const Auth = ({ onAuthChange }) => {
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [userName, setUserName] = useState(null);

  // Restore token and user name from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY);
    const storedUserName = localStorage.getItem(USER_NAME_KEY);
    if (storedToken) {
      console.log('Restored token from localStorage');
      setAccessToken(storedToken);
      onAuthChange(storedToken);
      if (storedUserName) {
        setUserName(storedUserName);
      }
    }
  }, [onAuthChange]);

  // Initialize Google Identity Services (for production)
  useEffect(() => {
    if (!USE_REDIRECT_PROXY) {
      const initializeGis = () => {
        if (window.google && window.google.accounts) {
          console.log('Initializing Google Identity Services (production mode)');
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: OAUTH_CLIENT_ID,
            scope: OAUTH_SCOPES,
            callback: async (tokenResponse) => {
              console.log('Token response received:', tokenResponse);
              if (tokenResponse && tokenResponse.access_token) {
                setAccessToken(tokenResponse.access_token);
                localStorage.setItem(STORAGE_KEY, tokenResponse.access_token);
                onAuthChange(tokenResponse.access_token);

                // Fetch user info
                try {
                  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: {
                      Authorization: `Bearer ${tokenResponse.access_token}`
                    }
                  });
                  const userInfo = await userInfoResponse.json();
                  if (userInfo.name) {
                    setUserName(userInfo.name);
                    localStorage.setItem(USER_NAME_KEY, userInfo.name);
                  }
                } catch (err) {
                  console.error('Error fetching user info:', err);
                }
              }
            },
          });
          setTokenClient(client);
          console.log('Token client initialized');
        }
      };

      const checkGisReady = setInterval(() => {
        if (window.google && window.google.accounts) {
          clearInterval(checkGisReady);
          initializeGis();
        }
      }, 100);

      return () => clearInterval(checkGisReady);
    }
  }, [onAuthChange]);

  // Handle OAuth redirect callback (for feature branches)
  useEffect(() => {
    if (USE_REDIRECT_PROXY) {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('oauth_error');

      if (error) {
        console.error('OAuth error:', error, urlParams.get('oauth_error_description'));
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (code) {
        console.log('OAuth code received, exchanging for token...');
        try {
          // Exchange authorization code for access token
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              code,
              client_id: OAUTH_CLIENT_ID,
              redirect_uri: OAUTH_REDIRECT_URI,
              grant_type: 'authorization_code',
            }),
          });

          const tokenData = await tokenResponse.json();

          if (tokenData.access_token) {
            console.log('Access token received');
            setAccessToken(tokenData.access_token);
            localStorage.setItem(STORAGE_KEY, tokenData.access_token);
            onAuthChange(tokenData.access_token);

            // Fetch user info
            try {
              const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                  Authorization: `Bearer ${tokenData.access_token}`
                }
              });
              const userInfo = await userInfoResponse.json();
              if (userInfo.name) {
                setUserName(userInfo.name);
                localStorage.setItem(USER_NAME_KEY, userInfo.name);
              }
            } catch (err) {
              console.error('Error fetching user info:', err);
            }

            // Clean up URL (remove code parameter)
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            console.error('Failed to get access token:', tokenData);
          }
        } catch (err) {
          console.error('Error exchanging code for token:', err);
        }
      }
    };

      handleOAuthCallback();
    }
  }, [onAuthChange]);

  const handleLogin = () => {
    console.log('Login button clicked');
    console.log('Using OAuth mode:', USE_REDIRECT_PROXY ? 'Redirect Proxy (feature branch)' : 'GIS (production)');

    if (USE_REDIRECT_PROXY) {
      // Use redirect proxy for feature branches and localhost
      const currentUrl = window.location.origin + window.location.pathname;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', OAUTH_SCOPES);
      authUrl.searchParams.set('access_type', 'online');
      authUrl.searchParams.set('state', encodeURIComponent(currentUrl));
      authUrl.searchParams.set('prompt', 'select_account');

      console.log('Redirecting to:', authUrl.toString());
      window.location.href = authUrl.toString();
    } else {
      // Use Google Identity Services for production
      if (tokenClient) {
        console.log('Requesting access token via GIS...');
        tokenClient.requestAccessToken();
      } else {
        console.error('Token client not initialized');
      }
    }
  };

  const handleLogout = async () => {
    if (accessToken) {
      try {
        if (USE_REDIRECT_PROXY) {
          // Revoke token via REST API (for redirect proxy mode)
          await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
            method: 'POST',
          });
        } else {
          // Revoke token via GIS (for production mode)
          if (window.google && window.google.accounts) {
            window.google.accounts.oauth2.revoke(accessToken);
          }
        }
      } catch (err) {
        console.error('Error revoking token:', err);
      }

      setAccessToken(null);
      setUserName(null);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_NAME_KEY);
      onAuthChange(null);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {!accessToken ? (
        <>
          <span style={{ fontSize: '0.85em', color: '#888' }}>
            Viewing anonymously
          </span>
          <button onClick={handleLogin}>Log In</button>
        </>
      ) : (
        <>
          <span style={{ fontSize: '0.85em', color: '#8bc34a' }}>
            {userName || 'Logged in'}
          </span>
          <button
            onClick={handleLogout}
            style={{ fontSize: '0.85em', padding: '0.4em 0.8em' }}
          >
            Log Out
          </button>
        </>
      )}
    </div>
  );
};

export default Auth;
