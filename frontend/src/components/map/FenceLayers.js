import React from 'react';
import { Circle, Polygon, Popup } from 'react-leaflet';
import * as turf from '@turf/turf';

/**
 * FenceLayers — renders all fences on the Leaflet map.
 *
 * Color coding:
 *   • Green  → user is currently inside
 *   • Purple → active fence, user outside
 *   • Gray   → inactive fence
 *
 * Props:
 *   fences:        fence objects from API
 *   insideFenceIds: Set<string>
 *   onDelete:      (fenceId) => void
 */
function FenceLayers({ fences, insideFenceIds, onDelete }) {
  return (
    <>
      {fences.map((fence) => {
        const inside   = insideFenceIds.has(fence.id);
        const inactive = !fence.is_active;
        const color    = inactive ? '#6b7280' : inside ? '#10b981' : '#7c3aed';
        const fillOpacity = inside ? 0.18 : 0.08;

        const popupContent = (
          <div style={{ minWidth: 180, fontSize: 13 }}>
            <strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
              {fence.name}
            </strong>
            <div style={{ color: '#6b7280', marginBottom: 4 }}>
              Type: <b>{fence.type}</b>
              {fence.type === 'circle' && ` · r = ${fence.radius_meters}m`}
              {fence.type === 'polygon' && ` · ${fence.coordinates?.length} pts`}
            </div>
            <div style={{ marginBottom: 8 }}>
              Status:{' '}
              <span style={{ color: inside ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {inside ? '✅ Inside' : '⭕ Outside'}
              </span>
            </div>
            <button
              onClick={() => window.confirm(`Delete "${fence.name}"?`) && onDelete(fence.id)}
              style={{
                background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6,
                padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              🗑 Delete
            </button>
          </div>
        );

        if (fence.type === 'circle' && fence.center) {
          return (
            <Circle
              key={fence.id}
              center={[fence.center.lat, fence.center.lng]}
              radius={fence.radius_meters}
              pathOptions={{ color, fillColor: color, fillOpacity, weight: inside ? 2.5 : 1.8 }}
            >
              <Popup>{popupContent}</Popup>
            </Circle>
          );
        }

        if (fence.type === 'polygon' && fence.coordinates?.length >= 3) {
          return (
            <Polygon
              key={fence.id}
              positions={fence.coordinates.map((c) => [c.lat, c.lng])}
              pathOptions={{ color, fillColor: color, fillOpacity, weight: inside ? 2.5 : 1.8 }}
            >
              <Popup>{popupContent}</Popup>
            </Polygon>
          );
        }

        return null;
      })}
    </>
  );
}

/**
 * Compute which fences contain the user's GPS position.
 * Returns a Set<string> of fence IDs.
 */
export function computeInsideFences(fences, location) {
  if (!location) return new Set();
  const userPt = turf.point([location.lng, location.lat]);
  const ids = new Set();

  fences.forEach((fence) => {
    if (!fence.is_active) return;

    if (fence.type === 'circle' && fence.center) {
      const center = turf.point([fence.center.lng, fence.center.lat]);
      const dist   = turf.distance(userPt, center, { units: 'meters' });
      if (dist <= fence.radius_meters) ids.add(fence.id);

    } else if (fence.type === 'polygon' && fence.coordinates?.length >= 4) {
      try {
        const coords = fence.coordinates.map((c) => [c.lng, c.lat]);
        // turf.polygon requires the ring to be closed (first === last)
        const ring = [...coords, coords[0]];
        if (turf.booleanPointInPolygon(userPt, turf.polygon([ring]))) ids.add(fence.id);
      } catch (_) { /* ignore malformed geometry */ }
    }
  });

  return ids;
}

export default FenceLayers;
