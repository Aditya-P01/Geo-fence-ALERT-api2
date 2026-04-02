import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const TrackingContext = createContext(null);

const LS_KEY = 'geo_tracking_enabled';

export function TrackingProvider({ children }) {
  // Restore tracking preference from localStorage
  const [isTracking, setIsTracking] = useState(
    () => localStorage.getItem(LS_KEY) === 'true'
  );
  const [position, setPosition] = useState(null);
  const [error, setError]       = useState(null);
  const watchIdRef = useRef(null);

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    // Avoid double-watching
    if (watchIdRef.current !== null) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 0 }
    );
    watchIdRef.current = id;
  }, []);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Called by UI: start tracking and persist intent
  const start = useCallback(() => {
    localStorage.setItem(LS_KEY, 'true');
    setIsTracking(true);
    setPosition(null); // reset so map re-centers on fresh position
    startWatch();
  }, [startWatch]);

  // Called by UI: stop tracking and clear intent
  const stop = useCallback(() => {
    localStorage.setItem(LS_KEY, 'false');
    setIsTracking(false);
    setPosition(null);
    stopWatch();
  }, [stopWatch]);

  // On initial app mount — auto-resume if user had tracking ON
  useEffect(() => {
    if (isTracking) {
      startWatch();
    }
    // On app-level unmount (tab close) — clean up the watch
    return () => stopWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TrackingContext.Provider value={{ position, error, isTracking, start, stop }}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  return useContext(TrackingContext);
}
