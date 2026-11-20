import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, X, Send, SlidersHorizontal, RotateCcw, Lock, Share2, Gift } from 'lucide-react';
import { UserProfile, GroupChat, SharedCatData } from '../types/chat';
import {
  CAT_BACKGROUND_OPTIONS,
  CAT_GLASSES_OPTIONS,
  CAT_HAT_OPTIONS,
  CAT_LEVEL_4_UNLOCK_SWIPES,
  CAT_NECK_OPTIONS,
  CAT_PERSONALITY_OPTIONS,
  CAT_SKIN_OPTIONS,
  CAT_STORAGE_KEYS,
  CAT_TOP_OPTIONS,
  COINS_PER_PET,
  COINS_PER_STAR,
  CatCustomization,
  DEFAULT_CAT_CUSTOMIZATION,
  EARTH_GIFT_STARS,
  FEED_COST,
  HUNGRY_COINS_PER_PET,
  INITIAL_COINS,
  INITIAL_HUNGER,
  buildSharedCatData,
  decayHunger,
  evaluatePetClick,
  evaluatePetStroke,
  exchangeCoinsForStar,
  exchangeCoinsForStarsBatch,
  feedCat,
  formatCoinsCount,
  generateCatSupportReply,
  getCatLevelInfo,
  getEffectiveCatMood,
  getLevelUpgradeCustomization,
  getUserCatStorageKey,
  isCatOptionUnlocked,
  sanitizeCatCustomization,
  spendStarsForEarthGift
} from '../utils/catGameLogic';
import { CatSprite } from './CatSprite';
import { CatCardMessage } from './CatCardMessage';

interface CatMinigameModalProps {
  currentUserId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  activeContact?: UserProfile | null;
  activeGroup?: GroupChat | null;
  allUsers?: UserProfile[];
  allGroups?: GroupChat[];
  onShareCatToChat?: (
    catData: SharedCatData,
    target?: { receiverId?: string; groupId?: string }
  ) => void;
  onSendGift?: (
    gift: { giftId: string; title: string; emoji: string; starsCost: number; message?: string },
    target?: { receiverId?: string; groupId?: string }
  ) => void;
}

interface FloatingParticle {
  id: number;
  x: number;
  y: number;
  kind: 'heart' | 'refuse' | 'feed';
  text: string;
}

function readStoredSwipes(userId?: string | null): number {
  try {
    const raw = localStorage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.swipes, userId));
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
    }
  } catch {}
  return 0;
}

