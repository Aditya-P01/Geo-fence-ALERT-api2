import { useTracking } from '../contexts/TrackingContext';

/**
 * useGeolocation — wrapper around TrackingContext.
 * Returns { position, mapCenter, error, isTracking, start, stop }
 */
export function useGeolocation() {
  return useTracking();
}
