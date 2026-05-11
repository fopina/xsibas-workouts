import { useState, useEffect } from 'preact/hooks';
import { TOKEN_EXPIRES_AT_KEY, getJwtExpiresAt, getTokenResponseExpiresAt } from '../utils/authToken';

const STORAGE_KEY = 'google_access_token';
const USER_NAME_KEY = 'google_user_name';
const USER_EMAIL_KEY = 'google_user_email';

const Auth = ({ accessToken, onAuthChange, onUserNameChange, onReadyStateChange, children, forceLogoutVersion = 0 }) => {
  const [tokenClient, setTokenClient] = useState(null);
  const [userName, setUserName] = useState(null);

  const clearAuthState = ({ clearStoredEmail = false } = {}) => {
    setUserName(null);
    if (onUserNameChange) onUserNameChange(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    if (clearStoredEmail) {
      localStorage.removeItem(USER_EMAIL_KEY);
    }
    onAuthChange(null);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY);
    const storedUserName = localStorage.getItem(USER_NAME_KEY);
    const storedExpiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_AT_KEY));
    const expiresAt = Number.isFinite(storedExpiresAt) && storedExpiresAt > 0
      ? storedExpiresAt
      : getJwtExpiresAt(storedToken);

    if (storedToken) {
      if (expiresAt && expiresAt <= Date.now()) {
        clearAuthState({ clearStoredEmail: false });
        return;
      }

      console.log('Restored token from localStorage');
      onAuthChange(storedToken, expiresAt);
      if (storedUserName) {
        setUserName(storedUserName);
        if (onUserNameChange) onUserNameChange(storedUserName);
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
              const expiresAt = getTokenResponseExpiresAt(tokenResponse.access_token, tokenResponse);

              localStorage.setItem(STORAGE_KEY, tokenResponse.access_token);
              if (expiresAt) {
                localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(expiresAt));
              } else {
                localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
              }
              onAuthChange(tokenResponse.access_token, expiresAt);

              try {
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                  headers: {
                    Authorization: `Bearer ${tokenResponse.access_token}`
                  }
                });
                const userInfo = await userInfoResponse.json();
                if (userInfo.name) {
                  setUserName(userInfo.name);
                  if (onUserNameChange) onUserNameChange(userInfo.name);
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
        if (onReadyStateChange) onReadyStateChange(true);
        console.log('Token client initialized');
      }
    };

    const checkGisReady = setInterval(() => {
      if (window.google && window.google.accounts) {
        clearInterval(checkGisReady);
        initializeGis();
      }
    }, 100);

    return () => {
      clearInterval(checkGisReady);
      if (onReadyStateChange) onReadyStateChange(false);
    };
  }, []);

  const handleLogin = () => {
    console.log('Login button clicked');
    console.log('Token client available:', !!tokenClient);
    if (tokenClient) {
      const loginHint = localStorage.getItem(USER_EMAIL_KEY);
      console.log('Requesting access token...', loginHint ? 'with login_hint and prompt=""' : 'with prompt="" and without login_hint');
      tokenClient.requestAccessToken(loginHint ? { login_hint: loginHint, prompt: '' } : { prompt: '' });
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

  return children({
    accessToken,
    userName,
    isReady: !!tokenClient,
    login: handleLogin,
    logout: handleLogout,
  });
};

export default Auth;
