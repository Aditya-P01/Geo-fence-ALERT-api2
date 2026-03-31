import React, { useEffect, useRef } from 'react';
import { Marker, Popup, Circle, useMap } from 'react-leaflet';

/**
 * UserMarker — shows the device's live GPS position.
 * On first fix, re-centres the map to the user's location.
 *
 * Props: location: { lat, lng, accuracy }
 */
function UserMarker({ location }) {
  const map = useMap();
  const hasCentred = useRef(false);

  useEffect(() => {
    if (location && !hasCentred.current) {
      map.setView([location.lat, location.lng], 15, { animate: true });
      hasCentred.current = true;
    }
  }, [location, map]);

  if (!location) return null;

  return (
    <>
      {/* Blue accuracy circle */}
      <Circle
        center={[location.lat, location.lng]}
        radius={location.accuracy || 30}
        pathOptions={{
          color: '#2563eb', fillColor: '#3b82f6',
          fillOpacity: 0.10, weight: 1.5, dashArray: '4 3',
        }}
      />
      {/* Position marker */}
      <Marker position={[location.lat, location.lng]}>
        <Popup>
          <div style={{ fontSize: 13, minWidth: 160 }}>
            <strong>📍 Your Location</strong>
            <div style={{ color: '#6b7280', marginTop: 4 }}>
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </div>
            {location.accuracy && (
              <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                Accuracy: ±{Math.round(location.accuracy)}m
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
}

export default UserMarker;
