import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center',
          color: '#e2e8f0', gap: '1rem',
        }}>
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {this.props.label || 'Something went wrong'}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: 420 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: '#7c3aed', color: '#fff', border: 'none',
              borderRadius: 8, padding: '0.55rem 1.2rem', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.9rem',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
