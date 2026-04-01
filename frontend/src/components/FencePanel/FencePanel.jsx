import { useState } from 'react';
import { fenceApi } from '../../api/client';
import './FencePanel.css';

const DEFAULT_FORM = { name: '', description: '', radius_meters: 200, events: ['ENTER', 'EXIT'] };

/**
 * FencePanel — sidebar for creating, editing, and deleting fences.
 * Props:
 *   fences         {Array}   — list of fence objects
 *   onRefresh      {Function}— reload fences from API
 *   onStartDraw    {Function(mode)} — trigger drawing mode on map
 *   pendingShape   {Object|null} — shape data from map drawing
 *   onPendingClear {Function} — clear pending shape after save
 */
export default function FencePanel({
  fences,
  onRefresh,
  onStartDraw,
  pendingShape,
  onPendingClear,
  ownerId,
  ownerName,
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState('create'); // 'create' | 'list'

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
        onPendingClear();
      }
      setForm(DEFAULT_FORM);
      setEditId(null);
      onRefresh();
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Failed to save fence');
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this fence?')) return;
    try { await fenceApi.remove(id); onRefresh(); } catch (err) { alert('Failed to delete'); }
  }

  async function handleToggle(fence) {
    try {
      await fenceApi.update(fence.id, { is_active: !fence.is_active });
      onRefresh();
    } catch { alert('Failed to update'); }
  }

  function startEdit(fence) {
    setEditId(fence.id);
    setForm({ name: fence.name, description: fence.description || '', radius_meters: fence.radius_meters || 200, events: fence.events || ['ENTER', 'EXIT'] });
    setExpanded('create');
  }

  return (
    <div className="fence-panel">
      {/* Tabs */}
      <div className="panel-tabs">
        <button className={`tab ${expanded === 'create' ? 'active' : ''}`} onClick={() => setExpanded('create')}>
          {editId ? 'Edit Fence' : 'Create Fence'}
        </button>
        <button className={`tab ${expanded === 'list' ? 'active' : ''}`} onClick={() => setExpanded('list')}>
          Fences ({fences.length})
        </button>
      </div>

      {expanded === 'create' && (
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
          {fences.length === 0 && <div className="empty-state">No fences yet. Draw one on the map.</div>}
          {fences.map(f => (
            <div key={f.id} className={`fence-card ${!f.is_active ? 'inactive' : ''}`}>
              <div className="fence-card-header">
                <span className={`fence-badge ${f.type}`}>{f.type}</span>
                <div className="fence-actions">
                  <button className="icon-btn" title="Edit" onClick={() => startEdit(f)}>✏️</button>
                  <button className="icon-btn" title="Toggle" onClick={() => handleToggle(f)}>{f.is_active ? '🟢' : '⭕'}</button>
                  <button className="icon-btn" title="Delete" onClick={() => handleDelete(f.id)}>🗑️</button>
                </div>
              </div>
              <div className="fence-name">{f.name}</div>
              {f.description && <div className="fence-desc">{f.description}</div>}
              <div className="fence-meta">
                {f.type === 'circle' && <span>Radius: {f.radius_meters}m</span>}
                {f.type === 'polygon' && <span>{f.coordinates?.length} vertices</span>}
                <span>{f.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
