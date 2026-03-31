import React, { useState, useEffect } from 'react';
import { fenceAPI, webhookAPI } from '../services/api';
import { toast } from 'react-toastify';
import './SettingsPage.css';

const INTERVALS = [5, 10, 15, 30];
const ACCURACY_OPTIONS = [
  { label: 'Any accuracy', value: 0 },
  { label: '< 50 m (recommended)', value: 50 },
  { label: '< 30 m (high)', value: 30 },
  { label: '< 15 m (best)', value: 15 },
];

function loadSettings() {
  try { return JSON.parse(localStorage.getItem('gf_settings') || '{}'); }
  catch (_) { return {}; }
}

function saveSettings(s) {
  localStorage.setItem('gf_settings', JSON.stringify(s));
}

export default function SettingsPage() {
  const [s, setS] = useState({
    trackingInterval: 5,
    gpsAccuracy: 50,
    alertSound: true,
    browserNotifications: false,
    ...loadSettings(),
  });
  const [notifPerm, setNotifPerm] = useState(Notification?.permission || 'default');
  const [clearing, setClearing]  = useState(false);

  // Persist on every change
  useEffect(() => { saveSettings(s); }, [s]);

  const update = (key, val) => setS(prev => ({ ...prev, [key]: val }));

  const requestNotifPerm = async () => {
    if (!('Notification' in window)) { toast.warning('Browser notifications not supported.'); return; }
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === 'granted') { update('browserNotifications', true); toast.success('Browser notifications enabled!'); }
    else { update('browserNotifications', false); toast.warning('Notification permission denied.'); }
  };

  const handleClearAll = async () => {
    if (!window.confirm('⚠️ Delete ALL fences, alerts, and webhooks? This cannot be undone.')) return;
    if (!window.confirm('Are you absolutely sure? Type OK to confirm in your mind and click OK.')) return;
    setClearing(true);
    try {
      const [fRes, wRes] = await Promise.all([
        fenceAPI.getAll({ limit: 1000 }),
        webhookAPI.getAll(),
      ]);
      const fences   = fRes.data.fences   || [];
      const webhooks = wRes.data.webhooks || [];
      await Promise.all([
        ...fences.map(f   => fenceAPI.delete(f.id)),
        ...webhooks.map(w => webhookAPI.delete(w.id)),
      ]);
      toast.success('All data cleared successfully.');
    } catch (err) {
      toast.error(`Clear failed: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1 className="page-title">⚙️ Settings</h1>
        <p className="page-sub">App preferences and configuration</p>
      </header>

      {/* ── Tracking ── */}
      <section className="settings-section">
        <h2 className="settings-section-title">📡 Tracking</h2>
        <div className="settings-card">
          <div className="setting-row">
            <div>
              <div className="setting-label">Tracking Interval</div>
              <div className="setting-desc">How often GPS coordinates are sent to the backend</div>
            </div>
            <div className="setting-control">
              {INTERVALS.map(n => (
                <button key={n} className={`interval-btn ${s.trackingInterval === n ? 'interval-btn--active' : ''}`}
                  onClick={() => update('trackingInterval', n)}>{n}s</button>
              ))}
            </div>
          </div>

          <div className="setting-divider" />

          <div className="setting-row">
            <div>
              <div className="setting-label">GPS Accuracy Threshold</div>
              <div className="setting-desc">Ignore GPS readings worse than this (prevents false alerts)</div>
            </div>
            <select className="setting-select" value={s.gpsAccuracy} onChange={e => update('gpsAccuracy', Number(e.target.value))}>
              {ACCURACY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* ── Notifications ── */}
      <section className="settings-section">
        <h2 className="settings-section-title">🔔 Notifications</h2>
        <div className="settings-card">
          <div className="setting-row">
            <div>
              <div className="setting-label">Alert Sound</div>
              <div className="setting-desc">Play a chime when ENTER/EXIT events fire</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={s.alertSound} onChange={e => update('alertSound', e.target.checked)} />
              <span className="toggle-track" />
            </label>
          </div>

          <div className="setting-divider" />

          <div className="setting-row">
            <div>
              <div className="setting-label">Browser Notifications</div>
              <div className="setting-desc">Show system notifications even when tab is in background
                {' '}<span className={`notif-perm notif-perm--${notifPerm}`}>{notifPerm}</span>
              </div>
            </div>
            <div className="setting-control">
              {notifPerm !== 'granted' ? (
                <button className="btn btn--primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }} onClick={requestNotifPerm}>
                  Enable
                </button>
              ) : (
                <label className="toggle">
                  <input type="checkbox" checked={s.browserNotifications} onChange={e => update('browserNotifications', e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Keyboard shortcuts ── */}
      <section className="settings-section">
        <h2 className="settings-section-title">⌨️ Keyboard Shortcuts</h2>
        <div className="settings-card">
          <div className="kb-grid">
            {[
              ['C', 'Activate circle draw mode'],
              ['P', 'Activate polygon draw mode'],
              ['T', 'Toggle live tracking'],
              ['Esc', 'Cancel current drawing'],
              ['1', 'Go to Map page'],
              ['2', 'Go to Dashboard'],
              ['3', 'Go to Alerts'],
              ['4', 'Go to Settings'],
            ].map(([key, desc]) => (
              <div key={key} className="kb-row">
                <kbd className="kbd">{key}</kbd>
                <span className="kb-desc">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Danger zone ── */}
      <section className="settings-section">
        <h2 className="settings-section-title danger-title">🔴 Danger Zone</h2>
        <div className="settings-card settings-card--danger">
          <div className="setting-row">
            <div>
              <div className="setting-label">Clear All Data</div>
              <div className="setting-desc">Permanently delete all fences, alerts, and webhooks. Cannot be undone.</div>
            </div>
            <button className="btn btn--danger" onClick={handleClearAll} disabled={clearing}>
              {clearing ? 'Clearing…' : '🗑 Clear All'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// Export settings loader for use by other components
export { loadSettings };
