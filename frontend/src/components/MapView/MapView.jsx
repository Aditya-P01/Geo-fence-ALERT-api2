import { useState, useEffect, useRef } from 'react';
import {
  loadGoogleMaps,
  FENCE_COLORS,
  userDotIcon,
  darkMapStyles,
} from './mapUtils';
import './MapView.css';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

const drawOpts = (fill, stroke) => ({
  fillColor: fill,
  fillOpacity: 0.2,
  strokeColor: stroke,
  strokeWeight: 2,
  clickable: false,
  editable: true,
  zIndex: 1,
});

function fenceShape(map, fence, colors, onFenceClick) {
  const common = {
    map,
    fillColor: colors.fill,
    fillOpacity: 0.15,
    strokeColor: colors.stroke,
    strokeOpacity: 0.9,
    strokeWeight: 2,
    clickable: true,
    zIndex: 200,
  };
  if (fence.type === 'circle' && fence.center) {
    const c = new window.google.maps.Circle({
      ...common,
      center: fence.center,
      radius: fence.radius_meters,
    });
    c.addListener('click', () => onFenceClick?.(fence));
    return c;
  }
  if (fence.type === 'polygon' && fence.coordinates) {
    const p = new window.google.maps.Polygon({
      ...common,
      paths: fence.coordinates.map((x) => ({ lat: x.lat, lng: x.lng })),
    });
    p.addListener('click', () => onFenceClick?.(fence));
    return p;
  }
  return null;
}

/**
 * MapView — Google Maps display component.
 * 
 * IMPORTANT: This component has ZERO internal GPS watchers.
 * All position data comes via props from TrackingContext.
 * 
 * Props:
 *   fences         - array of fence objects to render
 *   devicePosition - { lat, lng, accuracy } from TrackingContext (continuous when tracking)
 *   mapCenter      - { lat, lng } from TrackingContext (one-shot for initial centering)
 *   drawingMode    - 'circle' | 'polygon' | null
 *   onFenceDrawn   - callback when user finishes drawing
 *   onFenceClick   - callback when user clicks a fence
 */
