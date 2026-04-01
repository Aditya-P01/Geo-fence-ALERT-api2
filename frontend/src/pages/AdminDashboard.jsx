import { useState, useEffect, useCallback } from 'react';
import MapView from '../components/MapView/MapView';
import FencePanel from '../components/FencePanel/FencePanel';
import AlertFeed from '../components/AlertFeed/AlertFeed';
import FenceDetailModal from '../components/FenceDetailModal/FenceDetailModal';
import { fenceApi, ownerApi } from '../api/client';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [fences,       setFences]       = useState([]);
  const [ownerStats,   setOwnerStats]   = useState({ owners: [] });
  const [drawingMode,  setDrawingMode]  = useState(null);
  const [pendingShape, setPendingShape] = useState(null);
  const [activeTab,    setActiveTab]    = useState('fences'); // 'fences' | 'alerts'
  const [selectedFence, setSelectedFence] = useState(null);

  const loadData = useCallback(() => {
    fenceApi.getAll({ active: 'false', limit: 100 })
      .then(r => setFences(r.data.fences || []))
      .catch(() => {});
    
    ownerApi.getStats()
      .then(r => setOwnerStats(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleStartDraw(mode) {
    setDrawingMode(mode);
    setPendingShape(null);
  }

  function handleFenceDrawn(shape) {
    setDrawingMode(null);
    setPendingShape(shape);
  }

  return (
    <div className="admin-layout">
      {/* Left sidebar */}
      <aside className="admin-sidebar">
        
        {/* NEW: Admin Stats Strip */}
        <div className="admin-stats-strip">
          <div className="admin-stat"><span>{ownerStats.owners.length}</span> Owners</div>
          <div className="admin-stat"><span>{fences.length}</span> Fences</div>
          <div className="admin-stat">
            <span>{ownerStats.owners.reduce((sum, o) => sum + parseInt(o.total_alerts || 0, 10), 0)}</span> 
            Events
          </div>
        </div>

        <div className="sidebar-tabs">
          <button className={`stab ${activeTab === 'fences' ? 'active' : ''}`} onClick={() => setActiveTab('fences')}>
            🗺 Global Fences
          </button>
          <button className={`stab ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>
            🔔 Global Alerts
          </button>
        </div>

        <div className="sidebar-body">
          {activeTab === 'fences' && (
            <FencePanel
              fences={fences}
              onRefresh={loadData}
              onStartDraw={handleStartDraw}
              pendingShape={pendingShape}
              onPendingClear={() => setPendingShape(null)}
            />
          )}
          {activeTab === 'alerts' && <AlertFeed maxItems={100} />}
        </div>
      </aside>

      {/* Map */}
      <main className="admin-map">
        {drawingMode && (
          <div className="drawing-hint">
            🖊 Draw a <b>{drawingMode}</b> on the map — click to place, double-click to finish
            <button onClick={() => setDrawingMode(null)}>✕ Cancel</button>
          </div>
        )}
        <MapView
          fences={fences.filter(f => f.is_active)}
          drawingMode={drawingMode}
          onFenceDrawn={handleFenceDrawn}
          onFenceClick={setSelectedFence}
          showUserDot={true}
        />
        <FenceDetailModal fence={selectedFence} onClose={() => setSelectedFence(null)} />
      </main>
    </div>
  );
}
