import { useState, useEffect } from 'preact/hooks';
import { validateSpreadsheetSchema, formatValidationErrors } from '../utils/schemaValidator';

// We access gapi via the window object, as it's loaded from a script tag.
const gapi = window.gapi;

const WorkoutLog = ({ accessToken, sheetId, onSheetTitleLoaded, onAuthRequired, onSessionExpired, onAuthRefreshRequested }) => {
  const [workouts, setWorkouts] = useState([]);
  const [exerciseVideoMap, setExerciseVideoMap] = useState({});
  const [exerciseDetailsMap, setExerciseDetailsMap] = useState({});
  const [workoutHeaders, setWorkoutHeaders] = useState([]);
  const [workoutDateRowsMap, setWorkoutDateRowsMap] = useState({});
  const [expandedVideos, setExpandedVideos] = useState({});
  const [error, setError] = useState(null);
  const [loadingSheetData, setLoadingSheetData] = useState(false);
  const [loadingWorkoutDay, setLoadingWorkoutDay] = useState(false);
  const [hasLoadedInitialDayData, setHasLoadedInitialDayData] = useState(false);
  const [editingSectionScores, setEditingSectionScores] = useState({}); // Track which section scores are being edited
  const [savingSectionScores, setSavingSectionScores] = useState({}); // Track which section scores are being saved
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const logPerf = (phase, startMs, details = {}) => {
    const durationMs = Math.round(nowMs() - startMs);
    console.info(`[WorkoutLog][Perf] ${phase}: ${durationMs}ms ${safeLogDetails(details)}`);
  };
  const safeLogDetails = (details) => {
    try {
      return JSON.stringify(details);
    } catch {
      return String(details);
    }
  };
  const logWarn = (message, details = {}) => {
    console.warn(`${message} ${safeLogDetails(details)}`);
  };
  const logError = (message, details = {}) => {
    console.error(`${message} ${safeLogDetails(details)}`);
  };

  const parseLocalDateString = (value) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const columnIndexToLetter = (index) => {
    let result = '';
    let current = index;
    while (current >= 0) {
      result = String.fromCharCode((current % 26) + 65) + result;
      current = Math.floor(current / 26) - 1;
    }
    return result;
  };

  const ensureSheetsApiReady = async (tokenOverride = accessToken) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

    if (!tokenOverride && (!apiKey || apiKey === 'YOUR_API_KEY_HERE')) {
      throw new Error('Please log in to view your workout plan.');
    }

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (gapi && gapi.client) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    if (tokenOverride) {
      gapi.client.setToken({ access_token: tokenOverride });
    } else {
      gapi.client.setApiKey(apiKey);
    }

    try {
      await gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
    } catch (err) {
      throw new Error('The Google Sheets API is being blocked. Please check your browser extensions and network settings');
    }

    if (!gapi.client.sheets) {
      throw new Error('The Google Sheets API is not available. Please check your browser extensions.');
    }
  };

  const handleSheetFetchError = (err) => {
    console.error('Error fetching sheet data:', err);
    const errorMessage = err.result?.error?.message || err.message || '';
    const errorStatus = err.result?.error?.status || err.status || '';
    const errorCode = err.result?.error?.code || err.code || 0;

    if ((errorStatus === 'PERMISSION_DENIED' || errorCode === 403) && !accessToken) {
      setError('This sheet is private. Please log in to view it.');
      if (onAuthRequired) onAuthRequired();
    } else if (errorMessage === 'Please log in to view your workout plan.') {
      setError('Please log in to view your workout plan.');
    } else if (errorStatus === 'UNAUTHENTICATED' || errorMessage.includes('Invalid Credentials') || errorMessage.includes('invalid authentication')) {
      setError('Login expired. Login again');
      if (onSessionExpired) onSessionExpired();
      if (onAuthRequired) onAuthRequired();
    } else if ((errorStatus === 'PERMISSION_DENIED' || errorCode === 403) && accessToken) {
      setError(`You don't have permission to access this sheet. Make sure it's shared with your Google account.`);
    } else {
      setError(`Error fetching workout data: ${errorMessage}`);
    }
  };

  const isUnauthenticatedApiError = (err) => {
    const errorMessage = err?.result?.error?.message || err?.message || '';
    const errorStatus = err?.result?.error?.status || err?.status || '';
    const errorCode = err?.result?.error?.code || err?.code || 0;
    const errorReason = err?.result?.error?.errors?.[0]?.reason || '';
    const lowerMessage = String(errorMessage).toLowerCase();

    return errorStatus === 'UNAUTHENTICATED' ||
      errorReason === 'authError' ||
      errorMessage.includes('Invalid Credentials') ||
      errorMessage.includes('invalid authentication') ||
      ((errorStatus === 'PERMISSION_DENIED' || errorCode === 403) && (
        lowerMessage.includes('authentication credentials') ||
        lowerMessage.includes('invalid credentials') ||
        lowerMessage.includes('login required') ||
        lowerMessage.includes('auth')
      ));
  };

  const isRefreshableAuthenticatedError = (err) => {
    if (!accessToken) return false;
    const errorStatus = err?.result?.error?.status || err?.status || '';
    const errorCode = err?.result?.error?.code || err?.code || 0;
    return isUnauthenticatedApiError(err) || errorStatus === 'PERMISSION_DENIED' || errorCode === 403;
  };

  const trySilentRefreshAfterAuthError = async (err, context) => {
    const errorMessage = err?.result?.error?.message || err?.message || '';
    const errorStatus = err?.result?.error?.status || err?.status || '';
    const errorCode = err?.result?.error?.code || err?.code || '';
    const errorReason = err?.result?.error?.errors?.[0]?.reason || '';

    logWarn('[WorkoutLog] Sheets API error caught', {
      context,
      errorStatus,
      errorCode,
      errorReason,
      errorMessage
    });

    if (!accessToken || !onAuthRefreshRequested) {
      logWarn('[WorkoutLog] Auth error refresh path unavailable', {
        context,
        hasAccessToken: !!accessToken,
        hasRefreshHandler: !!onAuthRefreshRequested,
        errorStatus,
        errorCode,
        errorReason,
        errorMessage
      });
      return null;
    }
    if (!isRefreshableAuthenticatedError(err)) {
      logWarn('[WorkoutLog] Error is not classified as refreshable auth failure', {
        context,
        errorStatus,
        errorCode,
        errorReason,
        errorMessage
      });
      return null;
    }

    logWarn('[WorkoutLog] Access token failed for Sheets API call, attempting silent refresh', {
      context,
      errorStatus,
      errorCode,
      errorReason,
      errorMessage
    });

    try {
      const refreshedToken = await onAuthRefreshRequested();
      if (refreshedToken) {
        console.info(`[WorkoutLog] Silent refresh returned a new access token ${safeLogDetails({ context })}`);
        return refreshedToken;
      }
      logWarn('[WorkoutLog] Silent refresh returned no token', { context });
      return null;
    } catch (refreshErr) {
      logError('[WorkoutLog] Silent refresh request failed', {
        context,
        error: refreshErr?.message || refreshErr
      });
      return null;
    }
  };

  // Initialize selected date from URL or default to today
  const getInitialDate = () => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam) {
      const parsedDate = parseLocalDateString(dateParam);
      if (parsedDate) {
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
    const dateStr = toDateKey(selectedDate);
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
    let cancelled = false;

    const fetchSheetMetadataAndDateIndex = async (retryToken = null, hasRetried = false) => {
      const setupStartMs = nowMs();
      if (!sheetId) {
        setWorkouts([]);
        setWorkoutHeaders([]);
        setWorkoutDateRowsMap({});
        return;
      }

      setLoadingSheetData(true);
      setError(null);
      setWorkouts([]);
      setWorkoutHeaders([]);
      setWorkoutDateRowsMap({});
      setHasLoadedInitialDayData(false);

      try {
        await ensureSheetsApiReady(retryToken);

        // Validate spreadsheet schema before loading tabs
        const validation = await validateSpreadsheetSchema(gapi, sheetId);
        if (!validation.valid) {
          if (!cancelled) {
            setError(formatValidationErrors(validation.errors));
          }
          return;
        }

        const headers = validation.sheetHeaders?.WorkoutLog || [];
        const dateColumnIndex = headers.indexOf('Date');
        if (dateColumnIndex === -1) {
          throw new Error('WorkoutLog sheet is missing a Date column.');
        }

        const dateColumnLetter = columnIndexToLetter(dateColumnIndex);
        const metadataPromise = (async () => {
          try {
            return await gapi.client.sheets.spreadsheets.get({
              spreadsheetId: sheetId,
              fields: 'properties.title'
            });
          } catch (err) {
            console.warn('Could not fetch sheet title:', err);
            return null;
          }
        })();

        const [metadataResponse, exercisesResponse, datesResponse] = await Promise.all([
          metadataPromise,
          gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Exercises!A:Z',
          }),
          gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `WorkoutLog!${dateColumnLetter}2:${dateColumnLetter}`,
          })
        ]);

        const sheetTitle = metadataResponse?.result?.properties?.title;
        if (!cancelled && sheetTitle && onSheetTitleLoaded) {
          onSheetTitleLoaded(sheetId, sheetTitle);
        }

        const exercisesData = exercisesResponse.result.values;
        const videoMap = {};
        const detailsMap = {};
        if (exercisesData && exercisesData.length > 1) {
          const exerciseHeaders = exercisesData[0];
          const exerciseNameIndex = exerciseHeaders.indexOf('Exercise');
          const videoLinkIndex = exerciseHeaders.indexOf('VideoLink');
          const muscleGroupIndex = exerciseHeaders.indexOf('MuscleGroup');
          const equimentIndex = exerciseHeaders.indexOf('Equiment');
          const equipmentIndex = exerciseHeaders.indexOf('Equipment');
          const resolvedEquipmentIndex = equipmentIndex !== -1 ? equipmentIndex : equimentIndex;

          if (exerciseNameIndex !== -1) {
            exercisesData.slice(1).forEach(row => {
              const exerciseName = row[exerciseNameIndex];
              const videoLink = videoLinkIndex !== -1 ? (row[videoLinkIndex] || '') : '';
              const muscleGroup = muscleGroupIndex !== -1 ? (row[muscleGroupIndex] || '') : '';
              const equipment = resolvedEquipmentIndex !== -1 ? (row[resolvedEquipmentIndex] || '') : '';

              if (exerciseName && videoLink) {
                videoMap[exerciseName] = videoLink;
              }
              if (exerciseName) {
                detailsMap[exerciseName] = { muscleGroup, equipment };
              }
            });
          }
        }

        const dateRowsMap = {};
        (datesResponse.result.values || []).forEach((row, index) => {
          const dateValue = row[0];
          if (!parseLocalDateString(dateValue)) return;
          const sheetRowNumber = index + 2;
          if (!dateRowsMap[dateValue]) {
            dateRowsMap[dateValue] = [];
          }
          dateRowsMap[dateValue].push(sheetRowNumber);
        });

        if (!cancelled) {
          setExerciseVideoMap(videoMap);
          setExerciseDetailsMap(detailsMap);
          setWorkoutHeaders(headers);
          setWorkoutDateRowsMap(dateRowsMap);
          setError(null);
          logPerf('setup', setupStartMs, {
            sheetId,
            distinctWorkoutDates: Object.keys(dateRowsMap).length,
            exercisesIndexed: Object.keys(detailsMap).length
          });
        }
      } catch (err) {
        logPerf('setup_failed', setupStartMs, {
          sheetId,
          error: err?.message || err
        });
        const refreshedToken = !hasRetried
          ? await trySilentRefreshAfterAuthError(err, 'setup')
          : null;
        if (refreshedToken) {
          return fetchSheetMetadataAndDateIndex(refreshedToken, true);
        }
        if (!cancelled) {
          handleSheetFetchError(err);
        }
      } finally {
        if (!cancelled) {
          setLoadingSheetData(false);
        }
      }
    };

    fetchSheetMetadataAndDateIndex();

    return () => {
      cancelled = true;
    };
  }, [accessToken, sheetId]);

  useEffect(() => {
    let cancelled = false;

    const fetchSelectedDayWorkouts = async (retryToken = null, hasRetried = false) => {
      const dayLoadStartMs = nowMs();
      if (!sheetId || workoutHeaders.length === 0) {
        setLoadingWorkoutDay(false);
        return;
      }

      const selectedDateKey = toDateKey(selectedDate);
      const rowNumbers = workoutDateRowsMap[selectedDateKey] || [];
      const loadKind = hasLoadedInitialDayData ? 'day_switch' : 'initial_day';

      if (rowNumbers.length === 0) {
        setLoadingWorkoutDay(false);
        setWorkouts([]);
        setError(null);
        setHasLoadedInitialDayData(true);
        logPerf(loadKind, dayLoadStartMs, {
          sheetId,
          date: selectedDateKey,
          rows: 0
        });
        return;
      }

      setLoadingWorkoutDay(true);
      setError(null);

      try {
        await ensureSheetsApiReady(retryToken);

        const ranges = rowNumbers.map((rowNumber) => `WorkoutLog!A${rowNumber}:Z${rowNumber}`);
        const response = await gapi.client.sheets.spreadsheets.values.batchGet({
          spreadsheetId: sheetId,
          ranges,
        });

        const formattedData = (response.result.valueRanges || []).map((rangeResult, index) => {
          const row = rangeResult.values?.[0] || [];
          const workout = { __sheetRowNumber: rowNumbers[index] };

          workoutHeaders.forEach((header, headerIndex) => {
            workout[header] = row[headerIndex] || '';
          });

          if (!('Notes' in workout)) {
            workout.Notes = '';
          }
          if (!('Section Score' in workout)) {
            workout['Section Score'] = '';
          }

          return workout;
        });

        if (!cancelled) {
          setWorkouts(formattedData);
          setHasLoadedInitialDayData(true);
          logPerf(loadKind, dayLoadStartMs, {
            sheetId,
            date: selectedDateKey,
            rowsRequested: rowNumbers.length,
            rowsLoaded: formattedData.length
          });
        }
      } catch (err) {
        logPerf(`${loadKind}_failed`, dayLoadStartMs, {
          sheetId,
          date: selectedDateKey,
          error: err?.message || err
        });
        const refreshedToken = !hasRetried
          ? await trySilentRefreshAfterAuthError(err, 'day_load')
          : null;
        if (refreshedToken) {
          return fetchSelectedDayWorkouts(refreshedToken, true);
        }
        if (!cancelled) {
          handleSheetFetchError(err);
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkoutDay(false);
        }
      }
    };

    fetchSelectedDayWorkouts();

    return () => {
      cancelled = true;
    };
  }, [accessToken, sheetId, selectedDate, workoutHeaders, workoutDateRowsMap]);

  const showFullLoading = loadingSheetData;
  const showInlineDayLoading = (
    !loadingSheetData &&
    !error &&
    workoutHeaders.length > 0 &&
    !hasLoadedInitialDayData
  ) || (loadingWorkoutDay && hasLoadedInitialDayData);

  if (showFullLoading) {
    return (
      <div class="loading-state">
        <div class="loading-spinner large" aria-hidden="true" />
        <div>Loading workout data...</div>
      </div>
    );
  }

  if (error) {
    // Don't show the "open it in Sheets" link for authentication errors
    const isAuthError = error === 'Login expired. Login again';

    return (
      <div style={{ color: 'red' }}>
        <p>{error}</p>
        {!isAuthError && (
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
        )}
      </div>
    );
  }
  
  // Helper function to check if a date has workouts
  const hasWorkout = (date) => {
    const dateStr = toDateKey(date);
    return Boolean(workoutDateRowsMap[dateStr]?.length);
  };

  // Helper function to get workouts for a specific date
  const getWorkoutsForDate = (date) => {
    const dateStr = toDateKey(date);
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

  // Function to update section score in the spreadsheet
  const updateSectionScore = async (sheetRowNumber, newSectionScore, exerciseKey) => {
    if (!accessToken) {
      alert('Please sign in to edit section score');
      if (onAuthRequired) onAuthRequired();
      return;
    }

    setSavingSectionScores(prev => ({ ...prev, [exerciseKey]: true }));

    try {
      // Find the Section Score column index
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'WorkoutLog!A1:Z1',
      });

      const headers = response.result.values[0];
      let sectionScoreColumnIndex = headers.indexOf('Section Score');

      // If Section Score column doesn't exist, we need to add it
      if (sectionScoreColumnIndex === -1) {
        sectionScoreColumnIndex = headers.length;
        // Add Section Score header if it doesn't exist
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `WorkoutLog!${String.fromCharCode(65 + sectionScoreColumnIndex)}1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['Section Score']]
          }
        });
      }

      // Convert column index to letter (A, B, C, ...)
      const columnLetter = String.fromCharCode(65 + sectionScoreColumnIndex);
      const cellRange = `WorkoutLog!${columnLetter}${sheetRowNumber}`;

      // Update the section score cell
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: cellRange,
        valueInputOption: 'RAW',
        resource: {
          values: [[newSectionScore]]
        }
      });

      // Update local state
      setWorkouts(prev => {
        return prev.map(workout =>
          workout.__sheetRowNumber === sheetRowNumber
            ? { ...workout, ['Section Score']: newSectionScore }
            : workout
        );
      });

      // Clear editing state
      setEditingSectionScores(prev => {
        const updated = { ...prev };
        delete updated[exerciseKey];
        return updated;
      });

    } catch (err) {
      console.error("Error updating section score:", err);
      alert(`Error updating section score: ${err.result?.error?.message || err.message}`);
    } finally {
      setSavingSectionScores(prev => {
        const updated = { ...prev };
        delete updated[exerciseKey];
        return updated;
      });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Workout</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              const today = new Date();
              setSelectedDate(today);
              if (viewMode === 'month') {
                setCurrentMonth(today);
              }
            }}
            style={{ fontSize: '0.9em', padding: '0.5em 1em' }}
          >
            Today
          </button>
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
                    backgroundColor: hasWorkoutOnDate
                      ? (isTodayDate ? '#4f7a2a' : '#2d5016')
                      : (isTodayDate ? '#4a4a4a' : '#333'),
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
            {showInlineDayLoading ? (
              <div class="loading-inline" role="status" aria-live="polite">
                <div class="loading-spinner" aria-hidden="true" />
                <span>Loading day...</span>
              </div>
            ) : getWorkoutsForDate(selectedDate).length > 0 ? (
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
                          const details = exerciseDetailsMap[exercise.Exercise] || {};
                          const muscleGroup = details.muscleGroup || '';
                          const equipment = details.equipment || '';
                          const videoId = getYouTubeVideoId(videoLink);
                          const exerciseKey = `${sectionName}-${exerciseIndex}`;
                          const showVideo = expandedVideos[exerciseKey];
                          const notesValue = exercise.Notes || '';
                          const sectionScoreValue = exercise['Section Score'] || '';
                          const isEditingSectionScore = exerciseKey in editingSectionScores;
                          const isSavingSectionScore = exerciseKey in savingSectionScores;
                          const canEditSectionScore = !!accessToken;

                          const sheetRowNumber = exercise.__sheetRowNumber;

                          return (
                            <div key={exerciseIndex} style={{
                              marginBottom: '10px',
                              padding: '10px',
                              backgroundColor: '#1a1a1a',
                              borderRadius: '5px',
                              border: '1px solid #333'
                            }}>
                              {Object.entries(exercise).map(([key, value]) => {
                                // Skip Date, Section, Section Prescription, Day, and Section Score as they're already shown
                                // Don't skip empty Notes field - we want to show it for editing
                                if (key.startsWith('__')) return null;
                                if (key === 'Date' || key === 'Section' || key === 'Section Prescription' || key === 'Day') return null;
                                if (key === 'Section Score') return null;
                                if (!value && key !== 'Notes') return null;

                                // Special handling for Exercise field - larger text, optional video actions
                                if (key === 'Exercise') {
                                  return (
                                    <div key={key}>
                                      <div style={{
                                        marginBottom: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '10px'
                                      }}>
                                        <div style={{ fontSize: '1.05em', fontWeight: 600, minWidth: 0, flex: 1 }}>
                                          <div>
                                            {videoLink ? (
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
                                            ) : (
                                              <span>{value}</span>
                                            )}
                                          </div>
                                          {(muscleGroup || equipment) && (
                                            <div style={{ marginTop: '2px', fontSize: '0.8em', color: '#999', fontWeight: 400 }}>
                                              {muscleGroup}{muscleGroup && equipment ? ' • ' : ''}{equipment}
                                            </div>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginLeft: 'auto' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {videoId && (
                                              <button
                                                onClick={() => toggleVideo(exerciseKey)}
                                                title={showVideo ? 'Hide video' : 'Show video'}
                                                aria-label={showVideo ? 'Hide video' : 'Show video'}
                                                style={{
                                                  padding: '2px 8px',
                                                  fontSize: '0.85em',
                                                  backgroundColor: '#333',
                                                  color: '#aaa',
                                                  border: '1px solid #444',
                                                  borderRadius: '3px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                📹
                                              </button>
                                            )}
                                            {canEditSectionScore ? (
                                              <button
                                                onClick={() => setEditingSectionScores(prev => ({
                                                  ...prev,
                                                  [exerciseKey]: sectionScoreValue
                                                }))}
                                                title={sectionScoreValue ? 'Edit section score' : 'Add section score'}
                                                aria-label={sectionScoreValue ? 'Edit section score' : 'Add section score'}
                                                style={{
                                                  padding: '2px 8px',
                                                  fontSize: '0.85em',
                                                  backgroundColor: '#333',
                                                  color: '#aaa',
                                                  border: '1px solid #444',
                                                  borderRadius: '3px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                📝
                                              </button>
                                            ) : (
                                              <button
                                                onClick={() => {
                                                  if (onAuthRequired) onAuthRequired();
                                                }}
                                                title={`Sign in to ${sectionScoreValue ? 'edit' : 'add'} section score`}
                                                aria-label={`Sign in to ${sectionScoreValue ? 'edit' : 'add'} section score`}
                                                style={{
                                                  padding: '2px 8px',
                                                  fontSize: '0.85em',
                                                  backgroundColor: '#646cff',
                                                  color: '#fff',
                                                  border: 'none',
                                                  borderRadius: '3px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                📝
                                              </button>
                                            )}
                                          </div>
                                        </div>
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

                                // Special handling for Notes field - read-only; section score is editable below it
                                if (key === 'Notes') {
                                  return (
                                    <div key={key} style={{ marginTop: '10px', marginBottom: '5px' }}>
                                      <div style={{ marginTop: '5px' }}>
                                        {notesValue && (
                                          <div style={{
                                            color: '#aaa',
                                            fontStyle: 'italic',
                                            marginBottom: '4px'
                                          }}>
                                            {notesValue}
                                          </div>
                                        )}
                                      </div>
                                      {isEditingSectionScore ? (
                                        <div style={{ marginTop: '5px' }}>
                                          <textarea
                                            value={editingSectionScores[exerciseKey] || ''}
                                            onChange={(e) => setEditingSectionScores(prev => ({
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
                                            placeholder="Add section score here..."
                                          />
                                          <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
                                            <button
                                              onClick={() => updateSectionScore(sheetRowNumber, editingSectionScores[exerciseKey] || '', exerciseKey)}
                                              disabled={isSavingSectionScore}
                                              style={{
                                                padding: '5px 10px',
                                                fontSize: '0.85em',
                                                backgroundColor: '#646cff',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: isSavingSectionScore ? 'not-allowed' : 'pointer',
                                                opacity: isSavingSectionScore ? 0.6 : 1
                                              }}
                                            >
                                              {isSavingSectionScore ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                              onClick={() => setEditingSectionScores(prev => {
                                                const updated = { ...prev };
                                                delete updated[exerciseKey];
                                                return updated;
                                              })}
                                              disabled={isSavingSectionScore}
                                              style={{
                                                padding: '5px 10px',
                                                fontSize: '0.85em',
                                                backgroundColor: '#333',
                                                color: '#aaa',
                                                border: '1px solid #444',
                                                borderRadius: '4px',
                                                cursor: isSavingSectionScore ? 'not-allowed' : 'pointer'
                                              }}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ marginTop: '5px' }}>
                                          {sectionScoreValue && (
                                            <div style={{
                                              color: '#aaa',
                                              marginBottom: '4px'
                                            }}>
                                              🕒 {sectionScoreValue}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={key} style={{ marginBottom: '3px' }}>
                                    {value}
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
                    backgroundColor: hasWorkoutOnDate
                      ? (isTodayDate ? '#4f7a2a' : '#2d5016')
                      : (isTodayDate ? '#4a4a4a' : '#333'),
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
