import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          padding: '2rem',
          background: '#0d0b12',
          color: '#e8e4f0',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
          <pre style={{
            background: '#16131d',
            padding: '1rem',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '14px',
          }}>
            {this.state.error.message}
          </pre>
          <p style={{ color: '#9a92b0' }}>Check the browser console for more details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
