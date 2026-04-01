import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { OwnerProvider } from './contexts/OwnerContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OwnerProvider>
      <App />
    </OwnerProvider>
  </React.StrictMode>
);
