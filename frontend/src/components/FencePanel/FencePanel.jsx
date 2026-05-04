import { useState } from 'react';
import { fenceApi } from '../../api/client';
import './FencePanel.css';

const DEFAULT_FORM = { name: '', description: '', radius_meters: 200, events: ['ENTER', 'EXIT'] };

function timeAgo(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * FencePanel — sidebar for creating, editing, and deleting fences.
 * Props:
 *   fences         {Array}   — list of fence objects
 *   onRefresh      {Function}— reload fences from API
 *   onStartDraw    {Function(mode)} — trigger drawing mode on map
 *   pendingShape   {Object|null} — shape data from map drawing
 *   onPendingClear {Function} — clear pending shape after save
 *   adminMode      {Boolean} — group fences by owner
 *   alertHistory   {Array}   — array of alert events
 */
export default function FencePanel({
  fences = [],
  onRefresh,
  onStartDraw,
  pendingShape,
  onPendingClear,
  ownerId,
  ownerName,
  adminMode = false,
  alertHistory = [],
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState('list'); // 'create' | 'list'
  
  // UI State for expanding alerts in cards and expanding owners in adminMode
  const [expandedAlerts, setExpandedAlerts] = useState({});
  const [expandedOwners, setExpandedOwners] = useState({});

  const handle = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  async function handleSave(e) {
    e.preventDefault();
    if (!pendingShape && !editId) return;
    setLoading(true);
    try {
      if (editId) {
        await fenceApi.update(editId, { name: form.name, description: form.description });
      } else {
        const body = {
          name: form.name,
          description: form.description,
          events: form.events,
          ...pendingShape,
        };
        if (pendingShape.type === 'circle') body.radius_meters = Number(form.radius_meters) || pendingShape.radius_meters;
        if (ownerId) body.owner_id = ownerId;
        if (ownerName) body.owner_name = ownerName;
        await fenceApi.create(body);
        onPendingClear?.();
      }
      setForm(DEFAULT_FORM);
      setEditId(null);
      onRefresh?.();
      setExpanded('list');
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Failed to save fence');
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to permanently delete this fence? This action cannot be undone.')) return;
    try { await fenceApi.remove(id); onRefresh?.(); } catch (err) { alert('Failed to delete'); }
  }

  async function handleToggle(fence) {
    try {
      await fenceApi.update(fence.id, { is_active: !fence.is_active });
      onRefresh?.();
    } catch { alert('Failed to update'); }
  }

  function startEdit(fence) {
    setEditId(fence.id);
    setForm({ name: fence.name, description: fence.description || '', radius_meters: fence.radius_meters || 200, events: fence.events || ['ENTER', 'EXIT'] });
    setExpanded('create');
  }

  const toggleAlerts = (fenceId) => setExpandedAlerts(p => ({ ...p, [fenceId]: !p[fenceId] }));
  const toggleOwner = (ownerKey) => setExpandedOwners(p => ({ ...p, [ownerKey]: !p[ownerKey] }));

  // Render a single fence card
  const renderFenceCard = (f) => {
    const fenceAlerts = alertHistory.filter(a => a.fence_id === f.id);
    const isAlertsExpanded = !!expandedAlerts[f.id];

    return (
      <div key={f.id} className={`fence-card ${!f.is_active ? 'inactive' : ''}`}>
        <div className="fence-card-header">
          <span className={`fence-badge ${f.type}`}>{f.type}</span>
          <div className="fence-actions">
            {!adminMode && <button className="icon-btn" title="Edit" onClick={() => startEdit(f)}>✏️</button>}
            <button className="icon-btn" title="Toggle Active Status" onClick={() => handleToggle(f)}>{f.is_active ? '🟢' : '⭕'}</button>
            <button className="icon-btn" title="Delete Fence Permanently" onClick={() => handleDelete(f.id)}>🗑️</button>
          </div>
        </div>
        <div className="fence-name">{f.name}</div>
        {f.description && <div className="fence-desc">{f.description}</div>}
        <div className="fence-meta">
          {f.type === 'circle' && <span>Radius: {f.radius_meters}m</span>}
          {f.type === 'polygon' && <span>{f.coordinates?.length} vertices</span>}
          <span>{f.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        
        {/* Alerts Section inside Fence Card */}
        {fenceAlerts.length > 0 && (
          <div className="fence-alerts-section">
            <button className="btn-ghost alert-toggle-btn" onClick={() => toggleAlerts(f.id)}>
              {isAlertsExpanded ? '▼ Hide History' : `▶ Show History (${fenceAlerts.length})`}
            </button>
            {isAlertsExpanded && (
              <div className="fence-alerts-list">
                {fenceAlerts.map((a, i) => {
                  const isEnter = a.event_type === 'ENTER';
                  return (
                    <div key={a.id || i} className={`fence-alert-mini ${isEnter ? 'enter' : 'exit'}`}>
                      <span className="mini-icon">{isEnter ? '→' : '←'}</span>
                      <span className="mini-type">{a.event_type}</span>
                      <span className="mini-time">{timeAgo(a.timestamp || a.created_at)}</span>
                      {a.device_id && <span className="mini-device" title={a.device_id}>({a.device_id.substring(0, 8)}...)</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Group fences for Admin Mode
  const fencesByOwner = fences.reduce((acc, f) => {
    const key = f.owner_id || 'global';
    if (!acc[key]) acc[key] = { name: f.owner_name || 'Global Fences', items: [] };
    acc[key].items.push(f);
    return acc;
  }, {});

  return (
    <div className="fence-panel">
      {/* Tabs */}
      <div className="panel-tabs">
        {!adminMode && (
          <button className={`tab ${expanded === 'create' ? 'active' : ''}`} onClick={() => setExpanded('create')}>
            {editId ? 'Edit Fence' : 'Create Fence'}
          </button>
        )}
        <button className={`tab ${expanded === 'list' ? 'active' : ''}`} onClick={() => setExpanded('list')}>
          {adminMode ? 'All Fences' : 'My Fences'} ({fences.length})
        </button>
      </div>

      {!adminMode && expanded === 'create' && (
        <div className="panel-section">
          {/* Draw buttons */}
          {!editId && (
            <div className="draw-buttons">
              <button className="draw-btn circle" onClick={() => onStartDraw('circle')}>
                ⭕ Draw Circle
              </button>
              <button className="draw-btn polygon" onClick={() => onStartDraw('polygon')}>
                🔷 Draw Polygon
              </button>
            </div>
          )}

          {pendingShape && !editId && (
            <div className="pending-badge">
              ✅ {pendingShape.type === 'circle' ? `Circle (${pendingShape.radius_meters}m)` : `Polygon (${pendingShape.coordinates?.length} pts)`} — fill in name to save
            </div>
          )}

          <form onSubmit={handleSave} className="fence-form">
            <div className="form-group">
              <label>Name *</label>
              <input required value={form.name} onChange={handle('name')} placeholder="e.g. Office Zone" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={form.description} onChange={handle('description')} placeholder="Optional" />
            </div>
            {pendingShape?.type === 'circle' && (
              <div className="form-group">
                <label>Radius (m)</label>
                <input type="number" value={form.radius_meters} onChange={handle('radius_meters')} min="10" />
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={loading || (!pendingShape && !editId)}>
              {loading ? 'Saving…' : editId ? 'Update Fence' : 'Save Fence'}
            </button>
            {editId && <button type="button" className="btn-ghost" onClick={() => { setEditId(null); setForm(DEFAULT_FORM); }}>Cancel</button>}
          </form>
        </div>
      )}

      {expanded === 'list' && (
        <div className="panel-list">
          {fences.length === 0 && <div className="empty-state">No fences found.</div>}
          
          {adminMode ? (
            // Admin Mode: Layered by Owner
            Object.entries(fencesByOwner).map(([ownerKey, group]) => {
              const isExpanded = expandedOwners[ownerKey] !== false; // Default expanded
              return (
                <div key={ownerKey} className="admin-owner-group">
                  <div className="admin-owner-header" onClick={() => toggleOwner(ownerKey)}>
                    <div className="admin-owner-title">
                      {isExpanded ? '▼' : '▶'} {group.name}
                    </div>
                    <div className="admin-owner-badge">{group.items.length} fences</div>
                  </div>
                  {isExpanded && (
                    <div className="admin-owner-list">
                      {group.items.map(renderFenceCard)}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            // Normal Mode: Flat List
            fences.map(renderFenceCard)
          )}
        </div>
      )}
    </div>
  );
}
