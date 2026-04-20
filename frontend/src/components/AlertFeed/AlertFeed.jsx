import { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { alertApi } from '../../api/client';
import './AlertFeed.css';

function typeStyle(type) {
  return type === 'ENTER' ?
    { color: '#22d3ee', icon: '→' } :
    { color: '#f87171', icon: '←' };
}

function fmt(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AlertFeed({ maxItems = 50 }) {
  const [alerts, setAlerts] = useState([]);
  const [stats,  setStats]  = useState(null);

  // Load recent alerts on mount
  useEffect(() => {
    alertApi.getAll({ limit: maxItems }).then(r => setAlerts(r.data.alerts || [])).catch(() => {});
    alertApi.stats().then(r => setStats(r.data)).catch(() => {});
  }, [maxItems]);

  // Live updates via Socket.IO
  useSocket('geo_alert', (event) => {
    setAlerts(prev => [event, ...prev].slice(0, maxItems));
  });

  return (
    <div className="alert-feed">
      <div className="feed-header">
        <h3>Live Alerts</h3>
        {stats && (
          <div className="feed-stats">
            <span className="stat-chip enter">{stats.events?.enter ?? 0} ENTER</span>
            <span className="stat-chip exit">{stats.events?.exit ?? 0} EXIT</span>
          </div>
        )}
      </div>
      <div className="feed-list">
        {alerts.length === 0 && <div className="feed-empty">No alerts yet — start tracking a device.</div>}
        {alerts.map((a, i) => {
          const s = typeStyle(a.event_type);
          return (
            <div key={a.alert_id || a.id || i} className="feed-item">
              <span className="feed-icon" style={{ color: s.color }}>{s.icon}</span>
              <div className="feed-body">
                <div className="feed-title">
                  <span className="feed-event" style={{ color: s.color }}>{a.event_type}</span>
                  <span className="feed-fence">{a.fence_name || a.fence_id}</span>
                </div>
                <div className="feed-meta">
                  {a.device_id && <span>Device: {a.device_id}</span>}
                  {a.timestamp && <span>{fmt(a.timestamp)}</span>}
                  {a.created_at && <span>{fmt(a.created_at)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
