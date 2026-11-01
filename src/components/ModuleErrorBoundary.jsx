import React from 'react';

const AlertTriangle = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const RefreshCw = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

export default class ModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ModuleErrorBoundary] Error en módulo:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '2.5rem',
            margin: '1.5rem auto',
            maxWidth: '640px',
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-glass, rgba(239, 68, 68, 0.3))',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)'
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', marginBottom: '0.5rem' }}>
            {this.props.moduleName ? `Error al cargar ${this.props.moduleName}` : 'Se ha producido un error inesperado'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            {this.state.error?.message || 'Ocurrió una excepción al procesar los datos del módulo.'}
          </p>
          <button
            onClick={this.handleReset}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.65rem 1.25rem' }}
          >
            <RefreshCw size={16} /> Reintentar Carga
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
