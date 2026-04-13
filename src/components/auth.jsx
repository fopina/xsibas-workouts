import { useState, useEffect } from 'preact/hooks';

const STORAGE_KEY = 'google_access_token';
const USER_NAME_KEY = 'google_user_name';
const USER_EMAIL_KEY = 'google_user_email';

const Auth = ({ accessToken, onAuthChange, forceLogoutVersion = 0 }) => {
  const [tokenClient, setTokenClient] = useState(null);
  const [userName, setUserName] = useState(null);

  const clearAuthState = ({ clearStoredEmail = false } = {}) => {
    setUserName(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    if (clearStoredEmail) {
      localStorage.removeItem(USER_EMAIL_KEY);
    }
    onAuthChange(null);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY);
    const storedUserName = localStorage.getItem(USER_NAME_KEY);
    if (storedToken) {
      console.log('Restored token from localStorage');
      onAuthChange(storedToken);
      if (storedUserName) {
        setUserName(storedUserName);
      }
    }
  }, []);

  useEffect(() => {
    const initializeGis = () => {
      if (window.google && window.google.accounts) {
        console.log('Initializing Google Identity Services');
        console.log('Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (tokenResponse) => {
            console.log('Token response received:', tokenResponse);
            if (tokenResponse && tokenResponse.access_token) {
              localStorage.setItem(STORAGE_KEY, tokenResponse.access_token);
              onAuthChange(tokenResponse.access_token);

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
                if (userInfo.email) {
                  localStorage.setItem(USER_EMAIL_KEY, userInfo.email);
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
  }, [onAuthChange]);

  const handleLogin = () => {
    console.log('Login button clicked');
    console.log('Token client available:', !!tokenClient);
    if (tokenClient) {
      const loginHint = localStorage.getItem(USER_EMAIL_KEY);
      console.log('Requesting access token...', loginHint ? 'with login hint' : 'without login hint');
      tokenClient.requestAccessToken(loginHint ? { hint: loginHint } : {});
    } else {
      console.error('Token client not initialized');
    }
  };

  const handleLogout = () => {
    const tokenToRevoke = accessToken;
    clearAuthState({ clearStoredEmail: true });

    if (tokenToRevoke && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(tokenToRevoke, () => {});
    }
  };

  useEffect(() => {
    if (forceLogoutVersion === 0) return;

    clearAuthState({ clearStoredEmail: false });
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
