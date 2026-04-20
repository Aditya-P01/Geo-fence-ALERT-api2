import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import MapView from '../components/MapView/MapView';
import AlertFeed from '../components/AlertFeed/AlertFeed';
import { useGeolocation } from '../hooks/useGeolocation';
import { useSocket } from '../hooks/useSocket';
import { locationApi, fenceApi } from '../api/client';
import './DeviceDashboard.css';

const DEVICE_ID_KEY = 'geo_device_id';
const DEVICE_LABEL_KEY = 'geo_device_label';

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `device-${Date.now()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export default function DeviceDashboard() {
  const deviceId = getDeviceId();
  const { position, error: gpsError, isTracking, start, stop } = useGeolocation();
  const [fences, setFences]       = useState([]);
  const [insideFences, setInside] = useState([]);
  const [lastReport,   setLast]   = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    fenceApi.getAll({ limit: 100 }).then(r => setFences(r.data.fences || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isTracking && position) {
      const report = async () => {
        try {
          const label = (localStorage.getItem(DEVICE_LABEL_KEY) || '').trim();
          const res = await locationApi.report(deviceId, {
            lat: position.lat,
            lng: position.lng,
            timestamp: new Date(position.timestamp).toISOString(),
            ...(label ? { metadata: { device_label: label } } : {}),
          });
          setLast(res.data);
          setInside(res.data.currently_inside || []);
        } catch { /* silent */ }
      };
      report();
      intervalRef.current = setInterval(report, 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isTracking, position?.lat, position?.lng]);

  useSocket('geo_alert', (event) => {
    if (event.device_id !== deviceId) return;
    if (event.event_type === 'ENTER') {
      toast.success(`Entered: ${event.fence_name}`, { icon: '📍', duration: 6000 });
    } else {
      toast.error(`Exited: ${event.fence_name}`, { icon: '📤', duration: 6000 });
    }
  });

  return (
    <div className="device-layout">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e293b', color: '#fff', border: '1px solid rgba(99,102,241,0.3)' },
        }}
      />

      <aside className="device-sidebar">
        <div className="device-info-card">
          <div className="info-row">
            <span className="info-label">Device ID</span>
            <span className="info-value mono">{deviceId}</span>
          </div>
          <div className="info-row">
            <span className="info-label">GPS Status</span>
            <span className={`status-dot ${isTracking ? 'on' : 'off'}`}>
              {isTracking ? '● Tracking' : '○ Stopped'}
            </span>
          </div>
          {position && (
            <>
              <div className="info-row">
                <span className="info-label">Latitude</span>
                <span className="info-value mono">{position.lat.toFixed(6)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Longitude</span>
                <span className="info-value mono">{position.lng.toFixed(6)}</span>
              </div>
              {position.accuracy && (
                <div className="info-row">
                  <span className="info-label">Accuracy</span>
                  <span className="info-value">±{Math.round(position.accuracy)}m</span>
                </div>
              )}
            </>
          )}
          {lastReport && (
            <div className="info-row">
              <span className="info-label">Fences evaluated</span>
              <span className="info-value">{lastReport.evaluated_fences}</span>
            </div>
          )}
        </div>

        {gpsError && (
          <div className="gps-error">⚠️ {gpsError}</div>
        )}

        <div className="track-buttons">
          {!isTracking ? (
            <button className="btn-track start" onClick={start}>
              📡 Start GPS Tracking
            </button>
          ) : (
            <button className="btn-track stop" onClick={stop}>
              ⏹ Stop Tracking
            </button>
          )}
        </div>

        {insideFences.length > 0 && (
          <div className="inside-panel">
            <h4>Currently Inside</h4>
            {insideFences.map(f => (
              <div key={f.fence_id} className="inside-chip">
                📍 {f.fence_name}
              </div>
            ))}
          </div>
        )}

        <div className="device-feed">
          <AlertFeed maxItems={30} />
        </div>
      </aside>

      <main className="device-map">
        <MapView
          fences={fences.filter((f) => f.is_active)}
          devicePosition={
            position
              ? {
                  lat: position.lat,
                  lng: position.lng,
                  accuracy: position.accuracy,
                }
              : null
          }
          showUserDot={true}
        />
      </main>
    </div>
  );
}
