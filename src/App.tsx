import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GroupChat, MessageItem, PollData, AppTheme, SharedMusicData } from './types/chat';
import { YouTubeTrack } from './utils/youtubeMusic';
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
    if (type === 'poll') return poll?.question ? `📊 Опрос: ${poll.question}` : '📊 Опрос';
    if (type === 'music_share') return '🎵 Совместное прослушивание YouTube Music';
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

    return () => {
      unsubUsers();
      unsubGroups();
      unsubMsgs();
      unsubPollVotes();
      unsubReactions();
      unsubDeletedMsgs();
      unsubEditedMsgs();
      unsubReadReceipts();
    };
  }, []);

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

  // Activity update (typing / recording)
  const handleSetActivity = (status: 'idle' | 'typing' | 'recording') => {
    if (!currentUser) return;
    const target = activeGroupId || activeChatUserId;
    if (!target) return;

    const activityData = status === 'idle' ? null : {
      status,
      targetId: target,
      updatedAt: Date.now(),
      userName: currentUser.name
    };

    if (db) {
      update(ref(db, `users/${currentUser.id}`), { activity: activityData }).catch(() => {});
    }
  };

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
    type: 'text' | 'image' | 'video' | 'voice' | 'poll' | 'music_share';
    text?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    poll?: PollData;
    musicShare?: SharedMusicData;
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

    if (msgData.imageUrl !== undefined) rawMsg.imageUrl = msgData.imageUrl;
    if (msgData.videoUrl !== undefined) rawMsg.videoUrl = msgData.videoUrl;
    if (msgData.audioUrl !== undefined) rawMsg.audioUrl = msgData.audioUrl;
    if (msgData.poll !== undefined) rawMsg.poll = msgData.poll;
    if (msgData.musicShare !== undefined) rawMsg.musicShare = msgData.musicShare;

    if (activeGroupId) {
      rawMsg.groupId = activeGroupId;
    } else if (activeChatUserId) {
      rawMsg.receiverId = activeChatUserId;
    }

    const newMsg = rawMsg as MessageItem;
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

    const cleanBookmark = bookmarkMsg as MessageItem;
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
          onUpdateProfile={handleUpdateProfile}
          onDeleteAllNumbers={handleDeleteAllNumbers}
          onOpenR2Guide={() => setIsR2ModalOpen(true)}
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
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
        isOpen={isMinigameOpen}
        onClose={() => setIsMinigameOpen(false)}
      />

      {/* Top-Middle Windows & YouTube Media Player Widget ('music' command) */}
      <MusicPlayerWidget
        isActive={isMusicActive}
        onClose={() => setIsMusicActive(false)}
        activeContact={activeUser}
        onShareTrackToChat={handleShareTrackToChat}
        initialTrack={sharedTrackToPlay}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

    </div>
  );
}
