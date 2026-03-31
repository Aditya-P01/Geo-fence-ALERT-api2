import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle, Polygon, Popup } from 'react-leaflet';
import { format, formatDistanceToNow } from 'date-fns';
import { alertAPI, fenceAPI } from '../services/api';
import '../utils/leafletFix';
import './AlertsPage.css';

const PER_PAGE_OPTIONS = [20, 50, 100, 200];

// ── Build query params from filter state ──────────────────────
function buildParams(filters, page, perPage) {
  const p = { page, limit: perPage };
  if (filters.device_id)       p.device_id       = filters.device_id;
  if (filters.fence_id)        p.fence_id         = filters.fence_id;
  if (filters.event_type)      p.event_type       = filters.event_type;
  if (filters.delivery_status) p.delivery_status  = filters.delivery_status;
  if (filters.start_date)      p.start_date       = filters.start_date;
  if (filters.end_date)        p.end_date         = filters.end_date;
  return p;
}

// ── CSV export helper ─────────────────────────────────────────
async function downloadCSV(filters) {
  const res  = await alertAPI.getAll(buildParams(filters, 1, 10000));
  const rows = res.data.alerts || [];
  const hdr  = ['id','device_id','fence_name','event_type','delivery_status','device_lat','device_lng','created_at'];
  const csv  = [hdr.join(','), ...rows.map(r => hdr.map(k => `"${(r[k]||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
  const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'geo-fence-alerts.csv' });
  a.click(); URL.revokeObjectURL(url);
}

// ── Stats computed from paginated results ─────────────────────
function computeStats(alerts, total) {
  const enters = alerts.filter(a => a.event_type === 'ENTER').length;
  const exits  = alerts.filter(a => a.event_type === 'EXIT').length;
  const fenceCount = {};
  const devCount   = {};
  alerts.forEach(a => {
    fenceCount[a.fence_name || a.fence_id] = (fenceCount[a.fence_name || a.fence_id] || 0) + 1;
    devCount[a.device_id] = (devCount[a.device_id] || 0) + 1;
  });
  const topFence = Object.entries(fenceCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const topDev   = Object.entries(devCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  return { total, enters, exits, topFence, topDev };
}

// ── AlertDetailModal ──────────────────────────────────────────
function AlertDetailModal({ alert, fence, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyCoords = () => {
    const text = `${Number(alert.device_lat).toFixed(6)}, ${Number(alert.device_lng).toFixed(6)}`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const renderFenceOverlay = () => {
    if (!fence) return null;
    const color = alert.event_type === 'ENTER' ? '#10b981' : '#f43f5e';
    if (fence.type === 'circle' && fence.center) {
      return <Circle center={[fence.center.lat, fence.center.lng]} radius={fence.radius_meters} pathOptions={{ color, fillOpacity: 0.12, weight: 2 }} />;
    }
    if (fence.type === 'polygon' && fence.coordinates?.length >= 3) {
      return <Polygon positions={fence.coordinates.map(c => [c.lat, c.lng])} pathOptions={{ color, fillOpacity: 0.12, weight: 2 }}><Popup>{fence.name}</Popup></Polygon>;
    }
    return null;
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card alert-modal-card">
        <div className="alert-modal-header">
          <span className={`badge badge--${alert.event_type.toLowerCase()} badge--lg`}>
            {alert.event_type === 'ENTER' ? '🚨' : '👋'} {alert.event_type}
          </span>
          <h3 className="alert-modal-fence">{alert.fence_name || 'Unknown Fence'}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Mini Leaflet map */}
        <div className="alert-mini-map">
          <MapContainer
            key={alert.id}
            center={[Number(alert.device_lat), Number(alert.device_lng)]}
            zoom={15}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[Number(alert.device_lat), Number(alert.device_lng)]}>
              <Popup>Alert location</Popup>
            </Marker>
            {renderFenceOverlay()}
          </MapContainer>
        </div>

        {/* Details grid */}
        <div className="alert-modal-details">
          <div className="detail-row">
            <span className="detail-key">Device</span>
            <span className="detail-val detail-mono">{alert.device_id}</span>
          </div>
          <div className="detail-row">
            <span className="detail-key">Time</span>
            <span className="detail-val">{format(new Date(alert.created_at), 'PPpp')}</span>
          </div>
          <div className="detail-row">
            <span className="detail-key">Coordinates</span>
            <span className="detail-val detail-mono">
              {Number(alert.device_lat).toFixed(6)}, {Number(alert.device_lng).toFixed(6)}
              <button className="copy-btn" onClick={copyCoords}>{copied ? '✓ Copied' : '📋'}</button>
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-key">Delivery</span>
            <span className={`badge badge--${alert.delivery_status}`}>{alert.delivery_status}</span>
          </div>
          {alert.fence_type && (
            <div className="detail-row">
              <span className="detail-key">Fence Type</span>
              <span className="detail-val">{alert.fence_type}</span>
            </div>
          )}
        </div>

        {/* State transition timeline */}
        <div className="alert-timeline">
          <div className="timeline-step">
            <span className="timeline-dot" style={{ background: alert.event_type === 'ENTER' ? '#6b7280' : '#10b981' }} />
            <span>Device was <b>{alert.event_type === 'ENTER' ? 'OUTSIDE' : 'INSIDE'}</b></span>
          </div>
          <div className="timeline-arrow">↓</div>
          <div className="timeline-step">
            <span className="timeline-dot" style={{ background: alert.event_type === 'ENTER' ? '#10b981' : '#f43f5e' }} />
            <span>Device is now <b>{alert.event_type === 'ENTER' ? 'INSIDE' : 'OUTSIDE'}</b> — {alert.fence_name}</span>
          </div>
          <div className="timeline-time">{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</div>
        </div>

        <div className="modal-actions" style={{ marginTop: '1rem' }}>
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  AlertsPage
// ─────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const navigate = useNavigate();

  // Data state
  const [alerts,     setAlerts]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fenceList,  setFenceList]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [newIds,     setNewIds]     = useState(new Set());

  // Navigation / UI state
  const [page,    setPage]    = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [jumpVal, setJumpVal] = useState('');
  const [liveUpdates, setLiveUpdates] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [exporting,   setExporting]   = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedFence, setSelectedFence] = useState(null);

  // Filters (pending = in form; applied = what was last fetched)
  const EMPTY_FILTERS = { device_id: '', fence_id: '', event_type: '', delivery_status: '', start_date: '', end_date: '' };
  const [pendingFilters, setPendingFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  // Keep stable references for live-update interval
  const alertsRef = useRef(alerts);
  const filtersRef = useRef(appliedFilters);
  useEffect(() => { alertsRef.current = alerts;       }, [alerts]);
  useEffect(() => { filtersRef.current = appliedFilters; }, [appliedFilters]);

  // ── Load fence list for dropdown ──────────────────────────
  useEffect(() => {
    fenceAPI.getAll({ limit: 100 }).then(r => setFenceList(r.data.fences || [])).catch(() => {});
  }, []);

  // ── Fetch alerts ──────────────────────────────────────────
  const fetch = useCallback(async (f = appliedFilters, p = page, pp = perPage) => {
    setLoading(true); setError(null);
    try {
      const res = await alertAPI.getAll(buildParams(f, p, pp));
      setAlerts(res.data.alerts || []);
      setPagination(res.data.pagination);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetch(appliedFilters, page, perPage); }, [page, perPage]); // eslint-disable-line

  // On appliedFilters change, reset page to 1
  useEffect(() => { fetch(appliedFilters, 1, perPage); setPage(1); }, [appliedFilters]); // eslint-disable-line

  // ── Apply / clear filters ─────────────────────────────────
  const applyFilters = () => { setAppliedFilters({ ...pendingFilters }); };
  const clearFilters = () => { setPendingFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); };

  // ── Live updates polling ──────────────────────────────────
  useEffect(() => {
    if (!liveUpdates) return;
    const id = setInterval(async () => {
      try {
        const res  = await alertAPI.getAll(buildParams(filtersRef.current, 1, perPage));
        const fresh = res.data.alerts || [];
        const existingIds = new Set(alertsRef.current.map(a => a.id));
        const brandNew    = fresh.filter(a => !existingIds.has(a.id));
        if (brandNew.length > 0) {
          setNewIds(new Set(brandNew.map(a => a.id)));
          setAlerts(prev => [...brandNew, ...prev].slice(0, perPage));
          setTimeout(() => setNewIds(new Set()), 2500);
        }
      } catch (_) {}
    }, 10000);
    return () => clearInterval(id);
  }, [liveUpdates, perPage]);

  // ── Open detail modal ─────────────────────────────────────
  const openDetail = async (alert) => {
    setSelectedAlert(alert);
    if (alert.fence_id) {
      try {
        const r = await fenceAPI.getById(alert.fence_id);
        setSelectedFence(r.data);
      } catch (_) { setSelectedFence(null); }
    }
  };

  // ── CSV export ────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try { await downloadCSV(appliedFilters); }
    catch (err) { alert('Export failed: ' + err.message); }
    finally { setExporting(false); }
  };

  // ── Stats ─────────────────────────────────────────────────
  const stats = computeStats(alerts, pagination?.total ?? 0);
  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

  // ─────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="alerts-page">

      {/* ── Header bar ── */}
      <header className="alerts-header">
        <div>
          <h1 className="page-title">Alert History</h1>
          <p className="page-sub">Complete log of ENTER / EXIT boundary events</p>
        </div>
        <div className="alerts-header-actions">
          <button
            className={`ctrl-toggle ${liveUpdates ? 'ctrl-toggle--on' : ''}`}
            onClick={() => setLiveUpdates(v => !v)}
            title="Poll for new alerts every 10 seconds"
          >
            {liveUpdates ? '🔴 Live' : '⭕ Live'}
          </button>
          <button className="btn btn--ghost" onClick={handleExport} disabled={exporting}>
            {exporting ? '⏳ Exporting…' : '⬇ CSV'}
          </button>
        </div>
      </header>

      {/* ── Summary stat pills ── */}
      <div className="alerts-stats-row">
        <div className="stat-pill"><span className="sp-val">{stats.total}</span><span className="sp-lbl">Total {activeFilterCount > 0 ? '(filtered)' : ''}</span></div>
        <div className="stat-pill stat-pill--enter"><span className="sp-val">{stats.enters}</span><span className="sp-lbl">↓ ENTER</span></div>
        <div className="stat-pill stat-pill--exit"><span className="sp-val">{stats.exits}</span><span className="sp-lbl">↑ EXIT</span></div>
        <div className="stat-pill"><span className="sp-val sp-trunc" title={stats.topFence}>{stats.topFence}</span><span className="sp-lbl">Top Fence</span></div>
        <div className="stat-pill"><span className="sp-val sp-trunc" title={stats.topDev}>{stats.topDev}</span><span className="sp-lbl">Busiest Device</span></div>
      </div>

      {/* ── Main layout ── */}
      <div className="alerts-layout">

        {/* ── Filter sidebar ── */}
        <aside className={`filter-sidebar ${sidebarOpen ? 'filter-sidebar--open' : 'filter-sidebar--closed'}`}>
          <div className="filter-sidebar-header">
            <span>Filters {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}</span>
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(v => !v)}>{sidebarOpen ? '◂' : '▸'}</button>
          </div>

          {sidebarOpen && (
            <div className="filter-fields">
              <label className="filter-label-txt">Device ID</label>
              <input className="filter-input" placeholder='e.g. browser-device' value={pendingFilters.device_id} onChange={e => setPendingFilters(p => ({ ...p, device_id: e.target.value }))} />

              <label className="filter-label-txt">Fence</label>
              <select className="filter-input" value={pendingFilters.fence_id} onChange={e => setPendingFilters(p => ({ ...p, fence_id: e.target.value }))}>
                <option value="">All Fences</option>
                {fenceList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>

              <label className="filter-label-txt">Event Type</label>
              <div className="radio-group">
                {['', 'ENTER', 'EXIT'].map(v => (
                  <label key={v} className="radio-label">
                    <input type="radio" name="event_type" value={v} checked={pendingFilters.event_type === v} onChange={() => setPendingFilters(p => ({ ...p, event_type: v }))} />
                    {v || 'All'}
                  </label>
                ))}
              </div>

              <label className="filter-label-txt">Delivery Status</label>
              <div className="radio-group">
                {['', 'delivered', 'failed', 'pending'].map(v => (
                  <label key={v} className="radio-label">
                    <input type="radio" name="delivery" value={v} checked={pendingFilters.delivery_status === v} onChange={() => setPendingFilters(p => ({ ...p, delivery_status: v }))} />
                    {v || 'All'}
                  </label>
                ))}
              </div>

              <label className="filter-label-txt">Start Date</label>
              <input type="datetime-local" className="filter-input" value={pendingFilters.start_date} onChange={e => setPendingFilters(p => ({ ...p, start_date: e.target.value }))} />

              <label className="filter-label-txt">End Date</label>
              <input type="datetime-local" className="filter-input" value={pendingFilters.end_date} onChange={e => setPendingFilters(p => ({ ...p, end_date: e.target.value }))} />

              <div className="filter-actions">
                <button className="btn btn--primary" style={{ flex: 1 }} onClick={applyFilters}>Apply</button>
                <button className="btn btn--ghost" onClick={clearFilters}>Clear</button>
              </div>
            </div>
          )}
        </aside>

        {/* ── Results area ── */}
        <div className="alerts-results">
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : error ? (
            <div className="empty-state">
              <span className="empty-state-icon">⚠️</span>
              <p className="empty-state-text">{error}</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🔔</span>
              <p className="empty-state-text">No alerts found. Try adjusting your filters or create some test fences and trigger crossings with GPS tracking enabled!</p>
              <button className="btn btn--primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>Go to Map →</button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="alerts-table-wrap">
                <table className="data-table alerts-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Device</th>
                      <th>Fence</th>
                      <th>Event</th>
                      <th>Delivery</th>
                      <th>Location</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map(a => (
                      <tr
                        key={a.id}
                        className={newIds.has(a.id) ? 'row-new' : ''}
                        onClick={() => openDetail(a)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>
                          {format(new Date(a.created_at), 'MMM d, HH:mm:ss')}
                        </td>
                        <td className="td-mono">{a.device_id}</td>
                        <td>
                          <span style={{ fontSize: '0.85rem' }}>
                            {a.fence_type === 'circle' ? '⭕' : '🔶'} {a.fence_name || '—'}
                          </span>
                        </td>
                        <td><span className={`badge badge--${a.event_type.toLowerCase()}`}>{a.event_type}</span></td>
                        <td><span className={`badge badge--${a.delivery_status}`}>{a.delivery_status}</span></td>
                        <td className="td-muted td-mono" style={{ fontSize: '0.75rem' }}>
                          {Number(a.device_lat).toFixed(4)}, {Number(a.device_lng).toFixed(4)}
                        </td>
                        <td>
                          <button className="btn btn--ghost" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={e => { e.stopPropagation(); openDetail(a); }}>Details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="alerts-cards">
                {alerts.map(a => (
                  <div key={a.id} className={`alert-card ${newIds.has(a.id) ? 'alert-card--new' : ''}`} onClick={() => openDetail(a)}>
                    <div className="alert-card-top">
                      <span className={`badge badge--${a.event_type.toLowerCase()}`}>{a.event_type}</span>
                      <span className={`badge badge--${a.delivery_status}`}>{a.delivery_status}</span>
                    </div>
                    <div className="alert-card-fence">{a.fence_name || '—'}</div>
                    <div className="alert-card-meta">{a.device_id} · {format(new Date(a.created_at), 'MMM d, HH:mm')}</div>
                    <div className="alert-card-coords">{Number(a.device_lat).toFixed(4)}, {Number(a.device_lng).toFixed(4)}</div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination && (
                <div className="pagination">
                  <button className="btn btn--ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <span className="pagination-info">Page {pagination.page} of {pagination.totalPages} · {pagination.total} total</span>
                  <input
                    className="page-jump"
                    type="number"
                    min={1}
                    max={pagination.totalPages}
                    placeholder="Jump"
                    value={jumpVal}
                    onChange={e => setJumpVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(jumpVal); if (n >= 1 && n <= pagination.totalPages) { setPage(n); setJumpVal(''); } } }}
                  />
                  <select className="per-page-select" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
                    {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
                  </select>
                  <button className="btn btn--ghost" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Alert detail modal ── */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          fence={selectedFence}
          onClose={() => { setSelectedAlert(null); setSelectedFence(null); }}
        />
      )}
    </div>
  );
}
