import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, X, Send, SlidersHorizontal, RotateCcw, Music } from 'lucide-react';
import {
  CAT_BACKGROUND_OPTIONS,
  CAT_GLASSES_OPTIONS,
  CAT_HAT_OPTIONS,
  CAT_NECK_OPTIONS,
  CAT_PERSONALITY_OPTIONS,
  CAT_SKIN_OPTIONS,
  CAT_TOP_OPTIONS,
  COINS_PER_PET,
  CatCustomization,
  DEFAULT_CAT_CUSTOMIZATION,
  FEED_COST,
  HUNGRY_COINS_PER_PET,
  INITIAL_COINS,
  INITIAL_HUNGER,
  decayHunger,
  evaluatePetStroke,
  feedCat,
  generateCatSupportReply,
  getEffectiveCatMood,
  sanitizeCatCustomization
} from '../utils/catGameLogic';
import { CatSprite } from './CatSprite';

interface CatMinigameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FloatingParticle {
  id: number;
  x: number;
  y: number;
  kind: 'heart' | 'refuse' | 'feed';
  text: string;
}

const STORAGE_COINS_KEY = 'cosmo_cat_minigame_coins';
const STORAGE_HUNGER_KEY = 'cosmo_cat_minigame_hunger';
const STORAGE_CUSTOMIZATION_KEY = 'cosmo_cat_minigame_customization';

