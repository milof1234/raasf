import React, { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      data-testid="offline-indicator"
      role="status"
      aria-live="polite"
      className="fixed bottom-16 sm:bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl bg-amber-600/95 border border-amber-400/50 px-3 py-2 text-xs font-medium text-white shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse" />
      <span>Офлайн-режим — работают кэш и сохранённые данные</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Скрыть уведомление"
        className="ml-1 text-amber-100 hover:text-white cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
