import { useState, useEffect, useRef } from 'react';

/**
 * useGeolocation — wraps navigator.geolocation.watchPosition
 *
 * Returns:
 *   location : { lat, lng, accuracy, timestamp } | null
 *   error    : string | null
 *   loading  : boolean
 */
export function useGeolocation(options = {}) {
  const [location, setLocation] = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const watchId = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    const defaults = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...options,
    };

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          timestamp: new Date(pos.timestamp).toISOString(),
        });
        setLoading(false);
        setError(null);
      },
      (err) => {
        const messages = {
          1: 'Location access denied. Please allow GPS in your browser settings.',
          2: 'Position unavailable. Make sure GPS is enabled on your device.',
          3: 'Location request timed out. Please try again.',
        };
        setError(messages[err.code] || err.message);
        setLoading(false);
      },
      defaults
    );

    // Cleanup: stop watching when the component using this hook unmounts
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, error, loading };
}

export default useGeolocation;
