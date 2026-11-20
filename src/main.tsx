import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && typeof Storage !== 'undefined') {
  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    try {
      origSetItem.call(this, key, value);
    } catch {
      try {
        this.removeItem('cosmo_messages_cache');
        this.removeItem('cosmo_users_cache');
        if (key !== 'cosmo_messages_cache' && key !== 'cosmo_users_cache') {
          origSetItem.call(this, key, value);
        }
      } catch {}
    }
  };
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Неизвестная ошибка интерфейса' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('CosmoChat UI Error:', error, info);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('cosmo_user');
      sessionStorage.removeItem('cosmo_user');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0d11] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#131722] border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <h2 className="text-lg font-semibold">Произошёл сбой интерфейса</h2>
            <p className="text-xs text-slate-400 break-words">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Сбросить сессию и перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
} else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <div
      aria-label="Версия приложения"
      className="fixed bottom-2 right-2 z-[9999] pointer-events-none select-none px-2 py-0.5 rounded-full bg-black/55 border border-white/10 text-[10px] font-mono text-slate-300/85 backdrop-blur-sm"
    >
      CosmoChat v1.0.9
    </div>
  </>
);
