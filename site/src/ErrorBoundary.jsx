import React from 'react';

/**
 * Without this, one thrown render error unmounts the whole app, navigation included,
 * and leaves a blank page with no way back. Keep the failure local and recoverable.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Inference Atlas failed to render', error, info); }

  render() {
    if (!this.state.error) return this.props.children;
    return <div className="render-error" role="alert">
      <h1>This page stopped rendering.</h1>
      <p>Something in the page threw an error, so it was not drawn. The details are in the browser console. Your reading position and saved pages are untouched.</p>
      <div className="render-error-actions">
        <button className="inline-link" onClick={() => { this.setState({ error: null }); location.hash = '#feasibility'; }}>Back to the first chapter</button>
        <button className="inline-link" onClick={() => location.reload()}>Reload the page</button>
      </div>
      <pre>{String(this.state.error?.message || this.state.error)}</pre>
    </div>;
  }
}
