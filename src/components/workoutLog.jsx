import { useState, useEffect } from 'preact/hooks';

// We access gapi via the window object, as it's loaded from a script tag.
const gapi = window.gapi;

const WorkoutLog = ({ accessToken, sheetId }) => {
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState([]);
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Generate week dates centered on selected date
  useEffect(() => {
    const generateWeekDates = (centerDate) => {
      const dates = [];
      const startOfWeek = new Date(centerDate);
      startOfWeek.setDate(centerDate.getDate() - centerDate.getDay()); // Start from Sunday

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        dates.push(date);
      }
      return dates;
    };

    setWeekDates(generateWeekDates(selectedDate));
  }, [selectedDate]);

  // Generate month calendar (6 weeks to show full month grid)
  const generateMonthDates = (month) => {
    const dates = [];
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    // Start from the Sunday before or on the first day of month
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    // Generate 6 weeks (42 days) to always show complete weeks
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setViewMode('week');
  };

  const changeMonth = (offset) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + offset);
    setCurrentMonth(newMonth);
  };

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

  }, [accessToken, sheetId]); // This effect runs when accessToken or sheetId changes

  if (loading) {
    return <p>Loading workout data...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }
  
  // Helper function to check if a date has workouts
  const hasWorkout = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return workouts.some(workout => workout.Date === dateStr);
  };

  // Helper function to get workouts for a specific date
  const getWorkoutsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return workouts.filter(workout => workout.Date === dateStr);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelectedDate = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Workout Log</h2>
        <button
          onClick={() => setViewMode(viewMode === 'week' ? 'month' : 'week')}
          style={{ fontSize: '0.9em', padding: '0.5em 1em' }}
        >
          {viewMode === 'week' ? 'Month View' : 'Week View'}
        </button>
      </div>

      {viewMode === 'week' ? (
        // Week View
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '5px',
            marginBottom: '20px',
            width: '100%'
          }}>
            {weekDates.map((date, index) => {
              const hasWorkoutOnDate = hasWorkout(date);
              const isSelected = isSelectedDate(date);
              const isTodayDate = isToday(date);

              return (
                <div
                  key={index}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    padding: '10px 5px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: hasWorkoutOnDate ? '#2d5016' : '#333',
                    border: isSelected ? '2px solid #646cff' : isTodayDate ? '2px solid #555' : '1px solid #444',
                    transition: 'all 0.2s',
                    minWidth: 0
                  }}
                >
                  <div style={{ fontSize: '0.75em', color: '#aaa', marginBottom: '5px' }}>
                    {formatDayName(date)}
                  </div>
                  <div style={{ fontSize: '0.95em', fontWeight: isSelected ? 'bold' : 'normal' }}>
                    {formatDate(date)}
                  </div>
                  {hasWorkoutOnDate && (
                    <div style={{ marginTop: '3px', fontSize: '0.7em', color: '#8bc34a' }}>
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Show workout details for selected date */}
          <div>
            {getWorkoutsForDate(selectedDate).length > 0 ? (
              <div>
                <h3>Workouts for {formatDate(selectedDate)}</h3>
                {getWorkoutsForDate(selectedDate).map((workout, index) => (
                  <div key={index} style={{
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '5px',
                    border: '1px solid #333'
                  }}>
                    {Object.entries(workout).map(([key, value]) => (
                      value && <div key={key}><strong>{key}:</strong> {value}</div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#888' }}>No workout logged for {formatDate(selectedDate)}</p>
            )}
          </div>
        </div>
      ) : (
        // Month View
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <button onClick={() => changeMonth(-1)} style={{ fontSize: '0.9em', padding: '0.5em 1em' }}>
              ← Previous
            </button>
            <h3 style={{ margin: 0 }}>
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={() => changeMonth(1)} style={{ fontSize: '0.9em', padding: '0.5em 1em' }}>
              Next →
            </button>
          </div>

          {/* Day names header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '5px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontSize: '0.85em', color: '#aaa', padding: '5px' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Month calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
            {generateMonthDates(currentMonth).map((date, index) => {
              const hasWorkoutOnDate = hasWorkout(date);
              const isTodayDate = isToday(date);
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth();

              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(date)}
                  style={{
                    padding: '10px',
                    textAlign: 'center',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    backgroundColor: hasWorkoutOnDate ? '#2d5016' : '#333',
                    border: isTodayDate ? '2px solid #555' : '1px solid #444',
                    opacity: isCurrentMonth ? 1 : 0.4,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '0.9em' }}>
                    {date.getDate()}
                  </div>
                  {hasWorkoutOnDate && (
                    <div style={{ marginTop: '3px', fontSize: '0.7em', color: '#8bc34a' }}>
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutLog;
