import { useState, useEffect, useRef } from 'react';
import {
  loadGoogleMaps,
  readDefaultCenter,
  subscribeUserPos,
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

export default function MapView({
  fences = [],
  devicePosition,
  drawingMode,
  onFenceDrawn,
  onFenceClick,
  showUserDot = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const deviceMarkerRef = useRef(null);
  const userDotRef = useRef(null);
  const userAccRef = useRef(null);
  const drawMgrRef = useRef(null);
  const centeredRef = useRef(false);
  const onDrawRef = useRef(onFenceDrawn);
  onDrawRef.current = onFenceDrawn;

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [gpsWaiting, setGpsWaiting] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!KEY || KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      setError('Set VITE_GOOGLE_MAPS_KEY in frontend/.env.local');
      return;
    }
    loadGoogleMaps().then(() => setMapsLoaded(true)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const fb = readDefaultCenter();
      const center = fb || { lat: 20, lng: 0 };
      const zoom = fb ? 12 : 2;

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

      // Mark ready immediately (don't block on GPS prompt).
      if (!cancelled) setReady(true);

      // One-shot GPS recenter (fast path) — does not block initial map render.
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            if (cancelled || !mapRef.current) return;
            mapRef.current.panTo({ lat: p.coords.latitude, lng: p.coords.longitude });
            mapRef.current.setZoom(16);
          },
          () => { },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
        );
      }
    })();
    return () => { cancelled = true; };
  }, [mapsLoaded]);

  useEffect(() => {
    if (!showUserDot || !ready) return;
    return subscribeUserPos((pos) => {
      setGpsWaiting(false);
      const map = mapRef.current;
      if (!map || !window.google) return;

      if (!centeredRef.current && !devicePosition) {
        map.panTo({ lat: pos.lat, lng: pos.lng });
        map.setZoom(16);
        centeredRef.current = true;
      }
      const acc = Math.max(pos.acc || 10, 8);
      const c = { lat: pos.lat, lng: pos.lng };
      if (!userAccRef.current) {
        userAccRef.current = new window.google.maps.Circle({
          map,
          center: c,
          radius: acc,
          fillColor: '#1a73e8',
          fillOpacity: 0.1,
          strokeColor: '#1a73e8',
          strokeOpacity: 0.35,
          strokeWeight: 1,
          clickable: false,
          zIndex: 490,
        });
      } else {
        userAccRef.current.setCenter(c);
        userAccRef.current.setRadius(acc);
      }
      if (!userDotRef.current) {
        userDotRef.current = new window.google.maps.Marker({
          map,
          position: c,
          zIndex: 500,
          title: 'Your location',
          optimized: true,
          icon: userDotIcon(window.google.maps),
        });
      } else userDotRef.current.setPosition(c);
    });
  }, [showUserDot, ready, devicePosition]);

  useEffect(() => {
    const dm = drawMgrRef.current;
    if (!dm || !window.google) return;
    const T = window.google.maps.drawing.OverlayType;
    dm.setDrawingMode(drawingMode ? { circle: T.CIRCLE, polygon: T.POLYGON }[drawingMode] : null);
  }, [drawingMode]);

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

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const map = mapRef.current;
    if (!devicePosition) {
      const mk = deviceMarkerRef.current;
      if (mk?._accCircle) { mk._accCircle.setMap(null); mk._accCircle = null; }
      mk?.setMap(null);
      deviceMarkerRef.current = null;
      centeredRef.current = false; // Add this so map will pan again when tracking resumes
      return;
    }
    let mk = deviceMarkerRef.current;
    if (!mk) {
      mk = new window.google.maps.Marker({
        map,
        zIndex: 999,
        title: 'Device location',
        optimized: true,
        icon: userDotIcon(window.google.maps),
      });
      deviceMarkerRef.current = mk;
    }
    mk.setPosition(devicePosition);
    const r = devicePosition.accuracy != null ? Math.max(devicePosition.accuracy, 8) : 25;
    if (!mk._accCircle) {
      mk._accCircle = new window.google.maps.Circle({
        map,
        center: devicePosition,
        radius: r,
        fillColor: '#1a73e8',
        fillOpacity: 0.08,
        strokeColor: '#1a73e8',
        strokeOpacity: 0.3,
        strokeWeight: 1,
        clickable: false,
        zIndex: 498,
      });
    } else {
      mk._accCircle.setCenter(devicePosition);
      mk._accCircle.setRadius(r);
    }
    if (!centeredRef.current) {
      map.panTo(devicePosition);
      map.setZoom(16);
      centeredRef.current = true;
    }
  }, [devicePosition]);

  if (error) return <div className="map-error"><span>⚠️</span><p>{error}</p></div>;

  // Must mount the map container as soon as the JS API is loaded; otherwise `containerRef`
  // stays null and the map never initializes (ready never flips true).
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
      {gpsWaiting && showUserDot && ready && (
        <div className="map-gps-badge">📡 Acquiring GPS…</div>
      )}
    </div>
  );
}
