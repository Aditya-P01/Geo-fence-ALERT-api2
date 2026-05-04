const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

// ── Load Google Maps API (singleton promise) ────────────────────
let mapsPromise;
export function loadGoogleMaps() {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const done = () => {
        if (window.google?.maps) resolve(window.google.maps);
        else reject(new Error('Google Maps script present but API not available'));
      };
      if (window.google?.maps) {
        done();
        return;
      }
      existing.addEventListener('load', done);
      existing.addEventListener('error', () => {
        mapsPromise = null;
        reject(new Error('Failed to load Google Maps'));
      });
      return;
    }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=drawing,geometry`;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else {
        mapsPromise = null;
        reject(new Error('Maps script loaded but google.maps is missing'));
      }
    };
    s.onerror = () => {
      mapsPromise = null;
      reject(new Error('Failed to load Google Maps script (network or blocked)'));
    };
    document.head.appendChild(s);
  });
  return mapsPromise;
}

// ── Visual constants ────────────────────────────────────────────
export const FENCE_COLORS = {
  circle: { stroke: '#6366f1', fill: '#6366f1' },
  polygon: { stroke: '#10b981', fill: '#10b981' },
};

export const userDotIcon = (maps) => ({
  path: maps.SymbolPath.CIRCLE,
  scale: 8,
  fillColor: '#1a73e8',
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 2.5,
});

export const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1a29' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
];
