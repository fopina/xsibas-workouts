import { useState, useEffect } from 'preact/hooks';

const Auth = ({ onAuthChange }) => {
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    const initializeGis = () => {
      if (window.google && window.google.accounts) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              setAccessToken(tokenResponse.access_token);
              onAuthChange(tokenResponse.access_token);
            }
          },
        });
        setTokenClient(client);
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
    if (tokenClient) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      tokenClient.requestAccessToken();
    }
  };

  const handleLogout = () => {
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken, () => {
        setAccessToken(null);
        onAuthChange(null);
      });
    }
  };

  return (
    <div>
      {accessToken ? (
        <button onClick={handleLogout}>Log Out</button>
      ) : (
        <button onClick={handleLogin}>Log In with Google</button>
      )}
    </div>
  );
};

export default Auth;
