import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-icon">📍</span>
        <span className="navbar-title">GeoFence Alert</span>
      </div>
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
    </nav>
  );
};

export default Navbar;
