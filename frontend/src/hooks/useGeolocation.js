import { useTracking } from '../contexts/TrackingContext';

/**
 * useGeolocation — now just a wrapper around TrackingContext 
 * so existing consumers don't need to change imports.
 */
export function useGeolocation() {
  return useTracking();
}
