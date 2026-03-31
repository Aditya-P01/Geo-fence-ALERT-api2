import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const LINKS = [
  { to: '/',          end: true,  icon: '🗺️',  label: 'Map'       },
  { to: '/dashboard', end: false, icon: '📊',  label: 'Dashboard' },
  { to: '/alerts',    end: false, icon: '🔔',  label: 'Alerts'    },
  { to: '/settings',  end: false, icon: '⚙️',  label: 'Settings'  },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-icon">📍</span>
        <span className="navbar-title">GeoFence Alert</span>
      </div>

      {/* Desktop links */}
      <ul className="navbar-links">
        {LINKS.map(({ to, end, icon, label }) => (
          <li key={to}>
            <NavLink to={to} end={end}
              className={({ isActive }) => 'navbar-link' + (isActive ? ' navbar-link--active' : '')}>
              <span>{icon}</span>{label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Mobile hamburger */}
      <button className="navbar-hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="navbar-mobile-menu">
          {LINKS.map(({ to, end, icon, label }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => 'mobile-link' + (isActive ? ' mobile-link--active' : '')}
              onClick={() => setMobileOpen(false)}>
              <span className="mobile-link-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
