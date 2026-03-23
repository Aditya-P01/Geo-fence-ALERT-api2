import React, { useEffect, useState } from 'react';
import { fenceAPI, alertAPI } from '../services/api';
import './DashboardPage.css';

const DashboardPage = () => {
  const [stats, setStats]   = useState(null);
  const [fences, setFences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, fencesRes] = await Promise.all([
          alertAPI.getStats(),
          fenceAPI.getAll({ limit: 10 }),
        ]);
        setStats(statsRes.data);
        setFences(fencesRes.data.fences || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="dashboard-page">
      <div className="empty-state">
        <div className="spinner" />
        <p className="empty-state-text">Loading dashboard…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="dashboard-page">
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <p className="empty-state-text">Could not load dashboard: {error}</p>
        <p className="empty-state-text" style={{ fontSize: '0.8rem' }}>
          Make sure the backend is running on port 3000.
        </p>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <p className="dashboard-subtitle">System overview — last 24 hours</p>
      </header>

      {/* ── Stat cards ── */}
      {stats && (
        <section className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total_alerts}</div>
            <div className="stat-label">Total Alerts</div>
          </div>
          <div className="stat-card stat-card--enter">
            <div className="stat-value">{stats.events?.enter ?? 0}</div>
            <div className="stat-label">ENTER Events</div>
          </div>
          <div className="stat-card stat-card--exit">
            <div className="stat-value">{stats.events?.exit ?? 0}</div>
            <div className="stat-label">EXIT Events</div>
          </div>
          <div className="stat-card stat-card--delivered">
            <div className="stat-value">{stats.delivery?.delivered ?? 0}</div>
            <div className="stat-label">Webhooks Delivered</div>
          </div>
          <div className="stat-card stat-card--failed">
            <div className="stat-value">{stats.delivery?.failed ?? 0}</div>
            <div className="stat-label">Webhooks Failed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.unique_devices}</div>
            <div className="stat-label">Unique Devices</div>
          </div>
        </section>
      )}

      {/* ── Active fences ── */}
      <section className="dashboard-section">
        <h2 className="section-title">Active Geo-Fences</h2>
        {fences.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🗺️</span>
            <p className="empty-state-text">No fences yet. Draw one on the Map page.</p>
          </div>
        ) : (
          <div className="fence-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Events</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {fences.map((f) => (
                  <tr key={f.id}>
                    <td className="td-name">{f.name}</td>
                    <td><span className="badge badge--pending">{f.type}</span></td>
                    <td>{(f.events || []).join(', ')}</td>
                    <td>
                      <span className={`badge ${f.is_active ? 'badge--delivered' : 'badge--failed'}`}>
                        {f.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="td-muted">
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
