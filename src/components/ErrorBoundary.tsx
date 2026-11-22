import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = 'Terjadi kesalahan saat memproses data aplikasi.';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        if (parsed.error.toLowerCase().includes('permission')) {
          displayMessage = `Akses database ditolak (${parsed.operationType || 'read'} pada ${parsed.path || 'koleksi'}). Pastikan Anda masuk dengan akun admin yang berwenang.`;
        } else {
          displayMessage = parsed.error;
        }
      }
    } catch {
      if (error?.message) {
        displayMessage = error.message;
      }
    }
    return { hasError: true, message: displayMessage };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught app error:', error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6FAF8] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 text-red-600" aria-hidden="true" />
            </div>
            <h1 className="font-display font-bold text-lg text-forest-900">
              Terjadi Kendala Sistem
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
