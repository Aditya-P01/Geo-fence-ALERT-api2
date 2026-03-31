import { useEffect } from 'react';
import { useMapEvents, Circle, Polygon } from 'react-leaflet';
import * as turf from '@turf/turf';

/**
 * DrawingLayer — rendered inside <MapContainer>.
 *
 * Circle mode:  first click = center, mousemove = live radius preview, second click = finalize.
 * Polygon mode: each click adds a vertex; parent calls finishPolygon() callback.
 *
 * Props:
 *   drawMode:          'none' | 'circle' | 'polygon'
 *   polygonPoints:     { lat, lng }[]  (controlled by parent)
 *   setPolygonPoints:  state setter
 *   circleState:       { center: {lat,lng}|null, radius: number }
 *   setCircleState:    state setter
 *   onDrawComplete:    ({ type, data }) => void — called when a shape is finalised
 */
function DrawingLayer({
  drawMode,
  polygonPoints,
  setPolygonPoints,
  circleState,
  setCircleState,
  onDrawComplete,
}) {
  // Listen to map events — this hook must be inside MapContainer
  useMapEvents({
    click(e) {
      if (drawMode === 'circle') {
        if (!circleState.center) {
          // First click → set center
          setCircleState({ center: { lat: e.latlng.lat, lng: e.latlng.lng }, radius: 50 });
        } else {
          // Second click → finalise circle
          const { center, radius } = circleState;
          onDrawComplete({ type: 'circle', data: { center, radius_meters: Math.round(radius) } });
          setCircleState({ center: null, radius: 0 });
        }
      } else if (drawMode === 'polygon') {
        // Each click adds a vertex
        setPolygonPoints((prev) => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
      }
    },

    mousemove(e) {
      if (drawMode === 'circle' && circleState.center) {
        const from = turf.point([circleState.center.lng, circleState.center.lat]);
        const to   = turf.point([e.latlng.lng, e.latlng.lat]);
        const dist = turf.distance(from, to, { units: 'meters' });
        setCircleState((prev) => ({ ...prev, radius: Math.max(dist, 30) }));
      }
    },
  });

  // Sync cursor style to the map DOM element
  useEffect(() => {
    const container = document.querySelector('.leaflet-container');
    if (!container) return;
    container.style.cursor = drawMode !== 'none' ? 'crosshair' : '';
    return () => { container.style.cursor = ''; };
  }, [drawMode]);

  return (
    <>
      {/* Circle preview while drawing */}
      {drawMode === 'circle' && circleState.center && circleState.radius > 0 && (
        <Circle
          center={[circleState.center.lat, circleState.center.lng]}
          radius={circleState.radius}
          pathOptions={{ color: '#7c3aed', dashArray: '8 4', fillOpacity: 0.12, weight: 2 }}
        />
      )}

      {/* Polygon preview while drawing */}
      {drawMode === 'polygon' && polygonPoints.length >= 2 && (
        <Polygon
          positions={polygonPoints.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: '#7c3aed', dashArray: '8 4', fillOpacity: 0.1, weight: 2 }}
        />
      )}
    </>
  );
}

export default DrawingLayer;
