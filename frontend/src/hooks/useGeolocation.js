import { useState, useEffect, useRef } from 'react';

export function useGeolocation(options = {}) {
  const [location, setLocation] = useState(null);
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const watchId = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...options };

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date(pos.timestamp).toISOString() });
        setLoading(false);
        setError(null);
      },
      (err) => {
        const msgs = { 1: 'Location access denied. Allow GPS in browser settings.', 2: 'Position unavailable. Enable GPS on your device.', 3: 'Location request timed out.' };
        setError(msgs[err.code] || err.message);
        setLoading(false);
      },
      opts
    );

    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, error, loading };
}

export default useGeolocation;
