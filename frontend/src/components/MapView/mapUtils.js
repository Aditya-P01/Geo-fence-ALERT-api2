const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

export function readDefaultCenter() {
  const lat = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT || '');
  const lng = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LNG || '');
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function getOneShotPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 }
    );
  });
}

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
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=drawing,geometry&loading=async`;
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

const WATCH = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };
let watchId, lastPos;
const listeners = new Set();
export function subscribeUserPos(cb) {
  listeners.add(cb);
  if (lastPos) cb(lastPos);
  if (watchId == null && navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (p) => {
        lastPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.max(p.coords.accuracy || 0, 5) };
        listeners.forEach((fn) => fn(lastPos));
      },
      () => {},
      WATCH
    );
  }
  return () => listeners.delete(cb);
}

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
