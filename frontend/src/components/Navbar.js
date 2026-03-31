<<<<<<< HEAD
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

=======
import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
>>>>>>> frontend-branch
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-icon">📍</span>
        <span className="navbar-title">GeoFence Alert</span>
      </div>
<<<<<<< HEAD

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
=======
      <ul className="navbar-links">
        <li>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              'navbar-link' + (isActive ? ' navbar-link--active' : '')
            }
          >
            <span className="navbar-link-icon">🗺️</span>
            Map
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              'navbar-link' + (isActive ? ' navbar-link--active' : '')
            }
          >
            <span className="navbar-link-icon">📊</span>
            Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/alerts"
            className={({ isActive }) =>
              'navbar-link' + (isActive ? ' navbar-link--active' : '')
            }
          >
            <span className="navbar-link-icon">🔔</span>
            Alerts
          </NavLink>
        </li>
      </ul>
>>>>>>> frontend-branch
    </nav>
  );
};

export default Navbar;
