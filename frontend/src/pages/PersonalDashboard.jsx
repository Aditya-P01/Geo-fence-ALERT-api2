import { useState, useCallback, useEffect } from 'react';
import { useOwner } from '../contexts/OwnerContext';
import { fenceApi } from '../api/client';
import MapView from '../components/MapView/MapView';
import FencePanel from '../components/FencePanel/FencePanel';
import FenceDetailModal from '../components/FenceDetailModal/FenceDetailModal';
import './PersonalDashboard.css';

export default function PersonalDashboard() {
  const { owner, register, update } = useOwner();
  const [fences, setFences] = useState([]);
  const [drawingMode, setDrawingMode] = useState(null);
  const [pendingShape, setPendingShape] = useState(null);
  const [selectedFence, setSelectedFence] = useState(null);
  const [nameInput, setNameInput] = useState('');

  const loadMyFences = useCallback(() => {
    if (!owner) return;
    fenceApi.getAll({ owner_id: owner.owner_id, limit: 100 })
      .then(r => setFences(r.data.fences || []))
      .catch(() => {});
  }, [owner]);

  useEffect(() => { loadMyFences(); }, [loadMyFences]);
  useEffect(() => { if (owner) setNameInput(owner.owner_name); }, [owner]);

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

        <div className="pd-stats-strip">
          <div className="pd-stat"><span>{fences.length}</span> Fences</div>
          <div className="pd-stat"><span>{fences.filter(f => f.is_active).length}</span> Active</div>
        </div>

        <div className="pd-sidebar-body">
          <FencePanel
            fences={fences}
            onRefresh={loadMyFences}
            onStartDraw={(mode) => { setDrawingMode(mode); setPendingShape(null); }}
            pendingShape={pendingShape}
            onPendingClear={() => setPendingShape(null)}
            ownerId={owner.owner_id}
            ownerName={owner.owner_name}
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
          showUserDot={true}
        />
        <FenceDetailModal fence={selectedFence} onClose={() => setSelectedFence(null)} />
      </main>
    </div>
  );
}
