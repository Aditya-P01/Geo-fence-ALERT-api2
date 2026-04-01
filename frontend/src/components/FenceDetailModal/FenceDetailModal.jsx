import { useState, useEffect } from 'react';
import { fenceApi } from '../../api/client';
import { useSocket } from '../../hooks/useSocket';
import './FenceDetailModal.css';

function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
}

/**
 * FenceDetailModal — sliding panel shown when a fence is clicked.
 * Props:
 *   fence    {Object|null} — the fence to show; null = hidden
 *   onClose  {Function}
 */
export default function FenceDetailModal({ fence, onClose }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fence) { setAlerts([]); return; }
    setLoading(true);
    fenceApi.getAlerts(fence.id)
      .then(r => setAlerts(r.data.alerts || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [fence?.id]);

  // Prepend live alerts for THIS fence
  useSocket('geo_alert', (event) => {
    if (!fence || event.fence_id !== fence.id) return;
    setAlerts(prev => [
      {
        id: event.alert_id || Date.now(),
        device_id: event.device_id,
        event_type: event.event_type,
        device_lat: null, device_lng: null,
        created_at: event.timestamp || new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 200));
  });

  if (!fence) return null;

  return (
    <>
      <div className="fdm-backdrop" onClick={onClose} />
      <aside className="fdm-panel">
        <div className="fdm-header">
          <div>
            <span className={`fdm-type-badge ${fence.type}`}>{fence.type}</span>
            <h2 className="fdm-title">{fence.name}</h2>
          </div>
          <button className="fdm-close" onClick={onClose}>✕</button>
        </div>

        <div className="fdm-meta">
          {fence.description && <p className="fdm-desc">{fence.description}</p>}
          <div className="fdm-meta-row">
            <span>Owner</span>
            <span>{fence.owner_name || <em>Unknown</em>}</span>
          </div>
          {fence.type === 'circle' && (
            <div className="fdm-meta-row"><span>Radius</span><span>{fence.radius_meters}m</span></div>
          )}
          {fence.type === 'polygon' && (
            <div className="fdm-meta-row"><span>Vertices</span><span>{fence.coordinates?.length}</span></div>
          )}
          <div className="fdm-meta-row">
            <span>Status</span>
            <span className={fence.is_active ? 'active-pill' : 'inactive-pill'}>{fence.is_active ? 'Active' : 'Inactive'}</span>
          </div>
          <div className="fdm-meta-row"><span>Created</span><span>{fmtTime(fence.created_at)}</span></div>
        </div>

        <div className="fdm-alerts-header">
          <h3>Entry / Exit History</h3>
          <span className="fdm-count">{alerts.length} events</span>
        </div>

        {loading ? (
          <div className="fdm-loading"><div className="fdm-spinner" /></div>
        ) : alerts.length === 0 ? (
          <div className="fdm-empty">No events recorded yet for this fence.</div>
        ) : (
          <div className="fdm-table-wrap">
            <table className="fdm-table">
              <thead>
                <tr><th>Device</th><th>Event</th><th>Time</th></tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={a.id || i} className={`fdm-row ${a.event_type === 'ENTER' ? 'enter' : 'exit'}`}>
                    <td className="device-cell">{a.device_id}</td>
                    <td>
                      <span className={`event-pill ${a.event_type === 'ENTER' ? 'enter' : 'exit'}`}>
                        {a.event_type === 'ENTER' ? '→ ENTER' : '← EXIT'}
                      </span>
                    </td>
                    <td className="time-cell">{fmtTime(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </aside>
    </>
  );
}
