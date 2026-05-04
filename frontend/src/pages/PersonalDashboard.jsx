import { useState, useCallback, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useOwner } from '../contexts/OwnerContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useSocket } from '../hooks/useSocket';
import { fenceApi, locationApi, alertApi } from '../api/client';
import MapView from '../components/MapView/MapView';
import FencePanel from '../components/FencePanel/FencePanel';
import FenceDetailModal from '../components/FenceDetailModal/FenceDetailModal';
import './PersonalDashboard.css';

const DEVICE_ID_KEY = 'geo_device_id';

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `device-${Date.now()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function timeAgo(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function PersonalDashboard() {
  const { owner, register, update } = useOwner();
  const { position, mapCenter, error: gpsError, isTracking, start, stop } = useGeolocation();
  const [fences, setFences] = useState([]);
  const [drawingMode, setDrawingMode] = useState(null);
  const [pendingShape, setPendingShape] = useState(null);
  const [selectedFence, setSelectedFence] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [insideFences, setInside] = useState([]);
  const [lastReport, setLast] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);
  const [reportError, setReportError] = useState(null);
  const intervalRef = useRef(null);
  const deviceId = getDeviceId();

  const loadMyFences = useCallback(() => {
    if (!owner) return;
    fenceApi.getAll({ owner_id: owner.owner_id, active: 'false', limit: 100 })
      .then(r => setFences(r.data.fences || []))
      .catch(() => {});
  }, [owner]);

  // Load alert history on mount
  const loadAlertHistory = useCallback(() => {
    alertApi.getAll({ limit: 50 })
      .then(r => setAlertHistory(r.data.alerts || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadMyFences(); }, [loadMyFences]);
  useEffect(() => { loadAlertHistory(); }, [loadAlertHistory]);
  useEffect(() => { if (owner) setNameInput(owner.owner_name); }, [owner]);

  // ── Location reporting: send GPS to backend ───────────────────
  useEffect(() => {
    if (!isTracking || !position) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    const report = async () => {
      try {
        const res = await locationApi.report(deviceId, {
          lat: position.lat,
          lng: position.lng,
          timestamp: new Date(position.timestamp).toISOString(),
        });
        setLast(res.data);
        setInside(res.data.currently_inside || []);
        setReportError(null);

        // If events were fired, refresh alert history
        if (res.data.events_fired?.length > 0) {
          loadAlertHistory();
        }
      } catch (err) {
        setReportError(err.message || 'Failed to report location');
      }
    };

    // Report immediately on position change
    report();

    // Continue reporting every 5 seconds
    intervalRef.current = setInterval(report, 5000);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isTracking, position?.lat, position?.lng, deviceId, loadAlertHistory]);

  // ── Clear stale state when tracking stops ─────────────────────
  useEffect(() => {
    if (!isTracking) {
      setInside([]);
      setLast(null);
      setReportError(null);
    }
  }, [isTracking]);

  // ── Live toast notifications via WebSocket ────────────────────
  useSocket('geo_alert', (event) => {
    if (event.device_id !== deviceId) return;
    if (event.event_type === 'ENTER') {
      toast.success(`Entered: ${event.fence_name}`, { icon: '📍', duration: 6000 });
    } else {
      toast.error(`Exited: ${event.fence_name}`, { icon: '📤', duration: 6000 });
    }
    // Add to local alert history immediately
    setAlertHistory(prev => [event, ...prev].slice(0, 50));
    // Refresh fences to update counts
    loadMyFences();
  });

  // ── When a fence is deleted, clear stale inside state ─────────
  const handleFenceRefresh = useCallback(() => {
    loadMyFences();
    // Clear stale "currently inside" — next location report will re-evaluate
    setInside([]);
  }, [loadMyFences]);

  function handleSaveName(e) {
    if (e) e.preventDefault();
    if (!nameInput.trim()) return;
    if (owner) update(nameInput);
    else register(nameInput);
  }

  // --- Registration screen ---
  if (!owner) {
    return (
      <div className="pd-register-wrap">
        <div className="pd-register-box">
          <h2>Welcome to GeoFence</h2>
          <p>Please enter your name to access your personal dashboard and start drawing fences.</p>
          <form onSubmit={handleSaveName}>
            <input autoFocus placeholder="Your Name" value={nameInput} onChange={e => setNameInput(e.target.value)} />
            <button type="submit">Continue →</button>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Dashboard ---
  return (
    <div className="pd-layout">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e293b', color: '#fff', border: '1px solid rgba(99,102,241,0.3)' },
        }}
      />

      {/* Sidebar */}
      <aside className="pd-sidebar">
        <div className="pd-owner-card">
          <div className="pd-avatar">{owner?.owner_name?.charAt(0)?.toUpperCase() || '?'}</div>
          <div className="pd-owner-info">
            <input 
              value={nameInput} 
              onChange={e => setNameInput(e.target.value)} 
              onBlur={() => handleSaveName()}
              onKeyDown={e => e.key === 'Enter' && e.target.blur()}
              className="pd-name-input"
            />
            <span className="pd-owner-id" title={owner?.owner_id}>ID: {owner?.owner_id || '—'}</span>
          </div>
        </div>

        {/* Tracking control */}
        <div className="pd-tracking-card">
          {!isTracking ? (
            <button className="pd-track-btn start" onClick={start}>
              📡 Start Live Tracking
            </button>
          ) : (
            <button className="pd-track-btn stop" onClick={stop}>
              ⏹ Stop Tracking
            </button>
          )}
          {isTracking && position && (
            <div className="pd-track-status">
              <span className="pd-track-dot">●</span> Tracking active
              <span className="pd-track-coords">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)} · ±{Math.round(position.accuracy || 0)}m
              </span>
            </div>
          )}
          {isTracking && !position && !gpsError && (
            <div className="pd-track-status">
              <span className="pd-track-dot acquiring">●</span> Acquiring GPS signal...
            </div>
          )}
          {gpsError && (
            <div className="pd-gps-error">⚠️ {gpsError}</div>
          )}
          {reportError && (
            <div className="pd-gps-error">⚠️ API: {reportError}</div>
          )}
        </div>

        {/* Currently inside */}
        {insideFences.length > 0 && (
          <div className="pd-inside-panel">
            <h4>Currently Inside</h4>
            {insideFences.map(f => (
              <div key={f.fence_id} className="pd-inside-chip">📍 {f.fence_name}</div>
            ))}
          </div>
        )}

        <div className="pd-stats-strip">
          <div className="pd-stat"><span>{fences.length}</span> Fences</div>
          <div className="pd-stat"><span>{fences.filter(f => f.is_active).length}</span> Active</div>
          <div className="pd-stat"><span>{alertHistory.length}</span> Alerts</div>
        </div>

        <div className="pd-sidebar-body">
          <FencePanel
            fences={fences}
            onRefresh={handleFenceRefresh}
            onStartDraw={(mode) => { setDrawingMode(mode); setPendingShape(null); }}
            pendingShape={pendingShape}
            onPendingClear={() => setPendingShape(null)}
            ownerId={owner.owner_id}
            ownerName={owner.owner_name}
            alertHistory={alertHistory}
          />
        </div>
      </aside>

      {/* Map */}
      <main className="pd-map-area">
        {drawingMode && (
          <div className="pd-draw-hint">
            🖊 Draw a <b>{drawingMode}</b> — click to place, double-click to finish
            <button onClick={() => setDrawingMode(null)}>✕ Cancel</button>
          </div>
        )}
        <MapView
          fences={fences.filter(f => f.is_active)}
          drawingMode={drawingMode}
          onFenceDrawn={(shape) => { setDrawingMode(null); setPendingShape(shape); }}
          onFenceClick={setSelectedFence}
          mapCenter={mapCenter}
          devicePosition={
            isTracking && position
              ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy }
              : mapCenter
          }
        />
        <FenceDetailModal fence={selectedFence} onClose={() => setSelectedFence(null)} />
      </main>
    </div>
  );
}
