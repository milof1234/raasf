import React, { useState, useEffect } from 'react';
import { X, Cloud, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, Film, Image as ImageIcon } from 'lucide-react';

interface R2SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface R2Status {
  configured: boolean;
  provider: string;
  bucket: string | null;
  publicUrl: string | null;
}

export const R2SettingsModal: React.FC<R2SettingsModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<R2Status | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'instructions' | 'env'>('instructions');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/r2-status')
        .then(r => r.json())
        .then(data => setStatus(data))
        .catch(() => setStatus({ configured: false, provider: 'local-fallback', bucket: null, publicUrl: null }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2500);
    });
  };

  const envSample = `# Настройки Cloudflare R2 в .env файле
R2_ACCOUNT_ID="ваш_cloudflare_account_id"
R2_ACCESS_KEY_ID="ваш_r2_access_key_id"
R2_SECRET_ACCESS_KEY="ваш_r2_secret_access_key"
R2_BUCKET_NAME="cosmo-media"
R2_PUBLIC_URL="https://pub-xxxxxx.r2.dev"`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-[var(--cc-text)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--cc-bg-rail)] border border-[var(--cc-border-strong)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--cc-border)] bg-[var(--cc-bg-surface)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-[var(--cc-text)]">
                Хранилище Cloudflare R2
              </h2>
              <p className="text-xs text-[var(--cc-text-muted)]">Облачное хранилище для фото и видео</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть инструкцию R2"
            className="text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-2 rounded-xl hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-5 py-3 bg-[var(--cc-bg-app)] border-b border-[var(--cc-border)] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {status?.configured ? (
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Cloudflare R2 подключён (Бакет: {status.bucket})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Локальное хранилище активно (R2 не настроен)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[var(--cc-text-muted)]">
            <span className="flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-[var(--cc-accent-text)]" /> Фото
            </span>
            <span className="flex items-center gap-1">
              <Film className="w-3.5 h-3.5 text-cyan-400" /> Видео (MP4/WebM)
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--cc-border)] bg-[var(--cc-bg-rail)] px-5 pt-2.5 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('instructions')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'instructions'
                ? 'border-[var(--cc-accent)] text-[var(--cc-accent-text)]'
                : 'border-transparent text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
            }`}
          >
            Пошаговая инструкция
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('env')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'env'
                ? 'border-[var(--cc-accent)] text-[var(--cc-accent-text)]'
                : 'border-transparent text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
            }`}
          >
            Переменные (.env)
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {activeTab === 'instructions' ? (
            <div className="bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-2xl p-4 space-y-3">
              {[
                {
                  step: '1',
                  title: 'Создайте аккаунт Cloudflare',
                  body: (
                    <>
                      Перейдите на сайт{' '}
                      <a
                        href="https://dash.cloudflare.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-orange-400 hover:underline font-mono inline-flex items-center gap-0.5"
                      >
                        dash.cloudflare.com <ExternalLink className="w-3 h-3" />
                      </a>{' '}
                      и войдите или зарегистрируйтесь.
                    </>
                  )
                },
                {
                  step: '2',
                  title: 'Создайте бакет R2 (Bucket)',
                  body: (
                    <>
                      В левом меню выберите <strong>R2 Object Storage</strong> → нажмите <strong>Create bucket</strong>.
                      Укажите имя, например: <code className="bg-[var(--cc-bg-app)] text-cyan-300 px-1 py-0.5 rounded">cosmo-media</code>.
                    </>
                  )
                },
                {
                  step: '3',
                  title: 'Включите публичный доступ (Public URL)',
                  body: (
                    <>
                      В настройках бакета (<strong>Settings</strong>) включите <strong>Public Development URL</strong> и скопируйте адрес вида{' '}
                      <code className="bg-[var(--cc-bg-app)] text-emerald-300 px-1 py-0.5 rounded">https://pub-xxxxxxxxxxxx.r2.dev</code>.
                    </>
                  )
                },
                {
                  step: '4',
                  title: 'Создайте API-токен с правами записи',
                  body: (
                    <>
                      В меню R2 нажмите <strong>Manage R2 API Tokens</strong> → <strong>Create API token</strong> с правами <strong>Object Read &amp; Write</strong> и перенесите Account ID, Access Key ID и Secret Access Key.
                    </>
                  )
                }
              ].map((item, idx) => (
                <div
                  key={item.step}
                  className={`flex items-start gap-3 ${idx > 0 ? 'pt-3 border-t border-[var(--cc-border)]' : ''}`}
                >
                  <div className="w-6 h-6 rounded-lg bg-orange-500/15 text-orange-400 font-semibold flex items-center justify-center shrink-0 border border-orange-500/30 text-xs">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-[var(--cc-text)] text-xs sm:text-sm">{item.title}</h4>
                    <p className="text-[var(--cc-text-muted)] mt-0.5">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-[var(--cc-bg-app)] p-4 rounded-2xl border border-[var(--cc-border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-[var(--cc-text-muted)]">Конфигурация для сервера</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(envSample, 'env')}
                    className="px-2.5 py-1 bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] text-[var(--cc-text)] rounded-lg flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                  >
                    {copiedKey === 'env' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Копировать</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="font-mono text-xs text-cyan-300 overflow-x-auto p-2.5 bg-black/35 rounded-xl whitespace-pre-wrap">
                  {envSample}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--cc-border)] bg-[var(--cc-bg-surface)] flex items-center justify-between">
          <a
            href="https://dash.cloudflare.com/"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <span>Открыть Cloudflare Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[var(--cc-bg-surface-elevated)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] text-[var(--cc-text-secondary)] rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