export const CatMinigameModal: React.FC<CatMinigameModalProps> = ({
  currentUserId,
  isOpen,
  onClose,
  activeContact,
  activeGroup,
  allUsers = [],
  allGroups = [],
  onShareCatToChat,
  onSendGift
}) => {
  const coinsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUserId);
  const starsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.stars, currentUserId);
  const catNameKey = getUserCatStorageKey(CAT_STORAGE_KEYS.catName, currentUserId);
  const hungerKey = getUserCatStorageKey(CAT_STORAGE_KEYS.hunger, currentUserId);
  const swipesKey = getUserCatStorageKey(CAT_STORAGE_KEYS.swipes, currentUserId);
  const customizationKey = getUserCatStorageKey(CAT_STORAGE_KEYS.customization, currentUserId);

  const isAdminAccount = Boolean(allUsers.find(u => u.id === currentUserId)?.isAdmin || currentUserId === 'usr_admin' || currentUserId === 'usr_admin_2');
  const [swipes, setSwipes] = useState<number>(() => {
    const base = readStoredSwipes(currentUserId);
    return isAdminAccount && base < CAT_LEVEL_4_UNLOCK_SWIPES ? CAT_LEVEL_4_UNLOCK_SWIPES : base;
  });
  const [coins, setCoins] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(coinsKey);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
      }
    } catch {}
    return INITIAL_COINS;
  });

  const [hunger, setHunger] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(hungerKey);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
      }
    } catch {}
    return INITIAL_HUNGER;
  });

  const [customization, setCustomization] = useState<CatCustomization>(() => {
    try {
      const initialLevel = getCatLevelInfo(readStoredSwipes(currentUserId)).level;
      const raw = localStorage.getItem(customizationKey);
      if (raw) {
        return sanitizeCatCustomization(JSON.parse(raw), initialLevel);
      }
    } catch {}
    return DEFAULT_CAT_CUSTOMIZATION;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPurring, setIsPurring] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [supportReply, setSupportReply] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isDancing, setIsDancing] = useState(false);
  const [catName, setCatName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(catNameKey);
      if (saved) return saved;
    } catch {}
    return 'Космо-Котик';
  });
  const [stars, setStars] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(starsKey);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
      }
    } catch {}
    return 0;
  });

  useEffect(() => {
    try {
      localStorage.setItem(catNameKey, catName);
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'cat_minigame' } }));
    } catch {}
  }, [catName, catNameKey]);

  useEffect(() => {
    try {
      localStorage.setItem(starsKey, String(stars));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'cat_minigame' } }));
    } catch {}
  }, [stars, starsKey]);

  // Reload coins/stars/catName/swipes/hunger/customization when modal opens or external modal updates economy
  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const rawCoins = localStorage.getItem(coinsKey);
        if (rawCoins !== null) {
          const c = Number(rawCoins);
          if (Number.isFinite(c) && c >= 0) setCoins(Math.floor(c));
        } else {
          setCoins(INITIAL_COINS);
        }
        const rawStars = localStorage.getItem(starsKey);
        if (rawStars !== null) {
          const s = Number(rawStars);
          if (Number.isFinite(s) && s >= 0) setStars(Math.floor(s));
        } else {
          setStars(0);
        }
        const rawName = localStorage.getItem(catNameKey);
        if (rawName !== null && rawName !== catName) {
          setCatName(rawName);
        }
        const rawSwipes = localStorage.getItem(swipesKey);
        if (rawSwipes !== null) {
          const sw = Number(rawSwipes);
          if (Number.isFinite(sw) && sw >= 0 && Math.floor(sw) !== swipesRef.current) {
            setSwipes(Math.floor(sw));
            swipesRef.current = Math.floor(sw);
          }
        }
        const rawHunger = localStorage.getItem(hungerKey);
        if (rawHunger !== null) {
          const hg = Number(rawHunger);
          if (Number.isFinite(hg) && hg >= 0) {
            const safeHunger = Math.max(0, Math.min(100, Math.round(hg)));
            if (safeHunger !== hungerRef.current) {
              setHunger(safeHunger);
              hungerRef.current = safeHunger;
            }
          }
        }
        const rawCust = localStorage.getItem(customizationKey);
        if (rawCust) {
          try {
            const currentSwipes = readStoredSwipes(currentUserId);
            const lvl = getCatLevelInfo(currentSwipes).level;
            const parsed = sanitizeCatCustomization(JSON.parse(rawCust), lvl);
            if (JSON.stringify(parsed) !== JSON.stringify(customizationRef.current)) {
              setCustomization(parsed);
              customizationRef.current = parsed;
            }
          } catch {}
        }
      } catch {}
    };
    if (isOpen) {
      syncFromStorage();
    }
    const onExternalUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.source !== 'cat_minigame') {
        syncFromStorage();
      }
    };
    window.addEventListener('cosmo-cat-economy-updated', onExternalUpdate);
    return () => window.removeEventListener('cosmo-cat-economy-updated', onExternalUpdate);
  }, [isOpen, coinsKey, starsKey, catNameKey, swipesKey, hungerKey, customizationKey, currentUserId]);

  // Sharing cat to chat state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [shareTargetKey, setShareTargetKey] = useState<string>('current');
  const [shareSuccessToast, setShareSuccessToast] = useState<string | null>(null);

  // Send Earth gift state
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [giftTargetKey, setGiftTargetKey] = useState<string>('current');

  const hungerRef = useRef(hunger);
  hungerRef.current = hunger;
  const swipesRef = useRef(swipes);
  swipesRef.current = swipes;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const customizationRef = useRef(customization);
  customizationRef.current = customization;
  const chatHistoryRef = useRef<Array<{ role: 'user' | 'cat'; text: string }>>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const strokeAccRef = useRef<number>(0);
  const lastPetTimeRef = useRef<number>(0);
  const lastClickTimeRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);
  const didSwipeDuringPressRef = useRef<boolean>(false);
  const purrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const particleIdRef = useRef(1);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (isMutedRef.current) return null;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playPurrSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Warm cat purr: low triangle wave modulated by ~26 Hz rumble LFO
    const carrier = ctx.createOscillator();
    carrier.type = 'triangle';
    carrier.frequency.setValueAtTime(102, now);
    carrier.frequency.exponentialRampToValueAtTime(118, now + 0.25);
    carrier.frequency.exponentialRampToValueAtTime(95, now + 0.58);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(26, now);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.08, now);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.linearRampToValueAtTime(0.14, now + 0.08);
    master.gain.linearRampToValueAtTime(0.11, now + 0.35);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);

    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    carrier.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    carrier.start(now);
    lfo.start(now);
    carrier.stop(now + 0.64);
    lfo.stop(now + 0.64);

    // Gentle coin chime
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(987.77, now + 0.04);
    chime.frequency.setValueAtTime(1318.51, now + 0.11);
    chimeGain.gain.setValueAtTime(0.001, now + 0.04);
    chimeGain.gain.linearRampToValueAtTime(0.06, now + 0.06);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chime.start(now + 0.04);
    chime.stop(now + 0.28);
  }, [getAudioContext]);

  const playSadMeowSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(640, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.56);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.07);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }, [getAudioContext]);

  const playSadPurrSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Quiet trembling plaintive purr
    const carrier = ctx.createOscillator();
    carrier.type = 'triangle';
    carrier.frequency.setValueAtTime(92, now);
    carrier.frequency.linearRampToValueAtTime(84, now + 0.55);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(20, now);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.05, now);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.linearRampToValueAtTime(0.1, now + 0.08);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);

    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    carrier.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    carrier.start(now);
    lfo.start(now);
    carrier.stop(now + 0.62);
    lfo.stop(now + 0.62);

    // Soft plaintive descending meow
    const meow = ctx.createOscillator();
    const meowGain = ctx.createGain();
    meow.type = 'triangle';
    meow.frequency.setValueAtTime(450, now + 0.04);
    meow.frequency.exponentialRampToValueAtTime(270, now + 0.48);
    meowGain.gain.setValueAtTime(0.001, now + 0.04);
    meowGain.gain.linearRampToValueAtTime(0.085, now + 0.1);
    meowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    meow.connect(meowGain);
    meowGain.connect(ctx.destination);
    meow.start(now + 0.04);
    meow.stop(now + 0.52);
  }, [getAudioContext]);

  const playFeedSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }, [getAudioContext]);

  const playAngrySound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(115, now + 0.32);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }, [getAudioContext]);

  // Persist coins, hunger, swipes & customization scoped to currentUserId
  useEffect(() => {
    try {
      localStorage.setItem(coinsKey, String(coins));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'cat_minigame' } }));
    } catch {}
  }, [coins, coinsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(hungerKey, String(Math.round(hunger)));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'cat_minigame' } }));
    } catch {}
  }, [hunger, hungerKey]);

  useEffect(() => {
    try {
      localStorage.setItem(swipesKey, String(swipes));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'cat_minigame' } }));
    } catch {}
  }, [swipes, swipesKey]);

  useEffect(() => {
    try {
      localStorage.setItem(customizationKey, JSON.stringify(customization));
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'cat_minigame' } }));
    } catch {}
  }, [customization, customizationKey]);

  // Gradually decrease hunger while game is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setHunger(prev => decayHunger(prev, 0.5));
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Periodic blinking effect (моргать)
  useEffect(() => {
    if (!isOpen) return;
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 220);
    }, 3600);
    return () => clearInterval(blinkInterval);
  }, [isOpen]);

  // Stop purring immediately if hunger drops to 0 and meow periodically while starving
  useEffect(() => {
    if (!isOpen) return;
    if (hunger <= 0) {
      setIsPurring(false);
      playSadMeowSound();
      const meowInterval = setInterval(() => {
        if (hungerRef.current <= 0) {
          playSadMeowSound();
        }
      }, 4500);
      return () => clearInterval(meowInterval);
    }
  }, [isOpen, hunger <= 0, playSadMeowSound]);

  // Clean up timers on unmount/close
  useEffect(() => {
    if (!isOpen) {
      lastPointerRef.current = null;
      strokeAccRef.current = 0;
      setIsPurring(false);
      setParticles([]);
      setSupportReply(null);
      setIsThinking(false);
      setSupportError(null);
      if (purrTimeoutRef.current) {
        clearTimeout(purrTimeoutRef.current);
        purrTimeoutRef.current = null;
      }
      if (supportTimerRef.current) {
        clearTimeout(supportTimerRef.current);
        supportTimerRef.current = null;
      }
    }
  }, [isOpen]);

  const spawnParticle = useCallback((clientX: number, clientY: number, kind: FloatingParticle['kind'], text: string) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const relX = Math.max(36, Math.min(rect.width - 36, clientX - rect.left));
    const relY = Math.max(40, Math.min(rect.height - 40, clientY - rect.top));
    const id = particleIdRef.current++;

    setParticles(prev => [...prev.slice(-14), { id, x: relX, y: relY, kind, text }]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, 950);
  }, []);

  const applyPetReward = useCallback(
    (clientX: number, clientY: number, coinsEarned: number, isHungryPurr: boolean) => {
      const prevLevel = getCatLevelInfo(swipesRef.current).level;
      const nextSwipes = swipesRef.current + 1;
      swipesRef.current = nextSwipes;
      setSwipes(nextSwipes);
      const nextLevelInfo = getCatLevelInfo(nextSwipes);

      setCoins(c => c + coinsEarned);
      setIsPurring(true);
      const activePersonality = customizationRef.current.personality;

      if (nextLevelInfo.level > prevLevel) {
        playFeedSound();
        setCustomization(prev => getLevelUpgradeCustomization(prev, nextLevelInfo.level));
        const levelUpBanner =
          nextLevelInfo.level === 2
            ? '🏙️ УРОВЕНЬ 2! Небоскрёбы и неон!'
            : '🪐 УРОВЕНЬ 3! Космос: Луна, Марс, Венера!';
        spawnParticle(clientX, clientY - 24, 'feed', levelUpBanner);
      } else if (activePersonality === 'angry') {
        playAngrySound();
        spawnParticle(clientX - 10, clientY - 14, 'refuse', `😾 Фыр! +${coinsEarned}`);
      } else if (activePersonality === 'sad' || isHungryPurr) {
        playSadPurrSound();
        spawnParticle(clientX - 10, clientY - 14, 'refuse', `😿 +${coinsEarned}`);
      } else {
        playPurrSound();
        spawnParticle(clientX - 10, clientY - 14, 'heart', `💖 +${coinsEarned}`);
        spawnParticle(clientX + 18, clientY - 4, 'heart', '❤️');
      }

      if (purrTimeoutRef.current) clearTimeout(purrTimeoutRef.current);
      purrTimeoutRef.current = setTimeout(() => {
        setIsPurring(false);
      }, 850);
    },
    [playAngrySound, playFeedSound, playPurrSound, playSadPurrSound, spawnParticle]
  );

  const handleCatPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = lastPointerRef.current;
    const cur = { x: e.clientX, y: e.clientY };
    lastPointerRef.current = cur;
    if (!prev) return;

    const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (dist < 1) return;

    const result = evaluatePetStroke({
      accumulatedPx: strokeAccRef.current,
      stepDistancePx: dist,
      hunger: hungerRef.current,
      nowMs: Date.now(),
      lastPetTimeMs: lastPetTimeRef.current
    });

    strokeAccRef.current = result.nextAccumulatedPx;
    lastPetTimeRef.current = result.nextLastPetTimeMs;

    if (result.petCompleted) {
      if (isPointerDownRef.current) {
        didSwipeDuringPressRef.current = true;
      }
      applyPetReward(e.clientX, e.clientY, result.coinsEarned, result.isHungryPurr);
    }
  };

  const handleCatPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    getAudioContext();
    isPointerDownRef.current = true;
    didSwipeDuringPressRef.current = false;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCatPointerUp = () => {
    isPointerDownRef.current = false;
    lastPointerRef.current = null;
  };

  const handleCatPointerLeave = () => {
    isPointerDownRef.current = false;
    lastPointerRef.current = null;
  };

  const handleCatClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didSwipeDuringPressRef.current) {
      didSwipeDuringPressRef.current = false;
      return;
    }

    getAudioContext();
    const clickRes = evaluatePetClick({
      hunger: hungerRef.current,
      nowMs: Date.now(),
      lastClickTimeMs: lastClickTimeRef.current
    });
    lastClickTimeRef.current = clickRes.nextLastClickTimeMs;

    if (!clickRes.petCompleted) return;

    let x = e.clientX;
    let y = e.clientY;
    if (x === 0 && y === 0 && stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
    applyPetReward(x, y, clickRes.coinsEarned, clickRes.isHungryPurr);
  };

  const handleFeed = () => {
    getAudioContext();
    const res = feedCat(coins, hunger);
    if (!res.fed) return;

    setCoins(res.nextCoins);
    setHunger(res.nextHunger);
    playFeedSound();

    if (stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      spawnParticle(rect.left + rect.width / 2, rect.top + rect.height * 0.45, 'feed', '🐟 Ням-ням!');
    }
  };

  const handleExchangeCoinsForStar = (starCount = 1) => {
    const res = starCount === 1
      ? exchangeCoinsForStar(coins, stars)
      : exchangeCoinsForStarsBatch(coins, stars, starCount);
    if (!res.exchanged) return;
    getAudioContext();
    setCoins(res.nextCoins);
    setStars(res.nextStars);
    playFeedSound();
    if (stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      const added = res.nextStars - stars;
      spawnParticle(
        rect.left + rect.width / 2,
        rect.top + rect.height * 0.45,
        'feed',
        `⭐ +${added} за ${formatCoinsCount(added * COINS_PER_STAR)} монет!`
      );
    }
  };

  const handleConfirmSendEarthGift = () => {
    if (!onSendGift) return;
    const spend = spendStarsForEarthGift(stars);
    if (!spend.purchased) return;

    setStars(spend.nextStars);

    let target: { receiverId?: string; groupId?: string } | undefined = undefined;
    if (giftTargetKey === 'current') {
      if (activeGroup) target = { groupId: activeGroup.id };
      else if (activeContact) target = { receiverId: activeContact.id };
    } else if (giftTargetKey.startsWith('user_')) {
      target = { receiverId: giftTargetKey.replace('user_', '') };
    } else if (giftTargetKey.startsWith('group_')) {
      target = { groupId: giftTargetKey.replace('group_', '') };
    }

    const trimmedGiftMsg = giftMessage.trim();
    const giftPayload: { giftId: string; title: string; emoji: string; starsCost: number; message?: string } = {
      giftId: 'earth_planet',
      title: 'Планета Земля',
      emoji: '🌍',
      starsCost: EARTH_GIFT_STARS
    };
    if (trimmedGiftMsg) {
      giftPayload.message = trimmedGiftMsg;
    }

    onSendGift(giftPayload, target);

    setIsGiftModalOpen(false);
    setGiftMessage('');
    setShareSuccessToast('Подарок «Земля» отправлен в чат! 🌍✨');
    setTimeout(() => setShareSuccessToast(null), 3500);

    if (stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      spawnParticle(rect.left + rect.width / 2, rect.top + rect.height * 0.45, 'feed', '🌍 Подарок отправлен!');
    }
  };

  const handleConfirmShare = () => {
    if (!onShareCatToChat) return;
    const sharedData = buildSharedCatData(customization, swipes, shareNote, catName);

    let target: { receiverId?: string; groupId?: string } | undefined = undefined;
    if (shareTargetKey === 'current') {
      if (activeGroup) target = { groupId: activeGroup.id };
      else if (activeContact) target = { receiverId: activeContact.id };
    } else if (shareTargetKey.startsWith('user_')) {
      target = { receiverId: shareTargetKey.replace('user_', '') };
    } else if (shareTargetKey.startsWith('group_')) {
      target = { groupId: shareTargetKey.replace('group_', '') };
    }

    onShareCatToChat(sharedData, target);
    setIsShareModalOpen(false);
    setShareNote('');
    setShareSuccessToast('Котик отправлен в чат! 🎉');
    setTimeout(() => setShareSuccessToast(null), 3500);

    if (stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      spawnParticle(rect.left + rect.width / 2, rect.top + rect.height * 0.45, 'feed', '🐱 Отправлен в чат!');
    }
  };

  const handleSendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isThinking) return;

    getAudioContext();
    setChatInput('');
    setSupportError(null);
    setSupportReply(null);
    setIsThinking(true);
    if (supportTimerRef.current) clearTimeout(supportTimerRef.current);

    const currentPersonality = customizationRef.current.personality;

    const triggerCatVoice = () => {
      if (currentPersonality === 'angry') {
        setIsPurring(true);
        playAngrySound();
      } else if (currentPersonality === 'sad' || hungerRef.current <= 0) {
        setIsPurring(true);
        playSadPurrSound();
      } else {
        setIsPurring(true);
        playPurrSound();
      }
      if (purrTimeoutRef.current) clearTimeout(purrTimeoutRef.current);
      purrTimeoutRef.current = setTimeout(() => setIsPurring(false), 1100);
    };

    try {
      if (!navigator.onLine) {
        const offlineReply = generateCatSupportReply(trimmed, Date.now(), currentPersonality);
        setSupportReply(offlineReply);
        chatHistoryRef.current = [
          ...chatHistoryRef.current.slice(-4),
          { role: 'user', text: trimmed },
          { role: 'cat', text: offlineReply }
        ];
        triggerCatVoice();
        if (stageRef.current) {
          const rect = stageRef.current.getBoundingClientRect();
          spawnParticle(
            rect.left + rect.width * 0.5,
            rect.top + rect.height * 0.45,
            currentPersonality === 'angry' ? 'refuse' : 'heart',
            currentPersonality === 'angry' ? '💢' : '💛'
          );
        }
        supportTimerRef.current = setTimeout(() => setSupportReply(null), 35000);
        return;
      }

      const response = await fetch('/api/cat-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          isHungry: hungerRef.current <= 0,
          personality: currentPersonality,
          outfit: customizationRef.current.outfit,
          history: chatHistoryRef.current.slice(-6)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось получить ответ от котика');
      }

      const replyText =
        typeof data?.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : 'Мяу! Я рядом и слушаю тебя 🐾';

      setSupportReply(replyText);
      chatHistoryRef.current = [
        ...chatHistoryRef.current.slice(-4),
        { role: 'user', text: trimmed },
        { role: 'cat', text: replyText }
      ];

      triggerCatVoice();
      if (stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        spawnParticle(
          rect.left + rect.width * 0.5,
          rect.top + rect.height * 0.45,
          currentPersonality === 'angry' ? 'refuse' : 'heart',
          currentPersonality === 'angry' ? '😾' : '💛'
        );
      }

      supportTimerRef.current = setTimeout(() => {
        setSupportReply(null);
      }, 35000);
    } catch (err: any) {
      if (!navigator.onLine || err instanceof TypeError) {
        const offlineReply = generateCatSupportReply(trimmed, Date.now(), currentPersonality);
        setSupportReply(offlineReply);
        supportTimerRef.current = setTimeout(() => setSupportReply(null), 35000);
      } else {
        setSupportError(err?.message || 'Ошибка связи с котиком');
        supportTimerRef.current = setTimeout(() => {
          setSupportError(null);
        }, 8000);
      }
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return null;

  const hungerPct = Math.round(hunger);
  const mood = getEffectiveCatMood(hunger, isPurring, customization.personality);
  const isStarving = hunger <= 0;
  const canFeed = hunger < 100 && coins >= FEED_COST;
  const levelInfo = getCatLevelInfo(swipes);

  const hungerBarColor =
    hungerPct > 55
      ? 'bg-emerald-500'
      : hungerPct > 22
      ? 'bg-amber-400'
      : 'bg-rose-500';

  const isDarkStageBg =
    customization.background === 'space' ||
    customization.background === 'cyber' ||
    customization.background === 'night' ||
    customization.background === 'president_hall'
      ? 'from-[#2A0B10] via-[#4C1119] to-[#1A0D0A]'
      : customization.background === 'skyscrapers' ||
    customization.background === 'planets' ||
    customization.background === 'president_hall';

  const stageBgClass =
    customization.background === 'president_hall'
      ? 'from-[#2A0B10] via-[#4C1119] to-[#1A0D0A]'
      : customization.background === 'skyscrapers'
      ? 'from-[#0F172A] via-[#312E81] to-[#6D28D9]'
      : customization.background === 'planets'
      ? 'from-[#040714] via-[#170F38] to-[#0B1120]'
      : customization.background === 'space'
      ? 'from-[#1E1B4B] via-[#312E81] to-[#0F172A]'
      : customization.background === 'cyber'
      ? 'from-[#18181B] via-[#27272A] to-[#3B0764]'
      : customization.background === 'garden'
      ? 'from-[#ECFDF5] via-[#FEF3C7] to-[#D1FAE5]'
      : customization.background === 'night'
      ? 'from-[#0F172A] via-[#1E293B] to-[#090D16]'
      : customization.personality === 'angry'
      ? 'from-[#FEE2E2] via-[#FFFBEB] to-[#FDBA74]/60'
      : customization.personality === 'sad'
      ? 'from-[#DBEAFE] via-[#F1F5F9] to-[#CBD5E1]/70'
      : 'from-[#E0F2FE] via-[#FFFBEB] to-[#FDE68A]/55';

  const levelBadgeColor =
    levelInfo.level === 4
      ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-[#292524] shadow-sm'
      : levelInfo.level === 3
      ? 'bg-purple-600 text-white'
      : levelInfo.level === 2
      ? 'bg-cyan-400 text-[#292524]'
      : 'bg-amber-300 text-[#292524]';

  const levelBarColor =
    levelInfo.level === 4
      ? 'bg-gradient-to-r from-amber-400 via-red-500 to-amber-400'
      : levelInfo.level === 3
      ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
      : levelInfo.level === 2
      ? 'bg-gradient-to-r from-cyan-400 to-violet-500'
      : 'bg-amber-400';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col w-full h-[100dvh] bg-[#FFFBEB] animate-fade-in select-none text-[#292524] overflow-hidden"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Котик-кликер мини-игра"
        data-testid="cat-minigame-modal"
        data-cat-mood={mood}
        data-cat-level={levelInfo.level}
        className="w-full h-full flex flex-col overflow-hidden bg-[#FFFBEB]"
      >
        {/* Minimalist Top HUD */}
        <div className="px-3 sm:px-4 pt-3 pb-2 bg-[#FEF3C7] border-b-[3px] border-[#292524] flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Coin Counter & Star Counter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                data-testid="cat-coins"
                className="flex items-center gap-1.5 sm:gap-2 bg-white border-[2.5px] border-[#292524] rounded-2xl px-2.5 sm:px-3 py-1.5 shadow-[0_3px_0_#292524]"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="#FBBF24" stroke="#292524" strokeWidth="2.2" />
                  <circle cx="12" cy="12" r="6.5" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5" />
                  <text x="12" y="15.5" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#92400E">
                    ₽
                  </text>
                </svg>
                <span className="text-sm sm:text-base font-extrabold tabular-nums leading-none text-[#292524] whitespace-nowrap">
                  {formatCoinsCount(coins)}
                </span>
              </div>

              <button
                type="button"
                data-testid="cat-stars-badge"
                onClick={() => setIsGiftModalOpen(true)}
                className="flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 border-[2.5px] border-[#292524] rounded-2xl px-2.5 sm:px-3 py-1.5 shadow-[0_3px_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                title="Ваши Звёзды ⭐ и подарки в чат (нажмите, чтобы обменять монеты или подарить Землю)"
              >
                <span className="text-sm">⭐</span>
                <span className="text-sm sm:text-base font-black tabular-nums leading-none text-[#292524]">
                  {stars}
                </span>
              </button>
            </div>

            {/* Fullness / Hunger Bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs font-extrabold mb-1 px-0.5">
                <span className="truncate flex items-center gap-1">
                  <span aria-hidden="true">{isStarving ? '😿' : '🐟'}</span>
                  <span className="truncate">{catName.trim() || 'Котик'}</span>
                </span>
                <span
                  data-testid="cat-hunger-pct"
                  className={`tabular-nums ${isStarving ? 'text-rose-600' : 'text-[#292524]'}`}
                >
                  {hungerPct}%
                </span>
              </div>
              <div className="h-3.5 sm:h-4 w-full bg-white border-[2.5px] border-[#292524] rounded-full overflow-hidden p-0.5">
                <div
                  data-testid="cat-hunger-bar"
                  className={`h-full rounded-full transition-all duration-300 ${hungerBarColor}`}
                  style={{ width: `${hungerPct}%` }}
                />
              </div>
            </div>

            {/* Gift, Share, Settings, Sound & Close Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="cat-hud-gift-btn"
                onClick={() => setIsGiftModalOpen(true)}
                aria-label="Подарки и звёзды"
                title="Обменять монеты на звёзды ⭐ и подарить Землю 🌍"
                className="h-10 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 text-white border-[2.5px] border-[#292524] shadow-[0_3px_0_#292524] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 font-extrabold text-xs transition-all cursor-pointer"
              >
                <Gift className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Подарки</span>
              </button>

              <button
                type="button"
                data-testid="cat-share-to-chat-btn"
                onClick={() => setIsShareModalOpen(true)}
                aria-label="Отправить котика в чат"
                title="Отправить котика в чат"
                className="h-10 px-2.5 sm:px-3 rounded-xl bg-amber-300 hover:bg-amber-400 text-[#292524] border-[2.5px] border-[#292524] shadow-[0_3px_0_#292524] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 font-extrabold text-xs transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">В чат</span>
              </button>

              <button
                type="button"
                data-testid="cat-settings-btn"
                onClick={() => setIsSettingsOpen(prev => !prev)}
                aria-label="Настройки и одежда котика"
                aria-expanded={isSettingsOpen}
                title="Настройки котика и одежда"
                className={`h-10 px-2.5 sm:px-3 rounded-xl border-[2.5px] border-[#292524] shadow-[0_3px_0_#292524] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 font-extrabold text-xs transition-all cursor-pointer ${
                  isSettingsOpen ? 'bg-amber-300 text-[#292524]' : 'bg-white hover:bg-amber-100 text-[#292524]'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Настройки</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMuted(m => !m)}
                aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
                className="w-10 h-10 rounded-xl bg-white hover:bg-amber-100 border-[2.5px] border-[#292524] shadow-[0_3px_0_#292524] active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть мини-игру"
                className="w-10 h-10 rounded-xl bg-rose-400 hover:bg-rose-500 text-white border-[2.5px] border-[#292524] shadow-[0_3px_0_#292524] active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.75]" />
              </button>
            </div>
          </div>

          {/* Cat Level & Swipe Upgrade Bar */}
          <div
            data-testid="cat-level-hud"
            className="flex items-center gap-2 bg-white/90 border-[2px] border-[#292524] rounded-xl px-2.5 py-1.5"
          >
            <span
              data-testid="cat-level-badge"
              className={`px-2 py-0.5 rounded-lg border-[2px] border-[#292524] text-[11px] font-black shrink-0 ${levelBadgeColor}`}
            >
              Ур. {levelInfo.level}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] font-extrabold leading-tight mb-1 gap-2">
                <span className="truncate">{levelInfo.title}</span>
                <span data-testid="cat-swipes-count" className="tabular-nums shrink-0 text-[#57534E]">
                  {levelInfo.isMaxLevel
                    ? `Космо-ранг: ${levelInfo.stageSwipes} / ${levelInfo.stageGoal} (всего ${levelInfo.totalSwipes})`
                    : `${levelInfo.stageSwipes} / ${levelInfo.stageGoal} свайпов/кликов до ${levelInfo.level + 1} ур.`}
                </span>
              </div>
              <div className="h-2 w-full bg-stone-100 border-[1.5px] border-[#292524] rounded-full overflow-hidden">
                <div
                  data-testid="cat-level-bar"
                  className={`h-full transition-all duration-300 ${levelBarColor}`}
                  style={{ width: `${levelInfo.progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: Interactive Cat Area + Optional Settings Drawer */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
          {/* Left / Top Cat Stage + Bottom Controls */}
          <div className={`flex flex-col min-w-0 min-h-0 ${isSettingsOpen ? 'h-[235px] sm:h-auto sm:flex-1 shrink-0' : 'flex-1'}`}>
            <div
              ref={stageRef}
              className={`relative flex-1 min-h-0 flex flex-col items-center justify-center px-3 sm:px-4 py-2 sm:py-3 overflow-hidden bg-gradient-to-b transition-colors duration-300 ${stageBgClass}`}
            >
              {/* Background Theme Decorations */}
              {customization.background === 'president_hall' && (
                <svg className="w-full h-full" viewBox="0 0 600 320" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <linearGradient id="presWall" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B0D14" />
                      <stop offset="65%" stopColor="#26080D" />
                      <stop offset="100%" stopColor="#1A0A07" />
                    </linearGradient>
                    <linearGradient id="presGold" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FDE047" />
                      <stop offset="50%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#B45309" />
                    </linearGradient>
                  </defs>
                  <rect width="600" height="320" fill="url(#presWall)" />
                  {/* Warm chandelier glow */}
                  <ellipse cx="300" cy="40" rx="220" ry="90" fill="#FBBF24" opacity="0.16" />
                  {/* Grand arched windows */}
                  <rect x="85" y="45" width="76" height="165" rx="38" fill="#0F172A" stroke="url(#presGold)" strokeWidth="3" />
                  <rect x="439" y="45" width="76" height="165" rx="38" fill="#0F172A" stroke="url(#presGold)" strokeWidth="3" />
                  {/* Velvet curtains */}
                  <path d="M72,38 Q95,120 76,220 L108,220 Q112,120 104,38 Z" fill="#991B1B" opacity="0.92" />
                  <path d="M528,38 Q505,120 524,220 L492,220 Q488,120 496,38 Z" fill="#991B1B" opacity="0.92" />
                  {/* Classical marble columns */}
                  <rect x="26" y="25" width="32" height="215" fill="#E7E5E4" opacity="0.88" />
                  <rect x="20" y="20" width="44" height="10" rx="2" fill="url(#presGold)" />
                  <rect x="20" y="232" width="44" height="12" rx="2" fill="url(#presGold)" />
                  <rect x="542" y="25" width="32" height="215" fill="#E7E5E4" opacity="0.88" />
                  <rect x="536" y="20" width="44" height="10" rx="2" fill="url(#presGold)" />
                  <rect x="536" y="232" width="44" height="12" rx="2" fill="url(#presGold)" />
                  {/* Center wood paneling & Presidential Seal */}
                  <rect x="195" y="55" width="210" height="175" rx="8" fill="#2A120B" stroke="#78350F" strokeWidth="2.5" />
                  <circle cx="300" cy="115" r="34" fill="#451A03" stroke="url(#presGold)" strokeWidth="3.5" />
                  <path d="M300,90 L306,107 L324,107 L310,118 L315,135 L300,124 L285,135 L290,118 L276,107 L294,107 Z" fill="url(#presGold)" />
                  {/* Chandelier */}
                  <path d="M275,0 L325,0 L314,22 L286,22 Z" fill="url(#presGold)" opacity="0.9" />
                  <circle cx="285" cy="24" r="4" fill="#FEF08A" />
                  <circle cx="300" cy="26" r="5" fill="#FEF08A" />
                  <circle cx="315" cy="24" r="4" fill="#FEF08A" />
                  {/* State floor & red carpet */}
                  <rect x="0" y="240" width="600" height="80" fill="#451A03" />
                  <polygon points="210,240 390,240 460,320 140,320" fill="#991B1B" />
                  <line x1="210" y1="240" x2="140" y2="320" stroke="#FACC15" strokeWidth="2.5" />
                  <line x1="390" y1="240" x2="460" y2="320" stroke="#FACC15" strokeWidth="2.5" />
                </svg>
              )}
              {customization.background === 'skyscrapers' && (
                <div
                  data-testid="cat-bg-scene-skyscrapers"
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                >
                  <svg
                    viewBox="0 0 600 340"
                    preserveAspectRatio="xMidYMax slice"
                    className="w-full h-full opacity-90"
                    aria-hidden="true"
                  >
                    {/* Glowing City Moon */}
                    <circle cx="510" cy="58" r="24" fill="#FEF08A" opacity="0.88" />
                    <circle cx="510" cy="58" r="36" fill="#FDE047" opacity="0.16" />
                    {/* Distant Skyline Silhouettes */}
                    <rect x="18" y="130" width="52" height="210" fill="#1E1B4B" />
                    <rect x="82" y="95" width="60" height="245" fill="#1E293B" />
                    <rect x="155" y="148" width="44" height="192" fill="#1E1B4B" />
                    <rect x="395" y="115" width="56" height="225" fill="#1E293B" />
                    <rect x="462" y="80" width="64" height="260" fill="#1E1B4B" />
                    <rect x="536" y="140" width="54" height="200" fill="#0F172A" />
                    {/* Foreground Skyscraper Towers + Antennas */}
                    <rect x="42" y="150" width="66" height="190" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.45" />
                    <line x1="75" y1="122" x2="75" y2="150" stroke="#94A3B8" strokeWidth="2.5" />
                    <circle cx="75" cy="120" r="3" fill="#F43F5E" />

                    <rect x="435" y="102" width="76" height="238" fill="#0F172A" stroke="#EC4899" strokeWidth="1.5" strokeOpacity="0.5" />
                    <line x1="473" y1="68" x2="473" y2="102" stroke="#94A3B8" strokeWidth="2.5" />
                    <circle cx="473" cy="66" r="3.5" fill="#22D3EE" />

                    <rect x="122" y="185" width="56" height="155" fill="#090D16" stroke="#A855F7" strokeWidth="1.2" strokeOpacity="0.4" />
                    <rect x="520" y="170" width="58" height="170" fill="#090D16" stroke="#22D3EE" strokeWidth="1.2" strokeOpacity="0.4" />

                    {/* Lit Skyscraper Windows */}
                    <g fill="#FDE047" opacity="0.85">
                      <rect x="54" y="166" width="9" height="11" rx="1" />
                      <rect x="70" y="166" width="9" height="11" rx="1" />
                      <rect x="86" y="166" width="9" height="11" rx="1" />
                      <rect x="54" y="190" width="9" height="11" rx="1" />
                      <rect x="86" y="190" width="9" height="11" rx="1" />
                      <rect x="54" y="214" width="9" height="11" rx="1" fill="#22D3EE" />
                      <rect x="70" y="214" width="9" height="11" rx="1" />
                      <rect x="70" y="238" width="9" height="11" rx="1" fill="#F472B6" />
                      <rect x="448" y="118" width="10" height="12" rx="1" fill="#22D3EE" />
                      <rect x="466" y="118" width="10" height="12" rx="1" />
                      <rect x="484" y="118" width="10" height="12" rx="1" />
                      <rect x="448" y="142" width="10" height="12" rx="1" />
                      <rect x="484" y="142" width="10" height="12" rx="1" fill="#F472B6" />
                      <rect x="466" y="166" width="10" height="12" rx="1" fill="#22D3EE" />
                      <rect x="484" y="166" width="10" height="12" rx="1" />
                      <rect x="448" y="190" width="10" height="12" rx="1" />
                      <rect x="466" y="214" width="10" height="12" rx="1" />
                      <rect x="134" y="202" width="8" height="10" rx="1" fill="#22D3EE" />
                      <rect x="152" y="202" width="8" height="10" rx="1" />
                      <rect x="134" y="226" width="8" height="10" rx="1" />
                      <rect x="534" y="188" width="9" height="10" rx="1" fill="#F472B6" />
                      <rect x="554" y="188" width="9" height="10" rx="1" />
                      <rect x="534" y="212" width="9" height="10" rx="1" />
                    </g>
                  </svg>
                </div>
              )}
              {customization.background === 'planets' && (
                <div
                  data-testid="cat-bg-scene-planets"
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                >
                  <svg
                    viewBox="0 0 600 340"
                    preserveAspectRatio="xMidYMid slice"
                    className="w-full h-full"
                    aria-hidden="true"
                  >
                    {/* Nebula Glows */}
                    <circle cx="130" cy="90" r="110" fill="#7C3AED" opacity="0.16" />
                    <circle cx="470" cy="110" r="120" fill="#EC4899" opacity="0.13" />
                    <circle cx="300" cy="240" r="130" fill="#0EA5E9" opacity="0.12" />

                    {/* Starfield */}
                    <g fill="#F8FAFC">
                      <circle cx="40" cy="36" r="1.8" opacity="0.9" />
                      <circle cx="175" cy="28" r="1.4" opacity="0.7" />
                      <circle cx="265" cy="46" r="2.1" opacity="0.85" />
                      <circle cx="350" cy="32" r="1.5" opacity="0.75" />
                      <circle cx="560" cy="42" r="1.8" opacity="0.9" />
                      <circle cx="58" cy="215" r="1.6" opacity="0.7" />
                      <circle cx="218" cy="110" r="1.3" opacity="0.6" />
                      <circle cx="385" cy="145" r="1.4" opacity="0.65" />
                      <circle cx="548" cy="220" r="2" opacity="0.85" />
                      <circle cx="430" cy="275" r="1.5" opacity="0.7" />
                      <circle cx="145" cy="285" r="1.6" opacity="0.75" />
                    </g>
                    {/* Shooting Star */}
                    <line x1="255" y1="62" x2="295" y2="42" stroke="#BAE6FD" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

                    {/* ЛУНА (Moon) - Top Left */}
                    <g transform="translate(88, 78)">
                      <circle cx="0" cy="0" r="36" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
                      <circle cx="-12" cy="-10" r="7" fill="#CBD5E1" />
                      <circle cx="13" cy="-4" r="9.5" fill="#CBD5E1" />
                      <circle cx="-4" cy="15" r="5.5" fill="#94A3B8" opacity="0.65" />
                      <circle cx="15" cy="14" r="3.8" fill="#94A3B8" opacity="0.55" />
                      <text x="0" y="52" textAnchor="middle" fontSize="11" fontWeight="800" fill="#E2E8F0" opacity="0.9">
                        Луна
                      </text>
                    </g>

                    {/* МАРС (Mars) - Top Right */}
                    <g transform="translate(495, 86)">
                      <circle cx="0" cy="0" r="46" fill="#EF4444" opacity="0.16" />
                      <circle cx="0" cy="0" r="34" fill="#DC2626" stroke="#F87171" strokeWidth="2" />
                      <path d="M-24 -6 Q0 -16 26 -2" fill="none" stroke="#991B1B" strokeWidth="6" strokeLinecap="round" opacity="0.75" />
                      <path d="M-18 14 Q4 8 22 17" fill="none" stroke="#B91C1C" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
                      <ellipse cx="-6" cy="-26" rx="11" ry="4" fill="#FEE2E2" opacity="0.8" />
                      {/* Orbiting Tiny Moon */}
                      <circle cx="-44" cy="-22" r="4.5" fill="#FCA5A5" />
                      <text x="0" y="51" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FCA5A5" opacity="0.95">
                        Марс
                      </text>
                    </g>

                    {/* ВЕНЕРА (Venus) - Mid-Lower Left */}
                    <g transform="translate(115, 224)">
                      <circle cx="0" cy="0" r="40" fill="#F59E0B" opacity="0.18" />
                      <circle cx="0" cy="0" r="29" fill="#F59E0B" stroke="#FDE68A" strokeWidth="2" />
                      <path d="M-23 -8 Q0 2 23 -10" fill="none" stroke="#FEF3C7" strokeWidth="4.5" strokeLinecap="round" opacity="0.7" />
                      <path d="M-25 6 Q0 16 24 4" fill="none" stroke="#D97706" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
                      <text x="0" y="45" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FDE68A" opacity="0.95">
                        Венера
                      </text>
                    </g>

                    {/* Distant Ringed Accent Planet - Lower Right */}
                    <g transform="translate(508, 240)">
                      <ellipse cx="0" cy="0" rx="28" ry="8" transform="rotate(-18)" fill="none" stroke="#38BDF8" strokeWidth="3" opacity="0.75" />
                      <circle cx="0" cy="0" r="14" fill="#818CF8" />
                      <ellipse cx="0" cy="0" rx="28" ry="8" transform="rotate(-18)" fill="none" stroke="#A5F3FC" strokeWidth="1.5" opacity="0.65" />
                    </g>
                  </svg>
                </div>
              )}
              {customization.background === 'space' && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60">
                  <span className="absolute top-4 left-10 text-xs animate-pulse">✨</span>
                  <span className="absolute top-10 right-14 text-sm animate-ping">⭐</span>
                  <span className="absolute bottom-12 left-16 text-xs">🪐</span>
                  <span className="absolute top-20 left-1/3 text-xs animate-pulse">✨</span>
                </div>
              )}
              {customization.background === 'cyber' && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 bg-[linear-gradient(to_right,#06b6d4_1px,transparent_1px),linear-gradient(to_bottom,#ec4899_1px,transparent_1px)] bg-[size:24px_24px]" />
              )}
              {customization.background === 'garden' && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60">
                  <span className="absolute top-4 left-8 text-sm">🌸</span>
                  <span className="absolute top-8 right-12 text-xs">🌿</span>
                  <span className="absolute bottom-6 left-1/4 text-sm">🌷</span>
                </div>
              )}
              {customization.background === 'night' && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-70">
                  <span className="absolute top-4 right-10 text-lg">🌙</span>
                  <span className="absolute top-12 left-12 text-xs animate-pulse">✨</span>
                  <span className="absolute bottom-10 right-1/3 text-xs">⭐</span>
                </div>
              )}
              {customization.background === 'cozy' && (
                <>
                  <div className="absolute top-3 left-6 w-14 h-8 rounded-full bg-white/80 pointer-events-none" />
                  <div className="absolute top-6 right-8 w-16 h-9 rounded-full bg-white/80 pointer-events-none" />
                </>
              )}

              {/* Support Speech Bubble OR Thinking OR Error OR Hungry Thought Bubble */}
              <div className={isSettingsOpen ? 'hidden sm:block' : 'block'}>
                {isThinking ? (
                  <div
                    data-testid="cat-thinking-bubble"
                    className="relative z-20 mb-1 max-w-[340px] bg-white border-[3px] border-[#292524] rounded-2xl px-3.5 py-2 shadow-[0_4px_0_#292524] animate-fade-in"
                  >
                    <p className="text-xs sm:text-sm font-bold text-[#78716C] leading-snug text-center">
                      Котик думает... 🐾
                    </p>
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-[3px] border-b-[3px] border-[#292524] rotate-45" />
                  </div>
                ) : supportError ? (
                  <div
                    data-testid="cat-error-bubble"
                    className="relative z-20 mb-1 max-w-[340px] bg-rose-50 border-[3px] border-[#292524] rounded-2xl px-3.5 py-2 shadow-[0_4px_0_#292524] animate-fade-in flex items-center gap-2"
                  >
                    <p className="text-xs sm:text-sm font-bold text-rose-700 leading-snug text-center flex-1">
                      {supportError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSupportError(null)}
                      aria-label="Закрыть сообщение об ошибке"
                      className="text-rose-500 hover:text-rose-800 p-0.5 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-rose-50 border-r-[3px] border-b-[3px] border-[#292524] rotate-45" />
                  </div>
                ) : supportReply ? (
                  <div
                    data-testid="cat-support-bubble"
                    className="relative z-20 mb-1 max-w-[360px] bg-white border-[3px] border-[#292524] rounded-2xl px-3.5 py-2 shadow-[0_4px_0_#292524] animate-fade-in flex items-start gap-2"
                  >
                    <p className="text-xs sm:text-sm font-bold text-[#292524] leading-snug text-center flex-1">
                      {supportReply}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSupportReply(null)}
                      aria-label="Скрыть ответ котика"
                      className="text-[#78716C] hover:text-[#292524] p-0.5 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-[3px] border-b-[3px] border-[#292524] rotate-45" />
                  </div>
                ) : isStarving ? (
                  <div
                    data-testid="cat-hungry-bubble"
                    className="relative z-20 mb-1 bg-white border-[3px] border-[#292524] rounded-2xl px-3.5 py-1.5 shadow-[0_4px_0_#292524] flex items-center gap-2 animate-fade-in"
                  >
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" viewBox="0 0 36 36" aria-hidden="true">
                      <path d="M11 15 C15 10, 23 10, 26 15 C23 18, 15 18, 11 15 Z" fill="#60A5FA" stroke="#292524" strokeWidth="2" />
                      <polygon points="9,15 5,12 5,18" fill="#60A5FA" stroke="#292524" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M5 18 H31 L28 29 C27.5 30.5, 8.5 30.5, 8 29 Z" fill="#FB7185" stroke="#292524" strokeWidth="2.3" strokeLinejoin="round" />
                      <rect x="4" y="16" width="28" height="4" rx="2" fill="#FDA4AF" stroke="#292524" strokeWidth="2.2" />
                    </svg>
                    <span className="text-xs sm:text-sm font-extrabold text-[#292524] whitespace-nowrap">
                      Мяу! Дай рыбки!
                    </span>
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-[3px] border-b-[3px] border-[#292524] rotate-45" />
                  </div>
                ) : null}
              </div>

              {/* 2D Cartoon Cat Sprite + Anchored Cozy Rug (Petting Hitbox) */}
              <div className="relative z-10 flex flex-col items-center justify-center">
                <div className="absolute bottom-1 sm:bottom-2 w-44 sm:w-52 h-8 sm:h-10 rounded-[100%] bg-[#FCA5A5]/45 border-[2.5px] border-[#292524]/20 pointer-events-none" />
                <div
                  data-testid="cat-pet-zone"
                  role="button"
                  tabIndex={0}
                  aria-label="Погладить или кликнуть по котику"
                  onPointerDown={handleCatPointerDown}
                  onPointerMove={handleCatPointerMove}
                  onPointerUp={handleCatPointerUp}
                  onPointerLeave={handleCatPointerLeave}
                  onClick={handleCatClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}
                  className={`relative z-10 flex items-center justify-center touch-none cursor-pointer active:scale-[0.98] transition-transform duration-150 focus:outline-none ${
                    isSettingsOpen ? 'w-36 h-36 sm:w-52 sm:h-52' : 'w-44 h-44 sm:w-52 sm:h-52'
                  } ${
                    mood === 'purring' || mood === 'angry_purr'
                      ? 'scale-[1.05] -translate-y-1'
                      : mood === 'sad_purr'
                      ? 'scale-[1.02]'
                      : 'scale-100'
                  }`}
                >
                  <CatSprite
                    mood={mood}
                    outfit={customization.outfit}
                    isStarving={isStarving}
                    skin={customization.skin}
                    isBlinking={isBlinking}
                    isDancing={isDancing}
                  />
                </div>
              </div>

              {/* Floating Hearts / Notices */}
              {particles.map(p => (
                <div
                  key={p.id}
                  style={{ left: `${p.x}px`, top: `${p.y}px` }}
                  className={`absolute z-30 pointer-events-none font-extrabold whitespace-nowrap animate-float-up-fade ${
                    p.kind === 'refuse'
                      ? 'text-xs sm:text-sm bg-white/95 text-rose-600 border-2 border-[#292524] px-2.5 py-1 rounded-xl shadow-sm'
                      : p.kind === 'feed'
                      ? 'text-sm sm:text-base bg-emerald-100 text-emerald-800 border-2 border-[#292524] px-3 py-1 rounded-xl shadow-sm'
                      : 'text-base sm:text-lg text-rose-500 drop-shadow-[0_2px_0_#ffffff]'
                  }`}
                >
                  {p.text}
                </div>
              ))}

              {/* Concise Interaction Hint */}
              {!isSettingsOpen && (
                <p
                  className={`relative z-10 mt-0.5 text-xs font-bold text-center ${
                    isDarkStageBg ? 'text-slate-200/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]' : 'text-[#78716C]'
                  }`}
                >
                  {customization.personality === 'angry'
                    ? `Злой котик ворчит, но даёт +${COINS_PER_PET} монеты за клик/свайп`
                    : customization.personality === 'sad'
                    ? `Грустный котик ждёт ласки · +${isStarving ? HUNGRY_COINS_PER_PET : COINS_PER_PET} монеты`
                    : isStarving
                    ? `Котик жалобно мурлычет · +${HUNGRY_COINS_PER_PET} монеты за клик/свайп`
                    : `Свайпай или кликай по котику · +${COINS_PER_PET} монеты`}
                </p>
              )}
            </div>

            {/* Bottom Controls: Chat Input + Feed Button (collapsed on small mobile when Settings open so panel has full room) */}
            <div
              className={`px-3.5 sm:px-4 py-3 bg-[#FEF3C7] border-t-[3px] border-[#292524] flex-col gap-2.5 shrink-0 ${
                isSettingsOpen ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <form onSubmit={handleSendSupportMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  data-testid="cat-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isThinking}
                  placeholder="Напиши котику что угодно..."
                  aria-label="Сообщение котику"
                  className="flex-1 min-w-0 bg-white border-[2.5px] border-[#292524] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-[#292524] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
                />
                <button
                  type="submit"
                  data-testid="cat-chat-send"
                  disabled={!chatInput.trim() || isThinking}
                  aria-label="Отправить сообщение котику"
                  className="w-10 h-10 shrink-0 rounded-xl bg-amber-300 hover:bg-amber-400 disabled:bg-stone-200 disabled:text-stone-400 disabled:border-stone-400 border-[2.5px] border-[#292524] shadow-[0_3px_0_#292524] disabled:shadow-none active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                </button>
              </form>

              <button
                type="button"
                data-testid="cat-feed-btn"
                onClick={handleFeed}
                disabled={!canFeed}
                className={`w-full py-2.5 px-5 rounded-2xl border-[3px] border-[#292524] font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  canFeed
                    ? isStarving
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-[#292524] shadow-[0_4px_0_#292524] active:translate-y-1 active:shadow-none'
                      : 'bg-[#FBBF24] hover:bg-[#F59E0B] text-[#292524] shadow-[0_4px_0_#292524] active:translate-y-1 active:shadow-none'
                    : 'bg-stone-200 text-stone-500 border-stone-400 cursor-not-allowed opacity-85'
                }`}
              >
                <span aria-hidden="true">🐟</span>
                {hunger >= 100 ? (
                  <span>Котик полностью сыт (100%)</span>
                ) : (
                  <span>Покормить · {FEED_COST} монет</span>
                )}
              </button>
            </div>
          </div>

          {/* Right / Bottom Settings & Wardrobe Panel */}
          {isSettingsOpen && (
            <div
              data-testid="cat-settings-panel"
              className="flex-1 sm:flex-none sm:w-[340px] lg:w-[370px] min-h-0 bg-[#FFFDF5] border-t-[3px] sm:border-t-0 sm:border-l-[3px] border-[#292524] flex flex-col overflow-hidden shrink-0"
            >
              <div className="px-4 py-2.5 bg-[#FEF3C7] border-b-[2.5px] border-[#292524] flex items-center justify-between gap-2 shrink-0">
                <h3 className="text-sm font-extrabold text-[#292524] flex items-center gap-1.5">
                  <span>👗</span> Настройки и гардероб
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="cat-reset-outfit-btn"
                    onClick={() => setCustomization(DEFAULT_CAT_CUSTOMIZATION)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border-2 border-[#292524] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Сбросить настройки"
                  >
                    <RotateCcw className="w-3 h-3" /> Сброс
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="sm:hidden px-2.5 py-1 rounded-lg bg-amber-300 border-2 border-[#292524] text-[11px] font-extrabold cursor-pointer"
                  >
                    Готово
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                {/* Level Progression Summary Card */}
                <div className="bg-gradient-to-br from-amber-50 to-indigo-50 border-[2.5px] border-[#292524] rounded-xl p-3 space-y-1.5 shadow-[0_2px_0_#292524]">
                  <div className="flex items-center justify-between text-xs font-black text-[#292524]">
                    <span>📈 Прокачка котика</span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-[#292524]">
                      Ур. {levelInfo.level} / 3
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#57534E] space-y-0.5 leading-snug">
                    <div className={levelInfo.level >= 1 ? 'text-emerald-700 font-bold' : ''}>
                      • Ур. 1 (0–999): Обычный котик
                    </div>
                    <div className={levelInfo.level >= 2 ? 'text-emerald-700 font-bold' : ''}>
                      {levelInfo.level >= 2 ? '✅' : '🔒'} Ур. 2 (1000 свайпов): Небоскрёбы, очки и аксессуары
                    </div>
                    <div className={levelInfo.level >= 3 ? 'text-emerald-700 font-bold' : ''}>
                      {levelInfo.level >= 3 ? '✅' : '🔒'} Ур. 3 (3000): Луна, Марс, Венера и космос
                    </div>
                    <div className={levelInfo.level >= 4 ? 'text-amber-700 font-bold' : ''}>
                      {levelInfo.level >= 4 ? '✅' : '🔒'} Ур. 4 (4000): Кот Президент — Зал Президента, цилиндр и орден
                    </div>
                  </div>
                </div>

                {/* Name Your Cat Card */}
                <div className="bg-white border-[2.5px] border-[#292524] rounded-xl p-3 space-y-2 shadow-[0_2px_0_#292524]">
                  <div className="text-xs font-black text-[#292524] flex items-center gap-1.5">
                    <span>🐱</span> Имя вашего котика
                  </div>
                  <input
                    type="text"
                    data-testid="cat-custom-name-input"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Например: Барсик, Пушок..."
                    maxLength={25}
                    className="w-full bg-stone-50 border-2 border-[#292524] rounded-xl px-3 py-1.5 text-xs font-bold text-[#292524] focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* Star Exchange Card */}
                <div className="bg-gradient-to-br from-amber-100 to-yellow-50 border-[2.5px] border-[#292524] rounded-xl p-3 space-y-2.5 shadow-[0_2px_0_#292524]">
                  <div className="flex items-center justify-between text-xs font-black text-[#292524]">
                    <span className="flex items-center gap-1">
                      <span>⭐</span> Звёзды (у вас: {stars})
                    </span>
                    <span className="text-[11px] font-bold text-amber-800">
                      1000 монет = 1 ⭐
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="cat-exchange-star-btn"
                    onClick={() => handleExchangeCoinsForStar(1)}
                    disabled={coins < 1000}
                    className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-stone-200 disabled:text-stone-400 disabled:border-stone-400 border-2 border-[#292524] font-black text-xs text-[#292524] shadow-[0_2px_0_#292524] disabled:shadow-none active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-all"
                  >
                    <span>✨</span>
                    <span>Обменять 1000 монет на 1 звезду ⭐</span>
                  </button>
                </div>

                {/* Send Earth Gift Card */}
                <div className="bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 border-[2.5px] border-[#292524] rounded-xl p-3 space-y-2.5 shadow-[0_2px_0_#292524]">
                  <div className="flex items-center justify-between text-xs font-black text-[#292524]">
                    <span className="flex items-center gap-1">
                      <span>🌍</span> Подарок «Земля»
                    </span>
                    <span className="text-[11px] font-bold text-indigo-800">
                      20 звёзд ⭐
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="cat-send-earth-gift-btn"
                    onClick={() => setIsGiftModalOpen(true)}
                    disabled={stars < 20}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:brightness-105 disabled:bg-stone-200 disabled:text-stone-400 disabled:border-stone-400 border-2 border-[#292524] font-black text-xs text-white shadow-[0_2px_0_#292524] disabled:shadow-none active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all"
                  >
                    <span>🌍</span>
                    <span>Подарить Землю в чат (20 ⭐)</span>
                  </button>
                </div>

                {/* Send Outfit to Chat Button */}
                <button
                  type="button"
                  data-testid="cat-wardrobe-share-btn"
                  onClick={() => setIsShareModalOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:brightness-105 text-[#292524] border-[2.5px] border-[#292524] shadow-[0_3px_0_#292524] active:translate-y-0.5 active:shadow-none font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>Отправить этот наряд в чат</span>
                </button>

                {/* Burmaldancing / Dance Mode Toggle Button */}
                <div className="bg-amber-100 border-[2.5px] border-[#292524] rounded-xl p-3 flex items-center justify-between gap-2 shadow-[0_2px_0_#292524]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🕺</span>
                    <div>
                      <div className="text-xs font-extrabold text-[#292524]">Бурмалденсить (Танец)</div>
                      <div className="text-[11px] text-[#78716C]">Ритмичный танец котика</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="cat-dance-toggle"
                    onClick={() => {
                      getAudioContext();
                      setIsDancing(d => !d);
                      if (!isDancing && stageRef.current) {
                        const rect = stageRef.current.getBoundingClientRect();
                        spawnParticle(rect.left + rect.width / 2, rect.top + rect.height * 0.4, 'heart', '🎵 Бурмалденс!');
                        playPurrSound();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl border-2 border-[#292524] font-extrabold text-xs transition-all cursor-pointer ${
                      isDancing ? 'bg-emerald-400 text-[#292524] shadow-[0_2px_0_#292524]' : 'bg-white hover:bg-amber-50'
                    }`}
                  >
                    {isDancing ? 'Танцует 🎶' : 'Включить'}
                  </button>
                </div>

                {/* Background Theme Picker (фон) */}
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#78716C] mb-2">
                    Фон комнаты
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CAT_BACKGROUND_OPTIONS.map((opt) => {
                      const active = customization.background === opt.id;
                      const unlocked = isCatOptionUnlocked(opt.requiredLevel, levelInfo.level);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-bg-${opt.id}`}
                          aria-pressed={active}
                          disabled={!unlocked}
                          onClick={() => {
                            if (!unlocked) return;
                            setCustomization(prev => ({ ...prev, background: opt.id }));
                          }}
                          className={`px-2.5 py-2 rounded-xl border-2 border-[#292524] text-xs font-extrabold flex items-center justify-between gap-1.5 transition-all ${
                            !unlocked
                              ? 'bg-stone-100 text-stone-400 border-stone-300 cursor-not-allowed'
                              : active
                              ? 'bg-amber-300 shadow-[0_2px_0_#292524] cursor-pointer'
                              : 'bg-white hover:bg-amber-50 cursor-pointer'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-base shrink-0">{opt.emoji}</span>
                            <span className="truncate">{opt.label}</span>
                          </span>
                          {!unlocked && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-black text-stone-500">
                              <Lock className="w-3 h-3" /> {opt.requiredLevel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cool Skins Selector (скины крутые) */}
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#78716C] mb-2">
                    Крутые скины окраса
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CAT_SKIN_OPTIONS.map((opt) => {
                      const active = customization.skin === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-skin-${opt.id}`}
                          aria-pressed={active}
                          onClick={() =>
                            setCustomization(prev => ({ ...prev, skin: opt.id }))
                          }
                          className={`px-2.5 py-2 rounded-xl border-2 border-[#292524] text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                            active ? 'bg-amber-300 shadow-[0_2px_0_#292524]' : 'bg-white hover:bg-amber-50'
                          }`}
                        >
                          <span className="text-base">{opt.emoji}</span>
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Personality / Emotion Picker */}
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#78716C] mb-2">
                    Характер и настроение
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {CAT_PERSONALITY_OPTIONS.map((opt) => {
                      const active = customization.personality === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-mood-opt-${opt.id}`}
                          aria-pressed={active}
                          onClick={() =>
                            setCustomization(prev => ({ ...prev, personality: opt.id }))
                          }
                          className={`p-2 rounded-xl border-[2.5px] border-[#292524] flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                            active
                              ? 'bg-amber-300 shadow-[0_3px_0_#292524] -translate-y-0.5'
                              : 'bg-white hover:bg-amber-50'
                          }`}
                        >
                          <span className="text-xl leading-none">{opt.emoji}</span>
                          <span className="text-xs font-extrabold text-[#292524]">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hats */}
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#78716C] mb-2">
                    Головной убор
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CAT_HAT_OPTIONS.map((opt) => {
                      const active = customization.outfit.hat === opt.id;
                      const unlocked = isCatOptionUnlocked(opt.requiredLevel, levelInfo.level);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-hat-${opt.id}`}
                          aria-pressed={active}
                          disabled={!unlocked}
                          onClick={() => {
                            if (!unlocked) return;
                            setCustomization(prev => ({
                              ...prev,
                              outfit: { ...prev.outfit, hat: opt.id }
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border-2 border-[#292524] text-xs font-bold flex items-center gap-1 transition-all ${
                            !unlocked
                              ? 'bg-stone-100 text-stone-400 border-stone-300 cursor-not-allowed'
                              : active
                              ? 'bg-amber-300 shadow-[0_2px_0_#292524] cursor-pointer'
                              : 'bg-white hover:bg-amber-50 cursor-pointer'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
                          {!unlocked && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-stone-500">
                              <Lock className="w-2.5 h-2.5" /> {opt.requiredLevel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Glasses */}
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#78716C] mb-2">
                    Очки
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CAT_GLASSES_OPTIONS.map((opt) => {
                      const active = customization.outfit.glasses === opt.id;
                      const unlocked = isCatOptionUnlocked(opt.requiredLevel, levelInfo.level);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-glasses-${opt.id}`}
                          aria-pressed={active}
                          disabled={!unlocked}
                          onClick={() => {
                            if (!unlocked) return;
                            setCustomization(prev => ({
                              ...prev,
                              outfit: { ...prev.outfit, glasses: opt.id }
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border-2 border-[#292524] text-xs font-bold flex items-center gap-1 transition-all ${
                            !unlocked
                              ? 'bg-stone-100 text-stone-400 border-stone-300 cursor-not-allowed'
                              : active
                              ? 'bg-amber-300 shadow-[0_2px_0_#292524] cursor-pointer'
                              : 'bg-white hover:bg-amber-50 cursor-pointer'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
                          {!unlocked && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-stone-500">
                              <Lock className="w-2.5 h-2.5" /> {opt.requiredLevel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Top Clothing */}
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#78716C] mb-2">
                    Одежда
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CAT_TOP_OPTIONS.map((opt) => {
                      const active = customization.outfit.top === opt.id;
                      const unlocked = isCatOptionUnlocked(opt.requiredLevel, levelInfo.level);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-top-${opt.id}`}
                          aria-pressed={active}
                          disabled={!unlocked}
                          onClick={() => {
                            if (!unlocked) return;
                            setCustomization(prev => ({
                              ...prev,
                              outfit: { ...prev.outfit, top: opt.id }
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border-2 border-[#292524] text-xs font-bold flex items-center gap-1 transition-all ${
                            !unlocked
                              ? 'bg-stone-100 text-stone-400 border-stone-300 cursor-not-allowed'
                              : active
                              ? 'bg-amber-300 shadow-[0_2px_0_#292524] cursor-pointer'
                              : 'bg-white hover:bg-amber-50 cursor-pointer'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
                          {!unlocked && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-stone-500">
                              <Lock className="w-2.5 h-2.5" /> {opt.requiredLevel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Neck Accessory */}
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#78716C] mb-2">
                    На шею
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CAT_NECK_OPTIONS.map((opt) => {
                      const active = customization.outfit.neck === opt.id;
                      const unlocked = isCatOptionUnlocked(opt.requiredLevel, levelInfo.level);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-neck-${opt.id}`}
                          aria-pressed={active}
                          disabled={!unlocked}
                          onClick={() => {
                            if (!unlocked) return;
                            setCustomization(prev => ({
                              ...prev,
                              outfit: { ...prev.outfit, neck: opt.id }
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border-2 border-[#292524] text-xs font-bold flex items-center gap-1 transition-all ${
                            !unlocked
                              ? 'bg-stone-100 text-stone-400 border-stone-300 cursor-not-allowed'
                              : active
                              ? 'bg-amber-300 shadow-[0_2px_0_#292524] cursor-pointer'
                              : 'bg-white hover:bg-amber-50 cursor-pointer'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
                          {!unlocked && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-stone-500">
                              <Lock className="w-2.5 h-2.5" /> {opt.requiredLevel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Share to Chat Dialog */}
        {isShareModalOpen && (
          <div
            data-testid="cat-share-dialog-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsShareModalOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Отправить котика в чат"
              data-testid="cat-share-dialog"
              className="w-full max-w-md bg-[#FFFDF5] border-[3px] border-[#292524] rounded-3xl p-4 sm:p-5 shadow-[0_8px_0_#292524] flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto animate-scale-up"
            >
              <div className="flex items-center justify-between pb-2 border-b-2 border-[#292524]">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🐱</span>
                  <h3 className="text-base sm:text-lg font-black text-[#292524]">
                    Отправить котика в чат
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  aria-label="Закрыть окно отправки"
                  className="w-8 h-8 rounded-xl bg-white hover:bg-stone-100 border-2 border-[#292524] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Card Preview */}
              <div className="flex justify-center py-1">
                <CatCardMessage
                  catShare={buildSharedCatData(customization, swipes, shareNote, catName)}
                  senderName="Вы"
                  isMe={true}
                />
              </div>

              {/* Recipient Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-[#78716C] block">
                  Куда отправить:
                </label>
                <select
                  value={shareTargetKey}
                  onChange={(e) => setShareTargetKey(e.target.value)}
                  className="w-full bg-white border-2 border-[#292524] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#292524] focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="current">
                    {activeGroup
                      ? `💬 Текущий чат: Группа «${activeGroup.name}»`
                      : activeContact
                      ? `💬 Текущий чат: ${activeContact.name}`
                      : '💬 Текущий активный диалог'}
                  </option>
                  {allGroups.length > 0 && (
                    <optgroup label="Группы">
                      {allGroups.map((g) => (
                        <option key={`group_${g.id}`} value={`group_${g.id}`}>
                          👥 {g.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {allUsers.length > 0 && (
                    <optgroup label="Контакты">
                      {allUsers.map((u) => (
                        <option key={`user_${u.id}`} value={`user_${u.id}`}>
                          👤 {u.name} (@{u.username})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Comment / Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-[#78716C] block">
                  Комментарий (необязательно):
                </label>
                <input
                  type="text"
                  data-testid="cat-share-note-input"
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  placeholder="Смотри, какой у меня стильный котик! 🐾"
                  maxLength={120}
                  className="w-full bg-white border-2 border-[#292524] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-[#292524] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#292524] bg-white hover:bg-stone-100 font-extrabold text-xs sm:text-sm cursor-pointer transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  data-testid="cat-modal-confirm-share-btn"
                  onClick={handleConfirmShare}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#292524] bg-amber-400 hover:bg-amber-300 shadow-[0_3px_0_#292524] active:translate-y-0.5 active:shadow-none font-black text-xs sm:text-sm text-[#292524] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>Отправить</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Send Earth Gift Modal */}
        {isGiftModalOpen && (
          <div
            data-testid="earth-gift-dialog-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsGiftModalOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Подарить планету Земля"
              data-testid="earth-gift-dialog"
              className="w-full max-w-md bg-[#FFFDF5] border-[3px] border-[#292524] rounded-3xl p-4 sm:p-5 shadow-[0_8px_0_#292524] flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto animate-scale-up"
            >
              <div className="flex items-center justify-between pb-2 border-b-2 border-[#292524]">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌍</span>
                  <h3 className="text-base sm:text-lg font-black text-[#292524]">
                    Подарить планету Земля
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGiftModalOpen(false)}
                  aria-label="Закрыть окно подарка"
                  className="w-8 h-8 rounded-xl bg-white hover:bg-stone-100 border-2 border-[#292524] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Quick Balance & Coin -> Star Exchange */}
              <div className="bg-amber-100 border-2 border-[#292524] rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-black text-[#292524] tabular-nums">
                  <span className="truncate">🪙 Монеты: {formatCoinsCount(coins)}</span>
                  <span className="shrink-0">⭐ Звёзды: {stars} / {EARTH_GIFT_STARS}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    data-testid="cat-dialog-exchange-star-btn"
                    onClick={() => handleExchangeCoinsForStar(1)}
                    disabled={coins < COINS_PER_STAR}
                    className="w-full py-2 px-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-stone-200 disabled:text-stone-400 disabled:border-stone-400 border-2 border-[#292524] font-black text-xs text-[#292524] shadow-[0_2px_0_#292524] disabled:shadow-none active:translate-y-0.5 active:shadow-none cursor-pointer disabled:cursor-not-allowed transition-all tabular-nums"
                  >
                    +1 ⭐ ({formatCoinsCount(COINS_PER_STAR)} 🪙)
                  </button>
                  <button
                    type="button"
                    data-testid="cat-dialog-exchange-20stars-btn"
                    onClick={() => handleExchangeCoinsForStar(EARTH_GIFT_STARS)}
                    disabled={coins < COINS_PER_STAR * EARTH_GIFT_STARS}
                    className="w-full py-2 px-2.5 rounded-xl bg-yellow-300 hover:bg-yellow-200 disabled:bg-stone-200 disabled:text-stone-400 disabled:border-stone-400 border-2 border-[#292524] font-black text-xs text-[#292524] shadow-[0_2px_0_#292524] disabled:shadow-none active:translate-y-0.5 active:shadow-none cursor-pointer disabled:cursor-not-allowed transition-all tabular-nums"
                  >
                    +{EARTH_GIFT_STARS} ⭐ ({formatCoinsCount(COINS_PER_STAR * EARTH_GIFT_STARS)} 🪙)
                  </button>
                </div>
              </div>

              {/* Gift Preview */}
              <div className="bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 border-2 border-[#292524] rounded-2xl p-4 text-white text-center shadow-md space-y-2">
                <div className="text-5xl animate-bounce">🌍</div>
                <div className="text-base font-black">Подарок: Планета Земля</div>
                <div className="text-xs font-bold text-amber-200">
                  Стоимость: {EARTH_GIFT_STARS} звёзд ⭐ {stars < EARTH_GIFT_STARS ? `(не хватает ${EARTH_GIFT_STARS - stars} ⭐)` : '— можно дарить!'}
                </div>
                <p className="text-[11px] text-blue-100 italic">
                  Роскошный космический подарок, который украсит чат и порадует вашего собеседника!
                </p>
              </div>

              {/* Recipient Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-[#78716C] block">
                  Кому подарить:
                </label>
                <select
                  value={giftTargetKey}
                  onChange={(e) => setGiftTargetKey(e.target.value)}
                  className="w-full bg-white border-2 border-[#292524] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#292524] focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="current">
                    {activeGroup
                      ? `💬 Текущий чат: Группа «${activeGroup.name}»`
                      : activeContact
                      ? `💬 Текущий чат: ${activeContact.name}`
                      : '💬 Текущий активный диалог'}
                  </option>
                  {allGroups.length > 0 && (
                    <optgroup label="Группы">
                      {allGroups.map((g) => (
                        <option key={`group_${g.id}`} value={`group_${g.id}`}>
                          👥 {g.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {allUsers.length > 0 && (
                    <optgroup label="Контакты">
                      {allUsers.map((u) => (
                        <option key={`user_${u.id}`} value={`user_${u.id}`}>
                          👤 {u.name} (@{u.username})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Gift Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-[#78716C] block">
                  Поздравительная открытка (необязательно):
                </label>
                <input
                  type="text"
                  data-testid="earth-gift-message-input"
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  placeholder="Самый лучший подарок для тебя! 🌟"
                  maxLength={120}
                  className="w-full bg-white border-2 border-[#292524] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-[#292524] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsGiftModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#292524] bg-white hover:bg-stone-100 font-extrabold text-xs sm:text-sm cursor-pointer transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  data-testid="earth-gift-confirm-btn"
                  onClick={handleConfirmSendEarthGift}
                  disabled={stars < 20}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#292524] bg-gradient-to-r from-blue-500 to-indigo-600 hover:brightness-105 disabled:bg-stone-200 disabled:text-stone-400 disabled:border-stone-400 shadow-[0_3px_0_#292524] disabled:shadow-none active:translate-y-0.5 active:shadow-none font-black text-xs sm:text-sm text-white flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all"
                >
                  <span>🌍</span>
                  <span>Подарить Землю (20 ⭐)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Toast */}
        {shareSuccessToast && (
          <div
            data-testid="cat-share-toast"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-60 bg-emerald-500 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-2xl border-[2.5px] border-[#292524] shadow-[0_4px_0_#292524] animate-bounce-in flex items-center gap-2"
          >
            <span>✨</span>
            <span>{shareSuccessToast}</span>
          </div>
        )}
      </div>
    </div>
  );
};
