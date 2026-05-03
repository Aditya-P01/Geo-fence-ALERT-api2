import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const TrackingContext = createContext(null);
const LS_KEY = 'geo_tracking_enabled';

/**
 * Unified GPS Engine — THE ONLY geolocation source in the entire app.
 * 
 * Architecture:
 * 1. On mount: single getCurrentPosition for initial map centering (fast, allows cached)
 * 2. When tracking ON: single watchPosition for continuous updates (THE ONLY watcher)
 * 3. When tracking OFF: clear watcher, keep last known position for map
 * 
 * CRITICAL: No other component should call navigator.geolocation directly.
 * All position data flows through this context.
 */
export function TrackingProvider({ children }) {
  const [isTracking, setIsTracking] = useState(
    () => localStorage.getItem(LS_KEY) === 'true'
  );
  // position: updated by watchPosition when tracking
  const [position, setPosition] = useState(null);
  // mapCenter: one-shot position for initial map centering (available even when not tracking)
  const [mapCenter, setMapCenter] = useState(null);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);

  // ── On mount: get ONE position for map centering ─────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    // Fast one-shot: allows cached position (up to 5 min old), low accuracy OK
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setMapCenter(p);
        // If tracking is already on but position hasn't arrived yet, seed it
        if (!position) setPosition(p);
      },
      () => {}, // silently ignore — not critical for startup
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Core watcher: runs ONLY when tracking is ON ──────────────
  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    // Clear any existing watcher (safety)
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setError(null);

    // THE ONLY watchPosition in the entire application
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setPosition(p);
        setMapCenter(p); // keep mapCenter fresh too
        setError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location access denied. Please enable in browser settings.');
        }
        // For timeout/unavailable: DON'T show error if we already have a position
        // The watcher will automatically retry
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 }
    );
  }, []);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // ── Public: start tracking ───────────────────────────────────
  const start = useCallback(() => {
    localStorage.setItem(LS_KEY, 'true');
    setIsTracking(true);
    setError(null);
    startWatch();
  }, [startWatch]);

  // ── Public: stop tracking ────────────────────────────────────
  const stop = useCallback(() => {
    localStorage.setItem(LS_KEY, 'false');
    setIsTracking(false);
    setPosition(null);
    setError(null);
    stopWatch();
  }, [stopWatch]);

  // ── Auto-resume on mount if was tracking ─────────────────────
  useEffect(() => {
    if (isTracking) startWatch();
    return () => stopWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TrackingContext.Provider value={{ position, mapCenter, error, isTracking, start, stop }}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  return useContext(TrackingContext);
}
