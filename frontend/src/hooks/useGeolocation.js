import { useState, useEffect, useCallback } from 'react';

/**
 * useGeolocation — polls the browser GPS at a given interval.
 * Returns: { position, error, isTracking, start, stop }
 */
export function useGeolocation(intervalMs = 5000) {
  const [position, setPosition] = useState(null);
  const [error, setError]       = useState(null);
  const [isTracking, setTracking] = useState(false);
  const [watchId, setWatchId]   = useState(null);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setTracking(true);
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
    setWatchId(id);
  }, []);

  const stop = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setTracking(false);
    setPosition(null);
  }, [watchId]);

  useEffect(() => () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); }, [watchId]);

  return { position, error, isTracking, start, stop };
}