export default function MapView({
  fences = [],
  devicePosition,
  mapCenter,
  drawingMode,
  onFenceDrawn,
  onFenceClick,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const deviceMarkerRef = useRef(null);
  const deviceAccRef = useRef(null);
  const drawMgrRef = useRef(null);
  const centeredRef = useRef(false);
  const onDrawRef = useRef(onFenceDrawn);
  onDrawRef.current = onFenceDrawn;

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  // ── Load Google Maps API ─────────────────────────────────────
  useEffect(() => {
    if (!KEY || KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      setError('Set VITE_GOOGLE_MAPS_KEY in frontend/.env.local');
      return;
    }
    loadGoogleMaps().then(() => setMapsLoaded(true)).catch((e) => setError(e.message));
  }, []);

  // ── Initialize map (NO GPS dependency — instant) ─────────────
  useEffect(() => {
    if (!mapsLoaded || !containerRef.current || mapRef.current) return;

    try {
      // Default center: India if no position available yet
      const center = mapCenter
        ? { lat: mapCenter.lat, lng: mapCenter.lng }
        : { lat: 20.5937, lng: 78.9629 };
      const zoom = mapCenter ? 15 : 5;

      const m = new window.google.maps.Map(containerRef.current, {
        center,
        zoom,
        mapTypeId: 'roadmap',
        styles: darkMapStyles,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      mapRef.current = m;

      // Drawing manager
      const dm = new window.google.maps.drawing.DrawingManager({
        drawingControl: false,
        circleOptions: drawOpts('#6366f1', '#6366f1'),
        polygonOptions: drawOpts('#10b981', '#10b981'),
      });
      dm.setMap(m);
      drawMgrRef.current = dm;

      const g = window.google.maps;
      g.event.addListener(dm, 'circlecomplete', (circle) => {
        const data = {
          type: 'circle',
          center: { lat: circle.getCenter().lat(), lng: circle.getCenter().lng() },
          radius_meters: Math.round(circle.getRadius()),
        };
        circle.setMap(null);
        dm.setDrawingMode(null);
        onDrawRef.current?.(data);
      });
      g.event.addListener(dm, 'polygoncomplete', (poly) => {
        const coords = poly.getPath().getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
        const a = coords[0];
        const b = coords[coords.length - 1];
        if (a && b && (a.lat !== b.lat || a.lng !== b.lng)) coords.push({ lat: a.lat, lng: a.lng });
        poly.setMap(null);
        dm.setDrawingMode(null);
        onDrawRef.current?.({ type: 'polygon', coordinates: coords });
      });

      setReady(true);
    } catch (err) {
      console.error('[MapView] Init error:', err);
      setError('Failed to initialize map: ' + (err.message || 'unknown error'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsLoaded]);

  // ── Re-center map when mapCenter arrives (one-time) ──────────
  useEffect(() => {
    if (!mapRef.current || !mapCenter || centeredRef.current) return;
    mapRef.current.panTo({ lat: mapCenter.lat, lng: mapCenter.lng });
    mapRef.current.setZoom(15);
    centeredRef.current = true;
  }, [mapCenter]);

  // ── Drawing mode toggle ──────────────────────────────────────
  useEffect(() => {
    const dm = drawMgrRef.current;
    if (!dm || !window.google) return;
    const T = window.google.maps.drawing.OverlayType;
    dm.setDrawingMode(drawingMode ? { circle: T.CIRCLE, polygon: T.POLYGON }[drawingMode] : null);
  }, [drawingMode]);

  // ── Render fence overlays ────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    fences.forEach((fence) => {
      const colors = FENCE_COLORS[fence.type] || FENCE_COLORS.circle;
      const shape = fenceShape(mapRef.current, fence, colors, onFenceClick);
      if (shape) overlaysRef.current.push(shape);
    });
  }, [fences, onFenceClick]);

  // ── Device position marker (from TrackingContext) ────────────
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const map = mapRef.current;

    if (!devicePosition) {
      // Clean up marker when tracking stops
      if (deviceMarkerRef.current) {
        deviceMarkerRef.current.setMap(null);
        deviceMarkerRef.current = null;
      }
      if (deviceAccRef.current) {
        deviceAccRef.current.setMap(null);
        deviceAccRef.current = null;
      }
      return;
    }

    const pos = { lat: devicePosition.lat, lng: devicePosition.lng };

    // Create or update marker
    if (!deviceMarkerRef.current) {
      deviceMarkerRef.current = new window.google.maps.Marker({
        map,
        position: pos,
        zIndex: 999,
        title: 'Your location',
        optimized: true,
        icon: userDotIcon(window.google.maps),
      });
    } else {
      deviceMarkerRef.current.setPosition(pos);
    }

    // Accuracy circle
    const radius = Math.max(devicePosition.accuracy || 10, 8);
    if (!deviceAccRef.current) {
      deviceAccRef.current = new window.google.maps.Circle({
        map,
        center: pos,
        radius,
        fillColor: '#1a73e8',
        fillOpacity: 0.08,
        strokeColor: '#1a73e8',
        strokeOpacity: 0.3,
        strokeWeight: 1,
        clickable: false,
        zIndex: 498,
      });
    } else {
      deviceAccRef.current.setCenter(pos);
      deviceAccRef.current.setRadius(radius);
    }

    // Pan to first position received
    if (!centeredRef.current) {
      map.panTo(pos);
      map.setZoom(16);
      centeredRef.current = true;
    }
  }, [devicePosition]);

  // ── Render ───────────────────────────────────────────────────
  if (error) return <div className="map-error"><span>⚠️</span><p>{error}</p></div>;

  if (!mapsLoaded) {
    return (
      <div className="map-loading">
        <div className="map-spinner" />
        <p>Loading Google Maps…</p>
      </div>
    );
  }

  return (
    <div className="map-wrapper">
      <div ref={containerRef} className="map-container" />
      {!ready && (
        <div className="map-loading map-loading-overlay" aria-busy="true">
          <div className="map-spinner" />
          <p>Initializing map…</p>
        </div>
      )}
    </div>
  );
}
