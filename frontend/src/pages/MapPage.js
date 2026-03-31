import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import { toast } from 'react-toastify';

import '../utils/leafletFix';
import useGeolocation from '../hooks/useGeolocation';
import { fenceAPI, locationAPI } from '../services/api';

import DrawingLayer from '../components/map/DrawingLayer';
import FenceLayers, { computeInsideFences } from '../components/map/FenceLayers';
import UserMarker from '../components/map/UserMarker';

import './MapPage.css';

const DEFAULT_CENTER          = [28.6139, 77.2090];
const TRACKING_INTERVAL_MS    = 5000;
const TRAIL_MAX_POINTS        = 50;
const DEVICE_ID               = 'browser-device';

// ─────────────────────────────────────────────────────────────
//  MapPage
// ─────────────────────────────────────────────────────────────
export default function MapPage() {
  const { location, error: gpsError } = useGeolocation();

  // ── Core state ─────────────────────────────────────────────
  const [fences,         setFences]         = useState([]);
  const [insideFenceIds, setInsideFenceIds] = useState(new Set());
  const [drawMode,       setDrawMode]       = useState('none');
  const [tracking,       setTracking]       = useState(false);
  const [loadingFences,  setLoadingFences]  = useState(true);

  // ── Part 7: Tracking telemetry state ──────────────────────
  const [trailPoints,    setTrailPoints]    = useState([]);   // [[lat,lng], …]
  const [lastUpdateAt,   setLastUpdateAt]   = useState(null); // Date of last successful POST
  const [secsSinceUpdate, setSecsSinceUpdate] = useState(0);
  const [connError,      setConnError]      = useState(false);

  // ── Drawing sub-state ──────────────────────────────────────
  const [circleState,   setCircleState]    = useState({ center: null, radius: 0 });
  const [polygonPoints, setPolygonPoints]  = useState([]);

  // ── Fence name modal ───────────────────────────────────────
  const [showModal,   setShowModal]   = useState(false);
  const [modalName,   setModalName]   = useState('');
  const [pendingData, setPendingData] = useState(null);
  const [saving,      setSaving]      = useState(false);

  // Keep latest location in a ref for the tracking setInterval closure
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  // ── Load fences on mount ────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fenceAPI.getAll({ limit: 100 });
        setFences(res.data.fences || []);
      } catch (err) {
        toast.error(`Could not load fences: ${err.message}`);
      } finally {
        setLoadingFences(false);
      }
    })();
  }, []);

  // ── Re-compute inside/outside whenever location or fences change ──
  useEffect(() => {
    setInsideFenceIds(computeInsideFences(fences, location));
  }, [fences, location]);

  // ── "Seconds since last update" counter ────────────────────
  useEffect(() => {
    if (!tracking) { setSecsSinceUpdate(0); return; }
    const t = setInterval(() => {
      setSecsSinceUpdate(lastUpdateAt ? Math.floor((Date.now() - lastUpdateAt) / 1000) : 0);
    }, 1000);
    return () => clearInterval(t);
  }, [tracking, lastUpdateAt]);

  // ── Real-time tracking interval ─────────────────────────────
  useEffect(() => {
    if (!tracking) return;

    const interval = setInterval(async () => {
      const loc = locationRef.current;
      if (!loc) return;

      try {
        const res = await locationAPI.submit(DEVICE_ID, { lat: loc.lat, lng: loc.lng });
        const { events_fired = [], currently_inside = [] } = res.data;

        // Rich toasts
        events_fired.forEach((evt) => {
          if (evt.event_type === 'ENTER') {
            toast.success(`🚨 Entered Geo-Fence\n${evt.fence_name}`, { autoClose: 7000 });
          } else {
            toast.info(`👋 Exited Geo-Fence\n${evt.fence_name}`, { autoClose: 7000 });
          }
        });

        // Server truth for inside/outside
        setInsideFenceIds(new Set(currently_inside.map((f) => f.fence_id)));

        // Append to movement trail (ring-buffer of last TRAIL_MAX_POINTS)
        setTrailPoints((prev) => {
          const next = [...prev, [loc.lat, loc.lng]];
          return next.length > TRAIL_MAX_POINTS ? next.slice(next.length - TRAIL_MAX_POINTS) : next;
        });

        // Update telemetry
        setLastUpdateAt(Date.now());
        setConnError(false);
      } catch (err) {
        console.error('Tracking error:', err.message);
        setConnError(true); // Show "Connection Lost" badge
      }
    }, TRACKING_INTERVAL_MS);

    toast.info('📡 Live tracking started', { autoClose: 3000 });
    return () => {
      clearInterval(interval);
      setTrailPoints([]); // Clear trail when tracking stops
      setConnError(false);
      toast.info('⏹ Tracking stopped', { autoClose: 2000 });
    };
  }, [tracking]);

  // ── Drawing callbacks ───────────────────────────────────────
  const handleDrawComplete = useCallback(({ type, data }) => {
    setPendingData({ type, data });
    setModalName('');
    setShowModal(true);
  }, []);

  const handleFinishPolygon = () => {
    if (polygonPoints.length < 3) { toast.warning('Draw at least 3 points.'); return; }
    handleDrawComplete({ type: 'polygon', data: { coordinates: polygonPoints } });
    setPolygonPoints([]);
  };

  const handleCancelDraw = () => {
    setDrawMode('none');
    setCircleState({ center: null, radius: 0 });
    setPolygonPoints([]);
  };

  // ── Fence save ──────────────────────────────────────────────
  const handleSaveFence = async () => {
    if (!modalName.trim()) { toast.warning('Please enter a fence name.'); return; }
    setSaving(true);
    try {
      const { type, data } = pendingData;
      const payload =
        type === 'circle'
          ? { name: modalName.trim(), type: 'circle', center: data.center, radius_meters: data.radius_meters, events: ['ENTER', 'EXIT'] }
          : { name: modalName.trim(), type: 'polygon', coordinates: [...data.coordinates, data.coordinates[0]], events: ['ENTER', 'EXIT'] };
      const res = await fenceAPI.create(payload);
      setFences((prev) => [res.data, ...prev]);
      toast.success(`✅ Fence "${modalName.trim()}" created!`);
    } catch (err) {
      toast.error(`Failed to save fence: ${err.message}`);
    } finally {
      setSaving(false); setShowModal(false); setDrawMode('none'); setPendingData(null);
    }
  };

  // ── Fence delete ────────────────────────────────────────────
  const handleDeleteFence = useCallback(async (fenceId) => {
    try {
      await fenceAPI.delete(fenceId);
      setFences((prev) => prev.filter((f) => f.id !== fenceId));
      toast.success('Fence removed.');
    } catch (err) { toast.error(`Delete failed: ${err.message}`); }
  }, []);

  // ── Draw mode toggle ────────────────────────────────────────
  const activateMode = (mode) => {
    setDrawMode((prev) => {
      if (prev === mode) { handleCancelDraw(); return 'none'; }
      setCircleState({ center: null, radius: 0 });
      setPolygonPoints([]);
      return mode;
    });
  };

  // ── Keyboard shortcuts (C, P, T, Esc) ──────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (showModal) return; // don't fire when naming modal is open
      switch (e.key) {
        case 'c': case 'C': activateMode('circle');  break;
        case 'p': case 'P': activateMode('polygon'); break;
        case 't': case 'T': setTracking(v => !v);   break;
        case 'Escape':       handleCancelDraw();      break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, tracking]);

  // ─────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="map-page">

      {gpsError && <div className="gps-banner">⚠️ {gpsError}</div>}
      {loadingFences && <div className="map-loading-pill">Loading fences…</div>}

      {/* ── Connection lost badge (Part 7) ── */}
      {connError && (
        <div className="conn-lost-badge">⚡ Connection Lost — Retrying…</div>
      )}

      {/* ── Floating control panel ── */}
      <div className="map-control-panel">
        <div className="control-section">
          <p className="control-label">Draw Fence</p>
          <button className={`ctrl-btn ${drawMode === 'circle' ? 'ctrl-btn--active' : ''}`} onClick={() => activateMode('circle')} title="Draw circle: click center, move, click edge">⭕ Circle</button>
          <button className={`ctrl-btn ${drawMode === 'polygon' ? 'ctrl-btn--active' : ''}`} onClick={() => activateMode('polygon')} title="Draw polygon: click vertices, then Finish">🔶 Polygon</button>

          {drawMode === 'polygon' && (
            <div className="poly-actions">
              <span className="control-hint">{polygonPoints.length} pt{polygonPoints.length !== 1 ? 's' : ''}</span>
              <button className="ctrl-btn ctrl-btn--success" disabled={polygonPoints.length < 3} onClick={handleFinishPolygon}>✓ Finish</button>
              <button className="ctrl-btn ctrl-btn--danger" onClick={handleCancelDraw}>✕</button>
            </div>
          )}
          {drawMode === 'circle' && circleState.center && (
            <div className="poly-actions">
              <span className="control-hint">Click to set edge</span>
              <button className="ctrl-btn ctrl-btn--danger" onClick={handleCancelDraw}>✕</button>
            </div>
          )}
        </div>

        <div className="control-divider" />

        <div className="control-section">
          <p className="control-label">Tracking</p>
          <button className={`ctrl-btn ${tracking ? 'ctrl-btn--tracking' : ''}`} onClick={() => setTracking(t => !t)}>
            {tracking ? '🔴 Stop' : '📡 Start'} Tracking
          </button>

          {/* ── Part 7: Status indicators ── */}
          {tracking && (
            <div className="tracking-status">
              <span className="ctrl-info-row">
                <span className="status-dot status-dot--green tracking-pulse" />
                Tracking Active
              </span>
              <span className="ctrl-info-row" style={{ color: connError ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                {connError ? '⚡ Connection lost' : `⟳ ${secsSinceUpdate}s ago`}
              </span>
              <span className="ctrl-info-row" style={{ fontSize: '0.7rem' }}>
                🛤 {trailPoints.length} trail pts
              </span>
            </div>
          )}
        </div>

        <div className="control-divider" />

        <div className="control-section">
          <p className="control-label">Info</p>
          <div className="ctrl-info">
            <span className="ctrl-info-row">
              <span className="status-dot status-dot--green" style={{ opacity: location ? 1 : 0.3 }} />
              GPS {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'waiting…'}
            </span>
            <span className="ctrl-info-row">
              🗺 {fences.filter(f => f.is_active).length} active fence{fences.filter(f => f.is_active).length !== 1 ? 's' : ''}
            </span>
            <span className="ctrl-info-row">
              ✅ Inside {insideFenceIds.size} fence{insideFenceIds.size !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Leaflet Map ── */}
      <MapContainer center={DEFAULT_CENTER} zoom={13} className="leaflet-map" zoomControl={true}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <UserMarker location={location} />

        {/* Part 7: GPS movement trail */}
        {trailPoints.length >= 2 && (
          <Polyline
            positions={trailPoints}
            pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.55, dashArray: '6 4' }}
          />
        )}

        <DrawingLayer
          drawMode={drawMode}
          polygonPoints={polygonPoints}
          setPolygonPoints={setPolygonPoints}
          circleState={circleState}
          setCircleState={setCircleState}
          onDrawComplete={handleDrawComplete}
        />

        <FenceLayers fences={fences} insideFenceIds={insideFenceIds} onDelete={handleDeleteFence} />
      </MapContainer>

      {/* ── Fence Name Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-card">
            <h3 className="modal-title">{pendingData?.type === 'circle' ? '⭕' : '🔶'} Name Your Fence</h3>
            {pendingData?.type === 'circle' && <p className="modal-sub">Radius: {pendingData.data.radius_meters}m</p>}
            {pendingData?.type === 'polygon' && <p className="modal-sub">{pendingData.data.coordinates?.length} vertices</p>}
            <input
              className="modal-input"
              placeholder="e.g. Office Zone, School Campus…"
              value={modalName}
              onChange={e => setModalName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveFence()}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => { setShowModal(false); handleCancelDraw(); }}>Cancel</button>
              <button className="btn btn--primary" onClick={handleSaveFence} disabled={saving || !modalName.trim()}>
                {saving ? 'Saving…' : 'Create Fence'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
