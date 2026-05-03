import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const { pathname } = useLocation();
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">📍</span>
        <span className="navbar-title">GeoFence Alert</span>
      </div>
      <div className="navbar-links">
        <Link to="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
          My Fences
        </Link>
        <Link to="/admin" className={`nav-link ${pathname === '/admin' ? 'active' : ''}`}>
          Global Admin
        </Link>
        <Link to="/device" className={`nav-link ${pathname === '/device' ? 'active' : ''}`}>
          Device Tracker
        </Link>
      </div>
    </nav>
  );
}
