import { useState, useEffect } from 'preact/hooks';

// We access gapi via the window object, as it's loaded from a script tag.
const gapi = window.gapi;

const WorkoutLog = ({ accessToken, sheetId, onSheetTitleLoaded }) => {
  const [workouts, setWorkouts] = useState([]);
  const [exerciseVideoMap, setExerciseVideoMap] = useState({});
  const [expandedVideos, setExpandedVideos] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState({}); // Track which notes are being edited
  const [savingNotes, setSavingNotes] = useState({}); // Track which notes are being saved

  // Initialize selected date from URL or default to today
  const getInitialDate = () => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam) {
      const parsedDate = new Date(dateParam);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    return new Date();
  };

  const [selectedDate, setSelectedDate] = useState(getInitialDate());
  const [weekDates, setWeekDates] = useState([]);
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const toggleVideo = (exerciseKey) => {
    setExpandedVideos(prev => ({
      ...prev,
      [exerciseKey]: !prev[exerciseKey]
    }));
  };

  // Update URL when selected date changes
  useEffect(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    params.set('date', dateStr);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [selectedDate]);

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

  // Helper function to extract YouTube video ID from URL
  const getYouTubeVideoId = (url) => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
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

        // 3. Fetch spreadsheet metadata to get title
        try {
          const metadataResponse = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            fields: 'properties.title'
          });
          const sheetTitle = metadataResponse.result.properties?.title;
          if (sheetTitle && onSheetTitleLoaded) {
            onSheetTitleLoaded(sheetId, sheetTitle);
          }
        } catch (err) {
          console.warn('Could not fetch sheet title:', err);
        }

        // 5. Fetch Exercises tab to get video link mapping
        const exercisesResponse = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'Exercises!A:D',
        });

        const exercisesData = exercisesResponse.result.values;
        const videoMap = {};
        if (exercisesData && exercisesData.length > 1) {
          // Assuming row 0 is headers, find the Exercise and VideoLink columns
          const exerciseHeaders = exercisesData[0];
          const exerciseNameIndex = exerciseHeaders.indexOf('Exercise');
          const videoLinkIndex = exerciseHeaders.indexOf('VideoLink');

          if (exerciseNameIndex !== -1 && videoLinkIndex !== -1) {
            exercisesData.slice(1).forEach(row => {
              const exerciseName = row[exerciseNameIndex];
              const videoLink = row[videoLinkIndex];
              if (exerciseName && videoLink) {
                videoMap[exerciseName] = videoLink;
              }
            });
          }
        }
        setExerciseVideoMap(videoMap);

        // 6. Fetch WorkoutLog data
        const workoutResponse = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'WorkoutLog!A:Z',
        });

        const data = workoutResponse.result.values;
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
    return (
      <div style={{ color: 'red' }}>
        <p>{error}</p>
        <p style={{ marginTop: '1em', fontSize: '0.9em' }}>
          Can you{' '}
          <a
            href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#646cff', textDecoration: 'underline' }}
          >
            open it in Sheets
          </a>
          ? If you can access it there, the sharing permissions may need to be adjusted.
        </p>
      </div>
    );
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

  // Function to update notes in the spreadsheet
  const updateNotes = async (rowIndex, newNotes, exerciseKey) => {
    setSavingNotes(prev => ({ ...prev, [exerciseKey]: true }));

    try {
      // Find the Notes column index
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'WorkoutLog!A1:Z1',
      });

      const headers = response.result.values[0];
      let notesColumnIndex = headers.indexOf('Notes');

      // If Notes column doesn't exist, we need to add it
      if (notesColumnIndex === -1) {
        notesColumnIndex = headers.length;
        // Add Notes header if it doesn't exist
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `WorkoutLog!${String.fromCharCode(65 + notesColumnIndex)}1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['Notes']]
          }
        });
      }

      // Convert column index to letter (A, B, C, ...)
      const columnLetter = String.fromCharCode(65 + notesColumnIndex);
      // Row index in sheet is rowIndex + 2 (1 for header, 1 for 0-based to 1-based)
      const cellRange = `WorkoutLog!${columnLetter}${rowIndex + 2}`;

      // Update the notes cell
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: cellRange,
        valueInputOption: 'RAW',
        resource: {
          values: [[newNotes]]
        }
      });

      // Update local state
      setWorkouts(prev => {
        const updated = [...prev];
        updated[rowIndex] = { ...updated[rowIndex], Notes: newNotes };
        return updated;
      });

      // Clear editing state
      setEditingNotes(prev => {
        const updated = { ...prev };
        delete updated[exerciseKey];
        return updated;
      });

    } catch (err) {
      console.error("Error updating notes:", err);
      alert(`Error updating notes: ${err.result?.error?.message || err.message}`);
    } finally {
      setSavingNotes(prev => {
        const updated = { ...prev };
        delete updated[exerciseKey];
        return updated;
      });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Workout Log</h2>
        <button
          onClick={() => {
            const newMode = viewMode === 'week' ? 'month' : 'week';
            if (newMode === 'month') {
              // Set currentMonth to the month of the selected date
              setCurrentMonth(new Date(selectedDate));
            }
            setViewMode(newMode);
          }}
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
                {(() => {
                  const workoutsForDate = getWorkoutsForDate(selectedDate);
                  const sections = {};

                  // Group workouts by section
                  workoutsForDate.forEach(workout => {
                    const section = workout.Section || 'Other';
                    if (!sections[section]) {
                      sections[section] = [];
                    }
                    sections[section].push(workout);
                  });

                  return Object.entries(sections).map(([sectionName, exercises]) => {
                    // Get section prescription from first exercise (same for all in section)
                    const sectionPrescription = exercises[0]?.['Section Prescription'] || '';

                    return (
                      <div key={sectionName} style={{ marginBottom: '20px' }}>
                        <h4 style={{
                          fontSize: '1.1em',
                          marginBottom: '5px',
                          color: '#8bc34a',
                          borderBottom: '1px solid #444',
                          paddingBottom: '5px'
                        }}>
                          {sectionName}
                        </h4>
                        {sectionPrescription && (
                          <p style={{
                            fontSize: '0.9em',
                            color: '#aaa',
                            marginBottom: '10px',
                            fontStyle: 'italic'
                          }}>
                            {sectionPrescription}
                          </p>
                        )}
                        {exercises.map((exercise, exerciseIndex) => {
                          const videoLink = exerciseVideoMap[exercise.Exercise];
                          const videoId = getYouTubeVideoId(videoLink);
                          const exerciseKey = `${sectionName}-${exerciseIndex}`;
                          const showVideo = expandedVideos[exerciseKey];

                          // Find the row index in the original workouts array for this exercise
                          const rowIndex = workouts.findIndex(w =>
                            w.Date === exercise.Date &&
                            w.Exercise === exercise.Exercise &&
                            w.Section === exercise.Section
                          );

                          return (
                            <div key={exerciseIndex} style={{
                              marginBottom: '10px',
                              padding: '10px',
                              backgroundColor: '#1a1a1a',
                              borderRadius: '5px',
                              border: '1px solid #333'
                            }}>
                              {Object.entries(exercise).map(([key, value]) => {
                                // Skip Date, Section, Section Prescription, and Day as they're already shown
                                // Don't skip empty Notes field - we want to show it for editing
                                if (key === 'Date' || key === 'Section' || key === 'Section Prescription' || key === 'Day') return null;
                                if (!value && key !== 'Notes') return null;

                                // Special handling for Exercise field - show with video toggle if available
                                if (key === 'Exercise' && videoLink) {
                                  return (
                                    <div key={key}>
                                      <div style={{ marginBottom: '3px' }}>
                                        <strong>{key}:</strong>{' '}
                                        <a
                                          href={videoLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ color: '#646cff', textDecoration: 'none' }}
                                          onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                          onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                                        >
                                          {value}
                                        </a>
                                        {videoId && (
                                          <button
                                            onClick={() => toggleVideo(exerciseKey)}
                                            style={{
                                              marginLeft: '10px',
                                              padding: '2px 8px',
                                              fontSize: '0.85em',
                                              backgroundColor: '#333',
                                              color: '#aaa',
                                              border: '1px solid #444',
                                              borderRadius: '3px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {showVideo ? '▲ Hide Video' : '▼ Show Video'}
                                          </button>
                                        )}
                                      </div>
                                      {showVideo && videoId && (
                                        <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                                          <iframe
                                            width="100%"
                                            height="315"
                                            src={`https://www.youtube.com/embed/${videoId}`}
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            style={{ borderRadius: '5px', maxWidth: '560px' }}
                                          ></iframe>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                // Special handling for Notes field - make it editable
                                if (key === 'Notes') {
                                  const isEditing = editingNotes[exerciseKey];
                                  const isSaving = savingNotes[exerciseKey];

                                  return (
                                    <div key={key} style={{ marginTop: '10px', marginBottom: '5px' }}>
                                      <strong>Notes:</strong>
                                      {isEditing ? (
                                        <div style={{ marginTop: '5px' }}>
                                          <textarea
                                            value={editingNotes[exerciseKey] || ''}
                                            onChange={(e) => setEditingNotes(prev => ({
                                              ...prev,
                                              [exerciseKey]: e.target.value
                                            }))}
                                            style={{
                                              width: '100%',
                                              minHeight: '60px',
                                              padding: '8px',
                                              backgroundColor: '#2a2a2a',
                                              color: '#fff',
                                              border: '1px solid #444',
                                              borderRadius: '4px',
                                              fontSize: '0.9em',
                                              fontFamily: 'inherit',
                                              resize: 'vertical'
                                            }}
                                            placeholder="Add your notes here..."
                                          />
                                          <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
                                            <button
                                              onClick={() => updateNotes(rowIndex, editingNotes[exerciseKey] || '', exerciseKey)}
                                              disabled={isSaving}
                                              style={{
                                                padding: '5px 10px',
                                                fontSize: '0.85em',
                                                backgroundColor: '#646cff',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                                opacity: isSaving ? 0.6 : 1
                                              }}
                                            >
                                              {isSaving ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                              onClick={() => setEditingNotes(prev => {
                                                const updated = { ...prev };
                                                delete updated[exerciseKey];
                                                return updated;
                                              })}
                                              disabled={isSaving}
                                              style={{
                                                padding: '5px 10px',
                                                fontSize: '0.85em',
                                                backgroundColor: '#333',
                                                color: '#aaa',
                                                border: '1px solid #444',
                                                borderRadius: '4px',
                                                cursor: isSaving ? 'not-allowed' : 'pointer'
                                              }}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ marginTop: '5px' }}>
                                          <div style={{
                                            padding: '8px',
                                            backgroundColor: '#2a2a2a',
                                            borderRadius: '4px',
                                            minHeight: '30px',
                                            color: value ? '#fff' : '#666',
                                            fontStyle: value ? 'normal' : 'italic'
                                          }}>
                                            {value || 'No notes yet'}
                                          </div>
                                          <button
                                            onClick={() => setEditingNotes(prev => ({
                                              ...prev,
                                              [exerciseKey]: value || ''
                                            }))}
                                            style={{
                                              marginTop: '5px',
                                              padding: '4px 8px',
                                              fontSize: '0.8em',
                                              backgroundColor: '#333',
                                              color: '#aaa',
                                              border: '1px solid #444',
                                              borderRadius: '3px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {value ? 'Edit Notes' : 'Add Notes'}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={key} style={{ marginBottom: '3px' }}>
                                    <strong>{key}:</strong> {value}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
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
              const isSelected = isSelectedDate(date);
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
                    border: isSelected ? '2px solid #646cff' : isTodayDate ? '2px solid #555' : '1px solid #444',
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
