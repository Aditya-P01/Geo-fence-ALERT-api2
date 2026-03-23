import React from 'react';
import './MapPage.css';

/**
 * MapPage — interactive map with live GPS tracking and fence drawing.
 * Full implementation in the next part.
 */
const MapPage = () => {
  return (
    <div className="map-page">
      <div className="map-placeholder">
        <div className="map-placeholder-inner">
          <span className="map-placeholder-icon">🗺️</span>
          <h2>Interactive Map</h2>
          <p>Real-time GPS tracking and geo-fence drawing will appear here.</p>
          <p className="map-placeholder-sub">Map implementation coming in next part.</p>
        </div>
      </div>
    </div>
  );
};

export default MapPage;
