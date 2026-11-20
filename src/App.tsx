import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UserProfile,
  GroupChat,
  MessageItem,
  PollData,
  AppTheme,
  SharedMusicData,
  ListenTogetherSession,
  SharedCatData,
  GiftData,
  OwnedGift,
  CatStickerPayload,
  CoinEnvelopeData,
  TradeOfferData,
  ReplyPreview,
  ProfileEmojiStatusId
} from './types/chat';
import { YouTubeTrack } from './utils/youtubeMusic';
import { getListenSessionKey } from './utils/musicLogic';
import { ChatStreakInfo, computeChatStreakFromMessages, extractFrozenDays, getStreakChatKey } from './utils/streakLogic';
import {
  ADMIN_INITIAL_COINS,
  CAT_LEVEL_4_UNLOCK_SWIPES,
  getLevelUpgradeCustomization,
  CAT_STORAGE_KEYS,
  DEFAULT_CAT_CUSTOMIZATION,
  exchangeGiftForCoins,
  getCatLevelInfo,
  getGiftCoinValue,
  getUserCatStorageKey,
  grantAdminCoinsIfEligible,
  migrateLegacyCatStorageForUser,
  readUserCatEconomy,
  sanitizeCatCustomization
} from './utils/catGameLogic';
import {
  computeNextGiftSerial,
  COSMIC_HAMMER_GIFT_ID,
  isGiftUnsellable,
  togglePinnedGiftId
} from './utils/giftCatalog';
import {
  computeCraftedGiftResult,
  computeEnvelopeClaimShare,
  CRAFT_REQUIRED_COUNT,
  shouldTriggerGiftCelebration
} from './utils/cosmoFeatures';
import type { ClaimedGiftStatus } from './utils/profileGifts';
import {
  db,
  INITIAL_SEED_USERS,
  INITIAL_SEED_GROUPS,
  INITIAL_SEED_MESSAGES
} from './services/firebase';
import { ref, onValue, set, remove, update, get } from 'firebase/database';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { GroupInfoModal } from './components/GroupInfoModal';
import { PollModal } from './components/PollModal';
import { LightboxModal } from './components/LightboxModal';
import { CommandLineModal } from './components/CommandLineModal';
import { QrCodeModal } from './components/QrCodeModal';
import { R2SettingsModal } from './components/R2SettingsModal';
import { BeeSwarmOverlay } from './components/BeeSwarmOverlay';
import { CatMinigameModal } from './components/CatMinigameModal';
import { MusicPlayerWidget } from './components/MusicPlayerWidget';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TelegramProfileModal } from './components/TelegramProfileModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { CelebrationOverlay, CelebrationEvent } from './components/CelebrationOverlay';
import { cleanDigits, isAdminPhone, hashPassword, containsProfanity } from './utils/security';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = sessionStorage.getItem('cosmo_user') || localStorage.getItem('cosmo_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>(() => {
    try {
      const saved = localStorage.getItem('cosmo_users_cache');
      const raw = saved ? JSON.parse(saved) : null;
      const parsed: Record<string, UserProfile> =
        raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { ...INITIAL_SEED_USERS };
      // Filter out unreal demo users and old duplicate registrations
      delete parsed.usr_elena;
      delete parsed.usr_dmitry;
      delete parsed.usr_google_demo;
      delete parsed.usr_1790516242677;
      Object.keys(parsed).forEach(uid => {
        if (uid !== 'usr_admin' && cleanDigits(parsed[uid]?.phone) === '9254699801') {
          delete parsed[uid];
        }
      });
      if (!parsed.usr_admin) {
        parsed.usr_admin = {
          id: 'usr_admin',
          name: 'milof',
          username: 'milof',
          phone: '+7 (925) 469-98-01',
          passwordHash: hashPassword('123456'),
          isAdmin: true,
          isMuted: false,
          avatar: '',
          lastSeen: Date.now(),
          isOnline: true
        };
      } else {
        parsed.usr_admin = {
          ...parsed.usr_admin,
          phone: '+7 (925) 469-98-01',
          isAdmin: true
        };
      }
      if (!parsed.usr_admin_2) {
        parsed.usr_admin_2 = {
          id: 'usr_admin_2',
          name: 'Admin',
          username: 'admin2',
          phone: '+7 (925) 167-29-82',
          passwordHash: hashPassword('123456'),
          isAdmin: true,
          isMuted: false,
          avatar: '',
          lastSeen: Date.now(),
          isOnline: true
        };
      } else {
        parsed.usr_admin_2 = {
          ...parsed.usr_admin_2,
          phone: '+7 (925) 167-29-82',
          isAdmin: true
        };
      }
      return parsed;
    } catch {
      return INITIAL_SEED_USERS;
    }
  });

  const [groupsMap, setGroupsMap] = useState<Record<string, GroupChat>>(() => {
    try {
      const saved = localStorage.getItem('cosmo_groups_cache');
      const raw = saved ? JSON.parse(saved) : null;
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : INITIAL_SEED_GROUPS;
    } catch {
      return INITIAL_SEED_GROUPS;
    }
  });

  const [messagesList, setMessagesList] = useState<MessageItem[]>(() => {
    try {
      const saved = localStorage.getItem('cosmo_messages_cache');
      const raw = saved ? JSON.parse(saved) : null;
      return Array.isArray(raw) ? raw : INITIAL_SEED_MESSAGES;
    } catch {
      return INITIAL_SEED_MESSAGES;
    }
  });

  // Live poll votes: msgId -> { userId: optionId | '__none__' }
  const [pollVotesMap, setPollVotesMap] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const saved = localStorage.getItem('cosmo_poll_votes_cache');
      const raw = saved ? JSON.parse(saved) : null;
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });

  // Live reactions: msgId -> { userId: string[] }
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, string[]>>>(() => {
    try {
      const saved = localStorage.getItem('cosmo_reactions_cache');
      const raw = saved ? JSON.parse(saved) : null;
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });

  const [deletedMsgsMap, setDeletedMsgsMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('cosmo_deleted_msgs_cache');
      const raw = saved ? JSON.parse(saved) : {};
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });

  const [editedMsgsMap, setEditedMsgsMap] = useState<Record<string, { text: string; editedAt: string }>>(() => {
    try {
      const saved = localStorage.getItem('cosmo_edited_msgs_cache');
      const raw = saved ? JSON.parse(saved) : {};
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });

  const [readReceiptsMap, setReadReceiptsMap] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const saved = localStorage.getItem('cosmo_read_receipts_cache');
      const raw = saved ? JSON.parse(saved) : {};
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });

  const [streakMetaMap, setStreakMetaMap] = useState<
    Record<string, {
      customName?: string;
      wallpaperId?: string;
      updatedAt?: number;
      frozenDays?: Record<string, { byUserId?: string; byName?: string; at?: number } | boolean> | string[];
    }>
  >(() => {
    try {
      const saved = localStorage.getItem('cosmo_chat_streaks');
      const raw = saved ? JSON.parse(saved) : {};
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });

  const [pinnedMessagesMap, setPinnedMessagesMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('cosmo_pinned_msgs_cache');
      const raw = saved ? JSON.parse(saved) : {};
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });

  const [celebrationEvent, setCelebrationEvent] = useState<CelebrationEvent | null>(null);
  const seenCelebrationMsgIdsRef = useRef<Set<string> | null>(null);

  // Per-user owned gifts inventory & processed gift message statuses
  const [ownedGiftsMap, setOwnedGiftsMap] = useState<Record<string, OwnedGift>>(() => {
    if (!currentUser?.id) return {};
    try {
      const saved = localStorage.getItem(`cosmo_user_gifts_${currentUser.id}`);
      const raw = saved ? JSON.parse(saved) : {};
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });

  const [claimedGiftStatusMap, setClaimedGiftStatusMap] = useState<Record<string, ClaimedGiftStatus>>(() => {
    if (!currentUser?.id) return {};
    try {
      const saved = localStorage.getItem(`cosmo_claimed_gifts_${currentUser.id}`);
      const raw = saved ? JSON.parse(saved) : {};
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  });

  const [giftsHydratedForUser, setGiftsHydratedForUser] = useState<string | null>(null);

  const pendingLocalMsgsRef = useRef<Map<string, MessageItem>>(new Map());
  const inFlightWriteIdsRef = useRef<Set<string>>(new Set());

  const getFallbackMessageText = (
    type: MessageItem['type'],
    text?: string,
    poll?: PollData
  ): string => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed) return trimmed;
    if (type === 'voice') return '🎤 Голосовое сообщение';
    if (type === 'image') return '📷 Фото';
    if (type === 'video') return '🎬 Видео';
    if (type === 'video_circle') return '🎥 Видеокружок';
    if (type === 'poll') return poll?.question ? `📊 Опрос: ${poll.question}` : '📊 Опрос';
    if (type === 'music_share') return '🎵 Совместное прослушивание YouTube Music';
    if (type === 'cat_card') return '🐱 Космо-Котик';
    if (type === 'cat_sticker') return '🐾 Стикер с котиком';
    if (type === 'gift') return '🎁 Подарок в чат';
    if (type === 'coin_envelope') return '🧧 Конверт с монетами';
    if (type === 'trade_offer') return '🔄 Предложение обмена подарками';
    return 'Сообщение';
  };

  // Navigation & selection
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>('usr_admin');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'all' | 'direct' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(!currentUser);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isGroupInfoModalOpen, setIsGroupInfoModalOpen] = useState(false);
  const [viewingProfileUser, setViewingProfileUser] = useState<UserProfile | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isCommandLineOpen, setIsCommandLineOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isR2ModalOpen, setIsR2ModalOpen] = useState(false);
  const [isMatrixMode, setIsMatrixMode] = useState(false);
  const [isMellstroyOpen, setIsMellstroyOpen] = useState(false);
  const [isFoxOpen, setIsFoxOpen] = useState(false);
  const [isMinigameOpen, setIsMinigameOpen] = useState(false);
  const [isBeeSwarmActive, setIsBeeSwarmActive] = useState(false);
  const [isMusicActive, setIsMusicActive] = useState(false);
  const [sharedTrackToPlay, setSharedTrackToPlay] = useState<YouTubeTrack | null>(null);
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState<number>(0);
  const [activeListenSession, setActiveListenSession] = useState<ListenTogetherSession | null>(null);
  const listenBroadcastRef = useRef<BroadcastChannel | null>(null);
  const mellstroyAudioRef = useRef<HTMLAudioElement | null>(null);
  const mellstroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('cosmo_theme');
      if (saved === 'wave' || saved === 'cofe' || saved === 'default') return saved;
      return 'default';
    } catch {
      return 'default';
    }
  });

  const handleThemeChange = (theme: AppTheme) => {
    setCurrentTheme(theme);
    try {
      localStorage.setItem('cosmo_theme', theme);
    } catch {}
  };
  const [qrLoginSuccessNotice, setQrLoginSuccessNotice] = useState<{ name: string; username: string } | null>(null);

  const handleCloseMellstroy = () => {
    if (mellstroyTimerRef.current) {
      clearTimeout(mellstroyTimerRef.current);
      mellstroyTimerRef.current = null;
    }
    if (mellstroyAudioRef.current) {
      mellstroyAudioRef.current.pause();
      mellstroyAudioRef.current.currentTime = 0;
    }
    setIsMellstroyOpen(false);
  };

  const handleTriggerMellstroy = () => {
    if (mellstroyTimerRef.current) {
      clearTimeout(mellstroyTimerRef.current);
      mellstroyTimerRef.current = null;
    }
    if (mellstroyAudioRef.current) {
      mellstroyAudioRef.current.pause();
      mellstroyAudioRef.current.currentTime = 0;
    }

    const audio = new Audio('/assets/aistudio/baba-chai_5d9984c3.mp3');
    mellstroyAudioRef.current = audio;
    audio.currentTime = 0;

    const stopAtThreeSeconds = () => {
      if (audio.currentTime >= 3) {
        audio.pause();
        audio.currentTime = 0;
        if (mellstroyTimerRef.current) {
          clearTimeout(mellstroyTimerRef.current);
          mellstroyTimerRef.current = null;
        }
        audio.removeEventListener('timeupdate', stopAtThreeSeconds);
      }
    };

    audio.addEventListener('timeupdate', stopAtThreeSeconds);
    audio.addEventListener(
      'playing',
      () => {
        if (mellstroyTimerRef.current) clearTimeout(mellstroyTimerRef.current);
        mellstroyTimerRef.current = setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.removeEventListener('timeupdate', stopAtThreeSeconds);
        }, 3050);
      },
      { once: true }
    );

    audio.play().catch(() => {});
    setIsMellstroyOpen(true);
  };

  useEffect(() => {
    return () => {
      if (mellstroyTimerRef.current) {
        clearTimeout(mellstroyTimerRef.current);
      }
      if (mellstroyAudioRef.current) {
        mellstroyAudioRef.current.pause();
      }
    };
  }, []);

  // Global keydown listener for "/" to trigger CommandLine and Escape to close overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMellstroyOpen) {
        e.preventDefault();
        handleCloseMellstroy();
        return;
      }

      if (e.key === 'Escape' && isFoxOpen) {
        e.preventDefault();
        setIsFoxOpen(false);
        return;
      }

      if (e.key === 'Escape' && isMinigameOpen) {
        e.preventDefault();
        setIsMinigameOpen(false);
        return;
      }

      if (e.key === 'Escape' && isBeeSwarmActive && !isCommandLineOpen) {
        e.preventDefault();
        setIsBeeSwarmActive(false);
        return;
      }

      // Do not intercept if user is typing in form controls
      const target = e.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if ((e.key === '/' || e.code === 'Slash') && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsCommandLineOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMellstroyOpen, isFoxOpen, isMinigameOpen, isBeeSwarmActive, isCommandLineOpen]);

  // Handle cross-device QR code login URL parameter on page load
  useEffect(() => {
    try {
      const search = window.location.search;
      if (!search) return;
      const params = new URLSearchParams(search);
      const qrLoginParam = params.get('qr_login');
      if (qrLoginParam) {
        const decodedStr = decodeURIComponent(atob(qrLoginParam));
        const payload = JSON.parse(decodedStr);
        if (payload && payload.id && payload.name) {
          const transferredUser: UserProfile = {
            id: payload.id,
            name: payload.name,
            username: payload.username || 'user',
            phone: payload.phone || '+7 (000) 000-00-00',
            passwordHash: payload.passwordHash || '',
            isAdmin: !!payload.isAdmin,
            isMuted: false,
            avatar: payload.avatar || '',
            isOnline: true,
            lastSeen: Date.now()
          };

          setCurrentUser(prev => {
            const avatar = transferredUser.avatar || (prev?.id === transferredUser.id ? prev.avatar : '') || '';
            const merged = { ...transferredUser, avatar };
            sessionStorage.setItem('cosmo_user', JSON.stringify(merged));
            localStorage.setItem('cosmo_user', JSON.stringify(merged));
            return merged;
          });
          setUsersMap(prev => {
            const existing = prev[transferredUser.id];
            const avatar = transferredUser.avatar || existing?.avatar || '';
            return { ...prev, [transferredUser.id]: { ...transferredUser, avatar } };
          });
          setIsAuthModalOpen(false);

          if (db) {
            update(ref(db, `users/${transferredUser.id}`), {
              isOnline: true,
              lastSeen: Date.now()
            }).catch(() => {});
          }

          setQrLoginSuccessNotice({
            name: transferredUser.name,
            username: transferredUser.username
          });

          // Clean query params so URL remains clean
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    } catch (err) {
      console.warn('QR Login parameter parsing error:', err);
    }
  }, []);

  // Sync to localStorage as persistent offline fallback
  useEffect(() => {
    localStorage.setItem('cosmo_users_cache', JSON.stringify(usersMap));
  }, [usersMap]);

  useEffect(() => {
    localStorage.setItem('cosmo_groups_cache', JSON.stringify(groupsMap));
  }, [groupsMap]);

  useEffect(() => {
    localStorage.setItem('cosmo_messages_cache', JSON.stringify(messagesList));
  }, [messagesList]);

  useEffect(() => {
    localStorage.setItem('cosmo_poll_votes_cache', JSON.stringify(pollVotesMap));
  }, [pollVotesMap]);

  useEffect(() => {
    localStorage.setItem('cosmo_reactions_cache', JSON.stringify(reactionsMap));
  }, [reactionsMap]);

  useEffect(() => {
    localStorage.setItem('cosmo_deleted_msgs_cache', JSON.stringify(deletedMsgsMap));
  }, [deletedMsgsMap]);

  useEffect(() => {
    localStorage.setItem('cosmo_edited_msgs_cache', JSON.stringify(editedMsgsMap));
  }, [editedMsgsMap]);

  useEffect(() => {
    localStorage.setItem('cosmo_read_receipts_cache', JSON.stringify(readReceiptsMap));
  }, [readReceiptsMap]);

  useEffect(() => {
    localStorage.setItem('cosmo_chat_streaks', JSON.stringify(streakMetaMap));
  }, [streakMetaMap]);

  useEffect(() => {
    localStorage.setItem('cosmo_pinned_msgs_cache', JSON.stringify(pinnedMessagesMap));
  }, [pinnedMessagesMap]);

  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`cosmo_user_gifts_${currentUser.id}`, JSON.stringify(ownedGiftsMap));
    } catch {}
  }, [ownedGiftsMap, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`cosmo_claimed_gifts_${currentUser.id}`, JSON.stringify(claimedGiftStatusMap));
    } catch {}
  }, [claimedGiftStatusMap, currentUser?.id]);

  // Isolate per-user cat economy & grant infinite coins (999,999,999) for admin phone numbers
  useEffect(() => {
    if (!currentUser) return;
    const isTargetAdminPhone = isAdminPhone(currentUser.phone);

    try {
      migrateLegacyCatStorageForUser(currentUser.id, isTargetAdminPhone);

      if (isTargetAdminPhone) {
        const scopedCoinsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUser.id);
        const infiniteFlagKey = getUserCatStorageKey('cosmo_infinite_coins', currentUser.id);
        localStorage.setItem(infiniteFlagKey, '1');
        const currentCoins = readUserCatEconomy(currentUser.id).coins;
        const grantRes = grantAdminCoinsIfEligible(true, currentCoins, false);
        if (grantRes.granted || currentCoins < ADMIN_INITIAL_COINS) {
          localStorage.setItem(scopedCoinsKey, String(ADMIN_INITIAL_COINS));
        }
        const scopedSwipesKey = getUserCatStorageKey(CAT_STORAGE_KEYS.swipes, currentUser.id);
        const curSwipes = Number(localStorage.getItem(scopedSwipesKey) || '0') || 0;
        if (curSwipes < CAT_LEVEL_4_UNLOCK_SWIPES) {
          localStorage.setItem(scopedSwipesKey, String(CAT_LEVEL_4_UNLOCK_SWIPES));
          const scopedCustKey = getUserCatStorageKey(CAT_STORAGE_KEYS.customization, currentUser.id);
          const curCustRaw = localStorage.getItem(scopedCustKey);
          const curCust = curCustRaw ? sanitizeCatCustomization(JSON.parse(curCustRaw), 4) : DEFAULT_CAT_CUSTOMIZATION;
          localStorage.setItem(scopedCustKey, JSON.stringify(getLevelUpgradeCustomization(curCust, 4)));
        }
      }

      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'user_sync' } }));
    } catch {}
  }, [currentUser?.id, currentUser?.phone]);

  // Publish live catStats (with customization, swipes, level, hunger) to Firebase & usersMap
  useEffect(() => {
    const uid = currentUser?.id;
    if (!uid) return;

    const syncOwnCatStats = () => {
      try {
        const isTargetAdmin = isAdminPhone(currentUser.phone);
        const economy = readUserCatEconomy(uid);
        let swipes = 0;
        const rawSwipes = localStorage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.swipes, uid));
        if (rawSwipes) swipes = Math.max(0, Number(rawSwipes) || 0);
        const levelInfo = getCatLevelInfo(swipes);

        let cust = DEFAULT_CAT_CUSTOMIZATION;
        const rawCust = localStorage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.customization, uid));
        if (rawCust) {
          try {
            cust = sanitizeCatCustomization(JSON.parse(rawCust), levelInfo.level);
          } catch {}
        }

        let hunger = 80;
        const rawHunger = localStorage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.hunger, uid));
        if (rawHunger !== null) {
          const parsedH = Number(rawHunger);
          if (Number.isFinite(parsedH)) hunger = Math.max(0, Math.min(100, Math.round(parsedH)));
        }

        const coinsVal = isTargetAdmin ? ADMIN_INITIAL_COINS : economy.coins;
        const nextCatStats = {
          coins: coinsVal,
          stars: economy.stars,
          totalSwipes: swipes,
          level: levelInfo.level,
          catName: economy.catName,
          customization: cust,
          hunger: hunger,
          updatedAt: Date.now()
        };

        setUsersMap(prev => {
          const existing = prev[uid];
          if (!existing) return prev;
          const prevStats = existing.catStats;
          if (
            prevStats &&
            prevStats.coins === nextCatStats.coins &&
            prevStats.stars === nextCatStats.stars &&
            prevStats.totalSwipes === nextCatStats.totalSwipes &&
            prevStats.level === nextCatStats.level &&
            prevStats.catName === nextCatStats.catName &&
            JSON.stringify(prevStats.customization) === JSON.stringify(nextCatStats.customization) &&
            prevStats.hunger === nextCatStats.hunger
          ) {
            return prev;
          }
          if (db) {
            update(ref(db, `users/${uid}`), {
              catStats: nextCatStats,
              catCustomization: cust
            }).catch(() => {});
          }
          return {
            ...prev,
            [uid]: {
              ...existing,
              catStats: nextCatStats,
              catCustomization: cust
            }
          };
        });
      } catch {}
    };

    syncOwnCatStats();
    window.addEventListener('cosmo-cat-economy-updated', syncOwnCatStats);
    return () => window.removeEventListener('cosmo-cat-economy-updated', syncOwnCatStats);
  }, [currentUser?.id]);

  // Sync per-user gifts inventory & claimed gift statuses from Firebase / cache
  useEffect(() => {
    const uid = currentUser?.id;
    if (!uid) {
      setOwnedGiftsMap({});
      setClaimedGiftStatusMap({});
      setGiftsHydratedForUser(null);
      return;
    }

    try {
      const cachedGifts = localStorage.getItem(`cosmo_user_gifts_${uid}`);
      const parsedGifts = cachedGifts ? JSON.parse(cachedGifts) : {};
      setOwnedGiftsMap(parsedGifts && typeof parsedGifts === 'object' && !Array.isArray(parsedGifts) ? parsedGifts : {});
    } catch {
      setOwnedGiftsMap({});
    }

    try {
      const cachedClaimed = localStorage.getItem(`cosmo_claimed_gifts_${uid}`);
      const parsedClaimed = cachedClaimed ? JSON.parse(cachedClaimed) : {};
      setClaimedGiftStatusMap(parsedClaimed && typeof parsedClaimed === 'object' && !Array.isArray(parsedClaimed) ? parsedClaimed : {});
    } catch {
      setClaimedGiftStatusMap({});
    }

    if (!db) {
      setGiftsHydratedForUser(uid);
      return;
    }

    let gotGifts = false;
    let gotClaimed = false;
    const markHydrated = () => {
      if (gotGifts && gotClaimed) {
        setGiftsHydratedForUser(uid);
      }
    };

    const userGiftsRef = ref(db, `users/__gifts__/${uid}`);
    const unsubGifts = onValue(userGiftsRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        const sanitized: Record<string, OwnedGift> = {};
        Object.entries(val).forEach(([k, v]: [string, any]) => {
          if (v && typeof v === 'object' && v.id && v.title && v.emoji) {
            sanitized[k] = v as OwnedGift;
          }
        });
        setOwnedGiftsMap(sanitized);
      } else {
        setOwnedGiftsMap({});
      }
      gotGifts = true;
      markHydrated();
    }, () => {
      gotGifts = true;
      markHydrated();
    });

    const userClaimedRef = ref(db, `users/__claimed_gifts__/${uid}`);
    const unsubClaimed = onValue(userClaimedRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        setClaimedGiftStatusMap(val);
      } else {
        setClaimedGiftStatusMap({});
      }
      gotClaimed = true;
      markHydrated();
    }, () => {
      gotClaimed = true;
      markHydrated();
    });

    return () => {
      unsubGifts();
      unsubClaimed();
    };
  }, [currentUser?.id]);

  // Connect Firebase listeners if database is active
  useEffect(() => {
    if (!db) return;

    // Listen to users
    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        const filtered: Record<string, UserProfile> = {};
        Object.entries(val).forEach(([k, u]: [string, any]) => {
          if (!k.startsWith('__') && u && typeof u === 'object' && u.name) {
            if (k === 'usr_elena' || k === 'usr_dmitry' || k === 'usr_google_demo') {
              if (db) remove(ref(db, `users/${k}`)).catch(() => {});
              return;
            }
            // Never allow duplicate milof / admin accounts
            if (cleanDigits(u.phone) === '9254699801' || k === 'usr_admin') {
              filtered['usr_admin'] = {
                ...u,
                id: 'usr_admin',
                name: u.name || 'milof',
                username: u.username || 'milof',
                isAdmin: true
              };
              // If Firebase has an old duplicate entry, remove it
              if (k !== 'usr_admin' && db) {
                remove(ref(db, `users/${k}`)).catch(() => {});
              }
            } else {
              filtered[k] = u;
            }
          }
        });
        if (Object.keys(filtered).length > 0) {
          setUsersMap(prev => {
            const next = { ...prev, ...filtered };
            delete next.usr_elena;
            delete next.usr_dmitry;
            delete next.usr_google_demo;
            delete next.usr_1790516242677;
            Object.keys(next).forEach(uid => {
              if (uid !== 'usr_admin' && cleanDigits(next[uid]?.phone) === '9254699801') {
                delete next[uid];
              }
            });
            return next;
          });
        }

        if (currentUser) {
          const remoteSelf = filtered[currentUser.id] || (val && val[currentUser.id]);
          if (remoteSelf) {
            const remoteStats = remoteSelf.catStats;
            const remoteCust = remoteSelf.catCustomization || remoteStats?.customization;
            const uid = currentUser.id;
            let needsEconomyDispatch = false;

            if (remoteCust) {
              const custKey = getUserCatStorageKey(CAT_STORAGE_KEYS.customization, uid);
              const localRawCust = localStorage.getItem(custKey);
              if (!localRawCust) {
                try {
                  localStorage.setItem(custKey, JSON.stringify(remoteCust));
                  needsEconomyDispatch = true;
                } catch {}
              }
            }

            if (typeof remoteStats?.totalSwipes === 'number' && remoteStats.totalSwipes > 0) {
              const swipesKey = getUserCatStorageKey(CAT_STORAGE_KEYS.swipes, uid);
              const localSwipes = Number(localStorage.getItem(swipesKey) || 0);
              if (remoteStats.totalSwipes > localSwipes) {
                localStorage.setItem(swipesKey, String(remoteStats.totalSwipes));
                needsEconomyDispatch = true;
              }
            }

            if (remoteStats?.catName) {
              const nameKey = getUserCatStorageKey(CAT_STORAGE_KEYS.catName, uid);
              const localName = localStorage.getItem(nameKey);
              if (!localName || localName === 'Космо-Котик') {
                localStorage.setItem(nameKey, remoteStats.catName);
                needsEconomyDispatch = true;
              }
            }

            if (typeof remoteStats?.hunger === 'number') {
              const hungerKey = getUserCatStorageKey(CAT_STORAGE_KEYS.hunger, uid);
              if (localStorage.getItem(hungerKey) === null) {
                localStorage.setItem(hungerKey, String(remoteStats.hunger));
                needsEconomyDispatch = true;
              }
            }

            if (needsEconomyDispatch) {
              window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'firebase_hydration' } }));
            }
          }
        }
      }
    }, () => {});

    // Listen to groups under users/__groups__
    const groupsRef = ref(db, 'users/__groups__');
    const unsubGroups = onValue(groupsRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        setGroupsMap(val);
      } else {
        setGroupsMap({});
      }
    }, () => {});

    // Listen to messages (merge pending local sends until Firebase confirms, while respecting remote deletes)
    const msgsRef = ref(db, 'messages');
    const unsubMsgs = onValue(msgsRef, (snapshot) => {
      const val = snapshot.val();
      const firebaseMsgs: MessageItem[] = val && typeof val === 'object'
        ? Object.values(val).filter(
            (m: any): m is MessageItem => Boolean(m && typeof m === 'object' && m.id && m.senderId && m.type && m.time)
          )
        : [];
      const firebaseIds = new Set(firebaseMsgs.map(m => m.id));
      for (const pendingId of pendingLocalMsgsRef.current.keys()) {
        if (firebaseIds.has(pendingId) && !inFlightWriteIdsRef.current.has(pendingId)) {
          pendingLocalMsgsRef.current.delete(pendingId);
        }
      }
      const mergedMap = new Map<string, MessageItem>();
      firebaseMsgs.forEach(m => mergedMap.set(m.id, m));
      pendingLocalMsgsRef.current.forEach((m, id) => {
        if (!mergedMap.has(id)) {
          mergedMap.set(id, m);
        }
      });
      const combined = Array.from(mergedMap.values());
      combined.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      setMessagesList(combined);
    }, (err) => console.warn('Firebase messages sync warning:', err));

    // Listen to live poll votes
    const pollVotesRef = ref(db, 'users/__poll_votes__');
    const unsubPollVotes = onValue(pollVotesRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        setPollVotesMap(val);
      } else {
        setPollVotesMap({});
      }
    }, () => {});

    // Listen to live reactions
    const reactionsRef = ref(db, 'users/__reactions__');
    const unsubReactions = onValue(reactionsRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        const normalized: Record<string, Record<string, string[]>> = {};
        Object.entries(val).forEach(([msgId, perUser]: [string, any]) => {
          if (!perUser || typeof perUser !== 'object') return;
          normalized[msgId] = {};
          Object.entries(perUser).forEach(([uid, entry]: [string, any]) => {
            if (Array.isArray(entry)) {
              normalized[msgId][uid] = entry;
            } else if (entry && typeof entry === 'object' && Array.isArray(entry.list)) {
              normalized[msgId][uid] = entry.list;
            } else if (entry && typeof entry === 'object' && entry.list && typeof entry.list === 'object') {
              normalized[msgId][uid] = Object.values(entry.list);
            } else if (entry && typeof entry === 'object') {
              normalized[msgId][uid] = Object.values(entry).filter((x): x is string => typeof x === 'string');
            }
          });
        });
        setReactionsMap(normalized);
      } else {
        setReactionsMap({});
      }
    }, () => {});

    // Listen to deleted message tombstones
    const deletedMsgsRef = ref(db, 'users/__deleted_messages__');
    const unsubDeletedMsgs = onValue(deletedMsgsRef, (snapshot) => {
      const val = snapshot.val();
      setDeletedMsgsMap(val && typeof val === 'object' ? val : {});
    }, () => {});

    // Listen to edited message overrides
    const editedMsgsRef = ref(db, 'users/__edited_messages__');
    const unsubEditedMsgs = onValue(editedMsgsRef, (snapshot) => {
      const val = snapshot.val();
      setEditedMsgsMap(val && typeof val === 'object' ? val : {});
    }, () => {});

    // Listen to live read receipts
    const readReceiptsRef = ref(db, 'users/__read_receipts__');
    const unsubReadReceipts = onValue(readReceiptsRef, (snapshot) => {
      const val = snapshot.val();
      setReadReceiptsMap(val && typeof val === 'object' ? val : {});
    }, () => {});

    // Listen to custom chat streak names & metadata
    const streaksRef = ref(db, 'users/__chat_streaks__');
    const unsubStreaks = onValue(streaksRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        setStreakMetaMap(val);
      } else {
        setStreakMetaMap({});
      }
    }, () => {});

    // Listen to pinned messages per chat key
    const pinnedRef = ref(db, 'users/__pinned_messages__');
    const unsubPinned = onValue(pinnedRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        setPinnedMessagesMap(val);
      } else {
        setPinnedMessagesMap({});
      }
    }, () => {});

    // Track Firebase server clock offset so all participants share the exact same music timestamp
    const offsetRef = ref(db, '.info/serverTimeOffset');
    const unsubOffset = onValue(offsetRef, (snapshot) => {
      const val = snapshot.val();
      if (typeof val === 'number' && Number.isFinite(val)) {
        setServerTimeOffsetMs(val);
      }
    }, () => {});

    return () => {
      unsubUsers();
      unsubGroups();
      unsubMsgs();
      unsubPollVotes();
      unsubReactions();
      unsubDeletedMsgs();
      unsubEditedMsgs();
      unsubReadReceipts();
      unsubStreaks();
      unsubPinned();
      unsubOffset();
    };
  }, []);

  // Subscribe to real-time Listen Together session for the active chat/group
  const activeListenSessionKey = getListenSessionKey({
    currentUserId: currentUser?.id,
    activeChatUserId,
    activeGroupId
  });

  useEffect(() => {
    setActiveListenSession(null);
    if (!activeListenSessionKey) return;

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('cosmo_listen_together');
      listenBroadcastRef.current = channel;
      channel.onmessage = (ev) => {
        if (ev.data?.key === activeListenSessionKey && ev.data?.session) {
          setActiveListenSession(ev.data.session as ListenTogetherSession);
        }
      };
    }

    let unsubSession: (() => void) | null = null;
    if (db) {
      const sessionRef = ref(db, `users/__listen_together__/${activeListenSessionKey}`);
      unsubSession = onValue(sessionRef, (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object' && val.trackId) {
          setActiveListenSession(val as ListenTogetherSession);
        } else {
          setActiveListenSession(null);
        }
      }, () => {});
    }

    return () => {
      if (unsubSession) unsubSession();
      if (channel) {
        channel.close();
        if (listenBroadcastRef.current === channel) {
          listenBroadcastRef.current = null;
        }
      }
    };
  }, [activeListenSessionKey]);

  // Update current user if updated in usersMap
  useEffect(() => {
    if (currentUser && usersMap[currentUser.id]) {
      const updated = usersMap[currentUser.id];
      if (JSON.stringify(updated) !== JSON.stringify(currentUser)) {
        setCurrentUser(updated);
        sessionStorage.setItem('cosmo_user', JSON.stringify(updated));
        localStorage.setItem('cosmo_user', JSON.stringify(updated));
      }
    }
  }, [usersMap, currentUser]);

  // Heartbeat online presence
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      if (db) {
        update(ref(db, `users/${currentUser.id}`), {
          isOnline: true,
          lastSeen: Date.now()
        }).catch(() => {});
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    sessionStorage.setItem('cosmo_user', JSON.stringify(user));
    localStorage.setItem('cosmo_user', JSON.stringify(user));
    setIsAuthModalOpen(false);

    // If new user registered, save to db
    if (db) {
      set(ref(db, `users/${user.id}`), user).catch(() => {});
    }
  };

  const handleRegisterUser = (user: UserProfile) => {
    setUsersMap(prev => ({ ...prev, [user.id]: user }));
    if (db) {
      set(ref(db, `users/${user.id}`), user).catch(() => {});
    }
  };

  const handleLogout = () => {
    if (currentUser && db) {
      update(ref(db, `users/${currentUser.id}`), {
        isOnline: false,
        lastSeen: Date.now()
      }).catch(() => {});
    }
    setCurrentUser(null);
    sessionStorage.removeItem('cosmo_user');
    localStorage.removeItem('cosmo_user');
    setIsAuthModalOpen(true);
  };

  const handleAdminUpdateUser = (targetUserId: string, updates: Partial<UserProfile>) => {
    setUsersMap(prev => {
      const target = prev[targetUserId];
      if (!target) return prev;
      return { ...prev, [targetUserId]: { ...target, ...updates } };
    });
    if (currentUser?.id === targetUserId) {
      const updatedSelf = { ...currentUser, ...updates };
      setCurrentUser(updatedSelf);
      sessionStorage.setItem('cosmo_user', JSON.stringify(updatedSelf));
      localStorage.setItem('cosmo_user', JSON.stringify(updatedSelf));
    }
    if (db) {
      update(ref(db, `users/${targetUserId}`), updates).catch(() => {});
    }
  };

  const handleUpdateProfile = (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated: UserProfile = { ...currentUser, ...updates };
    setCurrentUser(updated);
    setUsersMap(prev => ({ ...prev, [updated.id]: updated }));
    sessionStorage.setItem('cosmo_user', JSON.stringify(updated));
    localStorage.setItem('cosmo_user', JSON.stringify(updated));

    if (db) {
      update(ref(db, `users/${updated.id}`), updates).catch(() => {});
    }
  };

  // Purely for the admin's phone number +7 (925) 469-98-01: delete all other numbers from DB
  const handleDeleteAllNumbers = async () => {
    if (!currentUser) return;
    const isTargetAdmin = cleanDigits(currentUser.phone) === '9254699801' || currentUser.isAdmin;
    if (!isTargetAdmin) return;

    const currentAdminUser = usersMap[currentUser.id] || currentUser;
    const adminProfile: UserProfile = {
      id: 'usr_admin',
      name: currentAdminUser.name || 'milof',
      username: currentAdminUser.username || 'milof',
      phone: '+7 (925) 469-98-01',
      passwordHash: currentAdminUser.passwordHash || hashPassword('123456'),
      isAdmin: true,
      isMuted: false,
      avatar: currentAdminUser.avatar || '',
      lastSeen: Date.now(),
      isOnline: true
    };

    // 1. Remove all non-admin users from Firebase RTDB
    if (db) {
      try {
        const usersSnap = await get(ref(db, 'users'));
        if (usersSnap.exists()) {
          const val = usersSnap.val();
          if (val && typeof val === 'object') {
            for (const [k, u] of Object.entries(val)) {
              if (k.startsWith('__')) continue;
              if (k !== 'usr_admin') {
                await remove(ref(db, `users/${k}`)).catch(() => {});
              }
            }
          }
        }
        await set(ref(db, 'users/usr_admin'), adminProfile).catch(() => {});
      } catch (err) {
        console.warn('Firebase user deletion error:', err);
      }
    }

    // 2. Clear from local state & cache
    const cleanMap: Record<string, UserProfile> = {
      usr_admin: adminProfile
    };
    setUsersMap(cleanMap);
    localStorage.setItem('cosmo_users_cache', JSON.stringify(cleanMap));

    // 3. Reset active chat to Saved Messages / Избранное
    setActiveChatUserId('usr_admin');
    setActiveGroupId(null);
  };

  // Activity update (typing / recording / cat_game / listening)
  const handleSetActivity = (
    status: 'idle' | 'typing' | 'recording' | 'cat_game' | 'listening',
    detail?: string
  ) => {
    if (!currentUser) return;
    const target = activeGroupId || activeChatUserId || 'global';

    const activityData = status === 'idle' ? null : {
      status,
      targetId: target,
      ...(detail ? { detail } : {}),
      updatedAt: Date.now(),
      userName: currentUser.name
    };

    setUsersMap(prev => {
      const existing = prev[currentUser.id];
      if (!existing) return prev;
      return {
        ...prev,
        [currentUser.id]: {
          ...existing,
          activity: activityData || undefined
        }
      };
    });

    if (db) {
      update(ref(db, `users/${currentUser.id}`), { activity: activityData }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    if (isMinigameOpen) {
      handleSetActivity('cat_game');
    } else if (currentUser.activity?.status === 'cat_game') {
      handleSetActivity('idle');
    }
  }, [isMinigameOpen]);

  // Trigger celebratory fireworks overlay when newly arriving rare gift is observed
  useEffect(() => {
    if (!currentUser) return;
    if (seenCelebrationMsgIdsRef.current === null) {
      seenCelebrationMsgIdsRef.current = new Set(messagesList.map(m => m.id));
      return;
    }
    const seen = seenCelebrationMsgIdsRef.current;
    for (const m of messagesList) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (
        m.type === 'gift' &&
        m.giftData &&
        m.receiverId === currentUser.id &&
        m.senderId !== currentUser.id &&
        shouldTriggerGiftCelebration(m.giftData.starsCost, m.giftData.isHolo)
      ) {
        setCelebrationEvent({
          id: m.id,
          title: `Вам подарили ${m.giftData.title}!`,
          emoji: m.giftData.emoji,
          subtitle: `от ${m.senderName} · ${m.giftData.starsCost} ⭐`
        });
      }
    }
  }, [messagesList, currentUser?.id]);

  // Direct chat selection
  const handleSelectDirectChat = (user: UserProfile) => {
    setActiveGroupId(null);
    setActiveChatUserId(user.id);
    setIsMobileChatOpen(true);
  };

  // Group chat selection
  const handleSelectGroupChat = (group: GroupChat) => {
    setActiveChatUserId(null);
    setActiveGroupId(group.id);
    setIsMobileChatOpen(true);
  };

  // Send message
  const handleSendMessage = (msgData: {
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
    coinEnvelope?: CoinEnvelopeData;
    tradeOffer?: TradeOfferData;
    replyTo?: ReplyPreview;
    ttlSeconds?: number;
    expiresAt?: number;
  }) => {
    if (!currentUser || currentUser.isMuted) return;
    if (!activeChatUserId && !activeGroupId) return;

    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const rawMsg: Record<string, any> = {
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderPhone: cleanDigits(currentUser.phone),
      time: new Date().toISOString(),
      readBy: [currentUser.id],
      type: msgData.type,
      text: getFallbackMessageText(msgData.type, msgData.text, msgData.poll)
    };

    let enrichedGiftData = msgData.giftData;
    if (msgData.type === 'gift' && msgData.giftData) {
      const assignedSerial = msgData.giftData.serialNumber ?? computeNextGiftSerial(msgData.giftData.giftId, messagesList);
      enrichedGiftData = {
        ...msgData.giftData,
        giftInstanceId: msgData.giftData.giftInstanceId || `own_${msgId}`,
        originalSenderName: msgData.giftData.originalSenderName || currentUser.name,
        serialNumber: assignedSerial
      };
    }

    if (msgData.imageUrl !== undefined) rawMsg.imageUrl = msgData.imageUrl;
    if (msgData.videoUrl !== undefined) rawMsg.videoUrl = msgData.videoUrl;
    if (msgData.audioUrl !== undefined) rawMsg.audioUrl = msgData.audioUrl;
    if (typeof msgData.videoDurationSec === 'number') rawMsg.videoDurationSec = msgData.videoDurationSec;
    if (msgData.poll !== undefined) rawMsg.poll = msgData.poll;
    if (msgData.musicShare !== undefined) rawMsg.musicShare = msgData.musicShare;
    if (msgData.catShare !== undefined) rawMsg.catShare = msgData.catShare;
    if (msgData.catSticker !== undefined) rawMsg.catSticker = msgData.catSticker;
    if (enrichedGiftData !== undefined) rawMsg.giftData = enrichedGiftData;
    if (msgData.coinEnvelope !== undefined) rawMsg.coinEnvelope = msgData.coinEnvelope;
    if (msgData.tradeOffer !== undefined) rawMsg.tradeOffer = msgData.tradeOffer;
    if (msgData.replyTo !== undefined) rawMsg.replyTo = msgData.replyTo;
    if (typeof msgData.ttlSeconds === 'number' && msgData.ttlSeconds > 0) {
      rawMsg.ttlSeconds = msgData.ttlSeconds;
      rawMsg.expiresAt = typeof msgData.expiresAt === 'number' && msgData.expiresAt > Date.now()
        ? msgData.expiresAt
        : Date.now() + msgData.ttlSeconds * 1000;
    }

    if (activeGroupId) {
      rawMsg.groupId = activeGroupId;
    } else if (activeChatUserId) {
      rawMsg.receiverId = activeChatUserId;
    }

    const newMsg = stripUndefinedDeep(rawMsg) as MessageItem;
    seenCelebrationMsgIdsRef.current?.add(msgId);
    pendingLocalMsgsRef.current.set(msgId, newMsg);
    setMessagesList(prev => [...prev, newMsg]);

    if (db) {
      inFlightWriteIdsRef.current.add(msgId);
      set(ref(db, `messages/${msgId}`), newMsg)
        .then(() => {
          inFlightWriteIdsRef.current.delete(msgId);
        })
        .catch((err) => {
          inFlightWriteIdsRef.current.delete(msgId);
          console.warn('Failed to save message to Firebase:', err);
        });
    }

    if (msgData.type === 'gift' && enrichedGiftData) {
      deliverGiftToRecipients(newMsg, enrichedGiftData, activeGroupId || undefined, activeChatUserId || undefined);
      if (shouldTriggerGiftCelebration(enrichedGiftData.starsCost, enrichedGiftData.isHolo)) {
        setCelebrationEvent({
          id: msgId,
          title: `Подарок «${enrichedGiftData.title}» отправлен!`,
          emoji: enrichedGiftData.emoji,
          subtitle: `${enrichedGiftData.starsCost} ⭐`
        });
      }
    }
  };

  const handleShareTrackToChat = (track: YouTubeTrack) => {
    handleSendMessage({
      type: 'music_share',
      text: `🎵 Слушаем вместе: ${track.artist} — ${track.title}`,
      musicShare: {
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        durationSec: track.durationSec,
        thumbnail: track.thumbnail,
        genre: track.genre
      }
    });
  };

  const stripUndefinedDeep = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

  const handleShareCatToChat = (
    catData: SharedCatData,
    target?: { receiverId?: string; groupId?: string }
  ) => {
    if (!currentUser || currentUser.isMuted) return;

    let targetGroupId = target?.groupId;
    let targetUserId = target?.receiverId;

    if (!targetGroupId && !targetUserId) {
      targetGroupId = activeGroupId || undefined;
      targetUserId = !targetGroupId ? (activeChatUserId || 'usr_admin') : undefined;
    }

    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const rawMsg: Record<string, any> = {
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderPhone: cleanDigits(currentUser.phone),
      time: new Date().toISOString(),
      readBy: [currentUser.id],
      type: 'cat_card',
      text: catData.note || `🐱 ${catData.catName || 'Космо-Котик'}`,
      catShare: stripUndefinedDeep(catData)
    };

    if (targetGroupId) {
      rawMsg.groupId = targetGroupId;
    } else if (targetUserId) {
      rawMsg.receiverId = targetUserId;
    }

    const newMsg = stripUndefinedDeep(rawMsg) as MessageItem;
    pendingLocalMsgsRef.current.set(msgId, newMsg);
    setMessagesList(prev => [...prev, newMsg]);

    if (db) {
      inFlightWriteIdsRef.current.add(msgId);
      set(ref(db, `messages/${msgId}`), newMsg)
        .then(() => {
          inFlightWriteIdsRef.current.delete(msgId);
        })
        .catch((err) => {
          inFlightWriteIdsRef.current.delete(msgId);
          console.warn('Failed to save cat card to Firebase:', err);
        });
    }
  };

  const deliverGiftToRecipients = (
    msg: MessageItem,
    gift: GiftData,
    targetGroupId?: string,
    targetUserId?: string
  ) => {
    if (!currentUser) return;
    const recipientIds: string[] = [];
    if (targetUserId) {
      recipientIds.push(targetUserId);
    } else if (targetGroupId) {
      const grp = groupsMap[targetGroupId];
      const members = Array.isArray(grp?.memberIds) ? grp.memberIds : [];
      members.forEach(uid => {
        if (uid !== currentUser.id) recipientIds.push(uid);
      });
    }

    recipientIds.forEach(recipientId => {
      const ownedId = `own_${msg.id}`;
      const unsellable = isGiftUnsellable(gift);
      const rawOwned: Record<string, any> = {
        id: ownedId,
        giftId: gift.giftId,
        title: gift.title,
        emoji: gift.emoji,
        starsCost: gift.starsCost,
        coinValue: unsellable ? 0 : getGiftCoinValue(gift.starsCost),
        senderId: currentUser.id,
        senderName: currentUser.name,
        receivedAt: Date.now(),
        sourceMsgId: msg.id
      };
      if (unsellable) rawOwned.isUnsellable = true;
      if (gift.isHolo) rawOwned.isHolo = true;
      if (typeof gift.serialNumber === 'number' && gift.serialNumber > 0) {
        rawOwned.serialNumber = gift.serialNumber;
      }
      if (gift.originalSenderName) rawOwned.originalSenderName = gift.originalSenderName;
      if (gift.regiftedFrom) rawOwned.regiftedFrom = gift.regiftedFrom;
      if (gift.message) rawOwned.message = gift.message;

      const cleanOwned = stripUndefinedDeep(rawOwned) as OwnedGift;

      if (recipientId === currentUser.id) {
        setOwnedGiftsMap(prev => ({ ...prev, [ownedId]: cleanOwned }));
        setClaimedGiftStatusMap(prev => ({ ...prev, [msg.id]: 'claimed' }));
        if (db) {
          set(ref(db, `users/__claimed_gifts__/${currentUser.id}/${msg.id}`), 'claimed').catch(() => {});
        }
      } else {
        try {
          const cacheKey = `cosmo_user_gifts_${recipientId}`;
          const existingRaw = localStorage.getItem(cacheKey);
          const existingMap = existingRaw ? JSON.parse(existingRaw) : {};
          const nextMap = existingMap && typeof existingMap === 'object' && !Array.isArray(existingMap)
            ? { ...existingMap, [ownedId]: cleanOwned }
            : { [ownedId]: cleanOwned };
          localStorage.setItem(cacheKey, JSON.stringify(nextMap));
          window.dispatchEvent(new CustomEvent('cosmo-user-gifts-updated', { detail: { userId: recipientId } }));
        } catch {}
      }
      if (db) {
        set(ref(db, `users/__gifts__/${recipientId}/${ownedId}`), cleanOwned).catch(() => {});
      }
    });
  };

  const handleSendGift = (
    gift: { giftId: string; title: string; emoji: string; starsCost: number; message?: string },
    target?: { receiverId?: string; groupId?: string }
  ) => {
    if (!currentUser || currentUser.isMuted) return;

    let targetGroupId = target?.groupId;
    let targetUserId = target?.receiverId;

    if (!targetGroupId && !targetUserId) {
      targetGroupId = activeGroupId || undefined;
      targetUserId = !targetGroupId ? (activeChatUserId || 'usr_admin') : undefined;
    }

    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const serialNumber = computeNextGiftSerial(gift.giftId, messagesList);
    const enrichedGift: GiftData = {
      ...gift,
      giftInstanceId: `own_${msgId}`,
      originalSenderName: currentUser.name,
      serialNumber
    };
    const rawMsg: Record<string, any> = {
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderPhone: cleanDigits(currentUser.phone),
      time: new Date().toISOString(),
      readBy: [currentUser.id],
      type: 'gift',
      text: gift.message || `🎁 Подарок: ${gift.title} ${gift.emoji}`,
      giftData: stripUndefinedDeep(enrichedGift)
    };

    if (targetGroupId) {
      rawMsg.groupId = targetGroupId;
    } else if (targetUserId) {
      rawMsg.receiverId = targetUserId;
    }

    const newMsg = stripUndefinedDeep(rawMsg) as MessageItem;
    seenCelebrationMsgIdsRef.current?.add(msgId);
    pendingLocalMsgsRef.current.set(msgId, newMsg);
    setMessagesList(prev => [...prev, newMsg]);

    if (db) {
      inFlightWriteIdsRef.current.add(msgId);
      set(ref(db, `messages/${msgId}`), newMsg)
        .then(() => {
          inFlightWriteIdsRef.current.delete(msgId);
        })
        .catch((err) => {
          inFlightWriteIdsRef.current.delete(msgId);
          console.warn('Failed to save gift to Firebase:', err);
        });
    }

    deliverGiftToRecipients(newMsg, enrichedGift, targetGroupId, targetUserId);
    if (shouldTriggerGiftCelebration(enrichedGift.starsCost, enrichedGift.isHolo)) {
      setCelebrationEvent({
        id: msgId,
        title: `Подарок «${enrichedGift.title}» отправлен!`,
        emoji: enrichedGift.emoji,
        subtitle: `${enrichedGift.starsCost} ⭐`
      });
    }
  };

  const handleRegiftGift = (
    ownedGift: OwnedGift,
    target: { receiverId?: string; groupId?: string },
    note?: string
  ): boolean => {
    if (!currentUser || currentUser.isMuted) return false;
    if (!ownedGiftsMap[ownedGift.id]) return false;
    if (!target.receiverId && !target.groupId) return false;

    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const trimmedNote = typeof note === 'string' ? note.trim() : '';
    const unsellable = isGiftUnsellable(ownedGift);
    const regiftData: GiftData = {
      giftId: ownedGift.giftId,
      title: ownedGift.title,
      emoji: ownedGift.emoji,
      starsCost: ownedGift.starsCost,
      giftInstanceId: `own_${msgId}`,
      originalSenderName: ownedGift.originalSenderName || ownedGift.senderName,
      regiftedFrom: currentUser.name,
      ...(unsellable ? { isUnsellable: true } : {}),
      ...(ownedGift.isHolo ? { isHolo: true } : {}),
      ...(typeof ownedGift.serialNumber === 'number' && ownedGift.serialNumber > 0
        ? { serialNumber: ownedGift.serialNumber }
        : {})
    };
    if (trimmedNote) {
      regiftData.message = trimmedNote;
    } else if (ownedGift.message) {
      regiftData.message = ownedGift.message;
    }

    // 1. Consume from sender's owned inventory
    setOwnedGiftsMap(prev => {
      const next = { ...prev };
      delete next[ownedGift.id];
      return next;
    });
    if (db) {
      remove(ref(db, `users/__gifts__/${currentUser.id}/${ownedGift.id}`)).catch(() => {});
    }

    if (ownedGift.sourceMsgId) {
      const srcId = ownedGift.sourceMsgId;
      setClaimedGiftStatusMap(prev => ({ ...prev, [srcId]: 'regifted' }));
      if (db) {
        set(ref(db, `users/__claimed_gifts__/${currentUser.id}/${srcId}`), 'regifted').catch(() => {});
      }
    }

    // 2. Post new gift message to target conversation
    const rawMsg: Record<string, any> = {
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderPhone: cleanDigits(currentUser.phone),
      time: new Date().toISOString(),
      readBy: [currentUser.id],
      type: 'gift',
      text: trimmedNote || `🎁 Передаренный подарок: ${ownedGift.title} ${ownedGift.emoji}`,
      giftData: stripUndefinedDeep(regiftData)
    };
    if (target.groupId) {
      rawMsg.groupId = target.groupId;
    } else if (target.receiverId) {
      rawMsg.receiverId = target.receiverId;
    }

    const newMsg = stripUndefinedDeep(rawMsg) as MessageItem;
    pendingLocalMsgsRef.current.set(msgId, newMsg);
    setMessagesList(prev => [...prev, newMsg]);

    if (db) {
      inFlightWriteIdsRef.current.add(msgId);
      set(ref(db, `messages/${msgId}`), newMsg)
        .then(() => {
          inFlightWriteIdsRef.current.delete(msgId);
        })
        .catch((err) => {
          inFlightWriteIdsRef.current.delete(msgId);
          console.warn('Failed to save regifted gift:', err);
        });
    }

    // 3. Deliver into recipient's profile inventory
    deliverGiftToRecipients(newMsg, regiftData, target.groupId, target.receiverId);
    if (unsellable || shouldTriggerGiftCelebration(regiftData.starsCost, regiftData.isHolo)) {
      setCelebrationEvent({
        id: msgId,
        title: unsellable ? 'Космический молот отправлен!' : `Подарок «${regiftData.title}» передарен!`,
        emoji: regiftData.emoji,
        subtitle: unsellable ? '🔨 Эксклюзивная реликвия крафта' : `${regiftData.starsCost} ⭐`
      });
    }
    return true;
  };

  const handleExchangeGiftForCoins = (
    ownedGift: OwnedGift
  ): { coinsEarned: number; nextCoins: number } | null => {
    if (!currentUser) return null;
    if (!ownedGiftsMap[ownedGift.id]) return null;
    if (isGiftUnsellable(ownedGift)) return null;

    const scopedCoinsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUser.id);
    let currentCoins = readUserCatEconomy(currentUser.id).coins;

    const exchangeRes = exchangeGiftForCoins(ownedGift.starsCost, currentCoins);

    try {
      localStorage.setItem(scopedCoinsKey, String(exchangeRes.nextCoins));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'gift_exchange' } }));
    } catch {}

    setOwnedGiftsMap(prev => {
      const next = { ...prev };
      delete next[ownedGift.id];
      return next;
    });
    if (db) {
      remove(ref(db, `users/__gifts__/${currentUser.id}/${ownedGift.id}`)).catch(() => {});
    }

    if (ownedGift.sourceMsgId) {
      const srcId = ownedGift.sourceMsgId;
      setClaimedGiftStatusMap(prev => ({ ...prev, [srcId]: 'exchanged' }));
      if (db) {
        set(ref(db, `users/__claimed_gifts__/${currentUser.id}/${srcId}`), 'exchanged').catch(() => {});
      }
    }

    return exchangeRes;
  };

  const handleBuyGiftForSelf = (
    gift: { giftId: string; title: string; emoji: string; starsCost: number; message?: string; isHolo?: boolean }
  ): boolean => {
    if (!currentUser || currentUser.isMuted) return false;
    const starsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.stars, currentUser.id);
    const currentStars = readUserCatEconomy(currentUser.id).stars;
    if (currentStars < gift.starsCost) return false;

    const nextStars = currentStars - gift.starsCost;
    localStorage.setItem(starsKey, String(nextStars));
    window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'buy_gift_self' } }));

    const buyId = 'buy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const ownedId = `own_${buyId}`;
    const unsellable = isGiftUnsellable(gift);
    const serialNumber = computeNextGiftSerial(gift.giftId, messagesList);

    const rawOwned: Record<string, any> = {
      id: ownedId,
      giftId: gift.giftId,
      title: gift.title,
      emoji: gift.emoji,
      starsCost: gift.starsCost,
      coinValue: unsellable ? 0 : getGiftCoinValue(gift.starsCost),
      senderId: currentUser.id,
      senderName: 'Себе (Покупка)',
      receivedAt: Date.now(),
      sourceMsgId: buyId
    };
    if (unsellable) rawOwned.isUnsellable = true;
    if (gift.isHolo) rawOwned.isHolo = true;
    if (typeof serialNumber === 'number' && serialNumber > 0) {
      rawOwned.serialNumber = serialNumber;
    }
    if (gift.message) rawOwned.message = gift.message;

    const cleanOwned = stripUndefinedDeep(rawOwned) as OwnedGift;
    setOwnedGiftsMap(prev => ({ ...prev, [ownedId]: cleanOwned }));

    try {
      const cacheKey = `cosmo_user_gifts_${currentUser.id}`;
      const existingRaw = localStorage.getItem(cacheKey);
      const existingMap = existingRaw ? JSON.parse(existingRaw) : {};
      const nextMap = { ...existingMap, [ownedId]: cleanOwned };
      localStorage.setItem(cacheKey, JSON.stringify(nextMap));
      window.dispatchEvent(new CustomEvent('cosmo-user-gifts-updated', { detail: { userId: currentUser.id } }));
    } catch {}

    if (db) {
      set(ref(db, `users/__gifts__/${currentUser.id}/${ownedId}`), cleanOwned).catch(() => {});
    }

    if (shouldTriggerGiftCelebration(gift.starsCost, Boolean(gift.isHolo))) {
      setCelebrationEvent({
        id: buyId,
        title: `Подарок «${gift.title}» куплен в коллекцию!`,
        emoji: gift.emoji,
        subtitle: `${gift.starsCost} ⭐`
      });
    }

    return true;
  };


  // Auto-claim incoming gift messages into currentUser's profile gift inventory once
  useEffect(() => {
    if (!currentUser || giftsHydratedForUser !== currentUser.id) return;

    const toClaim: Array<{ msg: MessageItem; owned: OwnedGift }> = [];
    for (const m of messagesList) {
      if (deletedMsgsMap[m.id]) continue;
      if (m.type !== 'gift' || !m.giftData) continue;

      const isDirectForMe = !m.groupId && m.receiverId === currentUser.id;
      const isGroupForMe =
        Boolean(m.groupId) &&
        m.senderId !== currentUser.id &&
        (!groupsMap[m.groupId!]?.memberIds || groupsMap[m.groupId!].memberIds.includes(currentUser.id));

      if (!isDirectForMe && !isGroupForMe) continue;
      if (claimedGiftStatusMap[m.id]) continue;

      const ownedId = `own_${m.id}`;
      if (ownedGiftsMap[ownedId]) continue;

      const unsellable = isGiftUnsellable(m.giftData);
      const ts = Date.parse(m.time);
      const rawOwned: Record<string, any> = {
        id: ownedId,
        giftId: m.giftData.giftId,
        title: m.giftData.title,
        emoji: m.giftData.emoji,
        starsCost: m.giftData.starsCost,
        coinValue: unsellable ? 0 : getGiftCoinValue(m.giftData.starsCost),
        senderId: m.senderId,
        senderName: m.senderName || usersMap[m.senderId]?.name || 'Пользователь',
        receivedAt: Number.isFinite(ts) ? ts : Date.now(),
        sourceMsgId: m.id
      };
      if (unsellable) rawOwned.isUnsellable = true;
      if (m.giftData.isHolo) rawOwned.isHolo = true;
      if (typeof m.giftData.serialNumber === 'number' && m.giftData.serialNumber > 0) {
        rawOwned.serialNumber = m.giftData.serialNumber;
      }
      if (m.giftData.originalSenderName) rawOwned.originalSenderName = m.giftData.originalSenderName;
      if (m.giftData.regiftedFrom) rawOwned.regiftedFrom = m.giftData.regiftedFrom;
      if (m.giftData.message) rawOwned.message = m.giftData.message;

      toClaim.push({ msg: m, owned: stripUndefinedDeep(rawOwned) as OwnedGift });
    }

    if (toClaim.length === 0) return;

    setOwnedGiftsMap(prev => {
      const next = { ...prev };
      toClaim.forEach(({ owned }) => {
        if (!next[owned.id]) next[owned.id] = owned;
      });
      return next;
    });
    setClaimedGiftStatusMap(prev => {
      const next = { ...prev };
      toClaim.forEach(({ msg }) => {
        if (!next[msg.id]) next[msg.id] = 'claimed';
      });
      return next;
    });

    const activeDb = db;
    if (activeDb) {
      toClaim.forEach(({ msg, owned }) => {
        set(ref(activeDb, `users/__gifts__/${currentUser.id}/${owned.id}`), owned).catch(() => {});
        set(ref(activeDb, `users/__claimed_gifts__/${currentUser.id}/${msg.id}`), 'claimed').catch(() => {});
      });
    }
  }, [currentUser, giftsHydratedForUser, messagesList, deletedMsgsMap, groupsMap, claimedGiftStatusMap, ownedGiftsMap, usersMap]);

  const ownedGiftsList = useMemo(
    () => Object.values(ownedGiftsMap).sort((a, b) => b.receivedAt - a.receivedAt),
    [ownedGiftsMap]
  );

  const handleSyncListenSession = (partial: Partial<ListenTogetherSession>) => {
    if (!currentUser || !activeListenSessionKey) return;
    const syncedNow = Date.now() + serverTimeOffsetMs;
    const nextSession: ListenTogetherSession = {
      trackId: partial.trackId ?? activeListenSession?.trackId ?? '',
      title: partial.title ?? activeListenSession?.title ?? '',
      artist: partial.artist ?? activeListenSession?.artist ?? '',
      durationSec: partial.durationSec ?? activeListenSession?.durationSec ?? 0,
      thumbnail: partial.thumbnail ?? activeListenSession?.thumbnail ?? '',
      genre: partial.genre ?? activeListenSession?.genre ?? 'pop',
      isPlaying: partial.isPlaying ?? activeListenSession?.isPlaying ?? true,
      positionSec: Number.isFinite(partial.positionSec) ? Math.max(0, partial.positionSec!) : 0,
      updatedAt: syncedNow,
      updatedBy: partial.updatedBy ?? currentUser.id,
      updatedByName: partial.updatedByName ?? currentUser.name
    };
    if (!nextSession.trackId) return;

    setActiveListenSession(nextSession);
    try {
      listenBroadcastRef.current?.postMessage({
        key: activeListenSessionKey,
        session: nextSession
      });
    } catch {}
    if (db) {
      set(ref(db, `users/__listen_together__/${activeListenSessionKey}`), nextSession).catch((err) => {
        console.warn('Failed to sync listen session:', err);
      });
    }

    if (nextSession.isPlaying && nextSession.title) {
      handleSetActivity('listening', nextSession.title);
    } else {
      handleSetActivity('idle');
    }
  };

  // Edit message
  const handleEditMessage = (msgId: string, newText: string) => {
    const updatedTime = new Date().toISOString();
    const editPayload = { text: newText, editedAt: updatedTime };
    const pending = pendingLocalMsgsRef.current.get(msgId);
    if (pending) {
      pendingLocalMsgsRef.current.set(msgId, { ...pending, text: newText, editedAt: updatedTime });
    }
    setEditedMsgsMap(prev => ({ ...prev, [msgId]: editPayload }));
    setMessagesList(prev => prev.map(m => m.id === msgId ? { ...m, text: newText, editedAt: updatedTime } : m));
    if (db) {
      set(ref(db, `users/__edited_messages__/${msgId}`), editPayload).catch(() => {});
    }
  };

  // Delete message
  const handleDeleteMessage = (msgId: string) => {
    inFlightWriteIdsRef.current.delete(msgId);
    pendingLocalMsgsRef.current.delete(msgId);
    setDeletedMsgsMap(prev => ({ ...prev, [msgId]: true }));
    setMessagesList(prev => prev.filter(m => m.id !== msgId));
    if (db) {
      set(ref(db, `users/__deleted_messages__/${msgId}`), true).catch(() => {});
    }
  };

  // Toggle reaction
  const handleToggleReaction = (msgId: string, emoji: string) => {
    if (!currentUser) return;
    const targetMsg = messagesList.find(m => m.id === msgId);
    const existingForUser = reactionsMap[msgId]?.[currentUser.id];

    let currentEmojis: string[];
    if (existingForUser !== undefined) {
      currentEmojis = existingForUser.filter(e => e !== '__none__');
    } else {
      // Fallback to any legacy reactions stored on the message object itself
      currentEmojis = [];
      if (targetMsg?.reactions) {
        Object.entries(targetMsg.reactions).forEach(([em, uids]) => {
          const list = Array.isArray(uids) ? uids : Object.values(uids || {});
          if (list.includes(currentUser.id)) {
            currentEmojis.push(em);
          }
        });
      }
    }

    // Enforce at most 1 reaction per user per message:
    // clicking the active emoji removes it; clicking another replaces it
    const nextEmojis = currentEmojis.includes(emoji) ? [] : [emoji];

    const storedList = nextEmojis.length > 0 ? nextEmojis : ['__none__'];

    setReactionsMap(prev => ({
      ...prev,
      [msgId]: {
        ...(prev[msgId] || {}),
        [currentUser.id]: storedList
      }
    }));

    if (db) {
      set(ref(db, `users/__reactions__/${msgId}/${currentUser.id}`), { list: storedList }).catch((err) => {
        console.warn('Failed to save reaction:', err);
      });
    }
  };

  // Save to Favorites / bookmarks
  const handleSaveToBookmarks = (msg: MessageItem) => {
    if (!currentUser) return;
    const newId = 'msg_bm_' + Date.now();
    const bookmarkMsg: Record<string, any> = {
      id: newId,
      senderId: currentUser.id,
      senderName: msg.senderName || currentUser.name,
      receiverId: currentUser.id,
      time: new Date().toISOString(),
      type: msg.type,
      readBy: [currentUser.id],
      text: getFallbackMessageText(msg.type, msg.text, msg.poll)
    };
    if (msg.imageUrl !== undefined) bookmarkMsg.imageUrl = msg.imageUrl;
    if (msg.videoUrl !== undefined) bookmarkMsg.videoUrl = msg.videoUrl;
    if (msg.audioUrl !== undefined) bookmarkMsg.audioUrl = msg.audioUrl;
    if (msg.poll !== undefined) bookmarkMsg.poll = msg.poll;
    if (msg.catShare !== undefined) bookmarkMsg.catShare = msg.catShare;
    if (msg.giftData !== undefined) bookmarkMsg.giftData = msg.giftData;

    const cleanBookmark = stripUndefinedDeep(bookmarkMsg) as MessageItem;
    pendingLocalMsgsRef.current.set(newId, cleanBookmark);
    setMessagesList(prev => [...prev, cleanBookmark]);
    if (db) {
      inFlightWriteIdsRef.current.add(newId);
      set(ref(db, `messages/${newId}`), cleanBookmark)
        .then(() => {
          inFlightWriteIdsRef.current.delete(newId);
        })
        .catch(() => {
          inFlightWriteIdsRef.current.delete(newId);
        });
    }
  };

  // Vote poll
  const handleVotePoll = (msgId: string, optionId: string) => {
    if (!currentUser) return;
    const targetMsg = messagesList.find(m => m.id === msgId);
    const explicitVote = pollVotesMap[msgId]?.[currentUser.id];

    let currentVotedOptionId: string | null = null;
    if (explicitVote !== undefined) {
      currentVotedOptionId = explicitVote === '__none__' ? null : explicitVote;
    } else if (targetMsg?.poll?.options) {
      const opts: Array<{ id: string; text: string; voterIds?: any }> = Array.isArray(targetMsg.poll.options)
        ? targetMsg.poll.options
        : Object.values(targetMsg.poll.options as Record<string, any>);
      const found = opts.find((opt) => {
        const voters = Array.isArray(opt.voterIds)
          ? opt.voterIds
          : opt.voterIds && typeof opt.voterIds === 'object'
          ? Object.values(opt.voterIds)
          : [];
        return voters.includes(currentUser.id);
      });
      if (found) currentVotedOptionId = found.id;
    }

    const nextVote = currentVotedOptionId === optionId ? '__none__' : optionId;

    setPollVotesMap(prev => ({
      ...prev,
      [msgId]: {
        ...(prev[msgId] || {}),
        [currentUser.id]: nextVote
      }
    }));

    if (db) {
      set(ref(db, `users/__poll_votes__/${msgId}/${currentUser.id}`), nextVote).catch((err) => {
        console.warn('Failed to save poll vote:', err);
      });
    }
  };

  // Admin moderation: Mute / Unmute user
  const handleToggleMuteUser = (targetUserId: string) => {
    if (!currentUser?.isAdmin && !isAdminPhone(currentUser?.phone || '')) return;
    const target = usersMap[targetUserId];
    if (!target) return;

    const newMutedState = !target.isMuted;
    setUsersMap(prev => ({
      ...prev,
      [targetUserId]: { ...target, isMuted: newMutedState }
    }));

    if (db) {
      update(ref(db, `users/${targetUserId}`), { isMuted: newMutedState }).catch(() => {});
    }
  };

  // Group creation
  const handleCreateGroup = (data: { name: string; description: string; avatarColor: string; memberIds: string[] }) => {
    if (!currentUser) return;
    if (containsProfanity(data.name) || containsProfanity(data.description)) return;
    const groupId = 'grp_' + Date.now();
    const newGroup: GroupChat = {
      id: groupId,
      name: data.name,
      description: data.description,
      avatar: data.avatarColor,
      creatorId: currentUser.id,
      memberIds: data.memberIds,
      createdAt: Date.now()
    };

    setGroupsMap(prev => ({ ...prev, [groupId]: newGroup }));
    if (db) {
      set(ref(db, `users/__groups__/${groupId}`), newGroup).catch(() => {});
    }

    // Welcome message in group
    const welcomeId = 'msg_w_' + Date.now();
    const welcomeMsg: MessageItem = {
      id: welcomeId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      groupId: groupId,
      time: new Date().toISOString(),
      type: 'text',
      text: `🚀 Группа «${data.name}» создана!`
    };
    pendingLocalMsgsRef.current.set(welcomeId, welcomeMsg);
    setMessagesList(prev => [...prev, welcomeMsg]);
    if (db) {
      inFlightWriteIdsRef.current.add(welcomeId);
      set(ref(db, `messages/${welcomeId}`), welcomeMsg)
        .then(() => {
          inFlightWriteIdsRef.current.delete(welcomeId);
        })
        .catch(() => {
          inFlightWriteIdsRef.current.delete(welcomeId);
        });
    }

    setActiveChatUserId(null);
    setActiveGroupId(groupId);
    setSidebarTab('groups');
    setIsMobileChatOpen(true);
  };

  // Group members management
  const handleAddGroupMember = (groupId: string, userId: string) => {
    const group = groupsMap[groupId];
    if (!group) return;
    const currentMembers = Array.isArray(group.memberIds) ? group.memberIds : [];
    const updatedMembers = Array.from(new Set([...currentMembers, userId]));
    const updatedGroup = { ...group, memberIds: updatedMembers };

    setGroupsMap(prev => ({ ...prev, [groupId]: updatedGroup }));
    if (db) {
      update(ref(db, `users/__groups__/${groupId}`), { memberIds: updatedMembers }).catch(() => {});
    }
  };

  const handleRemoveGroupMember = (groupId: string, userId: string) => {
    const group = groupsMap[groupId];
    if (!group) return;
    const currentMembers = Array.isArray(group.memberIds) ? group.memberIds : [];
    const updatedMembers = currentMembers.filter(id => id !== userId);
    const updatedGroup = { ...group, memberIds: updatedMembers };

    setGroupsMap(prev => ({ ...prev, [groupId]: updatedGroup }));
    if (db) {
      update(ref(db, `users/__groups__/${groupId}`), { memberIds: updatedMembers }).catch(() => {});
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroupsMap(prev => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    if (db) {
      remove(ref(db, `users/__groups__/${groupId}`)).catch(() => {});
    }
    setActiveGroupId(null);
    setIsMobileChatOpen(false);
  };

  const handleLeaveGroup = (groupId: string) => {
    if (!currentUser) return;
    handleRemoveGroupMember(groupId, currentUser.id);
    setActiveGroupId(null);
    setIsMobileChatOpen(false);
  };

  // Determine active conversation messages and merge live deletions, edits, read receipts, poll votes & reactions
  const activeMessages = messagesList
    .filter(m => {
      if (deletedMsgsMap[m.id]) return false;
      if (activeGroupId) {
        return m.groupId === activeGroupId;
      }
      if (activeChatUserId && currentUser) {
        if (m.groupId) return false;
        // Direct chat: either between me and partner, or if partner is me (Saved messages)
        if (activeChatUserId === currentUser.id) {
          return m.senderId === currentUser.id && m.receiverId === currentUser.id;
        }
        const fromMeToTarget = m.senderId === currentUser.id && m.receiverId === activeChatUserId;
        const fromTargetToMe = m.senderId === activeChatUserId && m.receiverId === currentUser.id;
        return fromMeToTarget || fromTargetToMe;
      }
      return false;
    })
    .map(m => {
      let nextMsg = m;

      const liveEdit = editedMsgsMap[m.id];
      if (liveEdit && liveEdit.text) {
        nextMsg = {
          ...nextMsg,
          text: liveEdit.text,
          editedAt: liveEdit.editedAt || nextMsg.editedAt
        };
      }

      const liveReceipts = readReceiptsMap[m.id];
      if (liveReceipts && typeof liveReceipts === 'object') {
        const mergedReadBy = Array.from(
          new Set([
            ...(Array.isArray(nextMsg.readBy) ? nextMsg.readBy : []),
            ...Object.keys(liveReceipts).filter(uid => liveReceipts[uid])
          ])
        );
        nextMsg = { ...nextMsg, readBy: mergedReadBy };
      }

      // Merge live poll votes
      if (m.type === 'poll' && m.poll) {
        const rawOpts = Array.isArray(m.poll.options)
          ? m.poll.options
          : m.poll.options && typeof m.poll.options === 'object'
          ? Object.values(m.poll.options)
          : [];
        const liveVotesForMsg = pollVotesMap[m.id] || {};

        const mergedOptions = rawOpts.map((opt: any) => {
          const legacyVoters: string[] = Array.isArray(opt.voterIds)
            ? opt.voterIds
            : opt.voterIds && typeof opt.voterIds === 'object'
            ? Object.values(opt.voterIds)
            : [];

          const voterSet = new Set(
            legacyVoters.filter(uid => liveVotesForMsg[uid] === undefined)
          );

          Object.entries(liveVotesForMsg).forEach(([uid, votedOptId]) => {
            if (votedOptId === opt.id) {
              voterSet.add(uid);
            }
          });

          return {
            ...opt,
            voterIds: Array.from(voterSet)
          };
        });

        nextMsg = {
          ...nextMsg,
          poll: {
            ...m.poll,
            options: mergedOptions
          }
        };
      }

      // Merge live reactions
      const liveReactionsForMsg = reactionsMap[m.id];
      if (m.reactions || liveReactionsForMsg) {
        const mergedReactions: Record<string, string[]> = {};

        const seenLegacyUids = new Set<string>();
        if (m.reactions && typeof m.reactions === 'object') {
          Object.entries(m.reactions).forEach(([em, uids]) => {
            const list = Array.isArray(uids) ? uids : Object.values(uids || {});
            const filtered = list.filter((uid): uid is string => {
              if (typeof uid !== 'string') return false;
              if (liveReactionsForMsg && liveReactionsForMsg[uid] !== undefined) return false;
              if (seenLegacyUids.has(uid)) return false;
              seenLegacyUids.add(uid);
              return true;
            });
            if (filtered.length > 0) {
              mergedReactions[em] = filtered;
            }
          });
        }

        if (liveReactionsForMsg) {
          Object.entries(liveReactionsForMsg).forEach(([uid, userEmojis]) => {
            const validEmojis = (userEmojis || []).filter(em => Boolean(em) && em !== '__none__');
            const activeEmoji = validEmojis.length > 0 ? validEmojis[validEmojis.length - 1] : null;
            if (activeEmoji) {
              if (!mergedReactions[activeEmoji]) mergedReactions[activeEmoji] = [];
              if (!mergedReactions[activeEmoji].includes(uid)) {
                mergedReactions[activeEmoji].push(uid);
              }
            }
          });
        }

        nextMsg = {
          ...nextMsg,
          reactions: mergedReactions
        };
      }

      return nextMsg;
    });

  // Mark incoming messages in the active conversation as read
  useEffect(() => {
    if (!currentUser || (!activeChatUserId && !activeGroupId)) return;
    const unreadIds: string[] = [];

    for (const m of messagesList) {
      if (deletedMsgsMap[m.id]) continue;
      if (m.senderId === currentUser.id) continue;
      const inActiveChat = activeGroupId
        ? m.groupId === activeGroupId
        : !m.groupId && m.senderId === activeChatUserId && m.receiverId === currentUser.id;
      if (!inActiveChat) continue;

      const existingReadBy = Array.isArray(m.readBy) ? m.readBy : [];
      const alreadyMarked =
        existingReadBy.includes(currentUser.id) ||
        Boolean(readReceiptsMap[m.id]?.[currentUser.id]);
      if (!alreadyMarked) {
        unreadIds.push(m.id);
      }
    }

    if (unreadIds.length === 0) return;

    setReadReceiptsMap(prev => {
      const next = { ...prev };
      unreadIds.forEach(id => {
        next[id] = { ...(next[id] || {}), [currentUser.id]: true };
      });
      return next;
    });
    const activeDb = db;
    if (activeDb) {
      unreadIds.forEach(id => {
        set(ref(activeDb, `users/__read_receipts__/${id}/${currentUser.id}`), true).catch(() => {});
      });
    }
  }, [currentUser?.id, activeChatUserId, activeGroupId, messagesList, deletedMsgsMap, readReceiptsMap]);

  const activeUser = activeChatUserId
    ? usersMap[activeChatUserId] || (activeChatUserId === currentUser?.id ? currentUser : null)
    : null;
  const activeGroup = activeGroupId ? groupsMap[activeGroupId] || null : null;

  // Compute TikTok-style chat streaks across all conversations (mutual replies required in direct & group chats)
  const chatStreaksMap = useMemo<Record<string, ChatStreakInfo>>(() => {
    const groupedMsgs: Record<string, Array<{ time: string; senderId?: string }>> = {};
    const requiredSendersByKey: Record<string, number> = {};

    for (const m of messagesList) {
      if (deletedMsgsMap[m.id]) continue;
      const key = m.groupId
        ? getStreakChatKey({ groupId: m.groupId })
        : getStreakChatKey({ currentUserId: m.senderId, targetUserId: m.receiverId });
      if (!key) continue;
      if (!groupedMsgs[key]) groupedMsgs[key] = [];
      groupedMsgs[key].push({ time: m.time, senderId: m.senderId });

      if (requiredSendersByKey[key] === undefined) {
        if (m.groupId) {
          const memberCount = groupsMap[m.groupId]?.memberIds?.length || 0;
          requiredSendersByKey[key] = memberCount === 1 ? 1 : 2;
        } else if (key.startsWith('direct_self_')) {
          requiredSendersByKey[key] = 1;
        } else {
          requiredSendersByKey[key] = 2;
        }
      }
    }

    const result: Record<string, ChatStreakInfo> = {};
    const allKeys = new Set<string>([
      ...Object.keys(groupedMsgs),
      ...Object.keys(streakMetaMap)
    ]);

    allKeys.forEach((key) => {
      let req = requiredSendersByKey[key];
      if (req === undefined) {
        if (key.startsWith('direct_self_')) {
          req = 1;
        } else if (key.startsWith('group_')) {
          const gid = key.slice('group_'.length);
          const memberCount = groupsMap[gid]?.memberIds?.length || 0;
          req = memberCount === 1 ? 1 : 2;
        } else {
          req = 2;
        }
      }

      const frozenDays = extractFrozenDays(streakMetaMap[key]?.frozenDays);
      const computed = computeChatStreakFromMessages(groupedMsgs[key] || [], Date.now(), {
        requiredSenders: req,
        frozenDays
      });
      const customName = typeof streakMetaMap[key]?.customName === 'string'
        ? streakMetaMap[key].customName!
        : '';
      result[key] = {
        streakKey: key,
        count: computed.count,
        lastActiveDay: computed.lastActiveDay,
        customName,
        isHotToday: computed.isHotToday,
        isAtRisk: computed.isAtRisk,
        isFrozenToday: computed.isFrozenToday,
        frozenDays: computed.frozenDays,
        canRescueYesterday: computed.canRescueYesterday,
        rescuableCount: computed.rescuableCount,
        pendingToday: computed.pendingToday,
        todaySenderIds: computed.todaySenderIds,
        requiredSenders: computed.requiredSenders
      };
    });

    return result;
  }, [messagesList, deletedMsgsMap, streakMetaMap, groupsMap]);

  const activeStreakKey = getStreakChatKey({
    currentUserId: currentUser?.id,
    targetUserId: activeChatUserId,
    groupId: activeGroupId
  });
  const activeStreak = activeStreakKey ? chatStreaksMap[activeStreakKey] || null : null;

  const handleRenameStreak = (streakKey: string, newName: string) => {
    const cleanName = newName.trim();
    const updatedAt = Date.now();
    setStreakMetaMap(prev => {
      const existing = prev[streakKey] || {};
      return {
        ...prev,
        [streakKey]: {
          ...existing,
          customName: cleanName,
          updatedAt
        }
      };
    });
    if (db) {
      update(ref(db, `users/__chat_streaks__/${streakKey}`), {
        customName: cleanName,
        updatedAt
      }).catch((err) => {
        console.warn('Failed to save streak name:', err);
      });
    }
  };

  const handleFreezeStreak = (streakKey: string, dayKey: string) => {
    if (!currentUser || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return;
    const now = Date.now();
    const freezeEntry = {
      byUserId: currentUser.id,
      byName: currentUser.name,
      at: now
    };
    setStreakMetaMap(prev => {
      const existing = prev[streakKey] || {};
      const existingMap: Record<string, any> = Array.isArray(existing.frozenDays)
        ? Object.fromEntries(existing.frozenDays.map(d => [d, true]))
        : { ...(existing.frozenDays || {}) };
      existingMap[dayKey] = freezeEntry;
      return {
        ...prev,
        [streakKey]: {
          ...existing,
          frozenDays: existingMap,
          updatedAt: now
        }
      };
    });
    if (db) {
      update(ref(db, `users/__chat_streaks__/${streakKey}`), {
        updatedAt: now,
        [`frozenDays/${dayKey}`]: freezeEntry
      }).catch((err) => {
        console.warn('Failed to freeze streak:', err);
      });
    }
  };

  const handleTogglePinGift = (giftId: string) => {
    if (!currentUser) return;
    const nextPinned = togglePinnedGiftId(currentUser.pinnedGiftIds || [], giftId);
    handleUpdateProfile({ pinnedGiftIds: nextPinned });
  };

  const handleSelectProfileBanner = (bannerId: 'default' | 'aurora' | 'galaxy' | 'sunset') => {
    if (!currentUser) return;
    handleUpdateProfile({ profileBannerId: bannerId });
  };

  const handleUnlockProfileBanner = (bannerId: 'default' | 'aurora' | 'galaxy' | 'sunset') => {
    if (!currentUser) return;
    const existingUnlocked = Array.isArray(currentUser.unlockedBanners) && currentUser.unlockedBanners.length > 0
      ? currentUser.unlockedBanners
      : ['default'];
    const nextUnlocked = Array.from(new Set([...existingUnlocked, bannerId]));
    handleUpdateProfile({
      unlockedBanners: nextUnlocked,
      profileBannerId: bannerId
    });
  };

  const handleSelectEmojiStatus = (statusId: ProfileEmojiStatusId) => {
    if (!currentUser) return;
    handleUpdateProfile({ emojiStatus: statusId });
  };

  const handleUnlockEmojiStatus = (statusId: ProfileEmojiStatusId) => {
    if (!currentUser) return;
    const existingUnlocked = Array.isArray(currentUser.unlockedStatuses) && currentUser.unlockedStatuses.length > 0
      ? currentUser.unlockedStatuses
      : ['none'];
    const nextUnlocked = Array.from(new Set([...existingUnlocked, statusId]));
    handleUpdateProfile({
      unlockedStatuses: nextUnlocked,
      emojiStatus: statusId
    });
  };

  const handleSelectStreakWallpaper = (streakKey: string, wallpaperId: string) => {
    const updatedAt = Date.now();
    setStreakMetaMap(prev => ({
      ...prev,
      [streakKey]: {
        ...(prev[streakKey] || {}),
        wallpaperId,
        updatedAt
      }
    }));
    if (db) {
      update(ref(db, `users/__chat_streaks__/${streakKey}`), {
        wallpaperId,
        updatedAt
      }).catch(() => {});
    }
  };

  const handlePinMessage = (msgId: string | null) => {
    if (!activeStreakKey) return;
    setPinnedMessagesMap(prev => {
      const next = { ...prev };
      if (msgId) next[activeStreakKey] = msgId;
      else delete next[activeStreakKey];
      return next;
    });
    if (db) {
      if (msgId) {
        set(ref(db, `users/__pinned_messages__/${activeStreakKey}`), msgId).catch(() => {});
      } else {
        remove(ref(db, `users/__pinned_messages__/${activeStreakKey}`)).catch(() => {});
      }
    }
  };

  const activePinnedMessage = useMemo(() => {
    if (!activeStreakKey) return null;
    const pinnedId = pinnedMessagesMap[activeStreakKey];
    if (!pinnedId) return null;
    return activeMessages.find(m => m.id === pinnedId) || null;
  }, [activeStreakKey, pinnedMessagesMap, activeMessages]);

  const activeStreakWallpaperId = activeStreakKey
    ? streakMetaMap[activeStreakKey]?.wallpaperId || 'default'
    : 'default';

  const handleSendCoinEnvelope = (totalCoins: number, maxClaims: number, note?: string): boolean => {
    if (!currentUser || currentUser.isMuted) return false;
    if (!activeChatUserId && !activeGroupId) return false;
    const cleanCoins = Math.floor(totalCoins);
    const cleanClaims = Math.min(10, Math.max(1, Math.floor(maxClaims)));
    if (cleanCoins < 100) return false;

    const coinsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUser.id);
    const currentCoins = readUserCatEconomy(currentUser.id).coins;
    if (currentCoins < cleanCoins) return false;

    const nextCoins = currentCoins - cleanCoins;
    try {
      localStorage.setItem(coinsKey, String(nextCoins));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'coin_envelope_send' } }));
    } catch {}

    const envelopeId = 'env_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const cleanNote = typeof note === 'string' && note.trim() ? note.trim() : undefined;
    const envelope: CoinEnvelopeData = {
      envelopeId,
      totalCoins: cleanCoins,
      maxClaims: cleanClaims,
      senderId: currentUser.id,
      senderName: currentUser.name,
      ...(cleanNote ? { note: cleanNote } : {})
    };
    handleSendMessage({
      type: 'coin_envelope',
      text: cleanNote || `🧧 Конверт с монетами (${cleanCoins} 🪙)`,
      coinEnvelope: envelope
    });
    return true;
  };

  const handleClaimCoinEnvelope = (msgId: string, envelope: CoinEnvelopeData) => {
    if (!currentUser) return;
    const claimedList = Array.isArray(envelope.claimedBy)
      ? envelope.claimedBy.filter(Boolean)
      : envelope.claimedBy && typeof envelope.claimedBy === 'object'
      ? Object.values(envelope.claimedBy).filter(Boolean)
      : [];
    if (claimedList.some(c => c && c.userId === currentUser.id)) {
      return;
    }
    const check = computeEnvelopeClaimShare(envelope, currentUser.id);
    if (!check.canClaim || check.amount <= 0) return;

    const claimEntry = {
      userId: currentUser.id,
      userName: currentUser.name,
      amount: check.amount,
      claimedAt: Date.now()
    };

    const nextClaimedBy = {
      ...(envelope.claimedBy || {}),
      [currentUser.id]: claimEntry
    };

    setMessagesList(prev =>
      prev.map(m =>
        m.id === msgId && m.coinEnvelope
          ? {
              ...m,
              coinEnvelope: {
                ...m.coinEnvelope,
                claimedBy: nextClaimedBy
              }
            }
          : m
      )
    );

    if (db) {
      set(ref(db, `messages/${msgId}/coinEnvelope/claimedBy/${currentUser.id}`), claimEntry).catch(() => {});
    }

    const coinsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUser.id);
    const curCoins = readUserCatEconomy(currentUser.id).coins;
    try {
      localStorage.setItem(coinsKey, String(curCoins + check.amount));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'coin_envelope_claim' } }));
    } catch {}
  };

  const handleCraftGifts = (ingredients: OwnedGift[], mode: 'next_tier' | 'holo' = 'next_tier'): OwnedGift | null => {
    if (!currentUser) return null;
    const consumed = ingredients.slice(0, CRAFT_REQUIRED_COUNT);
    if (consumed.length < CRAFT_REQUIRED_COUNT || !consumed.every(g => Boolean(ownedGiftsMap[g.id]))) {
      return null;
    }

    const isHammerTarget =
      mode === 'next_tier' && consumed[0]?.giftId === 'cosmic_kitten';
    const existingHammerCount = Object.values(ownedGiftsMap).filter(
      g => g.giftId === COSMIC_HAMMER_GIFT_ID
    ).length;
    const nextSerial = isHammerTarget
      ? computeNextGiftSerial(COSMIC_HAMMER_GIFT_ID, messagesList, existingHammerCount)
      : undefined;

    const crafted = computeCraftedGiftResult(
      consumed,
      mode,
      currentUser.id,
      currentUser.name,
      Date.now(),
      nextSerial
    );
    if (!crafted) return null;

    setOwnedGiftsMap(prev => {
      const next = { ...prev };
      consumed.forEach(item => {
        delete next[item.id];
      });
      next[crafted.id] = crafted;
      return next;
    });

    const consumedMsgIds = consumed
      .map(item => item.sourceMsgId)
      .filter((id): id is string => Boolean(id));
    if (consumedMsgIds.length > 0) {
      setClaimedGiftStatusMap(prev => {
        const next = { ...prev };
        consumedMsgIds.forEach(srcId => {
          next[srcId] = 'crafted';
        });
        return next;
      });
    }

    if (db) {
      const activeDb = db;
      consumed.forEach(item => {
        remove(ref(activeDb, `users/__gifts__/${currentUser.id}/${item.id}`)).catch(() => {});
        if (item.sourceMsgId) {
          set(ref(activeDb, `users/__claimed_gifts__/${currentUser.id}/${item.sourceMsgId}`), 'crafted').catch(() => {});
        }
      });
      set(ref(activeDb, `users/__gifts__/${currentUser.id}/${crafted.id}`), stripUndefinedDeep(crafted)).catch(() => {});
    }

    if (crafted.giftId === COSMIC_HAMMER_GIFT_ID || shouldTriggerGiftCelebration(crafted.starsCost, crafted.isHolo)) {
      setCelebrationEvent({
        id: crafted.id,
        title:
          crafted.giftId === COSMIC_HAMMER_GIFT_ID
            ? 'Выкован Космический молот!'
            : `Скрафчен ${crafted.title}!`,
        emoji: crafted.emoji,
        subtitle:
          crafted.giftId === COSMIC_HAMMER_GIFT_ID
            ? '🔨 Эксклюзив крафта · Можно подарить · Нельзя продать'
            : crafted.isHolo
            ? '✨ Голографический артефакт (2× ценность)'
            : `${crafted.starsCost} ⭐`
      });
    }
    return crafted;
  };

  const handleProposeGiftTrade = (
    targetUser: UserProfile,
    targetGift: OwnedGift,
    offeredGift: OwnedGift,
    note?: string
  ): boolean => {
    if (!currentUser || currentUser.isMuted) return false;
    if (!ownedGiftsMap[offeredGift.id]) return false;
    if (targetUser.id === currentUser.id) return false;
    if (isGiftUnsellable(targetGift) || isGiftUnsellable(offeredGift)) return false;

    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const cleanNote = typeof note === 'string' && note.trim() ? note.trim() : undefined;
    const offer: TradeOfferData = {
      tradeId: `trd_${msgId}`,
      proposerId: currentUser.id,
      proposerName: currentUser.name,
      proposerGift: stripUndefinedDeep(offeredGift),
      recipientId: targetUser.id,
      recipientName: targetUser.name,
      recipientGift: stripUndefinedDeep(targetGift),
      ...(cleanNote ? { note: cleanNote } : {}),
      status: 'pending',
      updatedAt: Date.now()
    };

    const newMsg = stripUndefinedDeep({
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderPhone: cleanDigits(currentUser.phone),
      receiverId: targetUser.id,
      time: new Date().toISOString(),
      readBy: [currentUser.id],
      type: 'trade_offer',
      text: `🔄 Предложение обмена: ${offeredGift.emoji} ${offeredGift.title} ↔ ${targetGift.emoji} ${targetGift.title}`,
      tradeOffer: offer
    }) as MessageItem;

    pendingLocalMsgsRef.current.set(msgId, newMsg);
    setMessagesList(prev => [...prev, newMsg]);
    if (db) {
      inFlightWriteIdsRef.current.add(msgId);
      set(ref(db, `messages/${msgId}`), newMsg)
        .then(() => inFlightWriteIdsRef.current.delete(msgId))
        .catch(() => inFlightWriteIdsRef.current.delete(msgId));
    }

    setActiveGroupId(null);
    setActiveChatUserId(targetUser.id);
    setIsMobileChatOpen(true);
    return true;
  };

  const handleRespondTradeOffer = (
    msgId: string,
    offer: TradeOfferData,
    decision: 'accepted' | 'declined'
  ) => {
    if (!currentUser || offer.recipientId !== currentUser.id || offer.status !== 'pending') return;
    const updatedOffer: TradeOfferData = {
      ...offer,
      status: decision,
      updatedAt: Date.now()
    };

    setMessagesList(prev =>
      prev.map(m => (m.id === msgId ? { ...m, tradeOffer: updatedOffer } : m))
    );
    if (db) {
      update(ref(db, `messages/${msgId}/tradeOffer`), {
        status: decision,
        updatedAt: updatedOffer.updatedAt
      }).catch(() => {});
    }

    if (decision !== 'accepted') return;

    const now = Date.now();
    const receivedFromProposer: OwnedGift = {
      ...offer.proposerGift,
      senderId: offer.proposerId,
      senderName: offer.proposerName,
      receivedAt: now
    };
    const sentToProposer: OwnedGift = {
      ...offer.recipientGift,
      senderId: currentUser.id,
      senderName: currentUser.name,
      receivedAt: now
    };

    setOwnedGiftsMap(prev => {
      const next = { ...prev };
      delete next[offer.recipientGift.id];
      next[receivedFromProposer.id] = receivedFromProposer;
      return next;
    });

    // Sync local caches for proposer when testing locally across sessions
    try {
      const propKey = `cosmo_user_gifts_${offer.proposerId}`;
      const propRaw = localStorage.getItem(propKey);
      const propMap = propRaw ? JSON.parse(propRaw) : {};
      if (propMap && typeof propMap === 'object') {
        delete propMap[offer.proposerGift.id];
        propMap[sentToProposer.id] = sentToProposer;
        localStorage.setItem(propKey, JSON.stringify(propMap));
        window.dispatchEvent(new CustomEvent('cosmo-user-gifts-updated', { detail: { userId: offer.proposerId } }));
      }
    } catch {}

    if (db) {
      remove(ref(db, `users/__gifts__/${currentUser.id}/${offer.recipientGift.id}`)).catch(() => {});
      set(ref(db, `users/__gifts__/${currentUser.id}/${receivedFromProposer.id}`), stripUndefinedDeep(receivedFromProposer)).catch(() => {});
      remove(ref(db, `users/__gifts__/${offer.proposerId}/${offer.proposerGift.id}`)).catch(() => {});
      set(ref(db, `users/__gifts__/${offer.proposerId}/${sentToProposer.id}`), stripUndefinedDeep(sentToProposer)).catch(() => {});
    }

    setCelebrationEvent({
      id: offer.tradeId,
      title: 'Обмен подарками выполнен!',
      emoji: receivedFromProposer.emoji,
      subtitle: `${offer.recipientGift.emoji} ↔ ${receivedFromProposer.emoji}`
    });
  };

  const themeClass = isMatrixMode
    ? 'bg-black text-emerald-400 selection:bg-emerald-600 selection:text-black font-mono'
    : currentTheme === 'wave'
    ? 'theme-wave bg-[var(--cc-bg-app)] text-[var(--cc-text)] selection:bg-cyan-500 selection:text-slate-950'
    : currentTheme === 'cofe'
    ? 'theme-cofe bg-[var(--cc-bg-app)] text-[var(--cc-text)] selection:bg-amber-600 selection:text-white'
    : 'theme-default bg-[var(--cc-bg-app)] text-[var(--cc-text)] selection:bg-blue-600 selection:text-white';

  return (
    <div className={`h-[100dvh] w-full max-w-full overflow-hidden flex font-sans antialiased transition-colors duration-300 relative ${themeClass}`}>
      
      {/* Wave Decorative Background Overlay */}
      {currentTheme === 'wave' && !isMatrixMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-15">
          <svg className="absolute -bottom-10 w-[200%] h-48 animate-wave-motion" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,50 L1200,120 L0,120 Z" fill="#06b6d4" />
          </svg>
          <svg className="absolute -bottom-10 w-[200%] h-36 animate-wave-motion opacity-75" style={{ animationDuration: '22s', animationDirection: 'reverse' }} viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,0 C200,60 400,-20 600,40 C800,100 1000,10 1200,40 L1200,120 L0,120 Z" fill="#0284c7" />
          </svg>
        </div>
      )}

      {/* Coffee Decorative Ambient Glow Overlay */}
      {currentTheme === 'cofe' && !isMatrixMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-700/12 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-orange-900/15 blur-3xl" />
        </div>
      )}

      {/* Matrix Mode Global Hacker Banner */}
      {isMatrixMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-black/95 border border-emerald-500/70 px-4 py-1.5 rounded-xl shadow-[0_0_24px_rgba(16,185,129,0.35)] flex items-center gap-3 text-xs text-emerald-300 font-mono">
          <span>MATRIX_MODE :: ACTIVE</span>
          <button
            onClick={() => setIsMatrixMode(false)}
            className="ml-1 px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/70 rounded text-emerald-200 text-[10px] font-bold cursor-pointer transition-colors"
          >
            ВЫХОД [ESC]
          </button>
        </div>
      )}

      {/* Main Full-Bleed Messenger Workspace */}
      <div className={`w-full min-w-0 h-full flex overflow-hidden transition-colors duration-300 z-10 ${
        isMatrixMode ? 'bg-black/95 border border-emerald-500/40' : 'bg-[var(--cc-bg-app)]'
      }`}>
        
        {/* Left Navigation & Chat List Rail */}
        <div className={`w-full sm:w-[320px] lg:w-[344px] min-w-0 h-full overflow-hidden shrink-0 ${isMobileChatOpen ? 'hidden sm:flex' : 'flex'}`}>
          {currentUser && (
            <Sidebar
              currentUser={currentUser}
              users={Object.values(usersMap)}
              groups={Object.values(groupsMap)}
              activeChatUserId={activeChatUserId}
              activeGroupId={activeGroupId}
              onSelectDirectChat={handleSelectDirectChat}
              onSelectGroupChat={handleSelectGroupChat}
              onOpenCreateGroup={() => setIsCreateGroupModalOpen(true)}
              onOpenProfile={() => setIsProfileModalOpen(true)}
              onLogout={handleLogout}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              currentTab={sidebarTab}
              onTabChange={setSidebarTab}
              onDeleteAllNumbers={handleDeleteAllNumbers}
              onOpenCommandLine={() => setIsCommandLineOpen(true)}
              onOpenQrCode={() => setIsQrModalOpen(true)}
              onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
              chatStreaks={chatStreaksMap}
            />
          )}
        </div>

        {/* Right Chat Canvas */}
        <div className={`flex-1 min-w-0 w-full h-full overflow-hidden ${isMobileChatOpen ? 'flex' : 'hidden sm:flex'}`}>
          {currentUser && (activeUser || activeGroup) ? (
            <ChatArea
              currentUser={currentUser}
              activeUser={activeUser}
              activeGroup={activeGroup}
              messages={activeMessages}
              allUsers={usersMap}
              onBackToSidebar={() => setIsMobileChatOpen(false)}
              onOpenGroupInfo={() => setIsGroupInfoModalOpen(true)}
              onSendMessage={handleSendMessage}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onToggleReaction={handleToggleReaction}
              onSaveToBookmarks={handleSaveToBookmarks}
              onVotePoll={handleVotePoll}
              onToggleMuteUser={handleToggleMuteUser}
              onOpenLightbox={(url) => setLightboxImageUrl(url)}
              onOpenPollModal={() => setIsPollModalOpen(true)}
              onSetActivity={handleSetActivity}
              onOpenMusicPlayer={(track) => {
                if (track) setSharedTrackToPlay(track);
                setIsMusicActive(true);
              }}
              onOpenCatGame={() => setIsMinigameOpen(true)}
              listenSession={activeListenSession}
              serverTimeOffsetMs={serverTimeOffsetMs}
              activeStreakKey={activeStreakKey}
              activeStreak={activeStreak}
              onRenameStreak={handleRenameStreak}
              onFreezeStreak={handleFreezeStreak}
              activeStreakWallpaperId={activeStreakWallpaperId}
              onSelectStreakWallpaper={handleSelectStreakWallpaper}
              pinnedMessage={activePinnedMessage}
              onPinMessage={handlePinMessage}
              onSendCoinEnvelope={handleSendCoinEnvelope}
              onClaimCoinEnvelope={handleClaimCoinEnvelope}
              onRespondTradeOffer={handleRespondTradeOffer}
              onTriggerStreakMilestoneCelebration={(days, title, badge) => {
                setCelebrationEvent({
                  id: `milestone_${days}_${Date.now()}`,
                  title: `${title} (${days} дн.)!`,
                  emoji: badge,
                  subtitle: 'Награда за серию огонька получена'
                });
              }}
              ownedGifts={ownedGiftsList}
              claimedGiftStatuses={claimedGiftStatusMap}
              allGroups={Object.values(groupsMap)}
              onRegiftGift={handleRegiftGift}
              onExchangeGiftForCoins={handleExchangeGiftForCoins}
               onBuyGiftForSelf={handleBuyGiftForSelf}
              onOpenUserProfile={(user) => setViewingProfileUser(user)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center cc-chat-backdrop">
              <div className="w-16 h-16 rounded-2xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border-strong)] flex items-center justify-center mb-4 shadow-lg text-[var(--cc-accent-text)]">
                <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.75" strokeOpacity="0.35" />
                  <path d="M7.5 19.5C11.5 22 20.5 14 24.5 10.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <circle cx="22" cy="11" r="2.25" fill="currentColor" />
                  <path d="M16 9.5L17.6 14.4L22.5 16L17.6 17.6L16 22.5L14.4 17.6L9.5 16L14.4 14.4L16 9.5Z" fill="currentColor" fillOpacity="0.9" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--cc-text)] tracking-tight">CosmoChat</h3>
              <p className="text-sm text-[var(--cc-text-muted)] mt-1.5 max-w-xs leading-relaxed">
                Выберите диалог или группу из списка слева, чтобы начать общение.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onSuccess={handleLoginSuccess}
        existingUsers={usersMap}
        onRegisterUser={handleRegisterUser}
      />

      {/* Profile & 2FA Modal */}
      {currentUser && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          allUsers={Object.values(usersMap)}
          allGroups={Object.values(groupsMap)}
          ownedGifts={ownedGiftsList}
          onRegiftGift={handleRegiftGift}
          onExchangeGiftForCoins={handleExchangeGiftForCoins}
          onCraftGifts={handleCraftGifts}
          onUpdateProfile={handleUpdateProfile}
          onDeleteAllNumbers={handleDeleteAllNumbers}
          onOpenR2Guide={() => setIsR2ModalOpen(true)}
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
          onOpenTelegramProfile={() => setViewingProfileUser(currentUser)}
          onAdminUpdateUser={handleAdminUpdateUser}
        />
      )}

      {/* Cosmo Profile Viewer (any user or self) */}
      {currentUser && (
        <TelegramProfileModal
          isOpen={Boolean(viewingProfileUser)}
          onClose={() => setViewingProfileUser(null)}
          targetUser={viewingProfileUser}
          currentUser={currentUser}
          allUsers={usersMap}
          allGroups={Object.values(groupsMap)}
          messages={messagesList}
          deletedMsgsMap={deletedMsgsMap}
          ownGifts={ownedGiftsList}
          ownClaimedStatuses={claimedGiftStatusMap}
          onSelectUserProfile={(user) => setViewingProfileUser(user)}
          onStartChat={(user) => handleSelectDirectChat(user)}
          onSelectGroup={(group) => handleSelectGroupChat(group)}
          onOpenSettings={() => setIsProfileModalOpen(true)}
          onOpenLightbox={(url) => setLightboxImageUrl(url)}
          onToggleMuteUser={handleToggleMuteUser}
          onSendGift={handleSendGift}
          onRegiftGift={handleRegiftGift}
          onExchangeGiftForCoins={handleExchangeGiftForCoins}
          onTogglePinGift={handleTogglePinGift}
          onSelectProfileBanner={handleSelectProfileBanner}
          onUnlockProfileBanner={handleUnlockProfileBanner}
          onSelectEmojiStatus={handleSelectEmojiStatus}
          onUnlockEmojiStatus={handleUnlockEmojiStatus}
          onCraftGifts={handleCraftGifts}
          onProposeGiftTrade={handleProposeGiftTrade}
        />
      )}

      {/* Leaderboard Modal ('Топ CosmoChat') */}
      {currentUser && (
        <LeaderboardModal
          isOpen={isLeaderboardOpen}
          onClose={() => setIsLeaderboardOpen(false)}
          currentUser={currentUser}
          allUsers={usersMap}
          allGroups={groupsMap}
          chatStreaks={chatStreaksMap}
          onSelectUserProfile={(user) => setViewingProfileUser(user)}
        />
      )}

      {/* Create Group Modal */}
      {currentUser && (
        <CreateGroupModal
          isOpen={isCreateGroupModalOpen}
          onClose={() => setIsCreateGroupModalOpen(false)}
          users={Object.values(usersMap)}
          currentUserId={currentUser.id}
          onCreateGroup={handleCreateGroup}
        />
      )}

      {/* Group Info Modal */}
      {currentUser && activeGroup && (
        <GroupInfoModal
          isOpen={isGroupInfoModalOpen}
          onClose={() => setIsGroupInfoModalOpen(false)}
          group={activeGroup}
          currentUser={currentUser}
          allUsers={Object.values(usersMap)}
          onAddMember={handleAddGroupMember}
          onRemoveMember={handleRemoveGroupMember}
          onDeleteGroup={handleDeleteGroup}
          onLeaveGroup={handleLeaveGroup}
          onOpenUserProfile={(user) => setViewingProfileUser(user)}
        />
      )}

      {/* Poll Creation Modal */}
      <PollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        onSubmit={(poll) => {
          handleSendMessage({
            type: 'poll',
            text: `📊 Опрос: ${poll.question}`,
            poll
          });
        }}
      />

      {/* Image Lightbox Modal */}
      <LightboxModal
        imageUrl={lightboxImageUrl}
        onClose={() => setLightboxImageUrl(null)}
      />

      {/* Terminal Command Line Modal ('/' shortcut) */}
      {currentUser && (
        <CommandLineModal
          isOpen={isCommandLineOpen}
          onClose={() => setIsCommandLineOpen(false)}
          currentUser={currentUser}
          allUsers={Object.values(usersMap)}
          onOpenQrCode={() => {
            setIsCommandLineOpen(false);
            setIsQrModalOpen(true);
          }}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onMatrixModeChange={(active) => setIsMatrixMode(active)}
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
          onTriggerMellstroy={handleTriggerMellstroy}
          isBeeSwarmActive={isBeeSwarmActive}
          onToggleBees={() => setIsBeeSwarmActive(prev => !prev)}
          onTriggerFox={() => setIsFoxOpen(true)}
          onTriggerMinigame={() => setIsMinigameOpen(true)}
          onToggleMusic={() => setIsMusicActive(prev => !prev)}
          isMusicActive={isMusicActive}
        />
      )}

      {/* Cross-Device QR Code Modal ('qr' command) */}
      {currentUser && (
        <QrCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          currentUser={currentUser}
        />
      )}

      {/* Cloudflare R2 Storage Guide Modal */}
      <R2SettingsModal
        isOpen={isR2ModalOpen}
        onClose={() => setIsR2ModalOpen(false)}
      />

      {/* QR Login Success Toast */}
      {qrLoginSuccessNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 border border-cyan-500/50 shadow-[0_0_40px_rgba(6,182,212,0.4)] px-5 py-3.5 rounded-2xl flex items-center gap-3.5 backdrop-blur-md animate-fade-in text-white max-w-md w-[90%]">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/60 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <span className="text-xl">🚀</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Вход по QR-коду успешен!</span>
            </div>
            <div className="text-xs text-slate-300 truncate">
              Вы авторизованы как <span className="text-cyan-400 font-mono font-medium">@{qrLoginSuccessNotice.username}</span> ({qrLoginSuccessNotice.name})
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQrLoginSuccessNotice(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mellstroy Command Overlay */}
      {isMellstroyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
          onClick={handleCloseMellstroy}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseMellstroy}
              aria-label="Закрыть"
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 transition-colors cursor-pointer"
            >
              ✕
            </button>
            <img
              src="/assets/aistudio/images_aabae77e.jpg"
              alt="mellstroy"
              className="w-full max-h-[80vh] object-contain bg-black block"
            />
          </div>
        </div>
      )}

      {/* Fox Command Overlay */}
      {isFoxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setIsFoxOpen(false)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsFoxOpen(false)}
              aria-label="Закрыть"
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 transition-colors cursor-pointer"
            >
              ✕
            </button>
            <img
              src="/assets/aistudio/images__1__4d22d0db.jpg"
              alt="fox"
              className="w-full max-h-[80vh] object-contain bg-black block"
            />
          </div>
        </div>
      )}

      {/* Flying Bees Swarm Overlay ('bee' command) */}
      <BeeSwarmOverlay isActive={isBeeSwarmActive} />

      {/* 2D Cartoon Cat Minigame Modal ('minigame' command) */}
      <CatMinigameModal
        key={currentUser?.id || 'guest'}
        currentUserId={currentUser?.id}
        isOpen={isMinigameOpen}
        onClose={() => setIsMinigameOpen(false)}
        activeContact={activeUser}
        activeGroup={activeGroup}
        allUsers={Object.values(usersMap)}
        allGroups={Object.values(groupsMap)}
        onShareCatToChat={handleShareCatToChat}
        onSendGift={handleSendGift}
      />

      {/* Top-Middle Windows & YouTube Media Player Widget ('music' command) */}
      <MusicPlayerWidget
        isActive={isMusicActive}
        onClose={() => {
          setIsMusicActive(false);
          if (currentUser?.activity?.status === 'listening') {
            handleSetActivity('idle');
          }
        }}
        currentUser={currentUser}
        activeContact={activeUser}
        activeGroup={activeGroup}
        onShareTrackToChat={handleShareTrackToChat}
        initialTrack={sharedTrackToPlay}
        listenSession={activeListenSession}
        serverTimeOffsetMs={serverTimeOffsetMs}
        onSyncListenSession={handleSyncListenSession}
      />

      {/* Fullscreen Particle Celebration Overlay */}
      <CelebrationOverlay
        event={celebrationEvent}
        onDone={() => setCelebrationEvent(null)}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

    </div>
  );
}
