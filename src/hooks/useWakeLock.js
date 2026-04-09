import { useEffect, useRef, useState, useCallback } from 'preact/hooks';

const formatWakeLockError = (err, context = 'Unknown wake lock error') => {
  if (!err) {
    return context;
  }

  if (err.name && err.message) {
    return `${context}: ${err.name} - ${err.message}`;
  }

  if (err.message) {
    return `${context}: ${err.message}`;
  }

  if (typeof err === 'string') {
    return `${context}: ${err}`;
  }

  return context;
};

export const useWakeLock = () => {
  const wakeLockRef = useRef(null);
  const requestInFlightRef = useRef(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastEvent, setLastEvent] = useState('idle');
  const [needsUserGesture, setNeedsUserGesture] = useState(false);

  useEffect(() => {
    console.log('[WakeLock] useEffect: Starting wake lock hook');
    console.log('[WakeLock] Navigator has wakeLock:', 'wakeLock' in navigator);

    if (!('wakeLock' in navigator)) {
      console.log('[WakeLock] ✗ Wake Lock API not supported in this browser');
      setIsSupported(false);
      setLastEvent('unsupported');
      return;
    }

    try {
      const saved = localStorage.getItem('wakeLockEnabled');
      if (saved !== null) {
        const enabled = JSON.parse(saved);
        console.log('[WakeLock] Loaded saved preference:', enabled);
        setIsEnabled(enabled);
      }
    } catch (err) {
      console.warn('[WakeLock] Failed to load preference:', err);
    }
  }, []);

  const requestWakeLock = useCallback(async (reason = 'manual') => {
    console.log('[WakeLock] requestWakeLock: Called, reason:', reason);
    console.log('[WakeLock] Current wakeLockRef:', wakeLockRef.current);

    if (wakeLockRef.current !== null) {
      console.log('[WakeLock] Wake lock already active, skipping request');
      setIsActive(true);
      setIsRequesting(false);
      setErrorMessage('');
      setLastEvent('active');
      return true;
    }

    if (requestInFlightRef.current) {
      console.log('[WakeLock] Request already in flight, waiting for existing request');
      return requestInFlightRef.current;
    }

    setIsRequesting(true);
    setErrorMessage('');
    setLastEvent(`requesting:${reason}`);

    const requestPromise = (async () => {
      try {
        console.log('[WakeLock] Requesting wake lock...');
        console.trace('[WakeLock] Stack trace for request');
        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        console.log('[WakeLock] ✓ Wake Lock activated successfully');
        console.log('[WakeLock] Wake lock object:', wakeLockRef.current);
        console.log('[WakeLock] Wake lock type:', wakeLockRef.current?.type);
        console.log('[WakeLock] Wake lock released:', wakeLockRef.current?.released);

        setIsActive(true);
        setIsRequesting(false);
        setErrorMessage('');
        setNeedsUserGesture(false);
        setLastEvent('active');

        wakeLockRef.current.addEventListener('release', () => {
          console.log('[WakeLock] ⚠ Wake Lock released (event fired)');
          wakeLockRef.current = null;
          setIsActive(false);
          setIsRequesting(false);
          setLastEvent(document.visibilityState === 'visible' && isEnabled ? 'released-unexpectedly' : 'released');
        });

        return true;
      } catch (err) {
        console.error('[WakeLock] ✗ Wake Lock request failed:', err);
        console.error('[WakeLock] Error name:', err.name);
        console.error('[WakeLock] Error message:', err.message);
        console.error('[WakeLock] Full error object:', err);
        console.trace('[WakeLock] Stack trace for error');

        const formatted = formatWakeLockError(err, `Wake lock request failed during ${reason}`);
        const requiresGesture = err.name === 'NotAllowedError' && reason !== 'toggle-on';
        setErrorMessage(requiresGesture ? 'Wake lock needs a tap to re-enable on this device' : formatted);
        setIsActive(false);
        setIsRequesting(false);
        setNeedsUserGesture(requiresGesture);
        setLastEvent(requiresGesture ? 'needs-user-gesture' : 'request-failed');

        if (err.name === 'NotSupportedError') {
          setIsSupported(false);
        } else if (err.name === 'NotAllowedError') {
          console.warn('[WakeLock] Permission denied - user interaction may not be valid or page may not be focused');
          if (!requiresGesture) {
            setIsEnabled(false);
            try {
              localStorage.setItem('wakeLockEnabled', JSON.stringify(false));
            } catch (storageErr) {
              console.warn('[WakeLock] Failed to persist disabled state after request failure:', storageErr);
            }
          }
        }

        return false;
      } finally {
        requestInFlightRef.current = null;
      }
    })();

    requestInFlightRef.current = requestPromise;
    return requestPromise;
  }, [isEnabled]);

  const releaseWakeLock = useCallback(async (reason = 'manual') => {
    console.log('[WakeLock] releaseWakeLock: Called, reason:', reason);
    setIsRequesting(false);

    if (wakeLockRef.current !== null) {
      console.log('[WakeLock] Releasing wake lock...');
      try {
        await wakeLockRef.current.release();
        console.log('[WakeLock] Wake lock released successfully');
        wakeLockRef.current = null;
        setIsActive(false);
        setNeedsUserGesture(false);
        setLastEvent(`released:${reason}`);
      } catch (err) {
        console.error('[WakeLock] Wake lock release failed:', err);
        setErrorMessage(formatWakeLockError(err, `Wake lock release failed during ${reason}`));
        setLastEvent('release-failed');
      }
    } else {
      console.log('[WakeLock] No active wake lock to release');
    }
  }, []);

  const toggleWakeLock = useCallback(async () => {
    console.log('[WakeLock] toggleWakeLock: Called, current enabled:', isEnabled);
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);

    try {
      localStorage.setItem('wakeLockEnabled', JSON.stringify(newEnabled));
      console.log('[WakeLock] Saved preference:', newEnabled);
    } catch (err) {
      console.warn('[WakeLock] Failed to save preference:', err);
    }

    if (newEnabled) {
      await requestWakeLock('toggle-on');
    } else {
      setErrorMessage('');
      setNeedsUserGesture(false);
      await releaseWakeLock('toggle-off');
    }
  }, [isEnabled, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (!isSupported || !isEnabled) return;

    const handleVisibilityChange = async () => {
      console.log('[WakeLock] visibilitychange event fired');
      console.log('[WakeLock] Document visibility state:', document.visibilityState);
      console.log('[WakeLock] Current wakeLockRef:', wakeLockRef.current);
      console.log('[WakeLock] Enabled:', isEnabled);

      if (document.visibilityState === 'visible' && wakeLockRef.current === null && isEnabled) {
        console.log('[WakeLock] Page visible and no active lock - re-acquiring wake lock');
        await requestWakeLock('visibility-visible');
      }
    };

    console.log('[WakeLock] Adding visibilitychange listener');
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('[WakeLock] Removing visibilitychange listener');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported, isEnabled, requestWakeLock]);

  useEffect(() => {
    if (!isSupported) return;

    if (isEnabled) {
      console.log('[WakeLock] Enabled - requesting wake lock');
      requestWakeLock('enabled-effect');
    } else if (wakeLockRef.current !== null) {
      console.log('[WakeLock] Disabled - releasing wake lock');
      releaseWakeLock('disabled-effect');
    }
  }, [isEnabled, isSupported, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    return () => {
      console.log('[WakeLock] Cleanup: Checking if wake lock needs to be released');
      requestInFlightRef.current = null;
      if (wakeLockRef.current !== null) {
        console.log('[WakeLock] Cleanup: Releasing wake lock...');
        wakeLockRef.current.release()
          .then(() => {
            console.log('[WakeLock] Cleanup: Wake lock released successfully');
          })
          .catch((err) => {
            console.error('[WakeLock] Cleanup: Wake lock release failed:', err);
          });
      }
    };
  }, []);

  console.log('[WakeLock] Returning from hook - isSupported:', isSupported, 'isActive:', isActive, 'isEnabled:', isEnabled, 'isRequesting:', isRequesting, 'needsUserGesture:', needsUserGesture, 'lastEvent:', lastEvent, 'errorMessage:', errorMessage);
  return { isSupported, isActive, isEnabled, isRequesting, needsUserGesture, errorMessage, lastEvent, toggleWakeLock };
};
