import { useState, useEffect, useRef } from 'react';
import './MapView.css';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

// ── Singleton loader — script injected exactly ONCE ───────────
let _mapsPromise = null;
function loadGoogleMaps() {
  if (_mapsPromise) return _mapsPromise;
  _mapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener('load', () => resolve(window.google.maps)); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=drawing,geometry`;
    script.async = true; script.defer = true;
    script.onload  = () => resolve(window.google.maps);
    script.onerror = () => { _mapsPromise = null; reject(new Error('Failed to load Google Maps')); };
    document.head.appendChild(script);
  });
  return _mapsPromise;
}

// ── User-position blue-dot singleton (shared across both dashboards) ──
let _userWatchId = null;
let _userPos    = null;
const _posListeners = new Set();
function subscribeUserPos(cb) {
  _posListeners.add(cb);
  if (_userPos) cb(_userPos);
  if (_userWatchId === null && navigator.geolocation) {
    _userWatchId = navigator.geolocation.watchPosition(
      pos => {
        _userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        _posListeners.forEach(fn => fn(_userPos));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  }
  return () => _posListeners.delete(cb);
}

const FENCE_COLORS = {
  circle:  { stroke: '#6366f1', fill: '#6366f1' },
  polygon: { stroke: '#10b981', fill: '#10b981' },
};

/**
 * MapView — full map with live blue-dot, fence overlays, drawing tools, device marker.
 *
 * Props:
 *   fences         {Array}    — fence objects to render
 *   devicePosition {Object}   — { lat, lng } external device pin (cyan) or null
 *   drawingMode    {string}   — 'circle' | 'polygon' | null
 *   onFenceDrawn   {Function} — called with shape data when user draws
 *   onFenceClick   {Function} — called with fence object when overlay is clicked
 *   showUserDot    {bool}     — show live blue dot (default true)
 */
export default function MapView({
  fences = [], devicePosition, drawingMode,
  onFenceDrawn, onFenceClick, showUserDot = true,
}) {
  const containerRef      = useRef(null);
  const mapRef            = useRef(null);
  const overlaysRef       = useRef([]);
  const deviceMarkerRef   = useRef(null);
  const userDotRef        = useRef(null);
  const userAccCircleRef  = useRef(null);
  const drawingManagerRef = useRef(null);
  const centeredRef       = useRef(false);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [error,      setError]      = useState(null);
  const [gpsWaiting, setGpsWaiting] = useState(true);

  // ── 1. Load Google Maps SDK ───────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || GOOGLE_MAPS_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      setError('Set VITE_GOOGLE_MAPS_KEY in frontend/.env.local');
      return;
    }
    loadGoogleMaps().then(() => setMapsLoaded(true)).catch(e => setError(e.message));
  }, []);

  // ── 2. Init map (no hardcoded center — waits for GPS) ────────
  useEffect(() => {
    if (!mapsLoaded || !containerRef.current || mapRef.current) return;

    // Start at world zoom; will fly to user location once GPS resolves
    mapRef.current = new window.google.maps.Map(containerRef.current, {
      center: { lat: 20, lng: 78 },
      zoom: 3,
      mapTypeId: 'roadmap',
      styles: darkMapStyles,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    // Drawing manager
    drawingManagerRef.current = new window.google.maps.drawing.DrawingManager({
      drawingControl: false,
      circleOptions:  { fillColor: '#6366f1', fillOpacity: 0.2, strokeColor: '#6366f1', strokeWeight: 2, clickable: false, editable: true, zIndex: 1 },
      polygonOptions: { fillColor: '#10b981', fillOpacity: 0.2, strokeColor: '#10b981', strokeWeight: 2, clickable: false, editable: true, zIndex: 1 },
    });
    drawingManagerRef.current.setMap(mapRef.current);

    window.google.maps.event.addListener(drawingManagerRef.current, 'circlecomplete', (circle) => {
      const data = { type: 'circle', center: { lat: circle.getCenter().lat(), lng: circle.getCenter().lng() }, radius_meters: Math.round(circle.getRadius()) };
      circle.setMap(null);
      drawingManagerRef.current.setDrawingMode(null);
      if (onFenceDrawn) onFenceDrawn(data);
    });
    window.google.maps.event.addListener(drawingManagerRef.current, 'polygoncomplete', (poly) => {
      const coords = poly.getPath().getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }));
      if (coords[0].lat !== coords[coords.length - 1].lat) coords.push(coords[0]);
      poly.setMap(null);
      drawingManagerRef.current.setDrawingMode(null);
      if (onFenceDrawn) onFenceDrawn({ type: 'polygon', coordinates: coords });
    });
  }, [mapsLoaded]);

  // ── 3. Live blue dot — user's own GPS position ───────────────
  useEffect(() => {
    if (!showUserDot || !mapsLoaded) return;

    const unsub = subscribeUserPos((pos) => {
      setGpsWaiting(false);

      if (!mapRef.current || !window.google) return;

      // First fix → fly to user location at street level
      if (!centeredRef.current && !devicePosition) {
        mapRef.current.setCenter({ lat: pos.lat, lng: pos.lng });
        mapRef.current.setZoom(15);
        centeredRef.current = true;
      }

      // Accuracy circle
      if (!userAccCircleRef.current) {
        userAccCircleRef.current = new window.google.maps.Circle({
          map: mapRef.current,
          center: { lat: pos.lat, lng: pos.lng },
          radius: pos.acc,
          fillColor: '#4285f4', fillOpacity: 0.12,
          strokeColor: '#4285f4', strokeOpacity: 0.4, strokeWeight: 1,
          clickable: false, zIndex: 490,
        });
      } else {
        userAccCircleRef.current.setCenter({ lat: pos.lat, lng: pos.lng });
        userAccCircleRef.current.setRadius(pos.acc);
      }

      // Blue dot
      if (!userDotRef.current) {
        userDotRef.current = new window.google.maps.Marker({
          map: mapRef.current,
          position: { lat: pos.lat, lng: pos.lng },
          zIndex: 500,
          title: 'Your location',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#4285f4', fillOpacity: 1,
            strokeColor: '#fff',  strokeWeight: 2.5,
          },
        });
      } else {
        userDotRef.current.setPosition({ lat: pos.lat, lng: pos.lng });
      }
    });
    return unsub;
  }, [showUserDot, mapsLoaded, devicePosition]);

  // ── 4. Sync drawing mode ──────────────────────────────────────
  useEffect(() => {
    if (!drawingManagerRef.current || !window.google) return;
    const modeMap = { circle: window.google.maps.drawing.OverlayType.CIRCLE, polygon: window.google.maps.drawing.OverlayType.POLYGON };
    drawingManagerRef.current.setDrawingMode(drawingMode ? modeMap[drawingMode] : null);
  }, [drawingMode]);

  // ── 5. Render fence overlays ──────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];

    fences.forEach(fence => {
      const colors = FENCE_COLORS[fence.type] || FENCE_COLORS.circle;
      let shape;

      if (fence.type === 'circle' && fence.center) {
        shape = new window.google.maps.Circle({
          map: mapRef.current,
          center: fence.center,
          radius: fence.radius_meters,
          fillColor: colors.fill, fillOpacity: 0.15,
          strokeColor: colors.stroke, strokeOpacity: 0.9, strokeWeight: 2,
          clickable: true, zIndex: 200,
        });
        shape.addListener('click', () => onFenceClick && onFenceClick(fence));
      } else if (fence.type === 'polygon' && fence.coordinates) {
        shape = new window.google.maps.Polygon({
          map: mapRef.current,
          paths: fence.coordinates.map(c => ({ lat: c.lat, lng: c.lng })),
          fillColor: colors.fill, fillOpacity: 0.15,
          strokeColor: colors.stroke, strokeOpacity: 0.9, strokeWeight: 2,
          clickable: true, zIndex: 200,
        });
        shape.addListener('click', () => onFenceClick && onFenceClick(fence));
      }
      if (shape) overlaysRef.current.push(shape);
    });
  }, [fences]);

  // ── 6. External device marker (cyan) ─────────────────────────
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!devicePosition) {
      deviceMarkerRef.current?.setMap(null);
      deviceMarkerRef.current = null;
      return;
    }
    if (!deviceMarkerRef.current) {
      deviceMarkerRef.current = new window.google.maps.Marker({
        map: mapRef.current, zIndex: 999, title: 'Your Device',
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#22d3ee', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      });
    }
    deviceMarkerRef.current.setPosition(devicePosition);
    if (!centeredRef.current) {
      mapRef.current.setCenter(devicePosition);
      mapRef.current.setZoom(15);
      centeredRef.current = true;
    }
  }, [devicePosition]);

  // ── Render ────────────────────────────────────────────────────
  if (error) return (
    <div className="map-error"><span>⚠️</span><p>{error}</p></div>
  );
  if (!mapsLoaded) return (
    <div className="map-loading"><div className="map-spinner" /><p>Loading map…</p></div>
  );

  return (
    <div className="map-wrapper">
      <div ref={containerRef} className="map-container" />
      {gpsWaiting && showUserDot && (
        <div className="map-gps-badge">📡 Acquiring GPS…</div>
      )}
    </div>
  );
}

// ── Dark map style ─────────────────────────────────────────────
const darkMapStyles = [
  { elementType: 'geometry',            stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road',            elementType: 'geometry',        stylers: [{ color: '#1e293b' }] },
  { featureType: 'road',            elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road.highway',    elementType: 'geometry',        stylers: [{ color: '#334155' }] },
  { featureType: 'water',           elementType: 'geometry',        stylers: [{ color: '#0c1a29' }] },
  { featureType: 'poi',             elementType: 'geometry',        stylers: [{ color: '#1e293b' }] },
  { featureType: 'transit.station', elementType: 'geometry',        stylers: [{ color: '#1e293b' }] },
  { featureType: 'administrative',  elementType: 'geometry',        stylers: [{ color: '#1e293b' }] },
];
