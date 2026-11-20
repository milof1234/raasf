import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        data-testid="pwa-install-btn"
        onClick={install}
        aria-label="Установить приложение CosmoChat"
        title="Установить CosmoChat для работы офлайн"
        className="w-9 h-9 rounded-xl text-[var(--cc-accent-text)] hover:text-white hover:bg-[var(--cc-accent)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
      >
        <Download className="w-[18px] h-[18px]" />
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          data-testid="pwa-ios-install-btn"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Установить на iPhone или iPad"
          title="Установить на экран «Домой»"
          className="w-9 h-9 rounded-xl text-[var(--cc-accent-text)] hover:text-white hover:bg-[var(--cc-accent)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <Smartphone className="w-[18px] h-[18px]" />
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[var(--cc-bg-rail)] border border-[var(--cc-border-strong)] p-5 shadow-2xl relative text-left">
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Закрыть инструкцию"
                className="absolute top-3.5 right-3.5 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-semibold text-[var(--cc-text)]">Установка на iPhone / iPad</h3>
              <p className="mt-2.5 text-xs text-[var(--cc-text-secondary)] leading-relaxed">
                1. Нажмите кнопку <strong>«Поделиться»</strong> в нижней панели Safari.
                <br />
                2. Прокрутите вниз и выберите <strong>«На экран «Домой»»</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
