import React, { useEffect, useState, useCallback } from 'react';
import { alertAPI } from '../services/api';
import { format } from 'date-fns';
import './AlertsPage.css';

const DELIVERY_LABELS = {
  delivered: '✅ Delivered',
  failed:    '❌ Failed',
  pending:   '⏳ Pending',
};

const FILTERS = ['All', 'ENTER', 'EXIT'];
const DELIVERY_FILTERS = ['All', 'delivered', 'failed', 'pending'];

const AlertsPage = () => {
  const [alerts, setAlerts]         = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [page, setPage]             = useState(1);
  const [eventFilter, setEventFilter]       = useState('All');
  const [deliveryFilter, setDeliveryFilter] = useState('All');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (eventFilter   !== 'All') params.event_type      = eventFilter;
      if (deliveryFilter !== 'All') params.delivery_status = deliveryFilter;

      const res = await alertAPI.getAll(params);
      setAlerts(res.data.alerts || []);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter, deliveryFilter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [eventFilter, deliveryFilter]);

  return (
    <div className="alerts-page">
      <header className="alerts-header">
        <h1 className="dashboard-title">Alert History</h1>
        <p className="dashboard-subtitle">Paginated log of all ENTER / EXIT events</p>
      </header>

      {/* ── Filters ── */}
      <div className="alerts-filters">
        <div className="filter-group">
          <span className="filter-label">Event</span>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-btn ${eventFilter === f ? 'filter-btn--active' : ''}`}
              onClick={() => setEventFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Delivery</span>
          {DELIVERY_FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-btn ${deliveryFilter === f ? 'filter-btn--active' : ''}`}
              onClick={() => setDeliveryFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
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
          <p className="empty-state-text">No alerts match the current filters.</p>
        </div>
      ) : (
        <>
          <div className="fence-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Device</th>
                  <th>Fence</th>
                  <th>Delivery</th>
                  <th>Location</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className={`badge badge--${a.event_type.toLowerCase()}`}>
                        {a.event_type}
                      </span>
                    </td>
                    <td className="td-name">{a.device_id}</td>
                    <td className="td-muted">{a.fence_name || a.fence_id}</td>
                    <td>
                      <span className={`badge badge--${a.delivery_status}`}>
                        {DELIVERY_LABELS[a.delivery_status] || a.delivery_status}
                      </span>
                    </td>
                    <td className="td-muted">
                      {Number(a.device_lat).toFixed(5)}, {Number(a.device_lng).toFixed(5)}
                    </td>
                    <td className="td-muted">
                      {format(new Date(a.created_at), 'MMM d, HH:mm:ss')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {pagination && pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn--ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages}
                &nbsp;·&nbsp;{pagination.total} total
              </span>
              <button
                className="btn btn--ghost"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AlertsPage;
