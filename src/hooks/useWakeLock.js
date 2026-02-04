import { useEffect, useRef, useState } from 'preact/hooks';

export const useWakeLock = () => {
  const wakeLockRef = useRef(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Wake Lock activated');
          setIsSupported(true);

          wakeLockRef.current.addEventListener('release', () => {
            console.log('Wake Lock released');
          });
        } else {
          console.log('Wake Lock API not supported');
          setIsSupported(false);
        }
      } catch (err) {
        console.error('Wake Lock request failed:', err);
        setIsSupported(false);
      }
    };

    // Request wake lock when component mounts
    requestWakeLock();

    // Re-acquire wake lock when page becomes visible
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current !== null) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup: release wake lock on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (wakeLockRef.current !== null) {
        wakeLockRef.current.release()
          .then(() => {
            wakeLockRef.current = null;
          })
          .catch((err) => {
            console.error('Wake Lock release failed:', err);
          });
      }
    };
  }, []);

  return { wakeLockRef, isSupported };
};
