import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { OwnerProvider } from './contexts/OwnerContext';
import { TrackingProvider } from './contexts/TrackingContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OwnerProvider>
      <TrackingProvider>
        <App />
      </TrackingProvider>
    </OwnerProvider>
  </React.StrictMode>
);
