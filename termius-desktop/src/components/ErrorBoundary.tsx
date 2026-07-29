import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#0c1017',
          color: '#f8fafc',
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: '2rem',
          textAlign: 'center',
        }}>
          <AlertTriangle size={64} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: '#f8fafc' }}>
            Đã xảy ra lỗi giao diện (UI Error)
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '500px', marginBottom: '1.5rem' }}>
            Ứng dụng đã khôi phục thành công từ sự cố ngắt kết nối SSH. Vui lòng bấm nút làm mới để tiếp tục.
          </p>
          {this.state.error && (
            <pre style={{
              background: '#1e293b',
              color: '#f1f5f9',
              padding: '1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              maxWidth: '600px',
              overflowX: 'auto',
              marginBottom: '1.5rem',
              border: '1px solid #334155'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s',
            }}
          >
            <RefreshCw size={16} /> Tải lại trang (Reload)
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
