import { useEffect, useRef, useState, useCallback } from 'preact/hooks';

export const useWakeLock = () => {
  const wakeLockRef = useRef(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    console.log('[WakeLock] useEffect: Starting wake lock hook');
    console.log('[WakeLock] Navigator has wakeLock:', 'wakeLock' in navigator);

    // Check if Wake Lock API is supported
    if (!('wakeLock' in navigator)) {
      console.log('[WakeLock] ✗ Wake Lock API not supported in this browser');
      setIsSupported(false);
      return;
    }

    // Load saved preference
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

  const requestWakeLock = useCallback(async () => {
    console.log('[WakeLock] requestWakeLock: Called');
    console.log('[WakeLock] Current wakeLockRef:', wakeLockRef.current);

    // Don't request if already active
    if (wakeLockRef.current !== null) {
      console.log('[WakeLock] Wake lock already active, skipping request');
      return true;
    }

    try {
      console.log('[WakeLock] Requesting wake lock...');
      console.trace('[WakeLock] Stack trace for request');
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] ✓ Wake Lock activated successfully');
      console.log('[WakeLock] Wake lock object:', wakeLockRef.current);
      console.log('[WakeLock] Wake lock type:', wakeLockRef.current?.type);
      console.log('[WakeLock] Wake lock released:', wakeLockRef.current?.released);
      setIsActive(true);

      wakeLockRef.current.addEventListener('release', () => {
        console.log('[WakeLock] ⚠ Wake Lock released (event fired)');
        wakeLockRef.current = null;
        setIsActive(false);
      });

      return true;
    } catch (err) {
      console.error('[WakeLock] ✗ Wake Lock request failed:', err);
      console.error('[WakeLock] Error name:', err.name);
      console.error('[WakeLock] Error message:', err.message);
      console.error('[WakeLock] Full error object:', err);
      console.trace('[WakeLock] Stack trace for error');

      // Only mark as unsupported if it's a real support issue
      if (err.name === 'NotSupportedError') {
        setIsSupported(false);
      } else if (err.name === 'NotAllowedError') {
        console.warn('[WakeLock] Permission denied - user interaction may not be valid or page may not be focused');
      }

      return false;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    console.log('[WakeLock] releaseWakeLock: Called');
    if (wakeLockRef.current !== null) {
      console.log('[WakeLock] Releasing wake lock...');
      try {
        await wakeLockRef.current.release();
        console.log('[WakeLock] Wake lock released successfully');
        wakeLockRef.current = null;
        setIsActive(false);
      } catch (err) {
        console.error('[WakeLock] Wake lock release failed:', err);
      }
    } else {
      console.log('[WakeLock] No active wake lock to release');
    }
  }, []);

  const toggleWakeLock = useCallback(async () => {
    console.log('[WakeLock] toggleWakeLock: Called, current enabled:', isEnabled);
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);

    // Save preference
    try {
      localStorage.setItem('wakeLockEnabled', JSON.stringify(newEnabled));
      console.log('[WakeLock] Saved preference:', newEnabled);
    } catch (err) {
      console.warn('[WakeLock] Failed to save preference:', err);
    }

    if (newEnabled) {
      await requestWakeLock();
    } else {
      await releaseWakeLock();
    }
  }, [isEnabled, requestWakeLock, releaseWakeLock]);

  // Re-acquire wake lock when page becomes visible (if enabled)
  useEffect(() => {
    if (!isSupported || !isEnabled) return;

    const handleVisibilityChange = async () => {
      console.log('[WakeLock] visibilitychange event fired');
      console.log('[WakeLock] Document visibility state:', document.visibilityState);
      console.log('[WakeLock] Current wakeLockRef:', wakeLockRef.current);
      console.log('[WakeLock] Enabled:', isEnabled);

      if (document.visibilityState === 'visible' && wakeLockRef.current === null && isEnabled) {
        console.log('[WakeLock] Page visible and no active lock - re-acquiring wake lock');
        await requestWakeLock();
      }
    };

    console.log('[WakeLock] Adding visibilitychange listener');
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('[WakeLock] Removing visibilitychange listener');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported, isEnabled, requestWakeLock]);

  // Request/release wake lock when enabled state changes
  useEffect(() => {
    if (!isSupported) return;

    if (isEnabled) {
      console.log('[WakeLock] Enabled - requesting wake lock');
      requestWakeLock();
    } else if (wakeLockRef.current !== null) {
      console.log('[WakeLock] Disabled - releasing wake lock');
      releaseWakeLock();
    }
  }, [isEnabled, isSupported, requestWakeLock, releaseWakeLock]);

  // Cleanup: release wake lock on unmount
  useEffect(() => {
    return () => {
      console.log('[WakeLock] Cleanup: Checking if wake lock needs to be released');
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

  console.log('[WakeLock] Returning from hook - isSupported:', isSupported, 'isActive:', isActive, 'isEnabled:', isEnabled);
  return { isSupported, isActive, isEnabled, toggleWakeLock };
};
