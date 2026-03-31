import { useState, useEffect, useRef } from 'react';

<<<<<<< HEAD
export function useGeolocation(options = {}) {
  const [location, setLocation] = useState(null);
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(true);
=======
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
>>>>>>> frontend-branch
  const watchId = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

<<<<<<< HEAD
    const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...options };

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date(pos.timestamp).toISOString() });
=======
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
>>>>>>> frontend-branch
        setLoading(false);
        setError(null);
      },
      (err) => {
<<<<<<< HEAD
        const msgs = { 1: 'Location access denied. Allow GPS in browser settings.', 2: 'Position unavailable. Enable GPS on your device.', 3: 'Location request timed out.' };
        setError(msgs[err.code] || err.message);
        setLoading(false);
      },
      opts
    );

    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
=======
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
>>>>>>> frontend-branch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, error, loading };
}

export default useGeolocation;
