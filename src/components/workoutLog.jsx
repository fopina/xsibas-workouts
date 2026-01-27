import { useState, useEffect } from 'preact/hooks';

// We access gapi via the window object, as it's loaded from a script tag.
const gapi = window.gapi;

const WorkoutLog = ({ accessToken }) => {
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const fetchSheetData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Wait for gapi.client to be initialized
        await new Promise((resolve) => {
          const interval = setInterval(() => {
            if (gapi && gapi.client) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });

        // 1. Set the access token
        gapi.client.setToken({ access_token: accessToken });

        // 2. Load the Sheets API discovery document
        try {
          await gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
        } catch (err) {
            setError('The Google Sheets API is being blocked. Please check your browser extensions and network settings');
            setLoading(false);
            return;
        }
        
        if (!gapi.client.sheets) {
          setError('The Google Sheets API is not available. Please check your browser extensions.');
          setLoading(false);
          return;
        }

        // 3. Make the API request
        const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID;
        const range = 'WorkoutLog!A:H';
        
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: range,
        });

        const data = response.result.values;
        if (data && data.length > 0) {
          const headers = data[0];
          const formattedData = data.slice(1).map(row => {
            const workout = {};
            headers.forEach((header, index) => {
              workout[header] = row[index] || ''; // Ensure empty cells are handled
            });
            return workout;
          });
          setWorkouts(formattedData);
        } else {
          setError('No data found in sheet.');
        }
      } catch (err) {
        console.error("Error fetching sheet data:", err);
        setError(`Error fetching workout data: ${err.result?.error?.message || err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSheetData();

  }, [accessToken]); // This effect runs when accessToken changes

  if (loading) {
    return <p>Loading workout data...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }
  
  if (!workouts.length) {
    return <p>No workouts logged yet.</p>
  }

  return (
    <div>
      <h2>Workout Log</h2>
      <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {workouts.length > 0 && Object.keys(workouts[0]).map(key => <th key={key}>{key}</th>)}
          </tr>
        </thead>
        <tbody>
          {workouts.map((workout, index) => (
            <tr key={index}>
              {Object.values(workout).map((value, i) => <td key={i}>{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WorkoutLog;
