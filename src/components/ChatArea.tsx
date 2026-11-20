import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VerifiedBadge } from './VerifiedBadge';
import {
  ArrowLeft,
  Info,
  VolumeX,
  Volume2,
  Search,
  Paperclip,
  BarChart3,
  Mic,
  Send,
  X,
  Bookmark,
  Crown,
  Check,
  CheckCheck,
  Edit2,
  Trash2,
  SmilePlus,
  Play,
  Youtube,
  ShieldAlert,
  Radio,
  Cat,
  Gift,
  Flame,
  Sparkles,
  Repeat,
  Coins,
  User as UserIcon,
  Timer,
  BellRing,
  Award,
  Reply,
  Pin,
  Video,
  Banknote,
  Plus,
  Lock
} from 'lucide-react';
import {
  UserProfile,
  GroupChat,
  MessageItem,
  PollData,
  SharedMusicData,
  ListenTogetherSession,
  SharedCatData,
  GiftData,
  OwnedGift,
  CatStickerPayload,
  CoinEnvelopeData,
  TradeOfferData,
  ReplyPreview
} from '../types/chat';
import { formatLastSeen, isAdminPhone } from '../utils/security';
import { computeSynchronizedPositionSec } from '../utils/musicLogic';
import {
  formatYouTubeDuration,
  checkContactYouTubeAccess,
  MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT,
  YouTubeTrack
} from '../utils/youtubeMusic';
import {
  ADMIN_INITIAL_COINS,
  CAT_STORAGE_KEYS,
  COINS_PER_STAR,
  DEFAULT_CAT_CUSTOMIZATION,
  EARTH_GIFT_STARS,
  STREAK_FREEZE_STARS,
  buildSharedCatData,
  exchangeCoinsForStar,
  exchangeCoinsForStarsBatch,
  formatCoinsCount,
  getGiftCoinValue,
  getUserCatStorageKey,
  readUserCatEconomy,
  sanitizeCatCustomization,
  spendStarsForStreakFreeze
} from '../utils/catGameLogic';
import {
  CAT_STICKER_PRESETS,
  GIFT_CATALOG,
  SECRET_MESSAGE_TTL_OPTIONS,
  getGiftCatalogItem,
  getStreakMilestonesState,
  isGiftUnsellable,
  spendStarsAmount
} from '../utils/giftCatalog';
import type { ClaimedGiftStatus } from '../utils/profileGifts';
import {
  CHAT_WALLPAPER_CATALOG,
  buildReplyPreview,
  getChatWallpaperItem,
  getEmojiStatusItem,
  isWallpaperUnlockedForStreak
} from '../utils/cosmoFeatures';
import {
  ChatStreakInfo,
  formatDaysLabel,
  getLocalDayKey,
  getStreakVisualMeta,
  shiftDayKey
} from '../utils/streakLogic';
import { CatCardMessage, CatStickerMessage } from './CatCardMessage';
import {
  VoicePlayerBubble,
  VideoCircleBubble,
  CoinEnvelopeCard,
  TradeOfferCard
} from './RichMessageCards';

