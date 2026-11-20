import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Palette,
  Bell,
  Camera,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  Crown,
  Cloud,
  ExternalLink,
  HardDrive,
  Waves,
  Coffee,
  Sparkles,
  Check,
  MoreHorizontal,
  Download,
  Monitor,
  Smartphone,
  Info,
  X,
  Gift,
  Coins,
  Repeat,
  Send,
  Lock
} from 'lucide-react';
import { UserProfile, AppTheme, GroupChat, OwnedGift } from '../types/chat';
import { containsProfanity, normalizeStr, hashPassword, isAdminPhone, cleanDigits } from '../utils/security';
import { VerifiedBadge } from './VerifiedBadge';
import { EARTH_GIFT_STARS, formatCoinsCount, getGiftCoinValue, readUserCatEconomy } from '../utils/catGameLogic';
import { COSMIC_HAMMER_GIFT_ID, getGiftCatalogItem, isGiftUnsellable } from '../utils/giftCatalog';
import { GiftCraftPanel } from './GiftCraftPanel';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  allGroups?: GroupChat[];
  ownedGifts?: OwnedGift[];
  onRegiftGift?: (
    ownedGift: OwnedGift,
    target: { receiverId?: string; groupId?: string },
    note?: string
  ) => boolean;
  onExchangeGiftForCoins?: (ownedGift: OwnedGift) => { coinsEarned: number; nextCoins: number } | null;
  onCraftGifts?: (ingredients: OwnedGift[], mode: 'next_tier' | 'holo') => OwnedGift | null;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onDeleteAllNumbers?: () => Promise<void> | void;
  onOpenR2Guide?: () => void;
  currentTheme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
  onOpenTelegramProfile?: () => void;
  onAdminUpdateUser?: (userId: string, updates: Partial<UserProfile>) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  allGroups = [],
  ownedGifts = [],
  onRegiftGift,
  onExchangeGiftForCoins,
  onCraftGifts,
  onUpdateProfile,
  onDeleteAllNumbers,
  onOpenR2Guide,
  currentTheme = 'default',
  onThemeChange,
  onOpenTelegramProfile,
  onAdminUpdateUser
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'gifts' | 'security' | 'storage' | 'appearance' | 'notifications' | 'more' | 'admin'>('profile');
  const [adminSearch, setAdminSearch] = useState('');
  const [r2Configured, setR2Configured] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/r2-status')
        .then(r => r.json())
        .then(d => setR2Configured(d.configured))
        .catch(() => setR2Configured(false));
    }
  }, [isOpen]);

  // Profile form state
  const [name, setName] = useState(currentUser.name || '');
  const [username, setUsername] = useState((currentUser.username || '').replace(/^@+/, ''));
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(currentUser.avatar || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || '');
      setUsername((currentUser.username || '').replace(/^@+/, ''));
      setAvatarPreview(currentUser.avatar || '');
      setNewPassword('');
      setProfileError('');
      setProfileSuccess('');
    }
  }, [isOpen, currentUser]);

  // 2FA state
  const [twoFactorEmail, setTwoFactorEmail] = useState(currentUser.email || 'r73006398@gmail.com');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorSuccess, setTwoFactorSuccess] = useState('');
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [customResendKey, setCustomResendKey] = useState(() => {
    try { return localStorage.getItem('cosmo_resend_api_key') || ''; } catch { return ''; }
  });
  const [customSender, setCustomSender] = useState(() => {
    try { return localStorage.getItem('cosmo_resend_sender') || ''; } catch { return ''; }
  });

  // Notification state
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('cosmo_sound_enabled');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // Gifts tab state & synced economy balances (strictly scoped to currentUser.id)
  const readEconomy = () => readUserCatEconomy(currentUser.id);
  const [economy, setEconomy] = useState(readEconomy);
  const [regiftOpenGiftId, setRegiftOpenGiftId] = useState<string | null>(null);
  const [regiftTargetKey, setRegiftTargetKey] = useState<string>('');
  const [regiftNote, setRegiftNote] = useState<string>('');
  const [giftFeedback, setGiftFeedback] = useState<string | null>(null);

  useEffect(() => {
    setEconomy(readUserCatEconomy(currentUser.id));
    if (!isOpen) return;
    const onSync = () => setEconomy(readUserCatEconomy(currentUser.id));
    window.addEventListener('cosmo-cat-economy-updated', onSync);
    return () => window.removeEventListener('cosmo-cat-economy-updated', onSync);
  }, [isOpen, currentUser.id]);

  useEffect(() => {
    if (!regiftTargetKey) {
      const firstOtherUser = allUsers.find(u => u.id !== currentUser.id);
      if (firstOtherUser) {
        setRegiftTargetKey(`user_${firstOtherUser.id}`);
      } else if (allGroups.length > 0) {
        setRegiftTargetKey(`group_${allGroups[0].id}`);
      } else {
        setRegiftTargetKey(`user_${currentUser.id}`);
      }
    }
  }, [allUsers, allGroups, currentUser.id, regiftTargetKey]);

  // Admin delete state
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [isAdminDeleting, setIsAdminDeleting] = useState(false);
  const [adminDeleteSuccess, setAdminDeleteSuccess] = useState(false);

  // Windows .exe download state ("Больше" tab)
  const [exeTargetMode, setExeTargetMode] = useState<'published' | 'current'>('published');
  const [isDownloadingExe, setIsDownloadingExe] = useState(false);
  const [exeDownloadMessage, setExeDownloadMessage] = useState('');
  const [exeDownloadError, setExeDownloadError] = useState('');

  // Android .apk download state ("Больше" tab)
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [apkDownloadMessage, setApkDownloadMessage] = useState('');
  const [apkDownloadError, setApkDownloadError] = useState('');

  const handleDownloadAndroidApk = async () => {
    setIsDownloadingApk(true);
    setApkDownloadMessage('');
    setApkDownloadError('');
    try {
      const url = `/api/download/cosmochat.apk?target=${encodeURIComponent(selectedExeTargetUrl)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Сервер не смог собрать CosmoChat.apk');
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'CosmoChat.apk';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      setApkDownloadMessage('Файл CosmoChat.apk (v2.1) скачан! Установите его на Android устройство.');
    } catch (err: any) {
      setApkDownloadError(err?.message || 'Ошибка при скачивании CosmoChat.apk');
    } finally {
      setIsDownloadingApk(false);
    }
  };

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://cosmochat.ai.studio';
  const publishedUrl = 'https://cosmochat.ai.studio';
  const selectedExeTargetUrl = exeTargetMode === 'current' && currentOrigin ? currentOrigin : publishedUrl;

  const handleDownloadWindowsExe = async () => {
    setIsDownloadingExe(true);
    setExeDownloadMessage('');
    setExeDownloadError('');
    try {
      const url = `/api/download/cosmochat.exe?target=${encodeURIComponent(selectedExeTargetUrl)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Сервер не смог собрать CosmoChat.exe');
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'CosmoChat.exe';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      setExeDownloadMessage('Файл CosmoChat.exe (v2.1) скачан! Запустите его на Windows.');
    } catch (err: any) {
      setExeDownloadError(err?.message || 'Ошибка при скачивании CosmoChat.exe');
    } finally {
      setIsDownloadingExe(false);
    }
  };



  const isAdmin = currentUser.isAdmin || isAdminPhone(currentUser.phone);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 250;
        let width = img.width, height = img.height;
        if (width > height) {
          if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        } else {
          if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarPreview(base64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const cleanName = name.trim();
    const cleanUser = username.trim().replace(/^@+/, '');

    if (!cleanName) {
      setProfileError('Введите имя');
      return;
    }

    if (!cleanUser) {
      setProfileError('Введите username');
      return;
    }

    if (containsProfanity(cleanName)) {
      setProfileError('Название ника с нецензурной лексикой');
      return;
    }

    if (containsProfanity(cleanUser)) {
      setProfileError('Название юзернейма с нецензурной лексикой');
      return;
    }

    if (!isAdmin) {
      const now = Date.now();
      const cooldownTime = 24 * 60 * 60 * 1000;
      const lastChange = currentUser.lastProfileChange || 0;
      if (now - lastChange < cooldownTime) {
        const timeLeft = cooldownTime - (now - lastChange);
        const leftH = Math.floor(timeLeft / (1000 * 60 * 60));
        const leftM = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        setProfileError(`Смена данных доступна раз в 24 часа. Осталось: ${leftH} ч. ${leftM} мин.`);
        return;
      }
    }

    const userCollision = allUsers.find(
      u => u.id !== currentUser.id && normalizeStr(u.username) === normalizeStr(cleanUser)
    );
    if (userCollision) {
      setProfileError('Этот username уже занят другим пользователем');
      return;
    }

    const updates: Partial<UserProfile> = {
      name: cleanName,
      username: cleanUser,
      avatar: avatarPreview,
      lastProfileChange: Date.now()
    };

    if (newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        setProfileError('Пароль должен содержать минимум 4 символа');
        return;
      }
      updates.passwordHash = hashPassword(newPassword.trim());
    }

    onUpdateProfile(updates);
    setProfileSuccess('Профиль успешно обновлён!');
    setTimeout(() => {
      setProfileSuccess('');
      onClose();
    }, 700);
  };

  const handleSend2FACode = async () => {
    setTwoFactorError('');
    setTwoFactorSuccess('');
    const email = twoFactorEmail.trim();
    if (!email || !email.includes('@')) {
      setTwoFactorError('Введите корректный адрес электронной почты');
      return;
    }

    setIsSendingCode(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          customApiKey: customResendKey.trim() || undefined,
          customSender: customSender.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки кода');

      setCodeSent(true);
      setTwoFactorSuccess(data.message || `Код успешно отправлен на ${email}`);
    } catch (err: any) {
      setTwoFactorError(err.message || 'Ошибка соединения с сервером');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerify2FACode = async () => {
    setTwoFactorError('');
    setTwoFactorSuccess('');
    const code = verificationCode.trim();
    if (!code) {
      setTwoFactorError('Введите 6-значный код подтверждения');
      return;
    }

    try {
      const res = await fetch('/api/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: twoFactorEmail.trim(), code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Неверный код');

      onUpdateProfile({
        email: twoFactorEmail.trim(),
        twoFactorEnabled: true
      });
      setTwoFactorSuccess('Двухфакторная защита (2FA) успешно подключена!');
      setCodeSent(false);
      setVerificationCode('');
    } catch (err: any) {
      setTwoFactorError(err.message || 'Неверный код подтверждения');
    }
  };

  const navItems: Array<{ id: typeof activeTab; label: string; icon: React.ComponentType<{ className?: string }>; testId?: string; count?: number }> = [
    { id: 'profile', label: 'Профиль', icon: User },
    { id: 'gifts', label: 'Подарки', icon: Gift, testId: 'settings-tab-gifts', count: ownedGifts.length },
    { id: 'security', label: 'Безопасность и 2FA', icon: Shield },
    { id: 'storage', label: 'Медиа и R2', icon: Cloud },
    { id: 'appearance', label: 'Внешний вид', icon: Palette },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
    { id: 'more', label: 'Больше', icon: MoreHorizontal, testId: 'settings-tab-more' },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Админ-панель', icon: Crown, testId: 'settings-tab-admin' }] : [])
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--cc-bg-app)] border border-[var(--cc-border-strong)] w-full max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row mt-auto sm:my-auto h-[94dvh] sm:h-auto sm:max-h-[92dvh] pb-[env(safe-area-inset-bottom)] sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Settings Navigation Rail */}
        <div className="w-full md:w-60 bg-[var(--cc-bg-rail)] border-b md:border-b-0 md:border-r border-[var(--cc-border)] p-3 sm:p-4 flex flex-col justify-between shrink-0">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 md:mb-5 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] flex items-center justify-center text-[var(--cc-accent-text)] shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--cc-text)]">Настройки</h3>
                  <p className="text-[11px] text-[var(--cc-text-muted)]">Управление аккаунтом</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть настройки"
                className="md:hidden w-10 h-10 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] text-[var(--cc-text-secondary)] flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={item.testId}
                    onClick={() => setActiveTab(item.id)}
                    className={`shrink-0 md:w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs sm:text-[13px] font-medium transition-all cursor-pointer text-left ${
                      isActive
                        ? 'bg-[var(--cc-bg-active-row)] text-[var(--cc-text)] ring-1 ring-[var(--cc-accent)]/35'
                        : 'text-[var(--cc-text-muted)] hover:bg-[var(--cc-bg-surface-hover)]/70 hover:text-[var(--cc-text)]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--cc-accent-text)]' : ''}`} />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span
                        data-testid="profile-gifts-tab-count"
                        className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-[var(--cc-accent-soft)] text-[var(--cc-accent-text)] shrink-0"
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="hidden md:block pt-3 mt-4 border-t border-[var(--cc-border)]">
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] text-[var(--cc-text-secondary)] py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        </div>

        {/* Settings Content Panel */}
        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto bg-[var(--cc-bg-app)]">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} noValidate className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-[var(--cc-border)] bg-[var(--cc-bg-surface)]">
                <div className="h-16 bg-gradient-to-br from-[var(--cc-accent)]/30 via-[var(--cc-bg-surface-elevated)] to-[var(--cc-bg-app)] border-b border-[var(--cc-border)]" />
                <div className="px-4 pb-4 text-center">
                  <div className="relative w-20 h-20 mx-auto -mt-10 mb-2 group">
                    <div className="w-20 h-20 rounded-full bg-[var(--cc-accent)] ring-4 ring-[var(--cc-bg-surface)] border border-[var(--cc-border-strong)] flex items-center justify-center text-3xl font-semibold text-white overflow-hidden shadow-md">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        name[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <label
                      htmlFor="editAvatarFile"
                      className="absolute inset-0 bg-black/70 rounded-full flex flex-col items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Camera className="w-5 h-5 mb-0.5" />
                      <span>Изменить</span>
                    </label>
                    <input
                      type="file"
                      id="editAvatarFile"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFile}
                    />
                  </div>

                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => setAvatarPreview('')}
                      className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Удалить фото
                    </button>
                  )}

                  <h3 className="text-base font-bold text-[var(--cc-text)] mt-1 flex items-center justify-center gap-1.5">
                    <span>{currentUser.name}</span>
                    {isAdmin && <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />}
                  </h3>
                  <div className="text-xs text-[var(--cc-text-muted)] mt-0.5">
                    @{currentUser.username} · {currentUser.phone}
                  </div>
                  <p className={`text-[11px] mt-1 ${isAdmin ? 'text-amber-400 font-medium' : 'text-[var(--cc-text-muted)]'}`}>
                    {isAdmin ? 'Режим Администратора: смена данных без ограничений' : 'Смена данных доступна раз в 24 часа'}
                  </p>

                  {onOpenTelegramProfile && (
                    <button
                      type="button"
                      data-testid="open-my-tg-profile-btn"
                      onClick={() => {
                        onClose();
                        onOpenTelegramProfile();
                      }}
                      className="mt-3 w-full min-h-[42px] py-2 px-3 rounded-xl bg-[var(--cc-accent-soft)] hover:bg-[var(--cc-accent)]/25 border border-[var(--cc-accent)]/40 text-xs font-semibold text-[var(--cc-accent-text)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Открыть витрину профиля</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Summary Strip for Gifts & Cat Coins */}
              <div className="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  data-testid="profile-summary-gifts-btn"
                  onClick={() => setActiveTab('gifts')}
                  className="p-2.5 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] transition-colors cursor-pointer"
                >
                  <div className="text-[11px] text-[var(--cc-text-muted)] flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Подарки в профиле</span>
                  </div>
                  <div className="text-sm font-bold text-[var(--cc-text)] tabular-nums mt-0.5">
                    {ownedGifts.length} {ownedGifts.length === 1 ? 'подарок' : 'подарков'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('gifts')}
                  className="p-2.5 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] transition-colors cursor-pointer"
                >
                  <div className="text-[11px] text-[var(--cc-text-muted)] flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Монеты котика</span>
                  </div>
                  <div
                    data-testid="profile-summary-coins"
                    className="text-sm font-bold text-amber-300 tabular-nums mt-0.5 truncate"
                  >
                    {formatCoinsCount(economy.coins)} 🪙
                  </div>
                </button>
              </div>

              <div>
                <label className="block text-xs text-[var(--cc-text-muted)] mb-1">Имя</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => { setName(e.target.value); setProfileError(''); }}
                  className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2.5 text-[16px] sm:text-sm text-[var(--cc-text)] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--cc-text-muted)] mb-1">Username</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-[var(--cc-text-muted)]">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value.replace(/^@+/, '');
                      setUsername(val);
                      setProfileError('');
                    }}
                    className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl pl-8 pr-3.5 py-2.5 text-[16px] sm:text-sm text-[var(--cc-text)] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[var(--cc-text-muted)] mb-1">
                  Новый пароль (оставьте пустым, если не меняете)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Новый пароль"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setProfileError(''); }}
                    className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl pl-3.5 pr-11 py-2.5 text-[16px] sm:text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Переключить видимость пароля"
                    className="absolute right-2 top-1.5 w-9 h-9 flex items-center justify-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {profileError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 text-center font-medium">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 text-center font-medium flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> {profileSuccess}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
              >
                Сохранить изменения
              </button>
            </form>
          )}

          {activeTab === 'gifts' && (
            <div data-testid="profile-gifts-panel" className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-[var(--cc-text)] flex items-center gap-2">
                    <Gift className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Мои подарки</span>
                  </h3>
                  <p className="text-xs text-[var(--cc-text-muted)] mt-0.5">
                    Передаривайте полученные подарки друзьям или обменивайте их на монеты котика.
                  </p>
                </div>
              </div>

              {/* Balance Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)]">
                  <div className="text-[11px] text-[var(--cc-text-muted)]">Монеты котика</div>
                  <div
                    data-testid="profile-gifts-coins-balance"
                    className="text-sm sm:text-base font-bold text-amber-300 tabular-nums mt-0.5 truncate"
                  >
                    {formatCoinsCount(economy.coins)} 🪙
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)]">
                  <div className="text-[11px] text-[var(--cc-text-muted)]">Звёзды</div>
                  <div
                    data-testid="profile-gifts-stars-balance"
                    className="text-sm sm:text-base font-bold text-yellow-300 tabular-nums mt-0.5"
                  >
                    {economy.stars} ⭐
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-[var(--cc-text-muted)]">В коллекции</div>
                  <div
                    data-testid="profile-gifts-owned-count"
                    className="text-sm sm:text-base font-bold text-[var(--cc-text)] tabular-nums mt-0.5"
                  >
                    {ownedGifts.length} шт.
                  </div>
                </div>
              </div>

              {giftFeedback && (
                <div
                  data-testid="profile-gift-feedback"
                  className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs text-emerald-200 font-medium flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{giftFeedback}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setGiftFeedback(null)}
                    className="text-emerald-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {onCraftGifts && (
                <GiftCraftPanel
                  ownedGifts={ownedGifts}
                  onCraftGifts={onCraftGifts}
                  testIdPrefix="profile"
                  onCrafted={(crafted) => {
                    setGiftFeedback(
                      crafted.giftId === COSMIC_HAMMER_GIFT_ID
                        ? '🔨 Выкован эксклюзивный Космический молот! Его можно подарить другу!'
                        : `Скрафчен подарок ${crafted.emoji} ${crafted.title}!`
                    );
                  }}
                />
              )}

              {ownedGifts.length === 0 ? (
                <div
                  data-testid="profile-gifts-empty"
                  className="p-6 rounded-2xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] text-center space-y-2"
                >
                  <div className="text-4xl">🎁</div>
                  <div className="text-sm font-semibold text-[var(--cc-text)]">Пока нет активных подарков</div>
                  <p className="text-xs text-[var(--cc-text-muted)] max-w-sm mx-auto leading-relaxed">
                    Полученные в чатах подарки (например, Планета Земля 🌍 за {EARTH_GIFT_STARS} ⭐) сразу появятся здесь — их можно передарить, скрафтить 10 в 1 или обменять на монеты!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ownedGifts.map((gift) => {
                    const unsellable = isGiftUnsellable(gift);
                    const coinValue = unsellable ? 0 : (gift.coinValue || getGiftCoinValue(gift.starsCost));
                    const isRegiftExpanded = regiftOpenGiftId === gift.id;
                    const catMeta = getGiftCatalogItem(gift.giftId);

                    return (
                      <div
                        key={gift.id}
                        data-testid="profile-gift-card"
                        className={`p-4 rounded-2xl border space-y-3 ${
                          unsellable
                            ? 'bg-gradient-to-br from-violet-950/60 via-fuchsia-950/40 to-amber-950/35 border-amber-300/65'
                            : 'bg-[var(--cc-bg-surface)] border-[var(--cc-border-strong)]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${catMeta.gradientClass} border border-amber-300/35 flex items-center justify-center text-3xl shrink-0`}>
                            {gift.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-[var(--cc-text)] truncate">{gift.title}</h4>
                              <div className="flex items-center gap-2 text-xs font-semibold tabular-nums shrink-0">
                                {unsellable ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/45 text-[10px] font-bold text-amber-200">
                                    🔨 Реликвия крафта
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-yellow-300">{gift.starsCost} ⭐</span>
                                    <span className="text-[var(--cc-text-muted)]">•</span>
                                    <span className="text-amber-300">{formatCoinsCount(coinValue)} 🪙</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-[var(--cc-text-muted)] mt-0.5 space-y-0.5">
                              <div>
                                От: <span className="text-[var(--cc-text-secondary)] font-medium">{gift.senderName}</span>
                              </div>
                              {gift.regiftedFrom && (
                                <div className="text-[11px] text-purple-300">
                                  Передарил(а): {gift.regiftedFrom}
                                  {gift.originalSenderName && gift.originalSenderName !== gift.regiftedFrom
                                    ? ` (изначально от ${gift.originalSenderName})`
                                    : ''}
                                </div>
                              )}
                            </div>
                            {gift.message && (
                              <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-[var(--cc-bg-app)] border border-[var(--cc-border)] text-xs text-[var(--cc-text-secondary)] italic">
                                «{gift.message}»
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            data-testid="profile-gift-regift-btn"
                            onClick={() => {
                              setRegiftOpenGiftId(isRegiftExpanded ? null : gift.id);
                              setRegiftNote('');
                            }}
                            className="min-h-[40px] px-3 py-2 rounded-xl bg-[var(--cc-accent-soft)] hover:bg-[var(--cc-accent)]/25 border border-[var(--cc-accent)]/40 text-[var(--cc-text)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Repeat className="w-3.5 h-3.5 text-[var(--cc-accent-text)] shrink-0" />
                            <span>{unsellable ? 'Подарить другу' : 'Передарить'}</span>
                          </button>

                          {unsellable ? (
                            <div
                              data-testid="profile-gift-unsellable-badge"
                              className="min-h-[40px] px-3 py-2 rounded-xl bg-black/30 border border-rose-400/30 text-rose-200/90 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              <Lock className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                              <span>Нельзя продать</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              data-testid="profile-gift-exchange-coins-btn"
                              onClick={() => {
                                if (!onExchangeGiftForCoins) return;
                                const res = onExchangeGiftForCoins(gift);
                                if (res) {
                                  setEconomy(prev => ({ ...prev, coins: res.nextCoins }));
                                  setGiftFeedback(
                                    `Подарок «${gift.title}» обменян на +${formatCoinsCount(res.coinsEarned)} 🪙! Баланс: ${formatCoinsCount(res.nextCoins)} 🪙`
                                  );
                                  if (regiftOpenGiftId === gift.id) setRegiftOpenGiftId(null);
                                }
                              }}
                              className="min-h-[40px] px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer tabular-nums whitespace-nowrap"
                            >
                              <Coins className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                              <span>Обменять (+{formatCoinsCount(coinValue)} 🪙)</span>
                            </button>
                          )}
                        </div>

                        {isRegiftExpanded && (
                          <div
                            data-testid="profile-gift-regift-form"
                            className="p-3 rounded-xl bg-[var(--cc-bg-app)] border border-[var(--cc-border)] space-y-2.5"
                          >
                            <div>
                              <label className="block text-[11px] font-medium text-[var(--cc-text-muted)] mb-1">
                                Кому передарить:
                              </label>
                              <select
                                data-testid="profile-gift-regift-select"
                                value={regiftTargetKey}
                                onChange={(e) => setRegiftTargetKey(e.target.value)}
                                className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-xl px-3 py-2 text-[16px] sm:text-xs text-[var(--cc-text)] focus:outline-none focus:border-[var(--cc-accent)]"
                              >
                                {allUsers.length > 0 && (
                                  <optgroup label="Пользователи">
                                    {allUsers.map(u => (
                                      <option key={`user_${u.id}`} value={`user_${u.id}`}>
                                        {u.id === currentUser.id ? `⭐ Избранное (${u.name})` : `👤 ${u.name} (@${u.username})`}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {allGroups.length > 0 && (
                                  <optgroup label="Группы">
                                    {allGroups.map(g => (
                                      <option key={`group_${g.id}`} value={`group_${g.id}`}>
                                        👥 {g.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-[var(--cc-text-muted)] mb-1">
                                Подпись (необязательно):
                              </label>
                              <input
                                type="text"
                                data-testid="profile-gift-regift-note"
                                value={regiftNote}
                                onChange={(e) => setRegiftNote(e.target.value)}
                                placeholder="Передариваю с теплом! ✨"
                                maxLength={120}
                                className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-xl px-3 py-2 text-[16px] sm:text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none focus:border-[var(--cc-accent)]"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setRegiftOpenGiftId(null)}
                                className="px-3 py-1.5 rounded-lg bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] text-xs text-[var(--cc-text-secondary)] cursor-pointer"
                              >
                                Отмена
                              </button>
                              <button
                                type="button"
                                data-testid="profile-gift-regift-confirm-btn"
                                onClick={() => {
                                  if (!onRegiftGift || !regiftTargetKey) return;
                                  const target = regiftTargetKey.startsWith('group_')
                                    ? { groupId: regiftTargetKey.replace('group_', '') }
                                    : { receiverId: regiftTargetKey.replace('user_', '') };
                                  const ok = onRegiftGift(gift, target, regiftNote);
                                  if (ok) {
                                    setRegiftOpenGiftId(null);
                                    setRegiftNote('');
                                    setGiftFeedback(`Подарок «${gift.title}» передарен в выбранный чат!`);
                                  }
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Отправить</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--cc-text)] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--cc-accent-text)]" />
                <span>Двухфакторная аутентификация (2FA)</span>
              </h3>
              <p className="text-xs text-[var(--cc-text-muted)] leading-relaxed">
                Защитите ваш аккаунт. Одноразовый 6-значный код отправляется через защищённый сервер на указанную почту.
              </p>

              <div className="p-4 bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-2xl space-y-3">
                {currentUser.twoFactorEnabled ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> 2FA Активна
                      </div>
                      <div className="text-[11px] text-[var(--cc-text-muted)] mt-0.5">
                        Привязана к почте: {currentUser.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateProfile({ twoFactorEnabled: false })}
                      className="px-3 py-1.5 rounded-lg bg-[var(--cc-bg-surface-elevated)] hover:bg-[var(--cc-bg-surface-hover)] text-red-400 text-xs font-medium transition-colors cursor-pointer border border-[var(--cc-border)]"
                    >
                      Отключить
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-[var(--cc-text-muted)] mb-1">Email для двухфакторной защиты</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={twoFactorEmail}
                        onChange={(e) => { setTwoFactorEmail(e.target.value); setTwoFactorError(''); }}
                        placeholder="user@example.com"
                        className="flex-1 bg-[var(--cc-bg-app)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2.5 sm:py-2 text-[16px] sm:text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isSendingCode}
                        onClick={handleSend2FACode}
                        className="px-4 py-2.5 sm:py-2 bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shrink-0"
                      >
                        {isSendingCode ? 'Отправка...' : 'Отправить код'}
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-[var(--cc-text-muted)]">
                      Отправка писем через Resend test-домен работает на адрес владельца <span className="text-[var(--cc-accent-text)] font-mono">r73006398@gmail.com</span>.
                    </div>

                    {twoFactorSuccess && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                        {twoFactorSuccess}
                      </div>
                    )}

                    {codeSent && (
                      <div className="mt-3 space-y-2">
                        <label className="block text-xs text-[var(--cc-text-muted)]">Введите 6 цифр из письма</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(e) => { setVerificationCode(e.target.value); setTwoFactorError(''); }}
                          placeholder="______"
                          className="w-full bg-[var(--cc-bg-app)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2 text-base text-[var(--cc-text)] text-center font-mono tracking-widest placeholder:text-[var(--cc-text-muted)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleVerify2FACode}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Подтвердить и включить 2FA
                        </button>
                      </div>
                    )}

                    {twoFactorError && (
                      <div className="text-xs text-red-400 mt-2 font-medium">{twoFactorError}</div>
                    )}

                    <div className="mt-4 pt-3 border-t border-[var(--cc-border)]">
                      <button
                        type="button"
                        onClick={() => setShowEmailSettings(!showEmailSettings)}
                        className="text-[11px] text-[var(--cc-accent-text)] hover:underline cursor-pointer"
                      >
                        {showEmailSettings ? 'Скрыть параметры шлюза Resend' : 'Настроить свой ключ или домен Resend'}
                      </button>

                      {showEmailSettings && (
                        <div className="mt-3 p-3 bg-[var(--cc-bg-app)] rounded-xl border border-[var(--cc-border)] space-y-2.5">
                          <div>
                            <label className="block text-[11px] text-[var(--cc-text-muted)] mb-1">Свой Resend API Key (опционально)</label>
                            <input
                              type="password"
                              placeholder="re_..."
                              value={customResendKey}
                              onChange={(e) => {
                                setCustomResendKey(e.target.value);
                                localStorage.setItem('cosmo_resend_api_key', e.target.value);
                              }}
                              className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--cc-text)] font-mono placeholder:text-[var(--cc-text-muted)] focus:outline-none focus:border-[var(--cc-accent)]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-[var(--cc-text-muted)] mb-1">Отправитель From (например: Cosmo &lt;hello@yourdomain.com&gt;)</label>
                            <input
                              type="text"
                              placeholder="CosmoChat <onboarding@resend.dev>"
                              value={customSender}
                              onChange={(e) => {
                                setCustomSender(e.target.value);
                                localStorage.setItem('cosmo_resend_sender', e.target.value);
                              }}
                              className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none focus:border-[var(--cc-accent)]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {isAdminPhone(currentUser.phone) && (
                <div className="p-4 bg-[var(--cc-bg-surface)] border border-red-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--cc-text)]">Панель администратора</h4>
                      <p className="text-[11px] text-[var(--cc-text-muted)]">Управление базой данных номеров</p>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--cc-text-secondary)]">
                    Удаление всех остальных номеров и профилей из базы данных Firebase. Номера администраторов останутся в системе.
                  </p>

                  {adminDeleteSuccess && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-medium">
                      Все сторонние номера успешно удалены из базы!
                    </div>
                  )}

                  {showAdminConfirm ? (
                    <div className="p-3 bg-red-950/50 border border-red-500/35 rounded-xl space-y-2">
                      <p className="text-xs text-red-200 font-medium">
                        Вы уверены? Это действие удалит всех пользователей, кроме вашего номера админа.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isAdminDeleting}
                          onClick={async () => {
                            setIsAdminDeleting(true);
                            try {
                              await onDeleteAllNumbers?.();
                              setAdminDeleteSuccess(true);
                              setTimeout(() => {
                                setShowAdminConfirm(false);
                                setAdminDeleteSuccess(false);
                                setIsAdminDeleting(false);
                              }, 1500);
                            } catch {
                              setIsAdminDeleting(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {isAdminDeleting ? 'Удаление...' : 'Да, точно удалить'}
                        </button>
                        <button
                          type="button"
                          disabled={isAdminDeleting}
                          onClick={() => setShowAdminConfirm(false)}
                          className="px-3 py-1.5 rounded-lg bg-[var(--cc-bg-surface-elevated)] hover:bg-[var(--cc-bg-surface-hover)] text-[var(--cc-text-secondary)] text-xs font-medium cursor-pointer transition-colors"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAdminDeleteSuccess(false);
                        setShowAdminConfirm(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Удалить все номера
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--cc-text)] flex items-center gap-2">
                <Cloud className="w-4 h-4 text-orange-400" />
                <span>Хранилище медиафайлов (Cloudflare R2)</span>
              </h3>
              <p className="text-xs text-[var(--cc-text-secondary)] leading-relaxed">
                CosmoChat поддерживает отправку <strong>фотографий</strong> и <strong>видеороликов</strong> через объектное хранилище Cloudflare R2 (S3-совместимое с нулевой платой за исходящий трафик).
              </p>

              <div className="p-4 bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-[var(--cc-accent-text)]" />
                    <span className="text-xs font-semibold text-[var(--cc-text)]">Статус хранилища</span>
                  </div>
                  <span className={`text-xs font-medium ${r2Configured ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {r2Configured ? 'Cloudflare R2 подключён' : 'Локальный режим (резервный)'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--cc-text-muted)] leading-relaxed">
                  {r2Configured
                    ? 'Все медиафайлы автоматически загружаются в ваш бакет Cloudflare R2 и транслируются через CDN.'
                    : 'В данный момент медиа сохраняются на сервере. Чтобы подключить ваш личный R2 бакет, добавьте переменные R2_* в настройки окружения.'}
                </p>
              </div>

              {onOpenR2Guide && (
                <button
                  type="button"
                  onClick={onOpenR2Guide}
                  className="w-full py-2.5 px-4 bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Cloud className="w-4 h-4" />
                  <span>Открыть инструкцию по подключению Cloudflare R2</span>
                </button>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--cc-text)] flex items-center gap-2">
                <Palette className="w-4 h-4 text-[var(--cc-accent-text)]" />
                <span>Внешний вид</span>
              </h3>
              <p className="text-xs text-[var(--cc-text-muted)] leading-relaxed">
                Выберите тему оформления мессенджера. Темы также переключаются через терминал (<code className="bg-[var(--cc-bg-surface)] px-1.5 py-0.5 rounded text-[var(--cc-accent-text)]">/</code> → <code className="bg-[var(--cc-bg-surface)] px-1.5 py-0.5 rounded text-[var(--cc-accent-text)]">wave</code> или <code className="bg-[var(--cc-bg-surface)] px-1.5 py-0.5 rounded text-amber-300">cofe</code>).
              </p>

              <div className="space-y-2.5">
                {[
                  {
                    id: 'default' as AppTheme,
                    title: 'Обсидиан (Cosmo Midnight)',
                    description: 'Чистая тёмная палитра с нейтральными поверхностями и синими акцентами',
                    icon: Sparkles,
                    iconBg: 'bg-blue-500/15 text-blue-400 border-blue-500/35',
                    swatches: ['#0b0d11', '#171a21', '#3b82f6']
                  },
                  {
                    id: 'wave' as AppTheme,
                    title: 'Волна (Ocean Wave)',
                    description: 'Глубокая морская лазурь, аквамарин и бирюзовые акценты',
                    icon: Waves,
                    iconBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/35',
                    swatches: ['#04131c', '#0b2636', '#06b6d4']
                  },
                  {
                    id: 'cofe' as AppTheme,
                    title: 'Кофе (Espresso & Caramel)',
                    description: 'Тёплая палитра: эспрессо, тёмный шоколад и янтарные акценты',
                    icon: Coffee,
                    iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/35',
                    swatches: ['#120c08', '#22160f', '#d97706']
                  }
                ].map(theme => {
                  const Icon = theme.icon;
                  const isActive = currentTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => onThemeChange?.(theme.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 focus:outline-none ${
                        isActive
                          ? 'bg-[var(--cc-bg-active-row)] border-[var(--cc-accent)]/60 ring-1 ring-[var(--cc-accent)]/30'
                          : 'bg-[var(--cc-bg-surface)] border-[var(--cc-border)] ring-0 hover:bg-[var(--cc-bg-surface-hover)]'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${theme.iconBg}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--cc-text)]">{theme.title}</span>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                              <Check className="w-3 h-3" /> Активна
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--cc-text-muted)] mt-0.5 leading-snug">{theme.description}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {theme.swatches.map((hex, i) => (
                          <span
                            key={i}
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--cc-text)] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--cc-accent-text)]" />
                <span>Уведомления</span>
              </h3>
              <div className="p-4 bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--cc-text)]">Звуки и оповещения</div>
                  <div className="text-[11px] text-[var(--cc-text-muted)] mt-0.5">Сигнал при получении нового входящего сообщения</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    try { localStorage.setItem('cosmo_sound_enabled', String(next)); } catch {}
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                    soundEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-[var(--cc-bg-surface-elevated)] text-[var(--cc-text-muted)] border-[var(--cc-border)]'
                  }`}
                >
                  {soundEnabled ? 'Включено' : 'Выключено'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--cc-text)] flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                    Панель администратора
                  </h4>
                  <p className="text-xs text-[var(--cc-text-muted)] mt-0.5">
                    Выдача галочки верификации (как в Telegram) и блокировка аккаунтов
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)]">
                  <div className="text-base font-bold text-[var(--cc-text)]">{allUsers.length}</div>
                  <div className="text-[11px] text-[var(--cc-text-muted)]">Всего</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)]">
                  <div className="text-base font-bold text-sky-400">{allUsers.filter(u => u.isVerified).length}</div>
                  <div className="text-[11px] text-[var(--cc-text-muted)]">С галочкой</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)]">
                  <div className="text-base font-bold text-rose-400">{allUsers.filter(u => u.isBanned).length}</div>
                  <div className="text-[11px] text-[var(--cc-text-muted)]">Заблокировано</div>
                </div>
              </div>

              <input
                type="text"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                placeholder="Поиск по имени, @username или телефону..."
                className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2 text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none"
              />

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {allUsers
                  .filter(u => {
                    const q = adminSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      u.name?.toLowerCase().includes(q) ||
                      u.username?.toLowerCase().includes(q) ||
                      u.phone?.toLowerCase().includes(q)
                    );
                  })
                  .map(u => {
                    const isSelf = u.id === currentUser.id;
                    return (
                      <div
                        key={u.id}
                        data-testid={`admin-user-row-${u.id}`}
                        className="p-3 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[var(--cc-accent-soft)] flex items-center justify-center text-xs font-bold text-[var(--cc-accent-text)] shrink-0 overflow-hidden">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              u.name?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--cc-text)] flex items-center gap-1.5 flex-wrap">
                              <span className="truncate max-w-[140px]">{u.name}</span>
                              {u.isVerified && <VerifiedBadge className="w-3.5 h-3.5" />}
                              {u.isAdmin && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px]">Админ</span>
                              )}
                              {u.isBanned && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 text-[10px]">Заблокирован</span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--cc-text-muted)] truncate">
                              @{u.username} · {u.phone}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onAdminUpdateUser?.(u.id, { isVerified: !u.isVerified })}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                              u.isVerified
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/35 hover:bg-sky-500/30'
                                : 'bg-[var(--cc-bg-surface-elevated)] text-[var(--cc-text)] border border-[var(--cc-border)] hover:border-sky-400/50'
                            }`}
                          >
                            {u.isVerified ? 'Убрать галочку' : 'Дать галочку'}
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => onAdminUpdateUser?.(u.id, { isBanned: !u.isBanned })}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                u.isBanned
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                              }`}
                            >
                              {u.isBanned ? 'Разблокировать' : 'Заблокировать'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === 'more' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--cc-text)] flex items-center gap-2">
                <MoreHorizontal className="w-4 h-4 text-[var(--cc-accent-text)]" />
                <span>Больше</span>
              </h3>
              <p className="text-xs text-[var(--cc-text-muted)]">
                Дополнительные инструменты и приложение CosmoChat для рабочего стола Windows.
              </p>

              <div
                data-testid="exe-download-card"
                className="p-4 bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-2xl space-y-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src="/pwa-192x192.png"
                      alt="CosmoChat Windows"
                      className="w-9 h-9 rounded-lg object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <h4 className="text-sm font-semibold text-[var(--cc-text)]">CosmoChat для Windows</h4>
                      <span className="text-[11px] font-mono font-medium text-[var(--cc-accent-text)]">
                        CosmoChat.exe • v2.1 • x64
                      </span>
                    </div>
                    <p className="text-xs text-[var(--cc-text-muted)] mt-1 leading-relaxed">
                      Обновлённый автономный <code className="bg-[var(--cc-bg-app)] px-1 py-0.5 rounded text-[var(--cc-accent-text)]">.exe</code> v2.1: новый дизайн интерфейса мессенджера, встроенные метаданные Windows, запуск в новом окне Edge / Chrome / Brave без вкладок и резервный переход в браузер по умолчанию.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-[var(--cc-text-muted)]">Адрес подключения в .exe:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExeTargetMode('published')}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        exeTargetMode === 'published'
                          ? 'bg-[var(--cc-bg-active-row)] border-[var(--cc-accent)]/60 text-[var(--cc-text)]'
                          : 'bg-[var(--cc-bg-app)] border-[var(--cc-border)] text-[var(--cc-text-secondary)] hover:border-[var(--cc-border-strong)]'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-[var(--cc-accent-text)] shrink-0" />
                        <span>cosmochat.ai.studio</span>
                      </div>
                      <div className="text-[10px] text-[var(--cc-text-muted)] mt-0.5">
                        Работает всегда, даже если AI Studio закрыт
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExeTargetMode('current')}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        exeTargetMode === 'current'
                          ? 'bg-[var(--cc-bg-active-row)] border-[var(--cc-accent)]/60 text-[var(--cc-text)]'
                          : 'bg-[var(--cc-bg-app)] border-[var(--cc-border)] text-[var(--cc-text-secondary)] hover:border-[var(--cc-border-strong)]'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Текущий адрес</span>
                      </div>
                      <div className="text-[10px] text-[var(--cc-text-muted)] mt-0.5 truncate" title={currentOrigin}>
                        {currentOrigin.replace(/^https?:\/\//, '')}
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="download-exe-btn"
                  disabled={isDownloadingExe}
                  onClick={handleDownloadWindowsExe}
                  className="w-full py-2.5 px-4 bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>{isDownloadingExe ? 'Подготовка CosmoChat.exe...' : 'Скачать CosmoChat.exe'}</span>
                </button>

                {exeDownloadMessage && (
                  <div
                    data-testid="exe-download-success"
                    className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{exeDownloadMessage}</span>
                  </div>
                )}

                {exeDownloadError && (
                  <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
                    {exeDownloadError}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-[var(--cc-bg-app)] border border-[var(--cc-border)] flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--cc-text-muted)] leading-relaxed">
                    При первом запуске на Windows фильтр SmartScreen может предупредить о новом неподписанном файле — нажмите <strong>«Подробнее»</strong> → <strong>«Выполнить в любом случае»</strong>.
                  </p>
                </div>
              </div>

              <div
                data-testid="apk-download-card"
                className="p-4 bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-2xl space-y-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 overflow-hidden text-emerald-400">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <h4 className="text-sm font-semibold text-[var(--cc-text)]">CosmoChat для Android</h4>
                      <span className="text-[11px] font-mono font-medium text-emerald-400">
                        {isInstalled ? 'Установлено' : 'PWA / На главный экран'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--cc-text-muted)] mt-1 leading-relaxed">
                      Android блокирует установку сторонних распакованных ZIP-файлов (ошибка <em>«Не удалось обработать пакет»</em>). Самый надежный и официальный способ поставить CosmoChat на Android — через браузер Chrome: нажмите меню <strong>(⋮)</strong> → <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>. Приложение мгновенно появится на рабочем столе как нативное!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="download-apk-btn"
                  disabled={isDownloadingApk}
                  onClick={handleDownloadAndroidApk}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>{isDownloadingApk ? 'Сборка CosmoChat.apk...' : 'Скачать CosmoChat.apk'}</span>
                </button>

                {apkDownloadMessage && (
                  <div
                    data-testid="apk-download-success"
                    className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{apkDownloadMessage}</span>
                  </div>
                )}

                {apkDownloadError && (
                  <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
                    {apkDownloadError}
                  </div>
                )}

                {isInstallable && !isInstalled && (
                  <button
                    type="button"
                    onClick={async () => {
                      await install();
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Установить CosmoChat на устройство</span>
                  </button>
                )}

                {isInstalled && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>CosmoChat уже установлено на вашем устройстве!</span>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-[var(--cc-bg-app)] border border-[var(--cc-border)] space-y-1.5">
                  <div className="text-xs font-semibold text-[var(--cc-text)] flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Инструкция для Android (Chrome / Яндекс):</span>
                  </div>
                  <ol className="text-[11px] text-[var(--cc-text-muted)] list-decimal list-inside space-y-1 leading-relaxed">
                    <li>Откройте меню браузера в правом верхнем углу <strong>(⋮)</strong>.</li>
                    <li>Выберите пункт <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.</li>
                    <li>Подтвердите — иконка CosmoChat появится на экране вашего смартфона.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
