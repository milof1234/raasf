import React, { useState, useEffect, useMemo } from 'react';
import { VerifiedBadge } from './VerifiedBadge';
import {
  X,
  MessageCircle,
  Gift,
  Copy,
  Check,
  Crown,
  VolumeX,
  Volume2,
  Bookmark,
  Edit2,
  AtSign,
  Phone,
  Image as ImageIcon,
  Users,
  Repeat,
  Coins,
  Send,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Lock
} from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { GroupChat, MessageItem, OwnedGift, ProfileEmojiStatusId, UserProfile } from '../types/chat';
import { formatLastSeen, isAdminPhone } from '../utils/security';
import {
  ADMIN_INITIAL_COINS,
  CAT_STORAGE_KEYS,
  COINS_PER_STAR,
  EARTH_GIFT_STARS,
  exchangeCoinsForStar,
  exchangeCoinsForStarsBatch,
  formatCoinsCount,
  getGiftCoinValue,
  getUserCatStorageKey,
  readUserCatEconomy,
  spendStarsForEarthGift
} from '../utils/catGameLogic';
import {
  ClaimedGiftStatus,
  getSharedGroupsForUser,
  getSharedMediaForUser,
  resolveUserProfileGifts
} from '../utils/profileGifts';

import {
  COSMIC_HAMMER_GIFT_ID,
  GIFT_CATALOG,
  PROFILE_BANNER_CATALOG,
  getGiftCatalogItem,
  getProfileBannerItem,
  isGiftUnsellable,
  spendStarsAmount
} from '../utils/giftCatalog';
import {
  EMOJI_STATUS_CATALOG,
  getEmojiStatusItem
} from '../utils/cosmoFeatures';
import { GiftCraftPanel } from './GiftCraftPanel';

interface TelegramProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfile | null;
  currentUser: UserProfile;
  allUsers: Record<string, UserProfile>;
  allGroups: GroupChat[];
  messages: MessageItem[];
  deletedMsgsMap: Record<string, boolean>;
  ownGifts?: OwnedGift[];
  ownClaimedStatuses?: Record<string, ClaimedGiftStatus>;
  onSelectUserProfile: (user: UserProfile) => void;
  onStartChat: (user: UserProfile) => void;
  onSelectGroup: (group: GroupChat) => void;
  onOpenSettings?: () => void;
  onOpenLightbox: (url: string) => void;
  onToggleMuteUser?: (userId: string) => void;
  onSendGift?: (
    gift: { giftId: string; title: string; emoji: string; starsCost: number; message?: string },
    target?: { receiverId?: string; groupId?: string }
  ) => void;
  onRegiftGift?: (
    ownedGift: OwnedGift,
    target: { receiverId?: string; groupId?: string },
    note?: string
  ) => boolean;
  onExchangeGiftForCoins?: (ownedGift: OwnedGift) => { coinsEarned: number; nextCoins: number } | null;
  onTogglePinGift?: (giftId: string) => void;
  onSelectProfileBanner?: (bannerId: 'default' | 'aurora' | 'galaxy' | 'sunset') => void;
  onUnlockProfileBanner?: (bannerId: 'default' | 'aurora' | 'galaxy' | 'sunset') => void;
  onSelectEmojiStatus?: (statusId: ProfileEmojiStatusId) => void;
  onUnlockEmojiStatus?: (statusId: ProfileEmojiStatusId) => void;
  onCraftGifts?: (ingredients: OwnedGift[], mode: 'next_tier' | 'holo') => OwnedGift | null;
  onProposeGiftTrade?: (
    targetUser: UserProfile,
    targetGift: OwnedGift,
    offeredGift: OwnedGift,
    note?: string
  ) => boolean;
}

