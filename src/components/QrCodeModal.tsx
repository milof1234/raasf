import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Download, Smartphone, Crown, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types/chat';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    setIsGenerating(true);

    try {
      const safeAvatar =
        currentUser.avatar && /^https?:\/\//i.test(currentUser.avatar) && currentUser.avatar.length < 512
          ? currentUser.avatar
          : '';
      const payload = {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        phone: currentUser.phone,
        isAdmin: !!currentUser.isAdmin,
        avatar: safeAvatar,
        passwordHash: currentUser.passwordHash || '',
        seed: Math.random().toString(36).substring(2, 8),
        created: Date.now()
      };

      const jsonStr = JSON.stringify(payload);
      const encoded = btoa(encodeURIComponent(jsonStr));

      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const fullUrl = `${origin}${pathname}?qr_login=${encoded}&u=${encodeURIComponent(currentUser.username || currentUser.id)}`;

      setTargetUrl(fullUrl);

      QRCode.toDataURL(fullUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0b0d11',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
        .then(url => {
          setQrDataUrl(url);
          setIsGenerating(false);
        })
        .catch(err => {
          console.error('QR code generation error:', err);
          setIsGenerating(false);
        });
    } catch (err) {
      console.error('Failed to construct QR payload:', err);
      setIsGenerating(false);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `cosmochat_qr_${currentUser.username || 'user'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--cc-bg-rail)] border border-[var(--cc-border-strong)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--cc-text)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--cc-border)] bg-[var(--cc-bg-surface)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] flex items-center justify-center text-[var(--cc-accent-text)]">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--cc-text)]">Вход по QR-коду</h2>
              <p className="text-xs text-[var(--cc-text-muted)]">Перенос аккаунта на другое устройство</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть QR-код"
            className="text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-1.5 rounded-xl hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="px-6 pt-5 pb-2 text-center flex flex-col items-center">
          <div className="relative mb-2.5">
            <div className="w-14 h-14 rounded-full bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] flex items-center justify-center overflow-hidden font-semibold text-lg text-[var(--cc-text)]">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser.name[0]?.toUpperCase() || '?'
              )}
            </div>
            {currentUser.isAdmin && (
              <span className="absolute -top-1 -right-1 bg-amber-500 p-1 rounded-full text-slate-950 shadow-sm" title="Администратор">
                <Crown className="w-3 h-3 fill-slate-950" />
              </span>
            )}
          </div>

          <div className="font-semibold text-sm text-[var(--cc-text)]">{currentUser.name}</div>
          <div className="text-xs text-[var(--cc-accent-text)] font-mono">@{currentUser.username}</div>
        </div>

        {/* QR Canvas Card */}
        <div className="p-4 flex flex-col items-center">
          <div className="p-3 bg-white rounded-2xl shadow-lg">
            {isGenerating ? (
              <div className="w-56 h-56 flex flex-col items-center justify-center gap-3 text-slate-800">
                <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                <span className="text-xs font-mono font-medium">Генерация кода...</span>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${currentUser.name}`}
                className="w-56 h-56 block rounded-lg select-none"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-red-500 text-xs">
                Ошибка генерации
              </div>
            )}
          </div>

          <p className="mt-3.5 text-xs text-[var(--cc-text-muted)] text-center max-w-xs leading-relaxed">
            Отсканируйте камерой смартфона для быстрого входа в аккаунт <span className="text-[var(--cc-text)] font-medium">@{currentUser.username}</span>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-[var(--cc-bg-surface)] border-t border-[var(--cc-border)] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 py-2.5 px-3 bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Ссылка скопирована!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Копировать ссылку</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="p-2.5 bg-[var(--cc-bg-surface-elevated)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] text-[var(--cc-text)] rounded-xl transition-colors cursor-pointer"
              title="Скачать PNG"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