interface ChatAreaProps {
  currentUser: UserProfile;
  activeUser: UserProfile | null;
  activeGroup: GroupChat | null;
  messages: MessageItem[];
  allUsers: Record<string, UserProfile>;
  onBackToSidebar: () => void;
  onOpenGroupInfo: () => void;
  onSendMessage: (msg: {
    type:
      | 'text'
      | 'image'
      | 'video'
      | 'video_circle'
      | 'voice'
      | 'poll'
      | 'music_share'
      | 'cat_card'
      | 'cat_sticker'
      | 'gift'
      | 'coin_envelope'
      | 'trade_offer';
    text?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    videoDurationSec?: number;
    poll?: PollData;
    musicShare?: SharedMusicData;
    catShare?: SharedCatData;
    catSticker?: CatStickerPayload;
    giftData?: GiftData;
    replyTo?: ReplyPreview;
    ttlSeconds?: number;
    expiresAt?: number;
  }) => void;
  onEditMessage: (msgId: string, newText: string) => void;
  onDeleteMessage: (msgId: string) => void;
  onToggleReaction: (msgId: string, emoji: string) => void;
  onSaveToBookmarks: (msg: MessageItem) => void;
  onVotePoll: (msgId: string, optionId: string) => void;
  onToggleMuteUser: (userId: string) => void;
  onOpenLightbox: (url: string) => void;
  onOpenPollModal: () => void;
  onSetActivity: (status: 'idle' | 'typing' | 'recording' | 'cat_game' | 'listening', detail?: string) => void;
  onOpenMusicPlayer?: (track?: YouTubeTrack) => void;
  onOpenCatGame?: () => void;
  listenSession?: ListenTogetherSession | null;
  serverTimeOffsetMs?: number;
  activeStreakKey?: string | null;
  activeStreak?: ChatStreakInfo | null;
  onRenameStreak?: (streakKey: string, customName: string) => void;
  onFreezeStreak?: (streakKey: string, dayKey: string) => void;
  activeStreakWallpaperId?: string;
  onSelectStreakWallpaper?: (streakKey: string, wallpaperId: string) => void;
  pinnedMessage?: MessageItem | null;
  onPinMessage?: (msgId: string | null) => void;
  onSendCoinEnvelope?: (totalCoins: number, maxClaims: number, note?: string) => boolean;
  onClaimCoinEnvelope?: (msgId: string, envelope: CoinEnvelopeData) => void;
  onRespondTradeOffer?: (msgId: string, offer: TradeOfferData, decision: 'accepted' | 'declined') => void;
  onTriggerStreakMilestoneCelebration?: (days: number, title: string, badge: string) => void;
  ownedGifts?: OwnedGift[];
  claimedGiftStatuses?: Record<string, ClaimedGiftStatus>;
  allGroups?: GroupChat[];
  onRegiftGift?: (
    ownedGift: OwnedGift,
    target: { receiverId?: string; groupId?: string },
    note?: string
  ) => boolean;
  onExchangeGiftForCoins?: (ownedGift: OwnedGift) => { coinsEarned: number; nextCoins: number } | null;
  onBuyGiftForSelf?: (gift: { giftId: string; title: string; emoji: string; starsCost: number; message?: string }) => boolean;
  onOpenUserProfile?: (user: UserProfile) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentUser,
  activeUser,
  activeGroup,
  messages,
  allUsers,
  onBackToSidebar,
  onOpenGroupInfo,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onSaveToBookmarks,
  onVotePoll,
  onToggleMuteUser,
  onOpenLightbox,
  onOpenPollModal,
  onSetActivity,
  onOpenMusicPlayer,
  onOpenCatGame,
  listenSession,
  serverTimeOffsetMs = 0,
  activeStreakKey,
  activeStreak,
  onRenameStreak,
  onFreezeStreak,
  activeStreakWallpaperId = 'default',
  onSelectStreakWallpaper,
  pinnedMessage,
  onPinMessage,
  onSendCoinEnvelope,
  onClaimCoinEnvelope,
  onRespondTradeOffer,
  onTriggerStreakMilestoneCelebration,
  ownedGifts = [],
  claimedGiftStatuses = {},
  allGroups = [],
  onRegiftGift,
  onExchangeGiftForCoins,
  onBuyGiftForSelf,
  onOpenUserProfile
}) => {
  const [inputText, setInputText] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageItem | null>(null);
  const [openReactionPickerMsgId, setOpenReactionPickerMsgId] = useState<string | null>(null);
  const [activeMobileMsgId, setActiveMobileMsgId] = useState<string | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const [musicAccessBanner, setMusicAccessBanner] = useState<string | null>(null);
  const [liveSyncNowMs, setLiveSyncNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!listenSession) return;
    setLiveSyncNowMs(Date.now());
    if (!listenSession.isPlaying) return;
    const timer = window.setInterval(() => {
      setLiveSyncNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [listenSession]);

  const handleStartListenTogether = () => {
    if (activeUser) {
      const check = checkContactYouTubeAccess(activeUser);
      if (!check.allowed) {
        setMusicAccessBanner(check.message || MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT);
        return;
      }
    }
    setMusicAccessBanner(null);
    onOpenMusicPlayer?.();
  };

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Cat card share, Gift & Streak modal state
  const [isCatShareModalOpen, setIsCatShareModalOpen] = useState(false);
  const [catShareNote, setCatShareNote] = useState('');
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [selectedGiftCatalogId, setSelectedGiftCatalogId] = useState<string>('earth_planet');
  const [giftMessage, setGiftMessage] = useState('');
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [streakNameInput, setStreakNameInput] = useState('');
  const [regiftModalGift, setRegiftModalGift] = useState<OwnedGift | null>(null);
  const [regiftTargetKey, setRegiftTargetKey] = useState<string>('');
  const [regiftNote, setRegiftNote] = useState('');
  const [giftActionToast, setGiftActionToast] = useState<string | null>(null);
  const [secretTtlSeconds, setSecretTtlSeconds] = useState<number>(0);
  const [nowClockMs, setNowClockMs] = useState<number>(() => Date.now());
  const [claimedStreakMilestones, setClaimedStreakMilestones] = useState<Record<string, number[]>>(() => {
    try {
      const saved = localStorage.getItem(`cosmo_streak_milestones_${currentUser.id}`);
      const raw = saved ? JSON.parse(saved) : {};
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });
  const [nudgeCooldownUntil, setNudgeCooldownUntil] = useState<Record<string, number>>({});
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [isEnvelopeModalOpen, setIsEnvelopeModalOpen] = useState(false);
  const [envelopeCoinsInput, setEnvelopeCoinsInput] = useState<number>(5000);
  const [envelopeClaimsInput, setEnvelopeClaimsInput] = useState<number>(3);
  const [envelopeNoteInput, setEnvelopeNoteInput] = useState<string>('');
  const [isVideoCircleModalOpen, setIsVideoCircleModalOpen] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const hasExpiring = messages.some(m => typeof m.expiresAt === 'number' && m.expiresAt > 0);
    if (!hasExpiring) return;
    setNowClockMs(Date.now());
    const id = window.setInterval(() => setNowClockMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [messages]);

  const readCatEconomy = useCallback(() => {
    return readUserCatEconomy(currentUser.id);
  }, [currentUser.id]);

  const [catEconomy, setCatEconomy] = useState(() => readCatEconomy());

  useEffect(() => {
    setCatEconomy(readCatEconomy());
    const onSync = () => setCatEconomy(readCatEconomy());
    window.addEventListener('cosmo-cat-economy-updated', onSync);
    return () => window.removeEventListener('cosmo-cat-economy-updated', onSync);
  }, [readCatEconomy, isGiftModalOpen, isCatShareModalOpen, isStreakModalOpen, isEnvelopeModalOpen]);

  useEffect(() => {
    if (isStreakModalOpen) {
      setStreakNameInput(activeStreak?.customName || '');
    }
  }, [isStreakModalOpen, activeStreak?.customName]);

  useEffect(() => {
    if (!regiftTargetKey) {
      const other = Object.values(allUsers).find(u => u.id !== currentUser.id);
      if (other) setRegiftTargetKey(`user_${other.id}`);
      else if (allGroups.length > 0) setRegiftTargetKey(`group_${allGroups[0].id}`);
      else setRegiftTargetKey(`user_${currentUser.id}`);
    }
  }, [allUsers, allGroups, currentUser.id, regiftTargetKey]);

  const showGiftToast = (msg: string) => {
    setGiftActionToast(msg);
    setTimeout(() => setGiftActionToast(prev => (prev === msg ? null : prev)), 3500);
  };

  const handleExchangeCoinToStarInChat = (starCount = 1) => {
    const current = readCatEconomy();
    const isTargetAdmin = isAdminPhone(currentUser.phone);
    const res = starCount === 1
      ? exchangeCoinsForStar(current.coins, current.stars)
      : exchangeCoinsForStarsBatch(current.coins, current.stars, starCount);
    if (!res.exchanged && !isTargetAdmin) return;
    const finalNextCoins = isTargetAdmin ? ADMIN_INITIAL_COINS : res.nextCoins;
    const finalNextStars = res.exchanged ? res.nextStars : current.stars + starCount;
    try {
      localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUser.id), String(finalNextCoins));
      localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.stars, currentUser.id), String(finalNextStars));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'chat_area' } }));
    } catch {}
    setCatEconomy({ ...current, coins: finalNextCoins, stars: finalNextStars });
  };

  const selectedCatalogGift = getGiftCatalogItem(selectedGiftCatalogId);

  const handleSendSelectedGiftFromChat = () => {
    if (currentUser.isMuted) return;
    const current = readCatEconomy();
    const spend = spendStarsAmount(current.stars, selectedCatalogGift.starsCost);
    if (!spend.purchased) return;
    try {
      localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.stars, currentUser.id), String(spend.nextStars));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'chat_area' } }));
    } catch {}
    setCatEconomy({ ...current, stars: spend.nextStars });

    const note = giftMessage.trim();
    const giftPayload: GiftData = {
      giftId: selectedCatalogGift.giftId,
      title: selectedCatalogGift.title,
      emoji: selectedCatalogGift.emoji,
      starsCost: selectedCatalogGift.starsCost
    };
    if (note) {
      giftPayload.message = note;
    }
    onSendMessage({
      type: 'gift',
      text: note || `🎁 Подарок: ${selectedCatalogGift.title} ${selectedCatalogGift.emoji}`,
      giftData: giftPayload
    });
    setGiftMessage('');
    setIsGiftModalOpen(false);
  };

  const handleSaveStreakName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStreakKey || !onRenameStreak) return;
    onRenameStreak(activeStreakKey, streakNameInput.trim());
    setIsStreakModalOpen(false);
  };

  const handleCatNameChangeInModal = (nextName: string) => {
    try {
      localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.catName, currentUser.id), nextName);
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'chat_area' } }));
    } catch {}
    setCatEconomy(prev => ({ ...prev, catName: nextName }));
  };

  const getCurrentCatData = useCallback((): SharedCatData => {
    let cust = DEFAULT_CAT_CUSTOMIZATION;
    let swipes = 0;
    let catName = 'Космо-Котик';
    try {
      const rawSwipes = localStorage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.swipes, currentUser.id));
      if (rawSwipes) swipes = Number(rawSwipes) || 0;
      const rawCust = localStorage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.customization, currentUser.id));
      if (rawCust) cust = sanitizeCatCustomization(JSON.parse(rawCust));
      const rawName = localStorage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.catName, currentUser.id));
      if (rawName) catName = rawName;
    } catch {}
    return buildSharedCatData(cust, swipes, catShareNote, catName);
  }, [catShareNote, currentUser.id]);

  const handleSendCatCard = () => {
    const catData = getCurrentCatData();
    onSendMessage({
      type: 'cat_card',
      text: catShareNote.trim() || `🐱 ${catData.catName || 'Котик'} (${catData.levelTitle})`,
      catShare: catData
    });
    setCatShareNote('');
    setIsCatShareModalOpen(false);
  };

  const handleSendCatSticker = (preset: (typeof CAT_STICKER_PRESETS)[number]) => {
    if (currentUser.isMuted) return;
    const catData = getCurrentCatData();
    const ttlProps = secretTtlSeconds > 0
      ? { ttlSeconds: secretTtlSeconds, expiresAt: Date.now() + secretTtlSeconds * 1000 }
      : {};
    onSendMessage({
      type: 'cat_sticker',
      text: `🐱 ${catData.catName || 'Котик'}: ${preset.caption}`,
      catSticker: {
        presetId: preset.id,
        label: preset.label,
        emoji: preset.emoji,
        caption: preset.caption,
        mood: preset.mood,
        isDancing: preset.isDancing,
        customization: catData.customization,
        catName: catData.catName
      },
      ...ttlProps
    });
    setIsCatShareModalOpen(false);
  };
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const voiceErrorTimeoutRef = useRef<any>(null);

  // Scroll only the messages list to bottom on new messages
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, activeUser?.id, activeGroup?.id]);

  // Close reaction picker and mobile message toolbar on Escape or outside click
  useEffect(() => {
    if (!openReactionPickerMsgId && !activeMobileMsgId) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-reaction-picker]')) {
        setOpenReactionPickerMsgId(null);
      }
      if (!target?.closest('[data-msg-toolbar]') && !target?.closest('[data-msg-bubble]')) {
        setActiveMobileMsgId(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenReactionPickerMsgId(null);
        setActiveMobileMsgId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [openReactionPickerMsgId, activeMobileMsgId]);

  // Reset transient editing/picker/recording state when switching chats or unmounting
  useEffect(() => {
    setEditingMsg(null);
    setReplyingTo(null);
    setOpenReactionPickerMsgId(null);
    setActiveMobileMsgId(null);
    setIsMobileActionsOpen(false);
    setIsMobileSearchOpen(false);
    setChatSearch('');
    setAttachedImage(null);
    return () => {
      clearTimeout(typingTimeoutRef.current);
      clearTimeout(voiceErrorTimeoutRef.current);
      clearInterval(recordIntervalRef.current);
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current);
        videoTimerRef.current = null;
      }
      if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
        try {
          videoRecorderRef.current.onstop = null;
          videoRecorderRef.current.stop();
        } catch {}
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(t => t.stop());
        videoStreamRef.current = null;
      }
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
          }
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        } catch {}
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
      setIsVideoRecording(false);
    };
  }, [activeUser?.id, activeGroup?.id]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputText, isRecording]);

  const isSavedMessages = !activeGroup && activeUser?.id === currentUser.id;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (val.trim()) {
      onSetActivity('typing');
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onSetActivity('idle');
      }, 3000);
    } else {
      onSetActivity('idle');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (currentUser.isMuted) return;

    if (editingMsg) {
      if (inputText.trim()) {
        onEditMessage(editingMsg.id, inputText.trim());
      }
      setEditingMsg(null);
      setInputText('');
      onSetActivity('idle');
      return;
    }

    const ttlProps = secretTtlSeconds > 0
      ? { ttlSeconds: secretTtlSeconds, expiresAt: Date.now() + secretTtlSeconds * 1000 }
      : {};
    const replyProps = replyingTo ? { replyTo: replyingTo } : {};

    if (attachedImage) {
      onSendMessage({
        type: 'image',
        imageUrl: attachedImage,
        text: inputText.trim() || undefined,
        ...replyProps,
        ...ttlProps
      });
      setAttachedImage(null);
      setReplyingTo(null);
      setInputText('');
      onSetActivity('idle');
      return;
    }

    if (inputText.trim()) {
      onSendMessage({
        type: 'text',
        text: inputText.trim(),
        ...replyProps,
        ...ttlProps
      });
      setReplyingTo(null);
      setInputText('');
      onSetActivity('idle');
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 900;
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
          setAttachedImage(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const showVoiceError = (message: string) => {
    clearTimeout(voiceErrorTimeoutRef.current);
    setVoiceError(message);
    voiceErrorTimeoutRef.current = setTimeout(() => setVoiceError(null), 8000);
  };

  // Voice recording
  const startRecording = async () => {
    if (currentUser.isMuted) return;
    setVoiceError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        showVoiceError('Запись голоса не поддерживается в этом браузере или открыта по небезопасному соединению.');
        return;
      }
      if (typeof MediaRecorder === 'undefined') {
        showVoiceError('Ваш браузер не поддерживает запись голосовых сообщений.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      onSetActivity('recording');

      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } catch (err: any) {
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setRecordSeconds(0);
      onSetActivity('idle');

      const errName = err?.name || '';
      if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        showVoiceError('Микрофон не найден на этом устройстве.');
      } else {
        showVoiceError(
          'Нет доступа к микрофону. Закройте плавающие окна/виджеты поверх экрана (например, боковую панель) и разрешите микрофон для сайта.'
        );
      }
    }
  };

  const stopMicrophoneTracks = (keepOnStopCallback = false) => {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      if (!keepOnStopCallback) {
        recorder.onstop = null;
      }
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        if (!keepOnStopCallback) {
          recorder.stream.getTracks().forEach(t => t.stop());
        }
      } catch {}
    }
    clearInterval(recordIntervalRef.current);
    setIsRecording(false);
    onSetActivity('idle');
  };

  const cancelRecording = () => {
    stopMicrophoneTracks(false);
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const sendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      stopMicrophoneTracks(false);
      mediaRecorderRef.current = null;
      showVoiceError('Не удалось сохранить запись — микрофон не был запущен.');
      return;
    }

    const mimeType = (recorder.mimeType || 'audio/webm').split(';')[0];
    recorder.onstop = () => {
      try {
        recorder.stream.getTracks().forEach(t => t.stop());
      } catch {}
      mediaRecorderRef.current = null;

      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];
      if (blob.size < 100) {
        showVoiceError('Запись слишком короткая — удерживайте чуть дольше и повторите.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          const ttlProps = secretTtlSeconds > 0
            ? { ttlSeconds: secretTtlSeconds, expiresAt: Date.now() + secretTtlSeconds * 1000 }
            : {};
          onSendMessage({
            type: 'voice',
            audioUrl: reader.result as string,
            ...ttlProps
          });
        }
      };
      reader.readAsDataURL(blob);
    };
    stopMicrophoneTracks(true);
  };

  // Video Circle recording helpers
  const stopVideoCamera = () => {
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
    if (videoRecorderRef.current) {
      try {
        if (videoRecorderRef.current.state !== 'inactive') {
          videoRecorderRef.current.onstop = null;
          videoRecorderRef.current.stop();
        }
      } catch {}
      videoRecorderRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    setIsVideoRecording(false);
    setVideoSeconds(0);
  };

  const openVideoCircleRecorder = async () => {
    if (currentUser.isMuted) return;
    setVideoError(null);
    setIsVideoCircleModalOpen(true);
    setIsVideoRecording(false);
    setVideoSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setVideoError('Камера не поддерживается в этом браузере или открыта без HTTPS.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 360 }, height: { ideal: 360 } },
        audio: true
      });
      videoStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
    } catch {
      setVideoError('Нет доступа к камере или микрофону. Разрешите доступ к камере в настройках браузера.');
    }
  };

  const startVideoCircleRecording = () => {
    const stream = videoStreamRef.current;
    if (!stream) return;
    setVideoError(null);
    videoChunksRef.current = [];
    try {
      const recorder = new MediaRecorder(stream);
      videoRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) videoChunksRef.current.push(ev.data);
      };
      recorder.start(250);
      setIsVideoRecording(true);
      setVideoSeconds(0);
      videoTimerRef.current = window.setInterval(() => {
        setVideoSeconds(prev => {
          if (prev + 1 >= 30) {
            finishVideoCircleRecording(30);
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setVideoError('Не удалось запустить запись видеокружка.');
    }
  };

  const finishVideoCircleRecording = (forcedDuration?: number) => {
    const recorder = videoRecorderRef.current;
    const durationUsed = forcedDuration ?? Math.max(1, videoSeconds);
    if (!recorder) {
      stopVideoCamera();
      setIsVideoCircleModalOpen(false);
      return;
    }
    const mime = (recorder.mimeType || 'video/webm').split(';')[0];
    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: mime });
      videoChunksRef.current = [];
      stopVideoCamera();
      setIsVideoCircleModalOpen(false);
      if (blob.size < 200) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          const ttlProps = secretTtlSeconds > 0
            ? { ttlSeconds: secretTtlSeconds, expiresAt: Date.now() + secretTtlSeconds * 1000 }
            : {};
          onSendMessage({
            type: 'video_circle',
            videoUrl: reader.result as string,
            videoDurationSec: durationUsed,
            ...(replyingTo ? { replyTo: replyingTo } : {}),
            ...ttlProps
          });
          setReplyingTo(null);
        }
      };
      reader.readAsDataURL(blob);
    };
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch {
      stopVideoCamera();
    }
  };

  // Filter messages by disappearing expiration + in-chat search
  const filteredMessages = messages.filter(m => {
    if (typeof m.expiresAt === 'number' && m.expiresAt > 0 && nowClockMs >= m.expiresAt) {
      return false;
    }
    if (!chatSearch.trim()) return true;
    return m.text?.toLowerCase().includes(chatSearch.toLowerCase().trim());
  });

  return (
    <div className="flex-1 min-w-0 w-full flex flex-col cc-chat-backdrop relative h-full overflow-hidden">
      
      {/* Sticky Glass Chat Header */}
      <div className="h-[56px] sm:h-[60px] border-b border-[var(--cc-border)] flex items-center px-2 sm:px-5 bg-[var(--cc-bg-header)] backdrop-blur-md justify-between gap-1.5 sm:gap-2 shrink-0 min-w-0 z-10">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBackToSidebar}
            aria-label="Назад к списку чатов"
            className="sm:hidden w-11 h-11 -ml-1 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {!activeGroup && (activeUser || isSavedMessages) ? (
            <button
              type="button"
              data-testid="chat-header-profile-trigger"
              onClick={() => onOpenUserProfile?.(isSavedMessages ? currentUser : activeUser!)}
              title="Открыть профиль пользователя"
              className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial text-left rounded-xl px-1 py-1 sm:-mx-1.5 hover:bg-[var(--cc-bg-surface-hover)]/65 transition-colors cursor-pointer group"
            >
              <div className="relative shrink-0">
                {isSavedMessages ? (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] flex items-center justify-center text-[var(--cc-accent-text)]">
                    <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border)] group-hover:border-[var(--cc-accent)]/60 flex items-center justify-center font-semibold text-[var(--cc-text)] overflow-hidden transition-colors">
                    {activeUser?.avatar ? (
                      <img src={activeUser.avatar} alt={activeUser.name} className="w-full h-full object-cover" />
                    ) : (
                      activeUser?.name[0]?.toUpperCase() || '?'
                    )}
                  </div>
                )}
                {activeUser && activeUser.isOnline && !isSavedMessages && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--cc-bg-rail)] rounded-full" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] sm:text-[15px] font-semibold text-[var(--cc-text)] group-hover:text-[var(--cc-accent-text)] flex items-center gap-1 min-w-0 transition-colors">
                  <span className="truncate">{isSavedMessages ? 'Избранное' : activeUser?.name}</span>
                  {!isSavedMessages && activeUser?.isVerified && <VerifiedBadge className="w-4 h-4" />}
                  {!isSavedMessages && activeUser?.emojiStatus && activeUser.emojiStatus !== 'none' && (
                    <span
                      data-testid="chat-header-emoji-status"
                      title={getEmojiStatusItem(activeUser.emojiStatus).title}
                      className="text-sm shrink-0 leading-none"
                    >
                      {getEmojiStatusItem(activeUser.emojiStatus).emoji}
                    </span>
                  )}
                  {!isSavedMessages && activeUser?.isAdmin && (
                    <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                  )}
                  {activeUser?.isMuted && (
                    <span className="text-red-400 text-xs flex items-center gap-0.5 shrink-0">
                      <VolumeX className="w-3.5 h-3.5" /> (замучен)
                    </span>
                  )}
                </div>

                <div className="text-xs text-[var(--cc-text-muted)] truncate">
                  {isSavedMessages ? (
                    'Ваши личные заметки и сохранённые сообщения'
                  ) : activeUser?.activity?.status === 'recording' ? (
                    <span className="text-rose-400 font-medium">записывает аудио...</span>
                  ) : activeUser?.activity?.status === 'typing' ? (
                    <span className="text-[var(--cc-accent-text)] font-medium">печатает...</span>
                  ) : activeUser?.activity?.status === 'cat_game' && Date.now() - (activeUser.activity.updatedAt || 0) < 180000 ? (
                    <span className="text-amber-300 font-medium">🐱 играет с котиком</span>
                  ) : activeUser?.activity?.status === 'listening' && Date.now() - (activeUser.activity.updatedAt || 0) < 180000 ? (
                    <span className="text-rose-300 font-medium">
                      🎵 слушает {activeUser.activity.detail || 'музыку'}
                    </span>
                  ) : (
                    formatLastSeen(activeUser?.lastSeen, activeUser?.isOnline).text
                  )}
                </div>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] flex items-center justify-center font-semibold text-base text-[var(--cc-text)]">
                  {activeGroup?.name[0]?.toUpperCase() || 'Г'}
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[var(--cc-text)] flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{activeGroup?.name}</span>
                </div>
                <div className="text-xs text-[var(--cc-text-muted)] truncate">
                  {`${(activeGroup?.memberIds || []).length} участников${activeGroup?.description ? ' • ' + activeGroup.description : ''}`}
                </div>
              </div>
            </div>
          )}

          {activeStreakKey && (() => {
            const count = activeStreak?.count || 0;
            const isHotToday = Boolean(activeStreak?.isHotToday);
            const isFrozenToday = Boolean(activeStreak?.isFrozenToday) && !isHotToday;
            const pendingToday = Boolean(activeStreak?.pendingToday);
            const todaySenders = activeStreak?.todaySenderIds || [];
            const iWroteToday = todaySenders.includes(currentUser.id);
            const meta = getStreakVisualMeta(count, isHotToday, activeStreak?.isFrozenToday);
            const customLabel = activeStreak?.customName?.trim();
            const titleText = isFrozenToday
              ? `${customLabel || 'Огонёк'} • Заморожен на сегодня ❄️ — огонёк под защитой`
              : pendingToday
              ? iWroteToday
                ? `${customLabel || 'Огонёк'} • Вы написали сегодня — ждём ответ собеседника`
                : `${customLabel || 'Огонёк'} • Собеседник уже написал сегодня — ответьте, чтобы зажечь огонёк!`
              : count > 0
              ? `${customLabel || 'Огонёк'} • ${formatDaysLabel(count)} (нажмите, чтобы назвать или заморозить)`
              : 'Огонёк чата как в TikTok — напишите друг другу, чтобы зажечь';
            return (
              <button
                type="button"
                data-testid="chat-streak-badge"
                onClick={() => setIsStreakModalOpen(true)}
                title={titleText}
                className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-gradient-to-r ${meta.badgeGradient} ${meta.textColor} ${meta.ringColor} hover:brightness-110 transition-all cursor-pointer shadow-sm ${
                  activeStreak?.isAtRisk && !isFrozenToday ? 'animate-pulse' : ''
                }`}
              >
                <span aria-hidden="true">{meta.emoji}</span>
                <span className="tabular-nums">{count}</span>
                {isFrozenToday ? (
                  <span aria-hidden="true" className="text-[10px] leading-none">
                    ❄️
                  </span>
                ) : (
                  pendingToday && (
                    <span aria-hidden="true" className="text-[10px] leading-none">
                      ⏳
                    </span>
                  )
                )}
                {customLabel && (
                  <span className="hidden md:inline max-w-[110px] truncate font-semibold opacity-95">
                    · {customLabel}
                  </span>
                )}
              </button>
            );
          })()}
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {!activeGroup && (activeUser || isSavedMessages) && onOpenUserProfile && (
            <button
              type="button"
              data-testid="chat-header-profile-btn"
              onClick={() => onOpenUserProfile(isSavedMessages ? currentUser : activeUser!)}
              aria-label="Открыть профиль пользователя"
              title="Профиль пользователя"
              className="hidden sm:flex w-9 h-9 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] items-center justify-center transition-colors cursor-pointer"
            >
              <UserIcon className="w-[18px] h-[18px]" />
            </button>
          )}

          {activeGroup && (
            <button
              type="button"
              onClick={onOpenGroupInfo}
              aria-label="Информация о группе"
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center transition-colors cursor-pointer"
              title="Информация о группе"
            >
              <Info className="w-[18px] h-[18px]" />
            </button>
          )}

          {currentUser.isAdmin && activeUser && activeUser.id !== currentUser.id && (
            <button
              type="button"
              onClick={() => onToggleMuteUser(activeUser.id)}
              aria-label={activeUser.isMuted ? 'Размутить' : 'Замутить'}
              title={activeUser.isMuted ? 'Размутить' : 'Замутить'}
              className={`w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer border ${
                activeUser.isMuted
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25'
              }`}
            >
              {activeUser.isMuted ? (
                <>
                  <Volume2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Размутить</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Замутить</span>
                </>
              )}
            </button>
          )}

          {/* Listen Together YouTube Button */}
          {activeUser && (
            <button
              type="button"
              data-testid="chat-listen-together-btn"
              onClick={handleStartListenTogether}
              title="Слушать YouTube Музыку вместе"
              className="w-10 h-10 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] text-rose-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
            >
              <Youtube className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-rose-500 fill-rose-500/20" />
              <span className="hidden sm:inline">Слушать вместе</span>
            </button>
          )}

          {/* Mobile Search Toggle */}
          <button
            type="button"
            data-testid="chat-mobile-search-toggle"
            onClick={() => {
              setIsMobileSearchOpen(prev => {
                if (prev) setChatSearch('');
                return !prev;
              });
            }}
            aria-label="Поиск в чате"
            className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              isMobileSearchOpen || chatSearch
                ? 'bg-[var(--cc-accent-soft)] text-[var(--cc-accent-text)]'
                : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)]'
            }`}
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          <div className="relative hidden md:flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-[var(--cc-text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Поиск в чате..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              className="bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none w-44 transition-colors"
            />
            {chatSearch && (
              <button
                type="button"
                onClick={() => setChatSearch('')}
                aria-label="Очистить поиск в чате"
                className="absolute right-2 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Mobile In-Chat Search Bar */}
      {isMobileSearchOpen && (
        <div className="md:hidden px-3 py-2 bg-[var(--cc-bg-header)] border-b border-[var(--cc-border)] flex items-center gap-2 shrink-0 z-10 backdrop-blur-md">
          <div className="relative flex-1 flex items-center bg-[var(--cc-bg-surface)] rounded-xl border border-[var(--cc-border)] focus-within:border-[var(--cc-accent)]">
            <Search className="w-4 h-4 absolute left-3 text-[var(--cc-text-muted)] pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Поиск по сообщениям..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              className="w-full bg-transparent pl-9 pr-8 py-2 text-[16px] text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none"
            />
            {chatSearch && (
              <button
                type="button"
                onClick={() => setChatSearch('')}
                aria-label="Очистить"
                className="absolute right-2 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-1.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsMobileSearchOpen(false);
              setChatSearch('');
            }}
            className="px-2.5 py-2 text-xs font-semibold text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)] cursor-pointer shrink-0"
          >
            Отмена
          </button>
        </div>
      )}

      {/* Contact YouTube / VPN Access Alert Banner */}
      {musicAccessBanner && (
        <div
          data-testid="chat-music-access-banner"
          className="bg-rose-950/90 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between gap-3 text-xs text-rose-200 animate-fade-in z-20 shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{musicAccessBanner}</span>
            <span className="text-[11px] text-rose-300/80 hidden sm:inline truncate">
              (В регионе РФ без VPN доступ к YouTube заблокирован)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMusicAccessBanner(null)}
            className="text-rose-400 hover:text-white p-0.5 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pinned Message Banner */}
      {pinnedMessage && (
        <div
          data-testid="chat-pinned-banner"
          className="bg-[var(--cc-bg-header)]/95 border-b border-[var(--cc-border)] px-3 sm:px-5 py-2 flex items-center justify-between gap-2 z-10 shrink-0 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => {
              const targetEl = document.getElementById(`msg-${pinnedMessage.id}`);
              targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
          >
            <div className="w-0.5 h-7 rounded-full bg-[var(--cc-accent)] shrink-0" />
            <Pin className="w-3.5 h-3.5 text-[var(--cc-accent-text)] shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-[var(--cc-accent-text)] truncate">
                Закреплённое сообщение · {pinnedMessage.senderName}
              </div>
              <div className="text-xs text-[var(--cc-text-secondary)] truncate group-hover:text-[var(--cc-text)]">
                {buildReplyPreview(pinnedMessage).previewText}
              </div>
            </div>
          </button>
          {onPinMessage && (
            <button
              type="button"
              data-testid="chat-unpin-btn"
              onClick={() => onPinMessage(null)}
              aria-label="Открепить сообщение"
              title="Открепить"
              className="w-7 h-7 rounded-lg text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Streak Chat Wallpaper Overlay */}
      {activeStreakWallpaperId && activeStreakWallpaperId !== 'default' && (
        <div
          data-testid="chat-streak-wallpaper-overlay"
          aria-hidden="true"
          className={`absolute inset-0 pointer-events-none z-0 transition-opacity duration-300 ${getChatWallpaperItem(activeStreakWallpaperId).overlayClass}`}
        />
      )}

      {/* Centered Messages Stream */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 sm:px-6 py-3 sm:py-4 relative z-[1]"
      >
        <div className="max-w-[840px] mx-auto w-full min-h-full flex flex-col justify-end gap-2 sm:gap-2.5">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center my-auto text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] flex items-center justify-center text-[var(--cc-accent-text)] mb-3">
                <Paperclip className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-[var(--cc-text)]">Сообщений пока нет</p>
              <p className="text-xs text-[var(--cc-text-muted)] mt-1 max-w-xs leading-relaxed">
                Напишите приветствие, отправьте фото, голосовое сообщение или создайте опрос.
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              const sender = allUsers[msg.senderId];
              const senderName = isMe ? 'Вы' : sender?.name || msg.senderName || 'Пользователь';
              const time = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isRead = (msg.readBy || []).some(id => id !== msg.senderId);
              const isPickerOpen = openReactionPickerMsgId === msg.id;
              const isMobileActive = activeMobileMsgId === msg.id;
              const isToolbarActive = isPickerOpen || isMobileActive;

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={`group/msg flex w-full items-end gap-1.5 sm:gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    sender && onOpenUserProfile ? (
                      <button
                        type="button"
                        data-testid="msg-sender-avatar-btn"
                        onClick={() => onOpenUserProfile(sender)}
                        title={`Открыть профиль ${sender.name}`}
                        className="w-8 h-8 rounded-full bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border)] hover:border-[var(--cc-accent)] flex items-center justify-center text-xs font-semibold text-[var(--cc-text)] shrink-0 overflow-hidden mb-0.5 cursor-pointer transition-colors"
                      >
                        {sender.avatar ? (
                          <img src={sender.avatar} alt={sender.name} className="w-full h-full object-cover" />
                        ) : (
                          senderName[0]?.toUpperCase() || '?'
                        )}
                      </button>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border)] flex items-center justify-center text-xs font-semibold text-[var(--cc-text)] shrink-0 overflow-hidden mb-0.5">
                        {sender?.avatar ? (
                          <img src={sender.avatar} alt={sender.name} className="w-full h-full object-cover" />
                        ) : (
                          senderName[0]?.toUpperCase() || '?'
                        )}
                      </div>
                    )
                  )}

                  <div className={`flex flex-col max-w-[84%] sm:max-w-[70%] min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Floating Action Toolbar: tap-to-reveal on mobile (<md), hover/focus on desktop (md+) */}
                    <div
                      data-msg-toolbar
                      className={`relative z-20 mb-1 items-center gap-0.5 flex-wrap md:flex-nowrap rounded-2xl md:rounded-xl bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] px-1.5 py-1 md:py-0.5 shadow-lg transition-opacity duration-150 ${
                        isToolbarActive
                          ? 'flex opacity-100 pointer-events-auto'
                          : 'hidden md:flex md:opacity-0 md:pointer-events-none md:group-hover/msg:opacity-100 md:group-hover/msg:pointer-events-auto md:group-focus-within/msg:opacity-100 md:group-focus-within/msg:pointer-events-auto'
                      }`}
                    >
                      {(['👍', '❤️', '🔥'] as const).map((quickEmoji) => {
                        const rawList = msg.reactions?.[quickEmoji];
                        const list = Array.isArray(rawList)
                          ? rawList
                          : rawList && typeof rawList === 'object'
                          ? Object.values(rawList as Record<string, unknown>)
                          : [];
                        const isActive = list.includes(currentUser.id);
                        const label = quickEmoji === '👍' ? 'Лайк' : quickEmoji === '❤️' ? 'Сердце' : 'Огонь';
                        return (
                          <button
                            key={quickEmoji}
                            type="button"
                            onClick={() => {
                              onToggleReaction(msg.id, quickEmoji);
                              setOpenReactionPickerMsgId(null);
                              setActiveMobileMsgId(null);
                            }}
                            className={`w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-lg text-sm md:text-xs hover:bg-[var(--cc-bg-surface-hover)] transition-transform hover:scale-110 cursor-pointer ${
                              isActive ? 'bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent)]/50' : ''
                            }`}
                            title={label}
                          >
                            {quickEmoji}
                          </button>
                        );
                      })}

                      <div data-reaction-picker className="relative inline-flex items-center">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenReactionPickerMsgId(prev => (prev === msg.id ? null : msg.id))
                          }
                          aria-label="Выбрать реакцию"
                          title="Ещё реакции"
                          className={`w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-lg text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer ${
                            isPickerOpen ? 'bg-[var(--cc-accent-soft)] text-[var(--cc-text)]' : ''
                          }`}
                        >
                          <SmilePlus className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        </button>

                        {isPickerOpen && (
                          <div className={`absolute bottom-full ${isMe ? 'right-0' : 'left-0'} mb-2 z-30 flex items-center gap-1 bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] rounded-xl px-2 py-1.5 shadow-2xl`}>
                            {['😂', '😮', '😢', '👏', '🎉', '🚀'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  onToggleReaction(msg.id, emoji);
                                  setOpenReactionPickerMsgId(null);
                                  setActiveMobileMsgId(null);
                                }}
                                className="text-lg md:text-base hover:scale-125 transition-transform p-1 rounded-lg hover:bg-[var(--cc-bg-surface-hover)] cursor-pointer leading-none"
                                title={`Реакция ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <span className="w-px h-4 md:h-3.5 bg-[var(--cc-border)] mx-0.5" aria-hidden="true" />

                      <button
                        type="button"
                        data-testid="msg-reply-btn"
                        onClick={() => {
                          setReplyingTo(buildReplyPreview(msg, senderName));
                          setActiveMobileMsgId(null);
                          textareaRef.current?.focus();
                        }}
                        className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-lg text-[var(--cc-text-muted)] hover:text-[var(--cc-accent-text)] hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer"
                        title="Ответить"
                      >
                        <Reply className="w-4 h-4 md:w-3.5 md:h-3.5" />
                      </button>

                      {onPinMessage && (
                        <button
                          type="button"
                          data-testid="msg-pin-btn"
                          onClick={() => {
                            onPinMessage(pinnedMessage?.id === msg.id ? null : msg.id);
                            setActiveMobileMsgId(null);
                          }}
                          className={`w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                            pinnedMessage?.id === msg.id
                              ? 'text-amber-300 bg-amber-400/15'
                              : 'text-[var(--cc-text-muted)] hover:text-amber-300 hover:bg-[var(--cc-bg-surface-hover)]'
                          }`}
                          title={pinnedMessage?.id === msg.id ? 'Открепить' : 'Закрепить'}
                        >
                          <Pin className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSaveToBookmarks(msg);
                          setActiveMobileMsgId(null);
                        }}
                        className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-lg text-[var(--cc-text-muted)] hover:text-amber-300 hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer"
                        title="В Избранное"
                      >
                        <Bookmark className="w-4 h-4 md:w-3.5 md:h-3.5" />
                      </button>

                      {isMe && msg.type === 'text' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMsg(msg);
                            setInputText(msg.text || '');
                            setActiveMobileMsgId(null);
                          }}
                          className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-lg text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer"
                          title="Редактировать"
                        >
                          <Edit2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        </button>
                      )}

                      {isMe && (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteMessage(msg.id);
                            setActiveMobileMsgId(null);
                          }}
                          className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-lg text-[var(--cc-text-muted)] hover:text-red-400 hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Clean Message Bubble */}
                    <div
                      data-msg-bubble
                      onClick={(e) => {
                        if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
                        const target = e.target as HTMLElement | null;
                        if (target?.closest('button, a, img, video, audio, input, select, textarea')) return;
                        setActiveMobileMsgId(prev => (prev === msg.id ? null : msg.id));
                      }}
                      className={`w-full min-w-0 rounded-2xl px-3.5 py-2.5 relative shadow-sm transition-all ${
                        isMe
                          ? 'bg-[var(--cc-bg-bubble-out)] border border-[var(--cc-bg-bubble-out-border)] text-white rounded-br-sm'
                          : 'bg-[var(--cc-bg-bubble-in)] border border-[var(--cc-border)] text-[var(--cc-text)] rounded-bl-sm'
                      } ${isMobileActive ? 'ring-1 ring-[var(--cc-accent)]/60' : ''}`}
                    >
                      {!isMe && (
                        sender && onOpenUserProfile ? (
                          <button
                            type="button"
                            data-testid="msg-sender-name-btn"
                            onClick={() => onOpenUserProfile(sender)}
                            className="text-xs font-semibold text-[var(--cc-accent-text)] hover:underline mb-1 cursor-pointer text-left inline-flex items-center gap-1"
                          >
                            <span>{senderName}</span>
                            {sender.emojiStatus && sender.emojiStatus !== 'none' && (
                              <span className="text-[11px] leading-none">{getEmojiStatusItem(sender.emojiStatus).emoji}</span>
                            )}
                          </button>
                        ) : (
                          <div className="text-xs font-semibold text-[var(--cc-accent-text)] mb-1">
                            {senderName}
                          </div>
                        )
                      )}

                      {msg.replyTo && (
                        <button
                          type="button"
                          data-testid="msg-reply-quote"
                          onClick={() => {
                            const orig = document.getElementById(`msg-${msg.replyTo!.msgId}`);
                            orig?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className="w-full text-left mb-1.5 px-2.5 py-1.5 rounded-xl bg-black/20 border-l-2 border-[var(--cc-accent)] hover:bg-black/30 transition-colors cursor-pointer block"
                        >
                          <div className="text-[11px] font-bold text-[var(--cc-accent-text)] truncate">
                            {msg.replyTo.senderName}
                          </div>
                          <div className="text-[11px] opacity-80 truncate">
                            {msg.replyTo.previewText}
                          </div>
                        </button>
                      )}

                      {/* Image */}
                      {msg.type === 'image' && msg.imageUrl && (
                        <div>
                          <div className="mb-1.5 -mx-1 -mt-0.5 rounded-xl overflow-hidden bg-black/25">
                            <img
                              src={msg.imageUrl}
                              alt="Прикрепленное фото"
                              onClick={() => onOpenLightbox(msg.imageUrl!)}
                              className="max-h-72 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                            />
                          </div>
                          {msg.text && msg.text !== '📷 Фото' && (
                            <div className="text-[13.5px] break-words leading-relaxed">{msg.text}</div>
                          )}
                        </div>
                      )}

                      {/* Poll */}
                      {msg.type === 'poll' && msg.poll && (
                        <div className="w-[215px] sm:min-w-[230px] max-w-full py-0.5">
                          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1 opacity-75 flex items-center gap-1">
                            <BarChart3 className="w-3.5 h-3.5" /> Опрос
                          </div>
                          <div className="text-sm font-semibold mb-2">{msg.poll.question}</div>

                          {(() => {
                            const rawOptions = msg.poll.options as any;
                            const options = Array.isArray(rawOptions)
                              ? rawOptions
                              : rawOptions && typeof rawOptions === 'object'
                              ? Object.values(rawOptions)
                              : [];

                            const getVoters = (rawVoterIds: any): string[] =>
                              Array.isArray(rawVoterIds)
                                ? rawVoterIds.filter((x): x is string => typeof x === 'string')
                                : rawVoterIds && typeof rawVoterIds === 'object'
                                ? Object.values(rawVoterIds).filter((x): x is string => typeof x === 'string')
                                : [];

                            const totalVotes = options.reduce(
                              (acc: number, cur: any) => acc + getVoters(cur?.voterIds).length,
                              0
                            );
                            const userHasVoted = options.some((opt: any) =>
                              getVoters(opt?.voterIds).includes(currentUser.id)
                            );

                            return (
                              <>
                                {options.map((opt: any) => {
                                  const voters = getVoters(opt?.voterIds);
                                  const hasVoted = voters.includes(currentUser.id);
                                  const pct = totalVotes > 0 ? Math.round((voters.length / totalVotes) * 100) : 0;

                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => onVotePoll(msg.id, opt.id)}
                                      className={`w-full text-left rounded-xl p-2.5 mt-1.5 relative overflow-hidden border cursor-pointer block transition-all ${
                                        hasVoted
                                          ? 'border-emerald-400/70 bg-white/15'
                                          : 'border-white/12 bg-black/20 hover:bg-black/30'
                                      }`}
                                    >
                                      <div
                                        className={`absolute left-0 top-0 bottom-0 transition-all duration-300 ${
                                          hasVoted ? 'bg-emerald-400/25' : 'bg-white/12'
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                      <div className="relative z-10 flex items-center justify-between gap-2 text-xs font-medium">
                                        <span className="flex items-center gap-1.5">
                                          {hasVoted && <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
                                          <span>{opt.text}</span>
                                        </span>
                                        <span className="shrink-0 tabular-nums opacity-90">{pct}% ({voters.length})</span>
                                      </div>
                                    </button>
                                  );
                                })}
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] opacity-75">
                                  <span>
                                    {totalVotes > 0 ? `Всего голосов: ${totalVotes}` : 'Пока нет голосов'}
                                  </span>
                                  {userHasVoted && (
                                    <span>Нажмите ещё раз, чтобы отменить</span>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Voice with 1x / 1.5x / 2x Speed Toggle */}
                      {msg.type === 'voice' && msg.audioUrl && (
                        <VoicePlayerBubble audioUrl={msg.audioUrl} />
                      )}

                      {/* Video Circle */}
                      {msg.type === 'video_circle' && msg.videoUrl && (
                        <VideoCircleBubble
                          videoUrl={msg.videoUrl}
                          durationSec={msg.videoDurationSec}
                        />
                      )}

                      {/* Coin Envelope */}
                      {msg.type === 'coin_envelope' && msg.coinEnvelope && (
                        <CoinEnvelopeCard
                          msgId={msg.id}
                          envelope={msg.coinEnvelope}
                          currentUserId={currentUser.id}
                          onClaimEnvelope={onClaimCoinEnvelope}
                        />
                      )}

                      {/* Gift Trade Offer */}
                      {msg.type === 'trade_offer' && msg.tradeOffer && (
                        <TradeOfferCard
                          msgId={msg.id}
                          offer={msg.tradeOffer}
                          currentUserId={currentUser.id}
                          onRespondTrade={onRespondTradeOffer}
                        />
                      )}

                      {/* Shared YouTube Music Track */}
                      {msg.type === 'music_share' && msg.musicShare && (() => {
                        const isLiveMatch = Boolean(listenSession && listenSession.trackId === msg.musicShare.trackId);
                        const livePosSec = isLiveMatch && listenSession
                          ? computeSynchronizedPositionSec(listenSession, liveSyncNowMs + serverTimeOffsetMs)
                          : 0;
                        const effectiveDur = (isLiveMatch && listenSession?.durationSec) || msg.musicShare.durationSec;
                        const progressPct = effectiveDur > 0 ? Math.min(100, (livePosSec / effectiveDur) * 100) : 0;

                        return (
                        <div className="p-3 rounded-2xl bg-slate-900/90 border border-rose-500/35 w-full max-w-sm space-y-2.5 shadow-lg my-1">
                          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-semibold text-rose-400">
                            <div className="flex items-center gap-1.5">
                              <Youtube className="w-3.5 h-3.5 fill-rose-500/30" />
                              <span>YouTube Music • Совместное прослушивание</span>
                            </div>
                            {isLiveMatch && listenSession && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono normal-case">
                                <span className={`w-1.5 h-1.5 rounded-full ${listenSession.isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                                {formatYouTubeDuration(livePosSec)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <img
                              src={msg.musicShare.thumbnail}
                              alt={msg.musicShare.title}
                              className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-950 border border-slate-800 shadow-sm"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-white truncate" title={msg.musicShare.title}>
                                {msg.musicShare.title}
                              </div>
                              <div className="text-xs text-slate-300 truncate mt-0.5">
                                {msg.musicShare.artist}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                                <span>
                                  {isLiveMatch
                                    ? `${formatYouTubeDuration(livePosSec)} / ${formatYouTubeDuration(effectiveDur)}`
                                    : formatYouTubeDuration(effectiveDur)}
                                </span>
                                {msg.musicShare.genre && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-rose-300 font-medium">
                                    {msg.musicShare.genre}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isLiveMatch && effectiveDur > 0 && (
                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-rose-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (activeUser) {
                                const check = checkContactYouTubeAccess(activeUser);
                                if (!check.allowed) {
                                  setMusicAccessBanner(check.message || MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT);
                                  return;
                                }
                              }
                              onOpenMusicPlayer?.({
                                id: msg.musicShare!.trackId,
                                title: msg.musicShare!.title,
                                artist: msg.musicShare!.artist,
                                durationSec: msg.musicShare!.durationSec,
                                thumbnail: msg.musicShare!.thumbnail,
                                genre: (msg.musicShare!.genre as any) || 'pop'
                              });
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>
                              {isLiveMatch && listenSession
                                ? (listenSession.isPlaying
                                    ? `Слушать синхронно (${formatYouTubeDuration(livePosSec)})`
                                    : `На паузе (${formatYouTubeDuration(livePosSec)})`)
                                : 'Слушать в плеере'}
                            </span>
                          </button>
                        </div>
                        );
                      })()}

                      {/* Cat Card */}
                      {msg.type === 'cat_card' && msg.catShare && (
                        <CatCardMessage
                          msgId={msg.id}
                          currentUserId={currentUser.id}
                          catShare={msg.catShare}
                          senderName={senderName}
                          isMe={isMe}
                          onOpenMinigame={onOpenCatGame}
                          onFeedFriendCat={(owner, catName) => {
                            showGiftToast(`🐟 Вы покормили котика ${catName || owner} за 500 🪙!`);
                          }}
                        />
                      )}

                      {/* Cat Reaction Sticker */}
                      {msg.type === 'cat_sticker' && msg.catSticker && (
                        <CatStickerMessage sticker={msg.catSticker} />
                      )}

                      {/* Gift Card */}
                      {msg.type === 'gift' && msg.giftData && (() => {
                        const ownedGift = ownedGifts.find(g => g.sourceMsgId === msg.id) || null;
                        const giftStatus = claimedGiftStatuses[msg.id];
                        const unsellable = isGiftUnsellable(ownedGift || msg.giftData);
                        const coinValue = unsellable ? 0 : (ownedGift?.coinValue ?? getGiftCoinValue(msg.giftData.starsCost));
                        const catMeta = getGiftCatalogItem(msg.giftData.giftId);

                        return (
                          <div
                            data-testid="gift-card-message"
                            className={`relative w-full max-w-[320px] rounded-2xl bg-gradient-to-br ${catMeta.gradientClass} border-2 ${
                              msg.giftData.isHolo ? 'border-amber-300 ring-1 ring-fuchsia-300/60' : catMeta.borderClass
                            } p-4 text-white shadow-xl space-y-2.5 my-1 select-none`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black uppercase tracking-wider text-amber-200">
                                {unsellable
                                  ? '🔨 Реликвия крафта'
                                  : msg.giftData.isHolo
                                  ? '✨ Holo Подарок'
                                  : msg.giftData.regiftedFrom
                                  ? '🔁 Передаренный подарок'
                                  : '🎁 Подарок в чат'}
                              </span>
                              <span className="text-xs font-black text-amber-200 tabular-nums">
                                {typeof msg.giftData.serialNumber === 'number' ? `#${msg.giftData.serialNumber} · ` : ''}
                                {unsellable ? 'Эксклюзив' : `${msg.giftData.starsCost} ⭐`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 py-1">
                              <div className="w-14 h-14 rounded-2xl bg-white/15 border-2 border-white/30 flex items-center justify-center text-4xl shrink-0 shadow-inner animate-bounce">
                                {msg.giftData.emoji}
                              </div>
                              <div className="min-w-0">
                                <div className="text-base font-black text-amber-100 truncate">
                                  {msg.giftData.title}
                                </div>
                                <div className="text-[11px] text-white/80">
                                  {catMeta.rarityLabel}
                                </div>
                                <div className="text-xs text-blue-100 font-medium">
                                  {(isMe ? currentUser : sender) && onOpenUserProfile ? (
                                    <button
                                      type="button"
                                      onClick={() => onOpenUserProfile(isMe ? currentUser : sender!)}
                                      className="hover:underline text-amber-100 cursor-pointer text-left"
                                    >
                                      от {senderName}
                                    </button>
                                  ) : (
                                    <span>от {senderName}</span>
                                  )}
                                </div>
                                {msg.giftData.originalSenderName && msg.giftData.regiftedFrom && msg.giftData.originalSenderName !== msg.giftData.regiftedFrom && (
                                  <div className="text-[11px] text-amber-200/85">
                                    изначально от {msg.giftData.originalSenderName}
                                  </div>
                                )}
                              </div>
                            </div>
                            {msg.giftData.message && (
                              <div className="bg-black/25 border border-white/20 rounded-xl px-3 py-2 text-xs font-semibold text-amber-100 italic">
                                «{msg.giftData.message}»
                              </div>
                            )}

                            {ownedGift ? (
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <button
                                  type="button"
                                  data-testid="chat-gift-card-regift-btn"
                                  onClick={() => {
                                    setRegiftModalGift(ownedGift);
                                    setRegiftNote('');
                                  }}
                                  className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Repeat className="w-3 h-3 shrink-0" />
                                  <span>{unsellable ? 'Подарить' : 'Передарить'}</span>
                                </button>
                                {unsellable ? (
                                  <div
                                    data-testid="chat-gift-card-unsellable-badge"
                                    className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-black/35 border border-rose-300/35 text-rose-100 text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap"
                                  >
                                    <Lock className="w-3 h-3 shrink-0" />
                                    <span>Не продаётся</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    data-testid="chat-gift-card-exchange-btn"
                                    onClick={() => {
                                      if (!onExchangeGiftForCoins) return;
                                      const res = onExchangeGiftForCoins(ownedGift);
                                      if (res) {
                                        showGiftToast(`Обменено: +${formatCoinsCount(res.coinsEarned)} 🪙!`);
                                      }
                                    }}
                                    className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black flex items-center justify-center gap-1 transition-colors cursor-pointer tabular-nums whitespace-nowrap"
                                  >
                                    <Coins className="w-3 h-3 shrink-0" />
                                    <span>+{formatCoinsCount(coinValue)} 🪙</span>
                                  </button>
                                )}
                              </div>
                            ) : giftStatus === 'exchanged' ? (
                              <div className="text-[11px] font-semibold text-amber-200/80 pt-0.5">
                                ✓ Обменено на {formatCoinsCount(coinValue)} монет
                              </div>
                            ) : giftStatus === 'regifted' ? (
                              <div className="text-[11px] font-semibold text-blue-200/80 pt-0.5">
                                ✓ Подарок передарен в другой чат
                              </div>
                            ) : giftStatus === 'crafted' ? (
                              <div className="text-[11px] font-semibold text-purple-200/85 pt-0.5">
                                ⚒️ Использовано в крафте (10 → 1)
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}

                      {/* Text */}
                      {msg.type === 'text' && (
                        <div className="text-[13.5px] break-words leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </div>
                      )}

                      {/* Active Reactions Row */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(msg.reactions).map(([emoji, rawUids]) => {
                            const uids = Array.isArray(rawUids)
                              ? rawUids.filter((x): x is string => typeof x === 'string')
                              : rawUids && typeof rawUids === 'object'
                              ? Object.values(rawUids as Record<string, unknown>).filter((x): x is string => typeof x === 'string')
                              : [];
                            if (uids.length === 0) return null;
                            const isMyReaction = uids.includes(currentUser.id);
                            const voterNames = uids
                              .map(uid => (uid === currentUser.id ? 'Вы' : allUsers[uid]?.name || 'Пользователь'))
                              .join(', ');
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => onToggleReaction(msg.id, emoji)}
                                title={voterNames}
                                className={`px-2 py-0.5 rounded-lg text-xs border transition-colors cursor-pointer tabular-nums ${
                                  isMyReaction
                                    ? 'bg-white/20 border-white/45 text-white font-semibold'
                                    : 'bg-black/20 border-white/12 text-[var(--cc-text-secondary)] hover:bg-black/30'
                                }`}
                              >
                                {emoji} {uids.length}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Compact Timestamp, Disappearing Countdown & Read Receipts */}
                      <div className="text-[10.5px] flex items-center justify-end gap-1 mt-1 opacity-75 tabular-nums">
                        {typeof msg.expiresAt === 'number' && msg.expiresAt > nowClockMs && (
                          <span
                            data-testid="secret-msg-countdown"
                            className="inline-flex items-center gap-0.5 text-amber-300 font-semibold mr-1"
                            title="Исчезающее сообщение"
                          >
                            <Timer className="w-3 h-3" />
                            {Math.max(1, Math.ceil((msg.expiresAt - nowClockMs) / 1000))}с
                          </span>
                        )}
                        {msg.editedAt && <span className="italic mr-0.5">изм.</span>}
                        <span>{time}</span>
                        {isMe && (
                          isRead ? (
                            <span title="Прочитано" className="inline-flex">
                              <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                            </span>
                          ) : (
                            <span title="Доставлено" className="inline-flex">
                              <Check className="w-3.5 h-3.5 text-white/75" />
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Bottom Composer */}
      <div className="px-2.5 sm:px-6 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:pb-4 pt-2 shrink-0 bg-gradient-to-t from-[var(--cc-bg-app)] via-[var(--cc-bg-app)]/95 to-transparent">
        <div className="max-w-[840px] mx-auto w-full">
          {currentUser.isMuted ? (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-2xl text-center text-xs text-red-400 font-medium">
              <VolumeX className="w-4 h-4 inline mr-1.5" />
              Вы замучены администратором и не можете отправлять сообщения.
            </div>
          ) : (
            <>
              {attachedImage && (
                <div className="mb-2 px-3 py-2 bg-[var(--cc-bg-surface)] border border-[var(--cc-border-strong)] rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={attachedImage}
                      alt="Превью"
                      className="w-11 h-11 rounded-lg object-cover border border-[var(--cc-border)] shrink-0"
                    />
                    <div className="text-xs min-w-0">
                      <div className="text-[var(--cc-text)] font-medium truncate">Фотография прикреплена</div>
                      <div className="text-[var(--cc-text-muted)] text-[11px] truncate">Добавьте подпись или отправьте</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    aria-label="Убрать фото"
                    className="text-[var(--cc-text-muted)] hover:text-red-400 p-2 rounded-lg hover:bg-[var(--cc-bg-surface-hover)] cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {replyingTo && (
                <div
                  data-testid="composer-reply-banner"
                  className="mb-2 px-3 py-2 bg-[var(--cc-bg-surface-elevated)] border-l-2 border-[var(--cc-accent)] border border-[var(--cc-border)] rounded-xl text-xs text-[var(--cc-text)] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Reply className="w-3.5 h-3.5 text-[var(--cc-accent-text)] shrink-0" />
                    <div className="min-w-0 truncate">
                      <div className="font-semibold text-[var(--cc-accent-text)] truncate">
                        Ответ для {replyingTo.senderName}
                      </div>
                      <div className="text-[var(--cc-text-secondary)] truncate">
                        {replyingTo.previewText}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    aria-label="Отменить ответ"
                    className="text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-1.5 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {editingMsg && (
                <div className="mb-2 px-3 py-2 bg-[var(--cc-accent-soft)] border border-[var(--cc-accent)]/35 rounded-xl text-xs text-[var(--cc-text)] flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Edit2 className="w-3.5 h-3.5 text-[var(--cc-accent-text)] shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-[var(--cc-accent-text)] mr-1.5">Редактирование:</span>
                      <span className="text-[var(--cc-text-secondary)]">{editingMsg.text}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMsg(null);
                      setInputText('');
                    }}
                    aria-label="Отменить редактирование"
                    className="text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {voiceError && (
                <div className="mb-2 px-3 py-2 bg-red-950/80 border border-red-500/35 rounded-xl text-xs text-red-100 flex items-start justify-between gap-2 leading-relaxed">
                  <span>{voiceError}</span>
                  <button
                    type="button"
                    onClick={() => setVoiceError(null)}
                    aria-label="Закрыть предупреждение"
                    className="text-red-300 hover:text-white p-1 shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Mobile Thumb-Friendly Actions Drawer */}
              {isMobileActionsOpen && (
                <div
                  data-testid="chat-mobile-actions-drawer"
                  className="sm:hidden mb-2 p-2.5 rounded-2xl bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] shadow-2xl grid grid-cols-4 gap-1.5 animate-fade-in"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileActionsOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="min-h-[58px] p-2 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--cc-text)] cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4 text-sky-400" />
                    <span>Фото</span>
                  </button>

                  <button
                    type="button"
                    data-testid="mobile-chat-video-circle-btn"
                    onClick={() => {
                      setIsMobileActionsOpen(false);
                      openVideoCircleRecorder();
                    }}
                    className="min-h-[58px] p-2 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--cc-text)] cursor-pointer"
                  >
                    <Video className="w-4 h-4 text-cyan-400" />
                    <span>Кружок</span>
                  </button>

                  <button
                    type="button"
                    data-testid="mobile-chat-gift-btn"
                    onClick={() => {
                      setIsMobileActionsOpen(false);
                      setIsGiftModalOpen(true);
                    }}
                    className="min-h-[58px] p-2 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-purple-200 cursor-pointer"
                  >
                    <Gift className="w-4 h-4 text-purple-400" />
                    <span>Подарок</span>
                  </button>

                  {onSendCoinEnvelope && (
                    <button
                      type="button"
                      data-testid="mobile-chat-envelope-btn"
                      onClick={() => {
                        setIsMobileActionsOpen(false);
                        setIsEnvelopeModalOpen(true);
                      }}
                      className="min-h-[58px] p-2 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-rose-200 cursor-pointer"
                    >
                      <Banknote className="w-4 h-4 text-rose-400" />
                      <span>Конверт</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="mobile-chat-cat-share-btn"
                    onClick={() => {
                      setIsMobileActionsOpen(false);
                      setIsCatShareModalOpen(true);
                    }}
                    className="min-h-[58px] p-2 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-amber-200 cursor-pointer"
                  >
                    <Cat className="w-4 h-4 text-amber-400" />
                    <span>Котик</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileActionsOpen(false);
                      onOpenPollModal();
                    }}
                    className="min-h-[58px] p-2 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--cc-text)] cursor-pointer"
                  >
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span>Опрос</span>
                  </button>

                  <button
                    type="button"
                    data-testid="mobile-chat-secret-timer-btn"
                    onClick={() => {
                      const idx = SECRET_MESSAGE_TTL_OPTIONS.findIndex(o => o.seconds === secretTtlSeconds);
                      const next = SECRET_MESSAGE_TTL_OPTIONS[(idx + 1) % SECRET_MESSAGE_TTL_OPTIONS.length];
                      setSecretTtlSeconds(next.seconds);
                    }}
                    className={`min-h-[58px] p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-[11px] font-semibold cursor-pointer tabular-nums ${
                      secretTtlSeconds > 0
                        ? 'bg-amber-400/20 border-amber-400/50 text-amber-200'
                        : 'bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border-[var(--cc-border)] text-[var(--cc-text)]'
                    }`}
                  >
                    <Timer className={`w-4 h-4 ${secretTtlSeconds > 0 ? 'text-amber-300' : 'text-[var(--cc-text-muted)]'}`} />
                    <span>
                      {secretTtlSeconds > 0
                        ? SECRET_MESSAGE_TTL_OPTIONS.find(o => o.seconds === secretTtlSeconds)?.label
                        : 'Таймер'}
                    </span>
                  </button>
                </div>
              )}

              <div className="w-full flex items-end gap-1 sm:gap-1.5 bg-[var(--cc-bg-surface)] border border-[var(--cc-border-strong)] focus-within:border-[var(--cc-accent)] rounded-2xl p-1 sm:p-1.5 shadow-lg transition-colors min-w-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                />

                {/* Mobile '+' Actions Toggle */}
                <button
                  type="button"
                  data-testid="chat-mobile-actions-btn"
                  onClick={() => setIsMobileActionsOpen(prev => !prev)}
                  aria-label="Дополнительные действия"
                  aria-expanded={isMobileActionsOpen}
                  className={`sm:hidden w-11 h-11 flex items-center justify-center rounded-xl transition-all shrink-0 cursor-pointer relative ${
                    isMobileActionsOpen
                      ? 'bg-[var(--cc-accent-soft)] text-[var(--cc-accent-text)]'
                      : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)]'
                  }`}
                >
                  <Plus className={`w-5 h-5 transition-transform duration-150 ${isMobileActionsOpen ? 'rotate-45' : ''}`} />
                  {secretTtlSeconds > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[var(--cc-bg-surface)]" />
                  )}
                </button>

                {/* Desktop Inline Action Toolbar */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Прикрепить изображение"
                  className="hidden sm:flex w-10 h-10 items-center justify-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Прикрепить фото"
                >
                  <Paperclip className="w-[18px] h-[18px]" />
                </button>

                <button
                  type="button"
                  onClick={onOpenPollModal}
                  aria-label="Создать опрос"
                  className="hidden sm:flex w-10 h-10 items-center justify-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Создать опрос"
                >
                  <BarChart3 className="w-[18px] h-[18px]" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsCatShareModalOpen(true)}
                  aria-label="Отправить котика в чат"
                  className="hidden sm:flex w-10 h-10 items-center justify-center text-[var(--cc-text-muted)] hover:text-amber-400 hover:bg-[var(--cc-bg-surface-hover)] rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Отправить котика в чат"
                  data-testid="chat-cat-share-btn"
                >
                  <Cat className="w-[18px] h-[18px]" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsGiftModalOpen(true)}
                  aria-label="Подарки в чат"
                  className="hidden sm:flex w-10 h-10 items-center justify-center text-purple-300 hover:text-amber-300 hover:bg-purple-500/20 rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Магазин подарков в чат (5 — 250 ⭐)"
                  data-testid="chat-gift-btn"
                >
                  <Gift className="w-[18px] h-[18px]" />
                </button>

                {onSendCoinEnvelope && (
                  <button
                    type="button"
                    data-testid="chat-envelope-btn"
                    onClick={() => setIsEnvelopeModalOpen(true)}
                    aria-label="Конверт с монетами"
                    title="Отправить конверт с монетами в чат"
                    className="hidden sm:flex w-10 h-10 items-center justify-center text-rose-300 hover:text-amber-300 hover:bg-rose-500/20 rounded-xl transition-colors shrink-0 cursor-pointer"
                  >
                    <Banknote className="w-[18px] h-[18px]" />
                  </button>
                )}

                <button
                  type="button"
                  data-testid="chat-video-circle-btn"
                  onClick={openVideoCircleRecorder}
                  aria-label="Записать видеокружок"
                  title="Записать видеокружок"
                  className="hidden sm:flex w-10 h-10 items-center justify-center text-[var(--cc-text-muted)] hover:text-sky-300 hover:bg-[var(--cc-bg-surface-hover)] rounded-xl transition-colors shrink-0 cursor-pointer"
                >
                  <Video className="w-[18px] h-[18px]" />
                </button>

                <button
                  type="button"
                  data-testid="chat-secret-timer-btn"
                  onClick={() => {
                    const idx = SECRET_MESSAGE_TTL_OPTIONS.findIndex(o => o.seconds === secretTtlSeconds);
                    const next = SECRET_MESSAGE_TTL_OPTIONS[(idx + 1) % SECRET_MESSAGE_TTL_OPTIONS.length];
                    setSecretTtlSeconds(next.seconds);
                  }}
                  aria-label="Таймер исчезающих сообщений"
                  title="Таймер исчезающих сообщений (Выкл / 10с / 1м / 5м)"
                  className={`hidden sm:flex h-10 px-2 items-center justify-center gap-1 rounded-xl transition-colors shrink-0 cursor-pointer text-[11px] font-bold tabular-nums whitespace-nowrap ${
                    secretTtlSeconds > 0
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)]'
                  }`}
                >
                  <Timer className="w-4 h-4 shrink-0" />
                  {secretTtlSeconds > 0 && (
                    <span>
                      {SECRET_MESSAGE_TTL_OPTIONS.find(o => o.seconds === secretTtlSeconds)?.label}
                    </span>
                  )}
                </button>

                {isRecording ? (
                  <div className="flex-1 min-w-0 bg-rose-500/10 border border-rose-500/30 rounded-xl px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 min-h-[44px] sm:min-h-[40px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <span className="text-xs font-mono text-rose-400 font-bold tabular-nums shrink-0">
                        {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
                        {String(recordSeconds % 60).padStart(2, '0')}
                      </span>
                      <span className="text-xs text-rose-300 hidden sm:inline truncate">Запись аудио</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={cancelRecording}
                        className="text-xs text-[var(--cc-text-secondary)] hover:text-white px-2.5 py-1.5 rounded-lg bg-[var(--cc-bg-surface-elevated)] cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={sendRecording}
                        className="text-xs text-white px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 font-medium cursor-pointer"
                      >
                        Отправить
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      placeholder="Сообщение..."
                      value={inputText}
                      onChange={handleTextChange}
                      onKeyDown={handleKeyDown}
                      className="flex-1 min-w-0 self-center bg-transparent resize-none outline-none text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] placeholder:truncate px-2 sm:px-2.5 py-2.5 leading-5 text-[16px] sm:text-[14px] max-h-32 min-h-[44px] sm:min-h-[40px] overflow-y-auto"
                    />

                    <button
                      type="button"
                      onClick={startRecording}
                      aria-label="Записать голосовое сообщение"
                      className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] rounded-xl transition-colors shrink-0 cursor-pointer"
                      title="Голосовое сообщение"
                    >
                      <Mic className="w-[19px] h-[19px] sm:w-[18px] sm:h-[18px]" />
                    </button>

                    <button
                      type="button"
                      onClick={handleSend}
                      aria-label="Отправить сообщение"
                      className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white rounded-xl shadow-sm shrink-0 transition-colors cursor-pointer"
                      title="Отправить"
                    >
                      <Send className="w-[19px] h-[19px] sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cat Share Modal */}
      {isCatShareModalOpen && (() => {
        const previewCatData = getCurrentCatData();
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsCatShareModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Отправить котика в чат"
              onClick={e => e.stopPropagation()}
              data-testid="chat-cat-share-modal"
              className="w-full max-w-md bg-slate-900 border-2 border-amber-400/40 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 flex flex-col gap-3.5 text-slate-100 max-h-[92dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🐱</span>
                  <h3 className="text-base font-extrabold text-white">
                    Отправить котика в чат
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCatShareModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cat Card Preview */}
              <div className="flex justify-center">
                <CatCardMessage
                  catShare={previewCatData}
                  senderName="Вы"
                  isMe={true}
                />
              </div>

              {/* Quick Cat Stickers Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Быстрые стикеры с вашим котиком (в 1 клик)
                  </label>
                  <span className="text-[10px] text-amber-300/80 font-medium">
                    Наряд сохраняется
                  </span>
                </div>
                <div
                  data-testid="chat-cat-stickers-grid"
                  className="grid grid-cols-3 gap-1.5"
                >
                  {CAT_STICKER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSendCatSticker(preset)}
                      data-testid={`chat-cat-sticker-${preset.id}`}
                      className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/60 text-left transition-all cursor-pointer active:scale-95"
                    >
                      <span className="text-base shrink-0">{preset.emoji}</span>
                      <span className="text-[11px] font-bold text-slate-100 truncate">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cat Custom Name Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Имя вашего котика (независимо от названия огонька)
                </label>
                <input
                  type="text"
                  value={catEconomy.catName}
                  onChange={e => handleCatNameChangeInModal(e.target.value)}
                  placeholder="Например: Барсик, Космо-Котик..."
                  maxLength={25}
                  data-testid="chat-cat-custom-name-input"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[16px] sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Note Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Подпись к котику (необязательно)
                </label>
                <input
                  type="text"
                  value={catShareNote}
                  onChange={e => setCatShareNote(e.target.value)}
                  placeholder="Например: Зацени, как я нарядил(а) котика! 😻"
                  maxLength={120}
                  data-testid="chat-cat-share-note-input"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[16px] sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {onOpenCatGame && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCatShareModalOpen(false);
                      onOpenCatGame();
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>🎨</span> Нарядить в игре
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsCatShareModalOpen(false)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    onClick={handleSendCatCard}
                    data-testid="chat-cat-share-submit-btn"
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Отправить</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TikTok-Style Chat Streak Modal */}
      {isStreakModalOpen && activeStreakKey && (() => {
        const count = activeStreak?.count || 0;
        const isHotToday = Boolean(activeStreak?.isHotToday);
        const isFrozenToday = Boolean(activeStreak?.isFrozenToday) && !isHotToday;
        const isAtRisk = Boolean(activeStreak?.isAtRisk);
        const canRescueYesterday = Boolean(activeStreak?.canRescueYesterday);
        const rescuableCount = activeStreak?.rescuableCount || 0;
        const pendingToday = Boolean(activeStreak?.pendingToday);
        const todaySenderIds = activeStreak?.todaySenderIds || [];
        const requiredSenders = activeStreak?.requiredSenders ?? (isSavedMessages ? 1 : 2);
        const iWroteToday = todaySenderIds.includes(currentUser.id);
        const partnerWroteToday = activeUser
          ? todaySenderIds.includes(activeUser.id)
          : todaySenderIds.some(id => id !== currentUser.id);
        const meta = getStreakVisualMeta(count, isHotToday, activeStreak?.isFrozenToday);

        const todayKey = getLocalDayKey();
        const yesterdayKey = shiftDayKey(todayKey, -1);
        const freezeTargetDay = canRescueYesterday && count === 0 ? yesterdayKey : todayKey;
        const canPurchaseFreeze =
          Boolean(onFreezeStreak) &&
          !isHotToday &&
          ((canRescueYesterday && count === 0) || (count > 0 && !isFrozenToday));
        const hasEnoughStarsForFreeze = catEconomy.stars >= STREAK_FREEZE_STARS;
        const missingStarsForFreeze = Math.max(0, STREAK_FREEZE_STARS - catEconomy.stars);
        const canQuickConvertMissingStars =
          missingStarsForFreeze > 0 && catEconomy.coins >= missingStarsForFreeze * COINS_PER_STAR;

        const handleBuyStreakFreeze = () => {
          if (!onFreezeStreak || !canPurchaseFreeze) return;
          const current = readCatEconomy();
          const spend = spendStarsForStreakFreeze(current.stars);
          if (!spend.purchased) return;
          try {
            localStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.stars, currentUser.id), String(spend.nextStars));
            window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'chat_area' } }));
          } catch {}
          setCatEconomy({ ...current, stars: spend.nextStars });
          onFreezeStreak(activeStreakKey, freezeTargetDay);
        };

        let statusText = '';
        if (isHotToday) {
          statusText = requiredSenders === 1
            ? 'Горит сегодня! Продолжайте писать каждый день.'
            : activeGroup
            ? 'Горит сегодня! Участники обменялись сообщениями 🔥'
            : 'Горит сегодня! Вы оба написали друг другу 🔥';
        } else if (isFrozenToday) {
          statusText = 'Заморожен на сегодня ❄️ Огонёк защищён и не сгорит до завтра!';
        } else if (pendingToday) {
          if (iWroteToday) {
            statusText = count > 0
              ? 'Вы уже написали сегодня! Ждём ответ собеседника, чтобы продлить огонёк.'
              : 'Вы уже написали сегодня! Как только собеседник ответит, зажжётся 1-й день огонька.';
          } else {
            statusText = count > 0
              ? 'Собеседник уже написал сегодня! Отправьте ответ, чтобы огонёк не потух.'
              : 'Собеседник уже написал сегодня! Ответьте ему, чтобы зажечь 1-й день огонька.';
          }
        } else if (isAtRisk) {
          statusText = requiredSenders === 1
            ? 'Напишите сообщение сегодня, чтобы огонёк не потух!'
            : 'Напишите друг другу сегодня (оба участника), чтобы огонёк не потух!';
        } else if (canRescueYesterday) {
          statusText = `Вчера огонёк (${formatDaysLabel(rescuableCount)}) прервался — успейте спасти его заморозкой!`;
        } else {
          statusText = requiredSenders === 1
            ? 'Отправьте сообщение в Избранное, чтобы зажечь 1-й день огонька!'
            : 'Напишите друг другу в один день (оба участника), чтобы зажечь 1-й день огонька!';
        }

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsStreakModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Огонёк чата"
              onClick={e => e.stopPropagation()}
              data-testid="chat-streak-modal"
              className="w-full max-w-md bg-slate-900 border-2 border-orange-400/50 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 flex flex-col gap-3.5 text-slate-100 max-h-[92dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-400 fill-orange-500" />
                  <h3 className="text-base font-extrabold text-white">
                    Огонёк чата (как в TikTok)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStreakModalOpen(false)}
                  aria-label="Закрыть окно огонька"
                  className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5 sm:w-4 sm:h-4" />
                </button>
              </div>

              <div className={`rounded-2xl p-4 bg-gradient-to-br ${meta.badgeGradient} border ${meta.ringColor} flex items-center gap-4 shadow-lg`}>
                <div className="w-14 h-14 rounded-2xl bg-black/30 border border-white/20 flex items-center justify-center text-4xl shrink-0 relative">
                  <span>{meta.emoji}</span>
                  {isFrozenToday && (
                    <span className="absolute -bottom-1 -right-1 text-base drop-shadow" aria-hidden="true">
                      ❄️
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/80">
                    {meta.tierTitle}
                  </div>
                  <div className="text-xl font-black text-white leading-tight mt-0.5">
                    {count > 0 ? formatDaysLabel(count) : 'Огонёк ещё не зажжён'}
                  </div>
                  <div className="text-xs text-white/90 mt-1" data-testid="streak-status-text">
                    {statusText}
                  </div>
                </div>
              </div>

              {requiredSenders > 1 && (
                <div
                  data-testid="streak-mutual-progress"
                  className="grid grid-cols-2 gap-2 text-xs"
                >
                  <div className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${
                    iWroteToday
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400'
                  }`}>
                    <span aria-hidden="true">{iWroteToday ? '✅' : '⏳'}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-white/90 truncate">Вы сегодня</div>
                      <div className="text-[11px] opacity-85 truncate">
                        {iWroteToday ? 'Написали' : 'Ещё не писали'}
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${
                    partnerWroteToday
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400'
                  }`}>
                    <span aria-hidden="true">{partnerWroteToday ? '✅' : '⏳'}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-white/90 truncate">
                        {activeGroup ? 'Другой участник' : 'Собеседник'}
                      </div>
                      <div className="text-[11px] opacity-85 truncate">
                        {partnerWroteToday ? 'Ответил(а)' : 'Ждём ответ'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Streak Freeze Card (10 Stars) */}
              <div
                data-testid="streak-freeze-card"
                className="rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-cyan-950/60 via-slate-900 to-sky-950/50 p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">❄️</span>
                    <div>
                      <div className="text-xs font-extrabold text-cyan-200">
                        Заморозка огонька
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Ледяной щит на 1 день — стоит <strong className="text-amber-300">{STREAK_FREEZE_STARS} ⭐</strong>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-amber-300 tabular-nums" data-testid="streak-modal-stars-balance">
                      {catEconomy.stars} ⭐
                    </div>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      {formatCoinsCount(catEconomy.coins)} 🪙
                    </div>
                  </div>
                </div>

                {isHotToday ? (
                  <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2">
                    🔥 Огонёк уже горит сегодня — заморозка сейчас не требуется.
                  </div>
                ) : isFrozenToday ? (
                  <div
                    data-testid="streak-frozen-active-banner"
                    className="text-[11px] text-cyan-200 bg-cyan-500/15 border border-cyan-400/35 rounded-xl px-3 py-2 font-medium"
                  >
                    ❄️ Ледяной щит активен! Огонёк защищён на сегодня и не потухнет до завтра.
                  </div>
                ) : canPurchaseFreeze ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleBuyStreakFreeze}
                      disabled={!hasEnoughStarsForFreeze}
                      data-testid="streak-freeze-btn"
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md ${
                        hasEnoughStarsForFreeze
                          ? 'bg-gradient-to-r from-cyan-500 to-sky-500 hover:brightness-110 text-slate-950 cursor-pointer active:scale-[0.99]'
                          : 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                      }`}
                    >
                      <span>❄️</span>
                      <span>
                        {canRescueYesterday && count === 0
                          ? `Спасти вчерашний огонёк (${formatDaysLabel(rescuableCount)}) за ${STREAK_FREEZE_STARS} ⭐`
                          : `Заморозить огонёк на сегодня за ${STREAK_FREEZE_STARS} ⭐`}
                      </span>
                    </button>

                    {!hasEnoughStarsForFreeze && (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
                        <span>Не хватает {missingStarsForFreeze} ⭐</span>
                        {canQuickConvertMissingStars ? (
                          <button
                            type="button"
                            onClick={() => handleExchangeCoinToStarInChat(missingStarsForFreeze)}
                            data-testid="streak-quick-buy-stars-btn"
                            className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold cursor-pointer transition-colors"
                          >
                            Обменять {formatCoinsCount(missingStarsForFreeze * COINS_PER_STAR)} 🪙 → +{missingStarsForFreeze} ⭐
                          </button>
                        ) : (
                          <span className="text-slate-400">Зарабатывайте 🪙 в котике</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2">
                    Заморозка открывается, когда у чата есть горящий огонёк или серия оборвалась вчера.
                  </div>
                )}
              </div>

              {/* Nudge / Remind Partner */}
              {requiredSenders > 1 && !isHotToday && !isFrozenToday && !partnerWroteToday && !currentUser.isMuted && (() => {
                const cooldownUntil = nudgeCooldownUntil[activeStreakKey] || 0;
                const onCooldown = Date.now() < cooldownUntil;
                return (
                  <button
                    type="button"
                    data-testid="streak-nudge-btn"
                    disabled={onCooldown}
                    onClick={() => {
                      onSendMessage({
                        type: 'text',
                        text: `🔥 Напоминаю про наш огонёк${activeStreak?.customName ? ` «${activeStreak.customName}»` : ''}! Напиши сообщение, чтобы не потух!`
                      });
                      setNudgeCooldownUntil(prev => ({ ...prev, [activeStreakKey]: Date.now() + 60_000 }));
                      setIsStreakModalOpen(false);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-400/45 disabled:opacity-50 disabled:cursor-not-allowed text-orange-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <BellRing className="w-3.5 h-3.5 shrink-0" />
                    <span>{onCooldown ? 'Напоминание отправлено ✓' : 'Напомнить об огоньке в чат 🔥'}</span>
                  </button>
                );
              })()}

              {/* Streak Milestones (7 / 14 / 30 days) */}
              {(() => {
                const claimedForKey = claimedStreakMilestones[activeStreakKey] || [];
                const milestones = getStreakMilestonesState(count, claimedForKey);
                return (
                  <div data-testid="streak-milestones-panel" className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Награды за серию огонька</span>
                    </div>
                    <div className="space-y-1.5">
                      {milestones.map((m) => (
                        <div key={m.days} className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <span>{m.badge}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">{m.title} ({m.days} дн.)</div>
                              <div className="text-[10px] text-amber-300 tabular-nums">+{formatCoinsCount(m.rewardCoins)} 🪙</div>
                            </div>
                          </div>
                          {m.claimed ? (
                            <span className="text-emerald-300 font-bold shrink-0">Получено ✓</span>
                          ) : m.claimable ? (
                            <button
                              type="button"
                              data-testid={`streak-claim-milestone-${m.days}`}
                              onClick={() => {
                                try {
                                  const coinsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUser.id);
                                  const curCoins = readUserCatEconomy(currentUser.id).coins;
                                  const nextCoins = curCoins + m.rewardCoins;
                                  localStorage.setItem(coinsKey, String(nextCoins));
                                  const nextMap = {
                                    ...claimedStreakMilestones,
                                    [activeStreakKey]: [...claimedForKey, m.days]
                                  };
                                  setClaimedStreakMilestones(nextMap);
                                  localStorage.setItem(`cosmo_streak_milestones_${currentUser.id}`, JSON.stringify(nextMap));
                                  window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'streak_milestone' } }));
                                  setCatEconomy(prev => ({ ...prev, coins: nextCoins }));
                                  showGiftToast(`${m.badge} Награда получена: +${formatCoinsCount(m.rewardCoins)} 🪙!`);
                                  onTriggerStreakMilestoneCelebration?.(m.days, m.title, m.badge);
                                } catch {}
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer shrink-0 tabular-nums"
                            >
                              Забрать
                            </button>
                          ) : (
                            <span className="text-slate-500 tabular-nums shrink-0">{Math.min(count, m.days)}/{m.days}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Exclusive Streak Wallpapers Picker */}
              {onSelectStreakWallpaper && (
                <div data-testid="streak-wallpapers-panel" className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-200 flex items-center justify-between gap-2">
                    <span>🌌 Фон чата за огонёк</span>
                    <span className="text-[10px] text-slate-400 tabular-nums">Сейчас: {count} дн.</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {CHAT_WALLPAPER_CATALOG.map((w) => {
                      const unlocked = isWallpaperUnlockedForStreak(w.id, count);
                      const isActive = (activeStreakWallpaperId || 'default') === w.id;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          disabled={!unlocked}
                          data-testid={`streak-wallpaper-${w.id}`}
                          onClick={() => onSelectStreakWallpaper(activeStreakKey, w.id)}
                          title={`${w.title}${w.minStreakDays > 0 ? ` (от ${w.minStreakDays} дн.)` : ''}`}
                          className={`p-1.5 rounded-xl border text-center transition-all ${
                            isActive
                              ? 'border-amber-400 ring-1 ring-amber-400/50'
                              : unlocked
                              ? 'border-slate-700 hover:border-slate-500 cursor-pointer'
                              : 'border-slate-800 opacity-45 cursor-not-allowed'
                          }`}
                        >
                          <div className={`h-7 rounded-lg ${w.swatchClass} mb-1 flex items-center justify-center text-[10px] font-bold text-white`}>
                            {!unlocked ? `🔒${w.minStreakDays}` : isActive ? '✓' : ''}
                          </div>
                          <div className="text-[9px] text-slate-300 truncate">{w.title}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveStreakName} className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Название для этого огонька (отдельно от имени котика)
                  </label>
                  <input
                    type="text"
                    value={streakNameInput}
                    onChange={e => setStreakNameInput(e.target.value)}
                    placeholder="Например: Вечное пламя, Наш огонёк..."
                    maxLength={30}
                    data-testid="streak-custom-name-input"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[16px] sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-400"
                  />
                  <div className="text-[11px] text-slate-400">
                    🐱 Ваш котик сейчас зовётся: <strong className="text-amber-300">{catEconomy.catName || 'Космо-Котик'}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsStreakModalOpen(false)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Закрыть
                  </button>
                  <button
                    type="submit"
                    data-testid="streak-save-name-btn"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-white text-xs font-black shadow-md cursor-pointer"
                  >
                    Сохранить название
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Chat Gift Store Modal (5 Rare Tiers + Coins -> Stars) */}
      {isGiftModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsGiftModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Подарки в чат"
            onClick={e => e.stopPropagation()}
            data-testid="chat-gift-modal"
            className="w-full max-w-md bg-slate-900 border-2 border-purple-400/50 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 flex flex-col gap-3.5 text-slate-100 max-h-[92dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-extrabold text-white">
                  Магазин подарков
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGiftModalOpen(false)}
                aria-label="Закрыть подарки"
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Balances & Coin -> Star Exchange */}
            <div className="rounded-2xl bg-slate-950/90 border border-amber-400/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs font-bold">
                <span className="text-amber-300 tabular-nums truncate" data-testid="chat-gift-coins-balance">
                  🪙 Монеты котика: {formatCoinsCount(catEconomy.coins)}
                </span>
                <span className="text-yellow-300 tabular-nums shrink-0" data-testid="chat-gift-stars-balance">
                  ⭐ Звёзды: {catEconomy.stars}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="chat-gift-exchange-star-btn"
                  onClick={() => handleExchangeCoinToStarInChat(1)}
                  disabled={!isAdminPhone(currentUser.phone) && catEconomy.coins < COINS_PER_STAR}
                  className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>+1 ⭐ ({formatCoinsCount(COINS_PER_STAR)} 🪙)</span>
                </button>
                <button
                  type="button"
                  data-testid="chat-gift-exchange-20stars-btn"
                  onClick={() => handleExchangeCoinToStarInChat(selectedCatalogGift.starsCost)}
                  disabled={!isAdminPhone(currentUser.phone) && catEconomy.coins < COINS_PER_STAR * selectedCatalogGift.starsCost}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 disabled:border-slate-800 disabled:bg-slate-800 disabled:text-slate-500 text-amber-200 font-black text-xs transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 tabular-nums"
                >
                  <span>+{selectedCatalogGift.starsCost} ⭐ ({formatCoinsCount(COINS_PER_STAR * selectedCatalogGift.starsCost)} 🪙)</span>
                </button>
              </div>

              {onOpenCatGame && (
                <button
                  type="button"
                  onClick={() => {
                    setIsGiftModalOpen(false);
                    onOpenCatGame();
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  🐱 Заработать монеты в мини-игре «Котик»
                </button>
              )}
            </div>

            {/* 5-Gift Rare Tiers Grid */}
            <div className="grid grid-cols-5 gap-1.5" data-testid="chat-gift-catalog-grid">
              {GIFT_CATALOG.map((item) => {
                const isSelected = item.giftId === selectedGiftCatalogId;
                return (
                  <button
                    key={item.giftId}
                    type="button"
                    data-testid={`chat-gift-option-${item.giftId}`}
                    onClick={() => setSelectedGiftCatalogId(item.giftId)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-500/25 border-purple-400 ring-1 ring-purple-400/60 scale-[1.03]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
                    }`}
                    title={`${item.title} (${item.starsCost} ⭐)`}
                  >
                    <div className="text-2xl leading-none">{item.emoji}</div>
                    <div className="text-[10px] font-extrabold text-yellow-300 mt-1 tabular-nums">{item.starsCost} ⭐</div>
                  </button>
                );
              })}
            </div>

            {/* Selected Gift Preview Card */}
            <div className={`rounded-2xl bg-gradient-to-br ${selectedCatalogGift.gradientClass} border ${selectedCatalogGift.borderClass} p-4 text-center space-y-1.5 shadow-lg`}>
              <div className="text-5xl animate-bounce">{selectedCatalogGift.emoji}</div>
              <div className="text-base font-black text-white">{selectedCatalogGift.title}</div>
              <div className="text-xs font-bold text-amber-200 tabular-nums">
                {selectedCatalogGift.rarityLabel} · Цена: {selectedCatalogGift.starsCost} ⭐
                {catEconomy.stars < selectedCatalogGift.starsCost
                  ? ` (не хватает ${selectedCatalogGift.starsCost - catEconomy.stars} ⭐)`
                  : ' — готово к отправке!'}
              </div>
              <p className="text-[11px] text-blue-100">
                {selectedCatalogGift.description} Можно закрепить на витрине, передарить или обменять на {formatCoinsCount(getGiftCoinValue(selectedCatalogGift.starsCost))} 🪙!
              </p>
              <div className="pt-1 text-[10.5px] font-semibold text-amber-200/95">
                🔨 Крафт 10 → 1 в профиле: 10× 😻 Космо-Котёнок → эксклюзивный Космический молот!
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Пожелание к подарку (необязательно)
              </label>
              <input
                type="text"
                value={giftMessage}
                onChange={e => setGiftMessage(e.target.value)}
                placeholder="Дарю с любовью в космос! ✨"
                maxLength={120}
                data-testid="chat-gift-message-input"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[16px] sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsGiftModalOpen(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Отмена
              </button>
              {onBuyGiftForSelf && (
                <button
                  type="button"
                  data-testid="chat-gift-buy-self-btn"
                  onClick={() => {
                    const ok = onBuyGiftForSelf({
                      giftId: selectedCatalogGift.giftId,
                      title: selectedCatalogGift.title,
                      emoji: selectedCatalogGift.emoji,
                      starsCost: selectedCatalogGift.starsCost,
                      message: giftMessage.trim() || undefined
                    });
                    if (ok) {
                      setIsGiftModalOpen(false);
                      setGiftMessage('');
                    }
                  }}
                  disabled={catEconomy.stars < selectedCatalogGift.starsCost || currentUser.isMuted}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-amber-300 text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span>🛒</span>
                  <span>Купить себе</span>
                </button>
              )}
              <button
                type="button"
                data-testid="chat-gift-send-earth-btn"
                onClick={handleSendSelectedGiftFromChat}
                disabled={catEconomy.stars < selectedCatalogGift.starsCost || currentUser.isMuted}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:brightness-110 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span>{selectedCatalogGift.emoji}</span>
                <span>Подарить ({selectedCatalogGift.starsCost} ⭐)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regift Modal from Chat */}
      {regiftModalGift && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setRegiftModalGift(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Передарить подарок"
            onClick={e => e.stopPropagation()}
            data-testid="chat-regift-modal"
            className="w-full max-w-md bg-slate-900 border-2 border-purple-400/50 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 flex flex-col gap-3.5 text-slate-100 max-h-[92dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Repeat className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-extrabold text-white">
                  Передарить подарок
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRegiftModalGift(null)}
                aria-label="Закрыть окно"
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-3xl">{regiftModalGift.emoji}</div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{regiftModalGift.title}</div>
                <div className="text-xs text-slate-400">
                  {regiftModalGift.starsCost} ⭐ • от {regiftModalGift.senderName}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">
                Кому передарить:
              </label>
              <select
                data-testid="chat-regift-select"
                value={regiftTargetKey}
                onChange={e => setRegiftTargetKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[16px] sm:text-sm text-white focus:outline-none focus:border-purple-400"
              >
                {Object.values(allUsers).length > 0 && (
                  <optgroup label="Пользователи">
                    {Object.values(allUsers).map(u => (
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">
                Комментарий (необязательно):
              </label>
              <input
                type="text"
                data-testid="chat-regift-note-input"
                value={regiftNote}
                onChange={e => setRegiftNote(e.target.value)}
                placeholder="Передариваю с наилучшими пожеланиями! ✨"
                maxLength={120}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[16px] sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRegiftModalGift(null)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                data-testid="chat-regift-confirm-btn"
                onClick={() => {
                  if (!onRegiftGift || !regiftTargetKey) return;
                  const target = regiftTargetKey.startsWith('group_')
                    ? { groupId: regiftTargetKey.replace('group_', '') }
                    : { receiverId: regiftTargetKey.replace('user_', '') };
                  const ok = onRegiftGift(regiftModalGift, target, regiftNote);
                  if (ok) {
                    setRegiftModalGift(null);
                    setRegiftNote('');
                    showGiftToast('Подарок передарен в выбранный чат!');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:brightness-110 text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Передарить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coin Envelope Modal */}
      {isEnvelopeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsEnvelopeModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Конверт с монетами"
            onClick={e => e.stopPropagation()}
            data-testid="chat-envelope-modal"
            className="w-full max-w-md bg-slate-900 border-2 border-rose-400/50 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 flex flex-col gap-3.5 text-slate-100 max-h-[92dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧧</span>
                <h3 className="text-base font-extrabold text-white">Конверт с монетами</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEnvelopeModalOpen(false)}
                aria-label="Закрыть конверт"
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>

            <div className="text-xs text-amber-300 font-bold tabular-nums flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <span>Ваш баланс монет:</span>
              <span>{formatCoinsCount(catEconomy.coins)} 🪙</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Сумма монет в конверте
              </label>
              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                {[1000, 5000, 10000].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEnvelopeCoinsInput(preset)}
                    className={`py-1.5 rounded-xl text-xs font-bold border tabular-nums cursor-pointer ${
                      envelopeCoinsInput === preset
                        ? 'bg-rose-500/25 border-rose-400 text-amber-200'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {formatCoinsCount(preset)} 🪙
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={100}
                max={catEconomy.coins || 100000000}
                value={envelopeCoinsInput}
                onChange={e => setEnvelopeCoinsInput(Math.max(0, Number(e.target.value) || 0))}
                data-testid="chat-envelope-coins-input"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[16px] sm:text-sm text-white tabular-nums focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">
                На сколько человек разделить (1 — 10):
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={envelopeClaimsInput}
                onChange={e => setEnvelopeClaimsInput(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                data-testid="chat-envelope-claims-input"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[16px] sm:text-sm text-white tabular-nums focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">
                Поздравление (необязательно):
              </label>
              <input
                type="text"
                value={envelopeNoteInput}
                onChange={e => setEnvelopeNoteInput(e.target.value)}
                placeholder="Угощайтесь! 🧧"
                maxLength={80}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[16px] sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEnvelopeModalOpen(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                data-testid="chat-envelope-submit-btn"
                disabled={!onSendCoinEnvelope || envelopeCoinsInput < 100 || (!isAdminPhone(currentUser.phone) && catEconomy.coins < envelopeCoinsInput)}
                onClick={() => {
                  if (!onSendCoinEnvelope) return;
                  const ok = onSendCoinEnvelope(envelopeCoinsInput, envelopeClaimsInput, envelopeNoteInput);
                  if (ok) {
                    setIsEnvelopeModalOpen(false);
                    setEnvelopeNoteInput('');
                    showGiftToast(`🧧 Конверт на ${formatCoinsCount(envelopeCoinsInput)} 🪙 отправлен!`);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white text-xs font-black shadow-md cursor-pointer disabled:cursor-not-allowed tabular-nums"
              >
                Отправить ({formatCoinsCount(envelopeCoinsInput)} 🪙)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Circle Recorder Modal */}
      {isVideoCircleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            stopVideoCamera();
            setIsVideoCircleModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Запись видеокружка"
            onClick={e => e.stopPropagation()}
            data-testid="chat-video-circle-modal"
            className="w-full max-w-sm bg-slate-900 border-2 border-sky-400/50 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 flex flex-col items-center gap-4 text-slate-100"
          >
            <div className="w-full flex items-center justify-between">
              <span className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Video className="w-4 h-4 text-sky-400" /> Видеокружок
              </span>
              <button
                type="button"
                onClick={() => {
                  stopVideoCamera();
                  setIsVideoCircleModalOpen(false);
                }}
                aria-label="Закрыть видеокружок"
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>

            <div className="w-52 h-52 rounded-full overflow-hidden bg-slate-950 border-4 border-sky-400/60 relative flex items-center justify-center">
              <video
                ref={videoPreviewRef}
                muted
                playsInline
                autoPlay
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {isVideoRecording && (
                <div className="absolute bottom-2 px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white text-xs font-bold tabular-nums">
                  ● 00:{String(videoSeconds).padStart(2, '0')} / 00:30
                </div>
              )}
            </div>

            {videoError && (
              <div className="w-full px-3 py-2 rounded-xl bg-red-950/80 border border-red-500/40 text-xs text-red-200 text-center">
                {videoError}
              </div>
            )}

            <div className="flex items-center gap-2 w-full justify-center">
              <button
                type="button"
                onClick={() => {
                  stopVideoCamera();
                  setIsVideoCircleModalOpen(false);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Отмена
              </button>
              {!isVideoRecording ? (
                <button
                  type="button"
                  disabled={Boolean(videoError)}
                  onClick={startVideoCircleRecording}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Начать запись
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => finishVideoCircleRecording()}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black cursor-pointer"
                >
                  Отправить кружок
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {giftActionToast && (
        <div
          data-testid="chat-gift-action-toast"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl border border-emerald-400/50 animate-fade-in"
        >
          {giftActionToast}
        </div>
      )}

    </div>
  );
};
