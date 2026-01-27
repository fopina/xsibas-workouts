import { useState, useEffect } from 'preact/hooks';
import Auth from './components/auth';
import WorkoutLog from './components/workoutLog';
import './app.css';

const gapi = window.gapi;

export function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);

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
        {accessToken && isGapiLoaded ? (
          <WorkoutLog accessToken={accessToken} />
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
