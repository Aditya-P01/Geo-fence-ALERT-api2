import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';
import { fenceAPI, alertAPI, webhookAPI } from '../services/api';
import './DashboardPage.css';

// ─────────────────────────────────────────────────────────────
//  DashboardPage
// ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();

  const [stats,    setStats]    = useState(null);
  const [fences,   setFences]   = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Webhook modal state
  const [showWebhookModal, setShowWebhookModal]   = useState(false);
  const [webhookUrl,        setWebhookUrl]         = useState('');
  const [webhookEvents,     setWebhookEvents]      = useState(['ENTER', 'EXIT']);
  const [savingWebhook,     setSavingWebhook]      = useState(false);

  // ── Data loading ────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [statsRes, fencesRes, webhooksRes] = await Promise.all([
        alertAPI.getStats(),
        fenceAPI.getAll({ limit: 100 }),
        webhookAPI.getAll(),
      ]);
      setStats(statsRes.data);
      setFences(fencesRes.data.fences || []);
      setWebhooks(webhooksRes.data.webhooks || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();

    // Auto-refresh every 30s
    const timer = setInterval(loadAll, 30000);
    return () => clearInterval(timer);
  }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
    toast.success('Data refreshed!', { autoClose: 2000 });
  };

  // ── Fence delete ────────────────────────────────────────────
  const handleDeleteFence = async (fence) => {
    if (!window.confirm(`Delete fence "${fence.name}"? This cannot be undone.`)) return;
    try {
      await fenceAPI.delete(fence.id);
      setFences((prev) => prev.filter((f) => f.id !== fence.id));
      toast.success(`Fence "${fence.name}" deleted.`);
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  // ── Webhook CRUD ────────────────────────────────────────────
  const handleSaveWebhook = async () => {
    if (!webhookUrl.trim()) { toast.warning('Enter a webhook URL.'); return; }
    setSavingWebhook(true);
    try {
      const res = await webhookAPI.create({ url: webhookUrl.trim(), event_types: webhookEvents });
      setWebhooks((prev) => [res.data, ...prev]);
      toast.success('Webhook registered!');
      setShowWebhookModal(false);
      setWebhookUrl('');
      setWebhookEvents(['ENTER', 'EXIT']);
    } catch (err) {
      toast.error(`Webhook creation failed: ${err.message}`);
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleToggleWebhook = async (webhook) => {
    try {
      const res = await webhookAPI.update(webhook.id, { is_active: !webhook.is_active });
      setWebhooks((prev) => prev.map((w) => (w.id === webhook.id ? res.data : w)));
    } catch (err) {
      toast.error(`Update failed: ${err.message}`);
    }
  };

  const handleDeleteWebhook = async (webhook) => {
    if (!window.confirm(`Remove webhook for\n${webhook.url}?`)) return;
    try {
      await webhookAPI.delete(webhook.id);
      setWebhooks((prev) => prev.filter((w) => w.id !== webhook.id));
      toast.success('Webhook removed.');
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    }
  };

  // ── Delivery rate helper ────────────────────────────────────
  const deliveryRate = () => {
    if (!stats || stats.total_alerts === 0) return 'N/A';
    return `${Math.round((stats.delivery.delivered / stats.total_alerts) * 100)}%`;
  };

  // ─────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="dashboard-page">
      <div className="empty-state"><div className="spinner" /><p className="empty-state-text">Loading dashboard…</p></div>
    </div>
  );

  if (error) return (
    <div className="dashboard-page">
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <p className="empty-state-text">Could not load: {error}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
          Make sure the backend API is running on port 3000.
        </p>
        <button className="btn btn--primary" style={{ marginTop: '1rem' }} onClick={loadAll}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">

      {/* ── Header ── */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">System overview · auto-refreshes every 30s</p>
        </div>
        <button className={`btn btn--ghost ${refreshing ? 'refreshing' : ''}`} onClick={handleRefresh}>
          {refreshing ? '⟳ Refreshing…' : '⟳ Refresh'}
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <section className="dashboard-stats">
          <div className="stat-card stat-card--enter">
            <div className="stat-icon">📍</div>
            <div className="stat-value">{fences.filter((f) => f.is_active).length}</div>
            <div className="stat-label">Active Fences</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔔</div>
            <div className="stat-value">{stats.total_alerts}</div>
            <div className="stat-label">Alerts (24h)</div>
          </div>
          <div className="stat-card stat-card--delivered">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{deliveryRate()}</div>
            <div className="stat-label">Delivery Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📱</div>
            <div className="stat-value">{stats.unique_devices}</div>
            <div className="stat-label">Unique Devices</div>
          </div>
          <div className="stat-card stat-card--enter">
            <div className="stat-icon">⬇️</div>
            <div className="stat-value">{stats.events?.enter ?? 0}</div>
            <div className="stat-label">ENTER Events</div>
          </div>
          <div className="stat-card stat-card--exit">
            <div className="stat-icon">⬆️</div>
            <div className="stat-value">{stats.events?.exit ?? 0}</div>
            <div className="stat-label">EXIT Events</div>
          </div>
        </section>
      )}

      {/* ── Fence card grid ── */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">Geo-Fences ({fences.length})</h2>
          <button className="btn btn--primary" onClick={() => navigate('/')}>
            + Draw on Map
          </button>
        </div>

        {fences.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🗺️</span>
            <p className="empty-state-text">No fences yet. Go to the Map page to draw one.</p>
          </div>
        ) : (
          <div className="fence-grid">
            {fences.map((fence) => (
              <div key={fence.id} className="fence-card">
                <div className="fence-card-icon">
                  {fence.type === 'circle' ? '⭕' : '🔶'}
                </div>
                <div className="fence-card-body">
                  <div className="fence-card-name">{fence.name}</div>
                  <div className="fence-card-meta">
                    <span className="badge badge--pending">{fence.type}</span>
                    <span className={`badge ${fence.is_active ? 'badge--delivered' : 'badge--failed'}`}>
                      {fence.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {fence.type === 'circle' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        r={fence.radius_meters}m
                      </span>
                    )}
                  </div>
                  <div className="fence-card-date">
                    Created {formatDistanceToNow(new Date(fence.created_at), { addSuffix: true })}
                  </div>
                </div>
                <div className="fence-card-actions">
                  <button
                    className="btn btn--ghost"
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                    onClick={() => navigate('/')}
                  >
                    🗺 Map
                  </button>
                  <button
                    className="btn btn--danger"
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                    onClick={() => handleDeleteFence(fence)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Webhook management ── */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">Webhooks ({webhooks.length})</h2>
          <button className="btn btn--primary" onClick={() => setShowWebhookModal(true)}>
            + Add Webhook
          </button>
        </div>

        {webhooks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🔗</span>
            <p className="empty-state-text">No webhooks registered. Add one to receive alert POSTs.</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-primary-lt)' }}>
              Tip: Use <a href="https://webhook.site" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>webhook.site</a> to get a free test URL.
            </p>
          </div>
        ) : (
          <div className="fence-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Events</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id}>
                    <td className="td-url" title={wh.url}>{wh.url}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(wh.event_types || []).map((e) => (
                          <span key={e} className={`badge badge--${e.toLowerCase()}`}>{e}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <label className="toggle" title={wh.is_active ? 'Disable' : 'Enable'}>
                        <input
                          type="checkbox"
                          checked={wh.is_active}
                          onChange={() => handleToggleWebhook(wh)}
                        />
                        <span className="toggle-track" />
                      </label>
                    </td>
                    <td className="td-muted">
                      {formatDistanceToNow(new Date(wh.created_at), { addSuffix: true })}
                    </td>
                    <td>
                      <button className="btn btn--danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => handleDeleteWebhook(wh)}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Add Webhook Modal ── */}
      {showWebhookModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowWebhookModal(false)}>
          <div className="modal-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>🔗 Register Webhook</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Your backend will POST alert payloads to this URL.
            </p>

            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.3rem' }}>
              Webhook URL *
            </label>
            <input
              className="modal-input"
              placeholder="https://webhook.site/your-unique-id"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveWebhook()}
              autoFocus
            />

            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Event Types
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {['ENTER', 'EXIT'].map((evt) => (
                <label key={evt} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={webhookEvents.includes(evt)}
                    onChange={() =>
                      setWebhookEvents((prev) =>
                        prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
                      )
                    }
                  />
                  <span className={`badge badge--${evt.toLowerCase()}`}>{evt}</span>
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => { setShowWebhookModal(false); setWebhookUrl(''); }}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={handleSaveWebhook} disabled={savingWebhook || !webhookUrl.trim()}>
                {savingWebhook ? 'Saving…' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
