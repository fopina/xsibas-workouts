import { useState, useEffect, useRef } from 'preact/hooks';

const STORAGE_KEY = 'google_access_token';
const USER_NAME_KEY = 'google_user_name';

const Auth = ({ onAuthChange, onAuthApiReady, forceLogoutVersion = 0 }) => {
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [userName, setUserName] = useState(null);

  const pendingTokenRequestRef = useRef(null);
  const refreshInFlightRef = useRef(null);

  const clearAuthState = () => {
    pendingTokenRequestRef.current = null;
    refreshInFlightRef.current = null;
    setAccessToken(null);
    setUserName(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    onAuthChange(null);
  };

  const persistTokenState = (tokenResponse) => {
    if (!tokenResponse?.access_token) return;

    setAccessToken(tokenResponse.access_token);
    localStorage.setItem(STORAGE_KEY, tokenResponse.access_token);
    onAuthChange(tokenResponse.access_token);
  };

  const requestAccessTokenWithMode = (mode) => {
    if (!tokenClient) {
      return Promise.reject(new Error('Token client not initialized'));
    }

    if (pendingTokenRequestRef.current) {
      return Promise.reject(new Error('Another token request is already pending'));
    }

    return new Promise((resolve, reject) => {
      pendingTokenRequestRef.current = { mode, resolve, reject };
      try {
        if (mode === 'silent') {
          console.log('[Auth] Starting silent token refresh');
          tokenClient.requestAccessToken({ prompt: '' });
        } else {
          console.log('[Auth] Starting interactive token request');
          tokenClient.requestAccessToken();
        }
      } catch (err) {
        pendingTokenRequestRef.current = null;
        reject(err);
      }
    });
  };

  const refreshAccessTokenSilently = async (reason = 'api_auth_error') => {
    if (!accessToken || !tokenClient) return null;
    if (refreshInFlightRef.current) {
      console.log('[Auth] Silent refresh already in progress, joining:', reason);
      return refreshInFlightRef.current;
    }

    if (pendingTokenRequestRef.current) {
      console.log('[Auth] Token request already pending, skipping silent refresh:', reason);
      return null;
    }

    const startedAt = Date.now();
    console.log('[Auth] Silent refresh start:', { reason });

    refreshInFlightRef.current = requestAccessTokenWithMode('silent')
      .then((tokenResponse) => {
        console.log('[Auth] Silent refresh success', {
          reason,
          durationMs: Date.now() - startedAt
        });
        return tokenResponse?.access_token || null;
      })
      .catch((err) => {
        console.error('[Auth] Silent refresh failed', {
          reason,
          durationMs: Date.now() - startedAt,
          error: err?.message || err
        });
        // Transition to explicit re-auth state if silent refresh fails.
        clearAuthState();
        return null;
      })
      .finally(() => {
        refreshInFlightRef.current = null;
      });

    return refreshInFlightRef.current;
  };

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

  useEffect(() => {
    const initializeGis = () => {
      if (window.google && window.google.accounts) {
        console.log('Initializing Google Identity Services');
        console.log('Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
          callback: async (tokenResponse) => {
            console.log('Token response received:', tokenResponse);
            const pendingRequest = pendingTokenRequestRef.current;
            pendingTokenRequestRef.current = null;

            if (tokenResponse?.error) {
              pendingRequest?.reject?.(new Error(tokenResponse.error));
              return;
            }

            if (tokenResponse && tokenResponse.access_token) {
              persistTokenState(tokenResponse);

              // Fetch user info to get the name (best effort)
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

              pendingRequest?.resolve?.(tokenResponse);
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

  useEffect(() => {
    if (!onAuthApiReady) return;

    onAuthApiReady({
      refreshAccessTokenSilently,
      clearAuthState
    });

    return () => onAuthApiReady(null);
  }, [onAuthApiReady, accessToken, tokenClient]);

  const handleLogin = () => {
    console.log('Login button clicked');
    console.log('Token client available:', !!tokenClient);
    if (tokenClient) {
      requestAccessTokenWithMode('interactive').catch((err) => {
        console.error('Interactive login failed:', err);
      });
    } else {
      console.error('Token client not initialized');
    }
  };

  const handleLogout = () => {
    const tokenToRevoke = accessToken;
    clearAuthState();

    if (tokenToRevoke && window.google?.accounts?.oauth2?.revoke) {
      // Revoke in background; do not block local logout on callback.
      window.google.accounts.oauth2.revoke(tokenToRevoke, () => {});
    }
  };

  // Force logout when session is detected as expired by API calls.
  useEffect(() => {
    if (forceLogoutVersion === 0) return;

    clearAuthState();
  }, [forceLogoutVersion]);

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