export const TelegramProfileModal: React.FC<TelegramProfileModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  allUsers,
  allGroups,
  messages,
  deletedMsgsMap,
  ownGifts = [],
  ownClaimedStatuses = {},
  onSelectUserProfile,
  onStartChat,
  onSelectGroup,
  onOpenSettings,
  onOpenLightbox,
  onToggleMuteUser,
  onSendGift,
  onRegiftGift,
  onExchangeGiftForCoins,
  onTogglePinGift,
  onSelectProfileBanner,
  onUnlockProfileBanner,
  onSelectEmojiStatus,
  onUnlockEmojiStatus,
  onCraftGifts,
  onProposeGiftTrade
}) => {
  const [activeTab, setActiveTab] = useState<'gifts' | 'media' | 'groups'>('gifts');
  const [copiedField, setCopiedField] = useState<'username' | 'phone' | null>(null);
  const [targetGiftsRaw, setTargetGiftsRaw] = useState<Record<string, OwnedGift>>({});
  const [targetClaimedRaw, setTargetClaimedRaw] = useState<Record<string, ClaimedGiftStatus>>({});
  const [isLoadingGifts, setIsLoadingGifts] = useState(false);

  // Selected gift for Cosmo profile gift detail sheet
  const [selectedGift, setSelectedGift] = useState<OwnedGift | null>(null);
  const [regiftTargetKey, setRegiftTargetKey] = useState('');
  const [regiftNote, setRegiftNote] = useState('');
  const [showRegiftForm, setShowRegiftForm] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [tradeOfferedGiftId, setTradeOfferedGiftId] = useState('');
  const [tradeNote, setTradeNote] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Inline "Send Gift" drawer inside target user's profile
  const [isSendGiftOpen, setIsSendGiftOpen] = useState(false);
  const [selectedCatalogGiftId, setSelectedCatalogGiftId] = useState<string>('earth_planet');
  const [sendGiftNote, setSendGiftNote] = useState('');
  const [isBannerShopOpen, setIsBannerShopOpen] = useState(false);

  const readEconomy = () => readUserCatEconomy(currentUser.id);
  const [economy, setEconomy] = useState(readEconomy);

  useEffect(() => {
    setEconomy(readUserCatEconomy(currentUser.id));
    if (!isOpen) return;
    const onSync = () => setEconomy(readUserCatEconomy(currentUser.id));
    window.addEventListener('cosmo-cat-economy-updated', onSync);
    return () => window.removeEventListener('cosmo-cat-economy-updated', onSync);
  }, [isOpen, isSendGiftOpen, currentUser.id]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedGift(null);
      setIsSendGiftOpen(false);
      setShowRegiftForm(false);
      setShowTradeForm(false);
      setFeedbackNotice(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedGift(null);
    setShowRegiftForm(false);
    setShowTradeForm(false);
    setIsSendGiftOpen(false);
    setActiveTab('gifts');
  }, [targetUser?.id]);

  useEffect(() => {
    if (!tradeOfferedGiftId && ownGifts.length > 0) {
      setTradeOfferedGiftId(ownGifts[0].id);
    }
  }, [ownGifts, tradeOfferedGiftId]);

  // Subscribe to target user's gifts & claimed gift statuses in Firebase (or localStorage cache)
  useEffect(() => {
    if (!isOpen || !targetUser) return;

    if (targetUser.id === currentUser.id) {
      setTargetGiftsRaw({});
      setTargetClaimedRaw({});
      setIsLoadingGifts(false);
      return;
    }

    // Seed from local cache immediately if available
    const readLocalTargetGifts = () => {
      try {
        const cachedG = localStorage.getItem(`cosmo_user_gifts_${targetUser.id}`);
        const parsedG = cachedG ? JSON.parse(cachedG) : {};
        setTargetGiftsRaw(parsedG && typeof parsedG === 'object' && !Array.isArray(parsedG) ? parsedG : {});
      } catch {
        setTargetGiftsRaw({});
      }
    };
    readLocalTargetGifts();

    const onLocalGiftUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ userId?: string }>).detail;
      if (!detail?.userId || detail.userId === targetUser.id) {
        readLocalTargetGifts();
      }
    };
    window.addEventListener('cosmo-user-gifts-updated', onLocalGiftUpdated);

    try {
      const cachedC = localStorage.getItem(`cosmo_claimed_gifts_${targetUser.id}`);
      const parsedC = cachedC ? JSON.parse(cachedC) : {};
      setTargetClaimedRaw(parsedC && typeof parsedC === 'object' && !Array.isArray(parsedC) ? parsedC : {});
    } catch {
      setTargetClaimedRaw({});
    }

    if (!db) {
      setIsLoadingGifts(false);
      return () => {
        window.removeEventListener('cosmo-user-gifts-updated', onLocalGiftUpdated);
      };
    }

    setIsLoadingGifts(true);
    let gotG = false;
    let gotC = false;
    const checkDone = () => {
      if (gotG && gotC) setIsLoadingGifts(false);
    };

    const unsubG = onValue(
      ref(db, `users/__gifts__/${targetUser.id}`),
      (snap) => {
        const val = snap.val();
        if (val && typeof val === 'object') {
          const clean: Record<string, OwnedGift> = {};
          Object.entries(val).forEach(([k, v]: [string, any]) => {
            if (v && typeof v === 'object' && v.id && v.title && v.emoji) {
              clean[k] = v as OwnedGift;
            }
          });
          setTargetGiftsRaw(clean);
        } else {
          setTargetGiftsRaw({});
        }
        gotG = true;
        checkDone();
      },
      () => {
        gotG = true;
        checkDone();
      }
    );

    const unsubC = onValue(
      ref(db, `users/__claimed_gifts__/${targetUser.id}`),
      (snap) => {
        const val = snap.val();
        setTargetClaimedRaw(val && typeof val === 'object' ? val : {});
        gotC = true;
        checkDone();
      },
      () => {
        gotC = true;
        checkDone();
      }
    );

    return () => {
      window.removeEventListener('cosmo-user-gifts-updated', onLocalGiftUpdated);
      unsubG();
      unsubC();
    };
  }, [isOpen, targetUser?.id, currentUser.id]);

  useEffect(() => {
    if (!regiftTargetKey) {
      const other = Object.values(allUsers).find(u => u.id !== currentUser.id);
      if (other) setRegiftTargetKey(`user_${other.id}`);
      else if (allGroups.length > 0) setRegiftTargetKey(`group_${allGroups[0].id}`);
      else setRegiftTargetKey(`user_${currentUser.id}`);
    }
  }, [allUsers, allGroups, currentUser.id, regiftTargetKey]);

  const resolvedUser = targetUser ? allUsers[targetUser.id] || targetUser : null;
  const isSelf = Boolean(resolvedUser && resolvedUser.id === currentUser.id);
  const pinnedIds = resolvedUser?.pinnedGiftIds || [];

  const profileGifts = useMemo(() => {
    if (!resolvedUser) return [];
    const list = resolveUserProfileGifts({
      targetUserId: resolvedUser.id,
      firebaseOwnedGifts: isSelf ? ownGifts : targetGiftsRaw,
      claimedStatuses: isSelf ? ownClaimedStatuses : targetClaimedRaw,
      messages,
      deletedMsgsMap,
      usersMap: allUsers
    });
    const pinnedSet = new Set(resolvedUser.pinnedGiftIds || []);
    return list.slice().sort((a, b) => {
      const ap = pinnedSet.has(a.id) ? 1 : 0;
      const bp = pinnedSet.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return b.receivedAt - a.receivedAt;
    });
  }, [resolvedUser, isSelf, ownGifts, ownClaimedStatuses, targetGiftsRaw, targetClaimedRaw, messages, deletedMsgsMap, allUsers]);

  const sharedMedia = useMemo(() => {
    if (!resolvedUser) return [];
    return getSharedMediaForUser({
      currentUserId: currentUser.id,
      targetUserId: resolvedUser.id,
      messages,
      deletedMsgsMap
    });
  }, [currentUser.id, resolvedUser, messages, deletedMsgsMap]);

  const sharedGroups = useMemo(() => {
    if (!resolvedUser) return [];
    return getSharedGroupsForUser({
      currentUserId: currentUser.id,
      targetUserId: resolvedUser.id,
      groups: allGroups
    });
  }, [currentUser.id, resolvedUser, allGroups]);

  const tradeableOwnGifts = useMemo(
    () => ownGifts.filter(g => !isGiftUnsellable(g)),
    [ownGifts]
  );

  if (!isOpen || !resolvedUser) return null;

  const lastSeenInfo = formatLastSeen(resolvedUser.lastSeen, resolvedUser.isOnline);
  const canSendGiftToTarget = Boolean(onSendGift) && !currentUser.isMuted;

  const handleCopy = (field: 'username' | 'phone', value: string) => {
    try {
      navigator.clipboard?.writeText(value).catch(() => {});
    } catch {}
    setCopiedField(field);
    setTimeout(() => setCopiedField(prev => (prev === field ? null : prev)), 1800);
  };

  const handleExchangeStars = (count = 1) => {
    const isTargetAdmin = isAdminPhone(currentUser.phone);
    const res = count === 1
      ? exchangeCoinsForStar(economy.coins, economy.stars)
      : exchangeCoinsForStarsBatch(economy.coins, economy.stars, count);
    if (!res.exchanged && !isTargetAdmin) return;
    const finalNextCoins = isTargetAdmin ? ADMIN_INITIAL_COINS : res.nextCoins;
    const finalNextStars = res.exchanged ? res.nextStars : economy.stars + count;
    try {
      localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUser.id), String(finalNextCoins));
      localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.stars, currentUser.id), String(finalNextStars));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'telegram_profile' } }));
    } catch {}
    setEconomy(prev => ({ ...prev, coins: finalNextCoins, stars: finalNextStars }));
  };

  const chosenCatalogGift = getGiftCatalogItem(selectedCatalogGiftId);
  const activeBanner = getProfileBannerItem(resolvedUser.profileBannerId);
  const unlockedBannersSet = new Set<string>(['default', ...(currentUser.unlockedBanners || [])]);
  const unlockedStatusesSet = new Set<string>(['none', ...(currentUser.unlockedStatuses || [])]);
  const resolvedEmojiStatus = getEmojiStatusItem(resolvedUser.emojiStatus);

  const handleConfirmSendSelectedGift = () => {
    if (!onSendGift || currentUser.isMuted) return;
    const spend = spendStarsAmount(economy.stars, chosenCatalogGift.starsCost);
    if (!spend.purchased) return;
    try {
      localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.stars, currentUser.id), String(spend.nextStars));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'telegram_profile' } }));
    } catch {}
    setEconomy(prev => ({ ...prev, stars: spend.nextStars }));

    const note = sendGiftNote.trim();
    const payload: { giftId: string; title: string; emoji: string; starsCost: number; message?: string } = {
      giftId: chosenCatalogGift.giftId,
      title: chosenCatalogGift.title,
      emoji: chosenCatalogGift.emoji,
      starsCost: chosenCatalogGift.starsCost
    };
    if (note) payload.message = note;

    onSendGift(payload, { receiverId: resolvedUser.id });
    setSendGiftNote('');
    setIsSendGiftOpen(false);
    setActiveTab('gifts');
    setFeedbackNotice(`Подарок «${chosenCatalogGift.title}» ${chosenCatalogGift.emoji} отправлен пользователю ${resolvedUser.name}!`);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const handleBuyOrEquipBanner = (bannerId: 'default' | 'aurora' | 'galaxy' | 'sunset', cost: number) => {
    if (!isSelf) return;
    if (unlockedBannersSet.has(bannerId) || cost === 0) {
      onSelectProfileBanner?.(bannerId);
      setFeedbackNotice('Оформление профиля обновлено!');
      setTimeout(() => setFeedbackNotice(null), 2500);
      return;
    }
    const spend = spendStarsAmount(economy.stars, cost);
    if (!spend.purchased) return;
    try {
      localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.stars, currentUser.id), String(spend.nextStars));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'telegram_profile_banner' } }));
    } catch {}
    setEconomy(prev => ({ ...prev, stars: spend.nextStars }));
    onUnlockProfileBanner?.(bannerId);
    onSelectProfileBanner?.(bannerId);
    setFeedbackNotice('Новый фон профиля разблокирован и установлен!');
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  const handleBuyOrEquipStatus = (statusId: ProfileEmojiStatusId, cost: number) => {
    if (!isSelf) return;
    if (unlockedStatusesSet.has(statusId) || cost === 0) {
      onSelectEmojiStatus?.(statusId);
      setFeedbackNotice('Эмодзи-статус обновлён!');
      setTimeout(() => setFeedbackNotice(null), 2500);
      return;
    }
    const spend = spendStarsAmount(economy.stars, cost);
    if (!spend.purchased) return;
    try {
      localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.stars, currentUser.id), String(spend.nextStars));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'telegram_profile_status' } }));
    } catch {}
    setEconomy(prev => ({ ...prev, stars: spend.nextStars }));
    onUnlockEmojiStatus?.(statusId);
    onSelectEmojiStatus?.(statusId);
    setFeedbackNotice('Новый статус разблокирован и установлен!');
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  const openSenderProfileByIdOrName = (senderId?: string, senderName?: string) => {
    if (senderId && allUsers[senderId]) {
      setSelectedGift(null);
      onSelectUserProfile(allUsers[senderId]);
      return;
    }
    if (senderName) {
      const byName = Object.values(allUsers).find(
        u => u.name.toLowerCase() === senderName.toLowerCase()
      );
      if (byName) {
        setSelectedGift(null);
        onSelectUserProfile(byName);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Профиль ${resolvedUser.name}`}
        data-testid="telegram-profile-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-[var(--cc-bg-rail)] border border-[var(--cc-border-strong)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[94dvh] sm:h-auto sm:max-h-[92dvh] mt-auto sm:my-auto text-[var(--cc-text)] pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        {/* Top Sticky Profile Bar */}
        <div className="h-[56px] sm:h-[52px] px-4 bg-[var(--cc-bg-header)] backdrop-blur-md border-b border-[var(--cc-border)] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {selectedGift ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedGift(null);
                  setShowRegiftForm(false);
                }}
                className="w-10 h-10 sm:w-9 sm:h-9 -ml-1.5 rounded-xl hover:bg-[var(--cc-bg-surface-hover)] text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)] flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Назад к профилю"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : null}
            <h3 className="text-[15px] font-semibold text-[var(--cc-text)] truncate">
              {selectedGift ? 'Информация о подарке' : isSelf ? 'Мой профиль' : 'Информация'}
            </h3>
          </div>

          <button
            type="button"
            data-testid="tg-profile-close-btn"
            onClick={onClose}
            aria-label="Закрыть профиль"
            className="w-10 h-10 sm:w-9 sm:h-9 -mr-1 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Profile Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {selectedGift ? (
            /* Gift Detail Sheet */
            <div data-testid="tg-profile-gift-detail" className="p-4 sm:p-5 space-y-4">
              <div className={`rounded-2xl bg-gradient-to-br ${getGiftCatalogItem(selectedGift.giftId).gradientClass} border border-[var(--cc-border-strong)] p-5 text-center space-y-2`}>
                <div className="w-20 h-20 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-5xl shadow-inner">
                  {selectedGift.emoji}
                </div>
                <div className="text-lg font-bold text-white">
                  {selectedGift.title}
                  {typeof selectedGift.serialNumber === 'number' && (
                    <span className="ml-1.5 text-amber-200 font-extrabold tabular-nums">#{selectedGift.serialNumber}</span>
                  )}
                </div>
                <div className="text-xs text-white/85 tabular-nums">
                  {isGiftUnsellable(selectedGift)
                    ? `${getGiftCatalogItem(selectedGift.giftId).rarityLabel} · Можно подарить · Нельзя купить и продать`
                    : `${getGiftCatalogItem(selectedGift.giftId).rarityLabel} · ${selectedGift.starsCost} ⭐ · ${formatCoinsCount(selectedGift.coinValue || getGiftCoinValue(selectedGift.starsCost))} 🪙`}
                </div>
                {selectedGift.message && (
                  <div className="mt-2 px-3 py-2 rounded-xl bg-black/25 border border-white/15 text-xs text-amber-100 italic">
                    «{selectedGift.message}»
                  </div>
                )}
              </div>

              {/* Key-Value Metadata List */}
              <div className="rounded-2xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] divide-y divide-[var(--cc-border)] text-xs">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--cc-text-muted)]">От кого</span>
                  {allUsers[selectedGift.senderId] ? (
                    <button
                      type="button"
                      data-testid="tg-profile-gift-sender-link"
                      onClick={() => openSenderProfileByIdOrName(selectedGift.senderId, selectedGift.senderName)}
                      className="font-semibold text-[var(--cc-accent-text)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{selectedGift.senderName}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="font-semibold text-[var(--cc-text)]">{selectedGift.senderName}</span>
                  )}
                </div>

                {selectedGift.regiftedFrom && (
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-[var(--cc-text-muted)]">Передарил(а)</span>
                    <span className="font-medium text-purple-300">{selectedGift.regiftedFrom}</span>
                  </div>
                )}

                {selectedGift.originalSenderName &&
                  selectedGift.originalSenderName !== selectedGift.senderName && (
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-[var(--cc-text-muted)]">Первый даритель</span>
                      <button
                        type="button"
                        onClick={() => openSenderProfileByIdOrName(undefined, selectedGift.originalSenderName)}
                        className="font-medium text-[var(--cc-accent-text)] hover:underline cursor-pointer"
                      >
                        {selectedGift.originalSenderName}
                      </button>
                    </div>
                  )}

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--cc-text-muted)]">Получатель</span>
                  <span className="font-semibold text-[var(--cc-text)]">{resolvedUser.name}</span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--cc-text-muted)]">Дата</span>
                  <span className="text-[var(--cc-text-secondary)] tabular-nums">
                    {selectedGift.receivedAt
                      ? new Date(selectedGift.receivedAt).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Недавно'}
                  </span>
                </div>
              </div>

              {isSelf && (
                <div className="space-y-2.5">
                  {onTogglePinGift && (
                    <button
                      type="button"
                      data-testid="tg-profile-pin-gift-btn"
                      onClick={() => onTogglePinGift(selectedGift.id)}
                      className={`w-full min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        pinnedIds.includes(selectedGift.id)
                          ? 'bg-amber-400/20 border-amber-400/50 text-amber-200'
                          : 'bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border-[var(--cc-border)] text-[var(--cc-text)]'
                      }`}
                    >
                      <span>{pinnedIds.includes(selectedGift.id) ? '📌 Открепить с витрины' : '📌 Закрепить на витрине (до 3)'}</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRegiftForm(prev => !prev);
                        setRegiftNote('');
                      }}
                      className="min-h-[42px] px-3 py-2 rounded-xl bg-[var(--cc-accent-soft)] hover:bg-[var(--cc-accent)]/25 border border-[var(--cc-accent)]/40 text-xs font-semibold text-[var(--cc-text)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Repeat className="w-3.5 h-3.5 text-[var(--cc-accent-text)]" />
                      <span>{isGiftUnsellable(selectedGift) ? 'Подарить другу' : 'Передарить'}</span>
                    </button>
                    {isGiftUnsellable(selectedGift) ? (
                      <div
                        data-testid="tg-profile-gift-unsellable-badge"
                        className="min-h-[42px] px-3 py-2 rounded-xl bg-black/30 border border-rose-400/30 text-xs font-semibold text-rose-200/90 flex items-center justify-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                        <span>Нельзя продать</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!onExchangeGiftForCoins) return;
                          const res = onExchangeGiftForCoins(selectedGift);
                          if (res) {
                            setSelectedGift(null);
                            setFeedbackNotice(
                              `Подарок обменян на +${formatCoinsCount(res.coinsEarned)} 🪙!`
                            );
                          }
                        }}
                        className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-xs font-semibold text-amber-200 flex items-center justify-center gap-1.5 cursor-pointer tabular-nums"
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-300" />
                        <span>+{formatCoinsCount(selectedGift.coinValue || getGiftCoinValue(selectedGift.starsCost))} 🪙</span>
                      </button>
                    )}
                  </div>

                  {showRegiftForm && (
                    <div className="p-3 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] space-y-2.5">
                      <select
                        value={regiftTargetKey}
                        onChange={(e) => setRegiftTargetKey(e.target.value)}
                        className="w-full bg-[var(--cc-bg-app)] border border-[var(--cc-border)] rounded-xl px-3 py-2 text-[16px] sm:text-xs text-[var(--cc-text)] focus:outline-none focus:border-[var(--cc-accent)]"
                      >
                        {Object.values(allUsers).map(u => (
                          <option key={`user_${u.id}`} value={`user_${u.id}`}>
                            {u.id === currentUser.id ? `⭐ Избранное (${u.name})` : `👤 ${u.name} (@${u.username})`}
                          </option>
                        ))}
                        {allGroups.map(g => (
                          <option key={`group_${g.id}`} value={`group_${g.id}`}>
                            👥 {g.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={regiftNote}
                        onChange={(e) => setRegiftNote(e.target.value)}
                        placeholder="Подпись к подарку (необязательно)"
                        maxLength={120}
                        className="w-full bg-[var(--cc-bg-app)] border border-[var(--cc-border)] rounded-xl px-3 py-2 text-[16px] sm:text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none focus:border-[var(--cc-accent)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!onRegiftGift || !regiftTargetKey) return;
                          const target = regiftTargetKey.startsWith('group_')
                            ? { groupId: regiftTargetKey.replace('group_', '') }
                            : { receiverId: regiftTargetKey.replace('user_', '') };
                          const ok = onRegiftGift(selectedGift, target, regiftNote);
                          if (ok) {
                            setShowRegiftForm(false);
                            setSelectedGift(null);
                            setFeedbackNotice('Подарок передарен!');
                          }
                        }}
                        className="w-full py-2 rounded-xl bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Отправить подарок</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Propose Trade Offer when viewing another user's gift */}
              {!isSelf && isGiftUnsellable(selectedGift) && (
                <div className="p-3 rounded-xl bg-violet-950/45 border border-amber-300/35 text-xs text-amber-100/90 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>🔨 Эксклюзив крафта: можно получить только через крафт 10× 😻 Космо-Котят или напрямую в подарок.</span>
                </div>
              )}

              {!isSelf && !isGiftUnsellable(selectedGift) && onProposeGiftTrade && tradeableOwnGifts.length > 0 && (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    data-testid="tg-profile-propose-trade-btn"
                    onClick={() => setShowTradeForm(prev => !prev)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/45 text-xs font-bold text-indigo-100 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Repeat className="w-3.5 h-3.5 text-indigo-300" />
                    <span>Предложить обмен на свой подарок</span>
                  </button>

                  {showTradeForm && (
                    <div data-testid="tg-profile-trade-form" className="p-3 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] space-y-2.5">
                      <label className="text-[11px] font-semibold text-[var(--cc-text-secondary)] block">
                        Какой ваш подарок предлагаете взамен:
                      </label>
                      <select
                        value={tradeOfferedGiftId}
                        onChange={(e) => setTradeOfferedGiftId(e.target.value)}
                        className="w-full bg-[var(--cc-bg-app)] border border-[var(--cc-border)] rounded-xl px-3 py-2 text-[16px] sm:text-xs text-[var(--cc-text)] focus:outline-none focus:border-indigo-400"
                      >
                        {tradeableOwnGifts.map(og => (
                          <option key={og.id} value={og.id}>
                            {og.emoji} {og.title} {og.serialNumber ? `#${og.serialNumber}` : ''} ({og.starsCost} ⭐)
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={tradeNote}
                        onChange={(e) => setTradeNote(e.target.value)}
                        placeholder="Комментарий к обмену (необязательно)"
                        maxLength={100}
                        className="w-full bg-[var(--cc-bg-app)] border border-[var(--cc-border)] rounded-xl px-3 py-2 text-[16px] sm:text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none focus:border-indigo-400"
                      />
                      <button
                        type="button"
                        data-testid="tg-profile-submit-trade-btn"
                        onClick={() => {
                          const offered = tradeableOwnGifts.find(og => og.id === tradeOfferedGiftId) || tradeableOwnGifts[0];
                          if (!offered) return;
                          const ok = onProposeGiftTrade(resolvedUser, selectedGift, offered, tradeNote);
                          if (ok) {
                            setShowTradeForm(false);
                            setTradeNote('');
                            setSelectedGift(null);
                            setFeedbackNotice(`Предложение обмена отправлено в чат с ${resolvedUser.name}!`);
                            setTimeout(() => setFeedbackNotice(null), 3500);
                          }
                        }}
                        className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Отправить предложение обмена</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Profile Cover + Hero Avatar */}
              <div className="relative">
                <div className={`h-24 border-b border-[var(--cc-border)] transition-all ${activeBanner.coverClass}`} />
                <div className="px-5 pb-4 text-center">
                  <div className="relative w-24 h-24 mx-auto -mt-12 mb-3">
                    <div className={`w-24 h-24 rounded-full bg-[var(--cc-accent)] ring-4 border border-[var(--cc-border-strong)] flex items-center justify-center text-3xl font-bold text-white overflow-hidden shadow-xl transition-all ${activeBanner.avatarRingClass}`}>
                      {resolvedUser.avatar ? (
                        <img
                          src={resolvedUser.avatar}
                          alt={resolvedUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        resolvedUser.name[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    {resolvedUser.isOnline && (
                      <span
                        title="В сети"
                        className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-[3px] border-[var(--cc-bg-rail)] rounded-full"
                      />
                    )}
                  </div>

                  <h2
                    data-testid="tg-profile-name"
                    className="text-xl font-bold text-[var(--cc-text)] flex items-center justify-center gap-1.5 leading-tight"
                  >
                    <span className="inline-flex items-center gap-1.5"><span className="truncate max-w-[240px]">{resolvedUser.name}</span>{resolvedUser.isVerified && <VerifiedBadge className="w-4 h-4" />}</span>
                    {resolvedEmojiStatus.emoji && (
                      <span
                        data-testid="tg-profile-emoji-status"
                        title={`Статус: ${resolvedEmojiStatus.title}`}
                        className="text-lg leading-none shrink-0"
                      >
                        {resolvedEmojiStatus.emoji}
                      </span>
                    )}
                    {resolvedUser.isAdmin && (
                      <Crown className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                    )}
                  </h2>

                  <div
                    data-testid="tg-profile-status"
                    className={`text-xs mt-1 font-medium ${
                      resolvedUser.isOnline ? 'text-emerald-400' : 'text-[var(--cc-text-muted)]'
                    }`}
                  >
                    {resolvedUser.isMuted ? (
                      <span className="text-red-400">замучен администратором</span>
                    ) : (
                      lastSeenInfo.text
                    )}
                  </div>

                  {/* Quick Action Tiles */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {isSelf ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onStartChat(currentUser);
                            onClose();
                          }}
                          className="min-h-[56px] p-2 rounded-2xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)] transition-colors cursor-pointer"
                        >
                          <Bookmark className="w-4 h-4 text-[var(--cc-accent-text)]" />
                          <span>Избранное</span>
                        </button>
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenSettings();
                            }}
                            className="min-h-[56px] p-2 rounded-2xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)] transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4 text-[var(--cc-accent-text)]" />
                            <span>Изменить</span>
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid="tg-profile-banner-shop-btn"
                          onClick={() => setIsBannerShopOpen(prev => !prev)}
                          className={`min-h-[56px] p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                            isBannerShopOpen
                              ? 'bg-[var(--cc-accent-soft)] border-[var(--cc-accent)]/50 text-[var(--cc-text)]'
                              : 'bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border-[var(--cc-border)] text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]'
                          }`}
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Фон (⭐)</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          data-testid="tg-profile-message-btn"
                          onClick={() => {
                            onStartChat(resolvedUser);
                            onClose();
                          }}
                          className="min-h-[56px] p-2 rounded-2xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)] transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4 text-[var(--cc-accent-text)]" />
                          <span>Написать</span>
                        </button>

                        <button
                          type="button"
                          data-testid="tg-profile-gift-btn"
                          disabled={!canSendGiftToTarget}
                          onClick={() => setIsSendGiftOpen(prev => !prev)}
                          className={`min-h-[56px] p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                            isSendGiftOpen
                              ? 'bg-[var(--cc-accent-soft)] border-[var(--cc-accent)]/50 text-[var(--cc-text)]'
                              : 'bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border-[var(--cc-border)] text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]'
                          }`}
                        >
                          <Gift className="w-4 h-4 text-purple-400" />
                          <span>Подарить</span>
                        </button>

                        {currentUser.isAdmin && onToggleMuteUser ? (
                          <button
                            type="button"
                            onClick={() => onToggleMuteUser(resolvedUser.id)}
                            className={`min-h-[56px] p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                              resolvedUser.isMuted
                                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                : 'bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border-[var(--cc-border)] text-red-300'
                            }`}
                          >
                            {resolvedUser.isMuted ? (
                              <>
                                <Volume2 className="w-4 h-4" />
                                <span>Размутить</span>
                              </>
                            ) : (
                              <>
                                <VolumeX className="w-4 h-4" />
                                <span>Замутить</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCopy('username', `@${resolvedUser.username}`)}
                            className="min-h-[56px] p-2 rounded-2xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)] transition-colors cursor-pointer"
                          >
                            {copiedField === 'username' ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-[var(--cc-accent-text)]" />
                            )}
                            <span>{copiedField === 'username' ? 'Скопировано' : 'Юзернейм'}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

                  {/* Self Profile Banner & Emoji Status Shop */}
              {isSelf && isBannerShopOpen && (
                <div
                  data-testid="tg-profile-banner-shop"
                  className="mx-4 mb-4 p-3.5 rounded-2xl bg-[var(--cc-bg-surface)] border border-amber-400/35 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--cc-text)]">Фон и свечение профиля</span>
                    <span className="text-yellow-300 font-bold tabular-nums">{economy.stars} ⭐</span>
                  </div>
                  <div className="space-y-1.5">
                    {PROFILE_BANNER_CATALOG.map((b) => {
                      const unlocked = unlockedBannersSet.has(b.id) || b.starsCost === 0;
                      const equipped = (resolvedUser.profileBannerId || 'default') === b.id;
                      const affordable = economy.stars >= b.starsCost;
                      return (
                        <div
                          key={b.id}
                          className="p-2.5 rounded-xl bg-[var(--cc-bg-app)] border border-[var(--cc-border)] flex items-center gap-3"
                        >
                          <div className={`w-10 h-7 rounded-lg border border-white/15 shrink-0 ${b.coverClass}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--cc-text)] truncate">{b.title}</div>
                            <div className="text-[11px] text-[var(--cc-text-muted)] truncate">{b.previewText}</div>
                          </div>
                          <button
                            type="button"
                            data-testid={`tg-banner-btn-${b.id}`}
                            disabled={!unlocked && !affordable}
                            onClick={() => handleBuyOrEquipBanner(b.id, b.starsCost)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${
                              equipped
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : unlocked
                                ? 'bg-[var(--cc-accent)] text-white'
                                : 'bg-amber-400 text-slate-950'
                            }`}
                          >
                            {equipped ? 'Выбран ✓' : unlocked ? 'Надеть' : `${b.starsCost} ⭐`}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Profile Emoji Statuses */}
                  <div className="pt-2 border-t border-[var(--cc-border)] space-y-2">
                    <div className="text-xs font-bold text-[var(--cc-text)]">
                      Эмодзи-статус около имени
                    </div>
                    <div data-testid="tg-profile-emoji-status-shop" className="grid grid-cols-4 gap-1.5">
                      {EMOJI_STATUS_CATALOG.map((st) => {
                        const unlocked = unlockedStatusesSet.has(st.id) || st.starsCost === 0;
                        const equipped = (resolvedUser.emojiStatus || 'none') === st.id;
                        const affordable = economy.stars >= st.starsCost;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            data-testid={`tg-status-btn-${st.id}`}
                            disabled={!unlocked && !affordable}
                            onClick={() => handleBuyOrEquipStatus(st.id, st.starsCost)}
                            title={st.title}
                            className={`p-2 rounded-xl border text-center transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                              equipped
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                : unlocked
                                ? 'bg-[var(--cc-bg-app)] border-[var(--cc-border-strong)] text-[var(--cc-text)] hover:border-[var(--cc-accent)]'
                                : 'bg-[var(--cc-bg-app)] border-[var(--cc-border)] text-amber-200'
                            }`}
                          >
                            <div className="text-lg leading-none">{st.emoji || '🚫'}</div>
                            <div className="text-[10px] font-bold mt-1 tabular-nums truncate">
                              {equipped ? 'Актив' : unlocked ? (st.id === 'none' ? 'Снять' : 'Надеть') : `${st.starsCost} ⭐`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Send Gift Panel from Target Profile (5-Gift Collection) */}
              {isSendGiftOpen && !isSelf && (
                <div
                  data-testid="tg-profile-send-gift-panel"
                  className="mx-4 mb-4 p-3.5 rounded-2xl bg-[var(--cc-bg-surface)] border border-purple-400/40 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--cc-text)]">
                      Отправить подарок · {resolvedUser.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSendGiftOpen(false)}
                      className="text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs tabular-nums bg-[var(--cc-bg-app)] px-3 py-2 rounded-xl border border-[var(--cc-border)]">
                    <span className="text-amber-300 font-semibold">🪙 {formatCoinsCount(economy.coins)}</span>
                    <span className="text-yellow-300 font-semibold">⭐ {economy.stars} / {chosenCatalogGift.starsCost}</span>
                  </div>

                  {economy.stars < chosenCatalogGift.starsCost && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleExchangeStars(1)}
                        disabled={!isAdminPhone(currentUser.phone) && economy.coins < COINS_PER_STAR}
                        className="py-1.5 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-[var(--cc-bg-app)] disabled:text-[var(--cc-text-muted)] text-slate-950 font-bold text-[11px] cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>+1 ⭐ (1 000 🪙)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExchangeStars(chosenCatalogGift.starsCost - economy.stars)}
                        disabled={!isAdminPhone(currentUser.phone) && economy.coins < COINS_PER_STAR * (chosenCatalogGift.starsCost - economy.stars)}
                        className="py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 disabled:border-[var(--cc-border)] disabled:bg-[var(--cc-bg-app)] disabled:text-[var(--cc-text-muted)] text-amber-200 font-bold text-[11px] cursor-pointer disabled:cursor-not-allowed tabular-nums"
                      >
                        +{chosenCatalogGift.starsCost - economy.stars} ⭐
                      </button>
                    </div>
                  )}

                  {/* 5-gift picker */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {GIFT_CATALOG.map((item) => {
                      const active = item.giftId === selectedCatalogGiftId;
                      return (
                        <button
                          key={item.giftId}
                          type="button"
                          onClick={() => setSelectedCatalogGiftId(item.giftId)}
                          className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                            active
                              ? 'bg-purple-500/25 border-purple-400 ring-1 ring-purple-400/60'
                              : 'bg-[var(--cc-bg-app)] border-[var(--cc-border)] hover:border-[var(--cc-border-strong)]'
                          }`}
                          title={`${item.title} (${item.starsCost} ⭐)`}
                        >
                          <div className="text-xl leading-none">{item.emoji}</div>
                          <div className="text-[10px] font-bold text-yellow-300 mt-1 tabular-nums">{item.starsCost}⭐</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className={`flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r ${chosenCatalogGift.gradientClass} border border-white/15`}>
                    <span className="text-3xl">{chosenCatalogGift.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white">{chosenCatalogGift.title}</div>
                      <div className="text-[11px] text-amber-200 tabular-nums">
                        {chosenCatalogGift.rarityLabel} · {chosenCatalogGift.starsCost} ⭐
                      </div>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={sendGiftNote}
                    onChange={(e) => setSendGiftNote(e.target.value)}
                    placeholder="Пожелание к подарку (необязательно)"
                    maxLength={120}
                    className="w-full bg-[var(--cc-bg-app)] border border-[var(--cc-border)] rounded-xl px-3 py-2 text-[16px] sm:text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none focus:border-purple-400"
                  />

                  <button
                    type="button"
                    data-testid="tg-profile-confirm-send-gift-btn"
                    disabled={economy.stars < chosenCatalogGift.starsCost || currentUser.isMuted}
                    onClick={handleConfirmSendSelectedGift}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:brightness-110 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white text-xs font-bold cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <span>{chosenCatalogGift.emoji}</span>
                    <span>Подарить «{chosenCatalogGift.title}» ({chosenCatalogGift.starsCost} ⭐)</span>
                  </button>
                </div>
              )}

              {feedbackNotice && (
                <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs text-emerald-200 font-medium">
                  {feedbackNotice}
                </div>
              )}

              {/* Grouped Info Rows */}
              <div className="mx-4 mb-4 rounded-2xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] divide-y divide-[var(--cc-border)]">
                <button
                  type="button"
                  onClick={() => handleCopy('username', `@${resolvedUser.username}`)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--cc-bg-surface-hover)]/60 transition-colors cursor-pointer text-left"
                >
                  <AtSign className="w-4 h-4 text-[var(--cc-text-muted)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div
                      data-testid="tg-profile-username"
                      className="text-sm font-medium text-[var(--cc-text)] truncate"
                    >
                      @{resolvedUser.username}
                    </div>
                    <div className="text-[11px] text-[var(--cc-text-muted)]">Имя пользователя</div>
                  </div>
                  <span className="text-[11px] text-[var(--cc-accent-text)] font-medium shrink-0">
                    {copiedField === 'username' ? 'Скопировано' : 'Копировать'}
                  </span>
                </button>

                {resolvedUser.phone && (
                  <button
                    type="button"
                    onClick={() => handleCopy('phone', resolvedUser.phone)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--cc-bg-surface-hover)]/60 transition-colors cursor-pointer text-left"
                  >
                    <Phone className="w-4 h-4 text-[var(--cc-text-muted)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div
                        data-testid="tg-profile-phone"
                        className="text-sm font-medium text-[var(--cc-text)] tabular-nums truncate"
                      >
                        {resolvedUser.phone}
                      </div>
                      <div className="text-[11px] text-[var(--cc-text-muted)]">Телефон</div>
                    </div>
                    <span className="text-[11px] text-[var(--cc-accent-text)] font-medium shrink-0">
                      {copiedField === 'phone' ? 'Скопировано' : 'Копировать'}
                    </span>
                  </button>
                )}
              </div>

              {/* Segmented Section Tabs */}
              <div className="border-t border-b border-[var(--cc-border)] bg-[var(--cc-bg-surface)]/50 px-2 flex items-center">
                <button
                  type="button"
                  data-testid="tg-profile-tab-gifts"
                  onClick={() => setActiveTab('gifts')}
                  className={`flex-1 py-2.5 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'gifts'
                      ? 'border-[var(--cc-accent)] text-[var(--cc-accent-text)]'
                      : 'border-transparent text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5 shrink-0" />
                  <span>Подарки</span>
                  <span className="tabular-nums opacity-80">({profileGifts.length})</span>
                </button>

                <button
                  type="button"
                  data-testid="tg-profile-tab-media"
                  onClick={() => setActiveTab('media')}
                  className={`flex-1 py-2.5 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'media'
                      ? 'border-[var(--cc-accent)] text-[var(--cc-accent-text)]'
                      : 'border-transparent text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Медиа</span>
                  <span className="tabular-nums opacity-80">({sharedMedia.length})</span>
                </button>

                <button
                  type="button"
                  data-testid="tg-profile-tab-groups"
                  onClick={() => setActiveTab('groups')}
                  className={`flex-1 py-2.5 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'groups'
                      ? 'border-[var(--cc-accent)] text-[var(--cc-accent-text)]'
                      : 'border-transparent text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Группы</span>
                  <span className="tabular-nums opacity-80">({sharedGroups.length})</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-4">
                {activeTab === 'gifts' && (
                  <div data-testid="tg-profile-gifts-list" className="space-y-3">
                    {/* 10-for-1 Gift Crafting Forge & Cosmic Hammer */}
                    {isSelf && onCraftGifts && (
                      <GiftCraftPanel
                        ownedGifts={ownGifts}
                        onCraftGifts={onCraftGifts}
                        testIdPrefix="tg"
                        onCrafted={(res) => {
                          setFeedbackNotice(
                            res.giftId === COSMIC_HAMMER_GIFT_ID
                              ? '🔨 Выкован эксклюзивный Космический молот! Можно подарить другу!'
                              : `Скрафчен подарок ${res.emoji} ${res.title}!`
                          );
                          setTimeout(() => setFeedbackNotice(null), 3500);
                        }}
                      />
                    )}

                    {isLoadingGifts && profileGifts.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[var(--cc-text-muted)]">
                        Загрузка подарков...
                      </div>
                    ) : profileGifts.length === 0 ? (
                      <div
                        data-testid="tg-profile-gifts-empty"
                        className="py-8 text-center space-y-2"
                      >
                        <div className="text-4xl">🎁</div>
                        <div className="text-sm font-semibold text-[var(--cc-text)]">
                          Подарков пока нет
                        </div>
                        <p className="text-xs text-[var(--cc-text-muted)] max-w-xs mx-auto">
                          {isSelf
                            ? 'Подарки, которые вам пришлют друзья, появятся на витрине вашего профиля.'
                            : `Станьте первым, кто подарит ${resolvedUser.name} Планету Земля 🌍!`}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        {profileGifts.map((gift) => {
                          const senderObj = allUsers[gift.senderId];
                          const isPinned = pinnedIds.includes(gift.id);
                          const catMeta = getGiftCatalogItem(gift.giftId);
                          return (
                            <button
                              key={gift.id}
                              type="button"
                              data-testid="tg-profile-gift-card"
                              onClick={() => setSelectedGift(gift)}
                              className={`p-3 rounded-2xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border transition-all text-left flex flex-col gap-2 cursor-pointer group ${
                                gift.isHolo
                                  ? 'border-fuchsia-400/70 ring-1 ring-amber-300/50'
                                  : isPinned
                                  ? 'border-amber-400/55 ring-1 ring-amber-400/30'
                                  : 'border-[var(--cc-border)] hover:border-[var(--cc-border-strong)]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-semibold text-yellow-300 tabular-nums truncate">
                                  {isPinned ? '📌 ' : ''}
                                  {typeof gift.serialNumber === 'number' ? `#${gift.serialNumber} · ` : ''}
                                  {isGiftUnsellable(gift) ? '🔨 Реликвия' : `${gift.starsCost} ⭐`}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-[var(--cc-text-muted)] group-hover:text-[var(--cc-text)] transition-colors shrink-0" />
                              </div>

                              <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${catMeta.gradientClass} border border-white/15 flex items-center justify-center text-3xl`}>
                                {gift.emoji}
                              </div>

                              <div className="min-w-0 text-center">
                                <div className="text-xs font-bold text-[var(--cc-text)] truncate">
                                  {gift.title}
                                </div>
                              </div>

                              <div className="pt-1.5 border-t border-[var(--cc-border)] flex items-center gap-1.5 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-[var(--cc-bg-surface-elevated)] flex items-center justify-center text-[10px] font-semibold text-[var(--cc-text)] shrink-0 overflow-hidden">
                                  {senderObj?.avatar ? (
                                    <img
                                      src={senderObj.avatar}
                                      alt={gift.senderName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    gift.senderName[0]?.toUpperCase() || '?'
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div
                                    data-testid="tg-profile-gift-sender"
                                    className="text-[11px] text-[var(--cc-text-secondary)] truncate"
                                  >
                                    от {gift.senderName}
                                  </div>
                                  {gift.regiftedFrom && (
                                    <div className="text-[10px] text-purple-300 truncate">
                                      передарен
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'media' && (
                  <div>
                    {sharedMedia.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[var(--cc-text-muted)]">
                        Нет общих фотографий в диалоге.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {sharedMedia.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onOpenLightbox(m.imageUrl!)}
                            className="aspect-square rounded-xl overflow-hidden bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] cursor-pointer hover:opacity-90 transition-opacity"
                          >
                            <img
                              src={m.imageUrl}
                              alt="Фото из чата"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'groups' && (
                  <div className="space-y-1.5">
                    {sharedGroups.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[var(--cc-text-muted)]">
                        Нет общих групп.
                      </div>
                    ) : (
                      sharedGroups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            onSelectGroup(g);
                            onClose();
                          }}
                          className="w-full p-2.5 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex items-center gap-3 text-left cursor-pointer transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] flex items-center justify-center font-semibold text-sm text-[var(--cc-text)] shrink-0">
                            {g.name[0]?.toUpperCase() || 'Г'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--cc-text)] truncate">{g.name}</div>
                            <div className="text-[11px] text-[var(--cc-text-muted)] tabular-nums">
                              {(g.memberIds || []).length} участников
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--cc-text-muted)] shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
