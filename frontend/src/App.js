import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'leaflet/dist/leaflet.css';
import './App.css';

import Navbar        from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';

// ── Code-split pages with React.lazy ──────────────────────────
const MapPage       = lazy(() => import('./pages/MapPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AlertsPage    = lazy(() => import('./pages/AlertsPage'));
const SettingsPage  = lazy(() => import('./pages/SettingsPage'));

// Suspense fallback
const PageLoader = () => (
  <div className="page-loader">
    <div className="spinner" />
  </div>
);

// ── Global keyboard shortcuts ─────────────────────────────────
function KeyboardRouter() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      // Don't fire shortcuts when user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      switch (e.key) {
        case '1': navigate('/');          break;
        case '2': navigate('/dashboard'); break;
        case '3': navigate('/alerts');    break;
        case '4': navigate('/settings'); break;
        // C, P, T, Esc are handled inside MapPage itself
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return null;
}

// ── App ───────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <KeyboardRouter />
      <div className="app-shell">
        <Navbar />
        <main className="app-content">
          <ErrorBoundary label="Page Error — Try Refreshing">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/"          element={<MapPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/alerts"    element={<AlertsPage />} />
                <Route path="/settings"  element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
        limit={5}
      />
    </BrowserRouter>
  );
}

export default App;
