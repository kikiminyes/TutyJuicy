import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send to error reporting service (e.g., Sentry)
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
            padding: '2rem',
          }}
        >
          <div style={{ maxWidth: '600px', width: '100%' }}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
                  Oops! Something went wrong
                </h2>
                <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                  We're sorry for the inconvenience. The application encountered an unexpected error.
                </p>

                {import.meta.env.DEV && this.state.error && (
                <details
                  style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    backgroundColor: '#fef2f2',
                    borderRadius: '0.375rem',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                  }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                    }}
                  >
                    Error Details (Development Only)
                  </summary>
                  <pre style={{ overflow: 'auto', fontSize: '0.75rem' }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button onClick={this.handleReset} variant="primary">
                  Try Again
                </Button>
                <Button onClick={() => (window.location.href = '/')} variant="outline">
                  Go Home
                </Button>
              </div>
              </div>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