export const CatMinigameModal: React.FC<CatMinigameModalProps> = ({ isOpen, onClose }) => {
  const [coins, setCoins] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COINS_KEY);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
      }
    } catch {}
    return INITIAL_COINS;
  });

  const [hunger, setHunger] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HUNGER_KEY);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
      }
    } catch {}
    return INITIAL_HUNGER;
  });

  const [customization, setCustomization] = useState<CatCustomization>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOMIZATION_KEY);
      if (raw) {
        return sanitizeCatCustomization(JSON.parse(raw));
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

  const hungerRef = useRef(hunger);
  hungerRef.current = hunger;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const customizationRef = useRef(customization);
  customizationRef.current = customization;
  const chatHistoryRef = useRef<Array<{ role: 'user' | 'cat'; text: string }>>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const strokeAccRef = useRef<number>(0);
  const lastPetTimeRef = useRef<number>(0);
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

  // Persist coins, hunger & customization
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COINS_KEY, String(coins));
    } catch {}
  }, [coins]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HUNGER_KEY, String(Math.round(hunger)));
    } catch {}
  }, [hunger]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CUSTOMIZATION_KEY, JSON.stringify(customization));
    } catch {}
  }, [customization]);

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
      setCoins(c => c + result.coinsEarned);
      setIsPurring(true);
      const activePersonality = customizationRef.current.personality;

      if (activePersonality === 'angry') {
        playAngrySound();
        spawnParticle(e.clientX - 10, e.clientY - 14, 'refuse', `😾 Фыр! +${result.coinsEarned}`);
      } else if (activePersonality === 'sad' || result.isHungryPurr) {
        playSadPurrSound();
        spawnParticle(e.clientX - 10, e.clientY - 14, 'refuse', `😿 +${result.coinsEarned}`);
      } else {
        playPurrSound();
        spawnParticle(e.clientX - 10, e.clientY - 14, 'heart', `💖 +${result.coinsEarned}`);
        spawnParticle(e.clientX + 18, e.clientY - 4, 'heart', '❤️');
      }

      if (purrTimeoutRef.current) clearTimeout(purrTimeoutRef.current);
      purrTimeoutRef.current = setTimeout(() => {
        setIsPurring(false);
      }, 850);
    }
  };

  const handleCatPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    getAudioContext();
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCatPointerLeave = () => {
    lastPointerRef.current = null;
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

  const hungerBarColor =
    hungerPct > 55
      ? 'bg-emerald-500'
      : hungerPct > 22
      ? 'bg-amber-400'
      : 'bg-rose-500';

  const stageBgClass =
    customization.background === 'space'
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
        className="w-full h-full flex flex-col overflow-hidden bg-[#FFFBEB]"
      >
        {/* Minimalist Top HUD */}
        <div className="px-3 sm:px-4 pt-3 pb-2.5 bg-[#FEF3C7] border-b-[3px] border-[#292524] flex items-center justify-between gap-2 shrink-0">
          {/* Coin Counter */}
          <div
            data-testid="cat-coins"
            className="flex items-center gap-1.5 sm:gap-2 bg-white border-[2.5px] border-[#292524] rounded-2xl px-2.5 sm:px-3 py-1.5 shadow-[0_3px_0_#292524] shrink-0"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="#FBBF24" stroke="#292524" strokeWidth="2.2" />
              <circle cx="12" cy="12" r="6.5" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5" />
              <text x="12" y="15.5" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#92400E">
                ₽
              </text>
            </svg>
            <span className="text-sm sm:text-lg font-extrabold tabular-nums leading-none text-[#292524]">
              {coins}
            </span>
          </div>

          {/* Fullness / Hunger Bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs font-extrabold mb-1 px-0.5">
              <span className="truncate flex items-center gap-1">
                <span aria-hidden="true">{isStarving ? '😿' : '🐟'}</span>
                <span>Сытость</span>
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

          {/* Settings, Sound & Close Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
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

        {/* Main Content: Interactive Cat Area + Optional Settings Drawer */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
          {/* Left / Top Cat Stage + Bottom Controls */}
          <div className={`flex flex-col min-w-0 min-h-0 ${isSettingsOpen ? 'h-[235px] sm:h-auto sm:flex-1 shrink-0' : 'flex-1'}`}>
            <div
              ref={stageRef}
              className={`relative flex-1 min-h-0 flex flex-col items-center justify-center px-3 sm:px-4 py-2 sm:py-3 overflow-hidden bg-gradient-to-b transition-colors duration-300 ${stageBgClass}`}
            >
              {/* Background Theme Decorations */}
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
                  onPointerDown={handleCatPointerDown}
                  onPointerMove={handleCatPointerMove}
                  onPointerUp={handleCatPointerLeave}
                  onPointerLeave={handleCatPointerLeave}
                  className={`relative z-10 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing transition-transform duration-150 ${
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
                <p className="relative z-10 mt-0.5 text-xs font-bold text-[#78716C] text-center">
                  {customization.personality === 'angry'
                    ? `Злой котик ворчит, но даёт +${COINS_PER_PET} монеты за поглаживание`
                    : customization.personality === 'sad'
                    ? `Грустный котик ждёт ласки · +${isStarving ? HUNGRY_COINS_PER_PET : COINS_PER_PET} монеты`
                    : isStarving
                    ? `Котик жалобно мурлычет · +${HUNGRY_COINS_PER_PET} монеты за свайп`
                    : `Гладь котика курсором или пальцем · +${COINS_PER_PET} монеты`}
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
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-bg-${opt.id}`}
                          aria-pressed={active}
                          onClick={() =>
                            setCustomization(prev => ({ ...prev, background: opt.id }))
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
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-hat-${opt.id}`}
                          aria-pressed={active}
                          onClick={() =>
                            setCustomization(prev => ({
                              ...prev,
                              outfit: { ...prev.outfit, hat: opt.id }
                            }))
                          }
                          className={`px-2.5 py-1.5 rounded-xl border-2 border-[#292524] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            active ? 'bg-amber-300 shadow-[0_2px_0_#292524]' : 'bg-white hover:bg-amber-50'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
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
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-glasses-${opt.id}`}
                          aria-pressed={active}
                          onClick={() =>
                            setCustomization(prev => ({
                              ...prev,
                              outfit: { ...prev.outfit, glasses: opt.id }
                            }))
                          }
                          className={`px-2.5 py-1.5 rounded-xl border-2 border-[#292524] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            active ? 'bg-amber-300 shadow-[0_2px_0_#292524]' : 'bg-white hover:bg-amber-50'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
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
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-top-${opt.id}`}
                          aria-pressed={active}
                          onClick={() =>
                            setCustomization(prev => ({
                              ...prev,
                              outfit: { ...prev.outfit, top: opt.id }
                            }))
                          }
                          className={`px-2.5 py-1.5 rounded-xl border-2 border-[#292524] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            active ? 'bg-amber-300 shadow-[0_2px_0_#292524]' : 'bg-white hover:bg-amber-50'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
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
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`cat-neck-${opt.id}`}
                          aria-pressed={active}
                          onClick={() =>
                            setCustomization(prev => ({
                              ...prev,
                              outfit: { ...prev.outfit, neck: opt.id }
                            }))
                          }
                          className={`px-2.5 py-1.5 rounded-xl border-2 border-[#292524] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            active ? 'bg-amber-300 shadow-[0_2px_0_#292524]' : 'bg-white hover:bg-amber-50'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
