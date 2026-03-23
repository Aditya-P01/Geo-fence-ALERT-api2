import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'leaflet/dist/leaflet.css';
import './App.css';

import Navbar from './components/Navbar';
import MapPage from './pages/MapPage';
import DashboardPage from './pages/DashboardPage';
import AlertsPage from './pages/AlertsPage';

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar />
        <main className="app-content">
          <Routes>
            <Route path="/"          element={<MapPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/alerts"    element={<AlertsPage />} />
          </Routes>
        </main>
      </div>

      {/* Toast notifications slide in from here when alerts fire */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </BrowserRouter>
  );
}

export default App;
