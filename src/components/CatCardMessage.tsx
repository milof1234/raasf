import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Heart, Gamepad2, Utensils } from 'lucide-react';
import {
  CAT_STORAGE_KEYS,
  FEED_COST,
  SharedCatData,
  formatCoinsCount,
  getCatOutfitLabels,
  getEffectiveCatMood,
  getUserCatStorageKey,
  readUserCatEconomy
} from '../utils/catGameLogic';
import { CatStickerPayload } from '../types/chat';
import { CatSprite } from './CatSprite';

interface CatCardMessageProps {
  msgId?: string;
  currentUserId?: string;
  catShare: SharedCatData;
  senderName: string;
  isMe: boolean;
  onOpenMinigame?: () => void;
  onFeedFriendCat?: (ownerName: string, catName?: string) => void;
}

interface FloatingPetParticle {
  id: number;
  x: number;
  y: number;
  text: string;
}

export const CatCardMessage: React.FC<CatCardMessageProps> = ({
  msgId,
  currentUserId,
  catShare,
  senderName,
  isMe,
  onOpenMinigame,
  onFeedFriendCat
}) => {
  const [petCount, setPetCount] = useState(0);
  const [isPurring, setIsPurring] = useState(false);
  const [particles, setParticles] = useState<FloatingPetParticle[]>([]);
  const highFiveKey = msgId && currentUserId ? `cosmo_cat_highfive_${currentUserId}_${msgId}` : null;
  const [hasHighFived, setHasHighFived] = useState(() => {
    if (!highFiveKey) return false;
    try {
      return localStorage.getItem(highFiveKey) === '1';
    } catch {
      return false;
    }
  });
  const [myCoins, setMyCoins] = useState(() => readUserCatEconomy(currentUserId).coins);
  const [fedFriendCount, setFedFriendCount] = useState(0);
  const purrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const particleIdRef = useRef(1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => setMyCoins(readUserCatEconomy(currentUserId).coins);
    sync();
    window.addEventListener('cosmo-cat-economy-updated', sync);
    return () => window.removeEventListener('cosmo-cat-economy-updated', sync);
  }, [currentUserId]);

  const customization = catShare.customization;
  const labels = getCatOutfitLabels(customization);
  const level = catShare.level || 1;
  const levelTitle = catShare.levelTitle || (level === 3 ? 'Космический кот' : level === 2 ? 'Городской стиль' : 'Обычный котик');

  const playPurrChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // Warm cat purr
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(105, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(96, now + 0.45);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);

      // Chime
      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(987.77, now + 0.05);
      chime.frequency.setValueAtTime(1318.51, now + 0.12);
      chimeGain.gain.setValueAtTime(0.001, now + 0.05);
      chimeGain.gain.linearRampToValueAtTime(0.06, now + 0.07);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      chime.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chime.start(now + 0.05);
      chime.stop(now + 0.3);
    } catch {}
  }, []);

  const handlePetInChat = (e?: React.MouseEvent) => {
    playPurrChime();
    setIsPurring(true);
    setPetCount(prev => prev + 1);

    if (purrTimerRef.current) clearTimeout(purrTimerRef.current);
    purrTimerRef.current = setTimeout(() => setIsPurring(false), 900);

    const card = cardRef.current;
    let relX = 140;
    let relY = 80;
    if (e && card) {
      const rect = card.getBoundingClientRect();
      relX = Math.max(20, Math.min(rect.width - 20, e.clientX - rect.left));
      relY = Math.max(20, Math.min(rect.height - 20, e.clientY - rect.top));
    }
    const id = particleIdRef.current++;
    const texts = ['💖', '❤️', '🐾 Мур!', '✨ Мяу!'];
    const chosen = texts[id % texts.length];
    setParticles(prev => [...prev.slice(-6), { id, x: relX, y: relY, text: chosen }]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, 950);
  };

  const spawnCustomParticle = (text: string) => {
    const id = particleIdRef.current++;
    setParticles(prev => [...prev.slice(-6), { id, x: 130, y: 75, text }]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, 1050);
  };

  const handleHighFive = () => {
    if (hasHighFived) {
      playPurrChime();
      spawnCustomParticle('🐾 Дай пять!');
      return;
    }
    playPurrChime();
    setIsPurring(true);
    if (purrTimerRef.current) clearTimeout(purrTimerRef.current);
    purrTimerRef.current = setTimeout(() => setIsPurring(false), 900);

    setHasHighFived(true);
    if (highFiveKey) {
      try {
        localStorage.setItem(highFiveKey, '1');
      } catch {}
    }
    if (currentUserId) {
      try {
        const coinsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUserId);
        const swipesKey = getUserCatStorageKey(CAT_STORAGE_KEYS.swipes, currentUserId);
        const curCoins = readUserCatEconomy(currentUserId).coins;
        const curSwipes = Math.max(0, Number(localStorage.getItem(swipesKey)) || 0);
        localStorage.setItem(coinsKey, String(curCoins + 25));
        localStorage.setItem(swipesKey, String(curSwipes + 1));
        setMyCoins(curCoins + 25);
        window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'cat_card_highfive' } }));
      } catch {}
    }
    spawnCustomParticle('✋ Дай пять! +25 🪙');
  };

  const handleFeedFriend = () => {
    if (!currentUserId || isMe) return;
    const curCoins = readUserCatEconomy(currentUserId).coins;
    if (curCoins < FEED_COST) return;
    playPurrChime();
    setIsPurring(true);
    if (purrTimerRef.current) clearTimeout(purrTimerRef.current);
    purrTimerRef.current = setTimeout(() => setIsPurring(false), 1100);
    try {
      const coinsKey = getUserCatStorageKey(CAT_STORAGE_KEYS.coins, currentUserId);
      const nextCoins = curCoins - FEED_COST;
      localStorage.setItem(coinsKey, String(nextCoins));
      setMyCoins(nextCoins);
      window.dispatchEvent(new CustomEvent('cosmo-cat-economy-updated', { detail: { source: 'cat_card_feed_friend' } }));
    } catch {}
    setFedFriendCount(prev => prev + 1);
    spawnCustomParticle('🐟 Угощение! Мур-спасибо!');
    onFeedFriendCat?.(senderName, catShare.catName);
  };

  const mood = getEffectiveCatMood(100, isPurring, customization.personality);

  const stageBgClass =
    customization.background === 'skyscrapers'
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
      : 'from-[#E0F2FE] via-[#FFFBEB] to-[#FDE68A]/60';

  const levelBadgeClass =
    level === 3
      ? 'bg-purple-600 text-white border-purple-400'
      : level === 2
      ? 'bg-cyan-400 text-slate-950 border-cyan-300'
      : 'bg-amber-300 text-slate-950 border-amber-400';

  return (
    <div
      ref={cardRef}
      data-testid="cat-card-message"
      className="relative w-full max-w-[340px] sm:max-w-[360px] rounded-2xl bg-slate-950/90 border-2 border-amber-400/40 shadow-xl overflow-hidden text-slate-100 select-none my-1"
    >
      {/* Floating Pet Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{ left: `${p.x}px`, top: `${p.y}px` }}
          className="absolute z-40 pointer-events-none text-sm font-black text-rose-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-float-up-fade"
        >
          {p.text}
        </div>
      ))}

      {/* Header Bar */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-amber-400/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base shrink-0">🐱</span>
          <div className="min-w-0">
            <div className="text-xs font-black text-amber-300 leading-tight truncate">
              {catShare.catName ? `🐱 ${catShare.catName}` : (isMe ? 'Ваш Котик' : `Котик ${senderName}`)}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold truncate leading-tight">
              {levelTitle}
            </div>
          </div>
        </div>

        <span
          data-testid="cat-card-level-badge"
          className={`px-2 py-0.5 rounded-lg border text-[10px] font-black shrink-0 ${levelBadgeClass}`}
        >
          Ур. {level}
        </span>
      </div>

      {/* Interactive Cat Stage (Click/Pet zone) */}
      <div
        onClick={handlePetInChat}
        className={`relative h-44 sm:h-48 w-full bg-gradient-to-b flex items-center justify-center overflow-hidden cursor-pointer transition-colors ${stageBgClass}`}
        title="Нажмите, чтобы погладить котика!"
      >
        {/* Background Scene Details */}
        {customization.background === 'skyscrapers' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
            <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" className="w-full h-full" aria-hidden="true">
              <circle cx="340" cy="40" r="16" fill="#FEF08A" opacity="0.88" />
              <rect x="20" y="90" width="45" height="150" fill="#1E1B4B" />
              <rect x="75" y="65" width="50" height="175" fill="#1E293B" />
              <rect x="290" y="80" width="45" height="160" fill="#1E1B4B" />
              <rect x="340" y="55" width="50" height="185" fill="#0F172A" />
              <rect x="35" y="105" width="45" height="135" fill="#0F172A" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.4" />
              <rect x="315" y="70" width="50" height="170" fill="#0F172A" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.4" />
              <g fill="#FDE047" opacity="0.85">
                <rect x="42" y="118" width="6" height="8" rx="1" />
                <rect x="54" y="118" width="6" height="8" rx="1" fill="#22D3EE" />
                <rect x="42" y="135" width="6" height="8" rx="1" />
                <rect x="325" y="85" width="7" height="9" rx="1" fill="#22D3EE" />
                <rect x="340" y="85" width="7" height="9" rx="1" fill="#F472B6" />
                <rect x="325" y="105" width="7" height="9" rx="1" />
              </g>
            </svg>
          </div>
        )}

        {customization.background === 'planets' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
              <circle cx="65" cy="55" r="70" fill="#7C3AED" opacity="0.18" />
              <circle cx="330" cy="70" r="75" fill="#EC4899" opacity="0.15" />
              <g fill="#F8FAFC">
                <circle cx="30" cy="25" r="1.5" opacity="0.85" />
                <circle cx="120" cy="20" r="1.2" opacity="0.7" />
                <circle cx="280" cy="25" r="1.5" opacity="0.85" />
                <circle cx="370" cy="30" r="1.6" opacity="0.9" />
                <circle cx="45" cy="150" r="1.3" opacity="0.7" />
                <circle cx="360" cy="160" r="1.4" opacity="0.7" />
              </g>
              <line x1="160" y1="40" x2="190" y2="25" stroke="#BAE6FD" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
              {/* Луна */}
              <g transform="translate(55, 52)">
                <circle cx="0" cy="0" r="24" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
                <circle cx="-8" cy="-6" r="5" fill="#CBD5E1" />
                <circle cx="9" cy="-2" r="6.5" fill="#CBD5E1" />
                <text x="0" y="36" textAnchor="middle" fontSize="9" fontWeight="800" fill="#E2E8F0" opacity="0.9">Луна</text>
              </g>
              {/* Марс */}
              <g transform="translate(345, 58)">
                <circle cx="0" cy="0" r="24" fill="#DC2626" stroke="#F87171" strokeWidth="1.5" />
                <path d="M-17 -4 Q0 -11 18 -1" fill="none" stroke="#991B1B" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
                <ellipse cx="-4" cy="-18" rx="8" ry="3" fill="#FEE2E2" opacity="0.8" />
                <text x="0" y="36" textAnchor="middle" fontSize="9" fontWeight="800" fill="#FCA5A5" opacity="0.95">Марс</text>
              </g>
              {/* Венера */}
              <g transform="translate(70, 160)">
                <circle cx="0" cy="0" r="18" fill="#F59E0B" stroke="#FDE68A" strokeWidth="1.5" />
                <path d="M-14 -5 Q0 2 15 -6" fill="none" stroke="#FEF3C7" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
                <text x="0" y="28" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#FDE68A" opacity="0.95">Венера</text>
              </g>
            </svg>
          </div>
        )}

        {customization.background === 'space' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60">
            <span className="absolute top-3 left-8 text-xs animate-pulse">✨</span>
            <span className="absolute top-6 right-10 text-xs">⭐</span>
            <span className="absolute bottom-8 left-12 text-xs">🪐</span>
          </div>
        )}

        {customization.background === 'cyber' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 bg-[linear-gradient(to_right,#06b6d4_1px,transparent_1px),linear-gradient(to_bottom,#ec4899_1px,transparent_1px)] bg-[size:20px_20px]" />
        )}

        {customization.background === 'garden' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60">
            <span className="absolute top-3 left-6 text-xs">🌸</span>
            <span className="absolute top-5 right-8 text-xs">🌿</span>
          </div>
        )}

        {customization.background === 'night' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-70">
            <span className="absolute top-3 right-8 text-base">🌙</span>
            <span className="absolute top-8 left-8 text-xs animate-pulse">✨</span>
          </div>
        )}

        {/* Cozy rug shadow */}
        <div className="absolute bottom-1 w-32 h-6 rounded-[100%] bg-pink-900/30 pointer-events-none" />

        {/* Cat Sprite */}
        <div className={`relative z-10 w-36 h-36 transition-transform duration-150 ${isPurring ? 'scale-105' : 'hover:scale-[1.02]'}`}>
          <CatSprite
            mood={mood}
            outfit={customization.outfit}
            isStarving={false}
            skin={customization.skin}
            isDancing={isPurring}
          />
        </div>

        {/* Tap to pet hint overlay */}
        <div className="absolute bottom-1.5 inset-x-0 flex justify-center pointer-events-none">
          <span className="text-[10px] font-bold bg-black/60 backdrop-blur-sm text-slate-200 px-2 py-0.5 rounded-full border border-white/10">
            Нажмите на котика, чтобы погладить 🐾
          </span>
        </div>
      </div>

      {/* Outfit Chips & Details */}
      <div className="p-3 bg-slate-900/95 space-y-2">
        {/* Note if provided */}
        {catShare.note && (
          <div className="text-xs italic bg-slate-800/80 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-amber-200">
            💬 «{catShare.note}»
          </div>
        )}

        {/* Items equipped tags */}
        <div className="flex flex-wrap gap-1 text-[10.5px]">
          {customization.outfit.hat !== 'none' && (
            <span className="px-2 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 font-medium">
              🧢 {labels.hat}
            </span>
          )}
          {customization.outfit.glasses !== 'none' && (
            <span className="px-2 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-medium">
              🕶️ {labels.glasses}
            </span>
          )}
          {customization.outfit.top !== 'none' && (
            <span className="px-2 py-0.5 rounded-lg bg-violet-950/80 border border-violet-500/40 text-violet-300 font-medium">
              🧥 {labels.top}
            </span>
          )}
          {customization.outfit.neck !== 'none' && (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-medium">
              ✨ {labels.neck}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 font-medium">
            🎨 {labels.skin}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 font-medium">
            🖼️ {labels.background}
          </span>
        </div>

        {/* Swipes + Pet interaction counter */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold pt-1 border-t border-slate-800">
          <span>🐾 {catShare.totalSwipes || 0} свайпов/кликов</span>
          {petCount > 0 && (
            <span className="text-rose-400 font-bold flex items-center gap-1 animate-pulse">
              <Heart className="w-3 h-3 fill-rose-500" /> Поглажен {petCount} {petCount === 1 ? 'раз' : 'раза'}
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="cat-card-pet-btn"
              onClick={handlePetInChat}
              className="flex-1 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Heart className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>Погладить</span>
            </button>

            <button
              type="button"
              data-testid="cat-card-highfive-btn"
              onClick={handleHighFive}
              className={`py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                hasHighFived
                  ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200'
                  : 'bg-indigo-500 hover:bg-indigo-400 text-white'
              }`}
              title="Дать пять котику и получить +25 🪙"
            >
              <span>✋</span>
              <span>{hasHighFived ? 'Пять! ✓' : 'Дай пять'}</span>
            </button>

            {onOpenMinigame && (
              <button
                type="button"
                data-testid="cat-card-open-game-btn"
                onClick={onOpenMinigame}
                className="py-1.5 px-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-md active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                title="Открыть игру с котиком"
              >
                <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                <span>Игра</span>
              </button>
            )}
          </div>

          {!isMe && currentUserId && (
            <button
              type="button"
              data-testid="cat-card-feed-friend-btn"
              onClick={handleFeedFriend}
              disabled={myCoins < FEED_COST}
              className="w-full py-1.5 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 disabled:opacity-50 disabled:cursor-not-allowed text-amber-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer tabular-nums"
            >
              <Utensils className="w-3 h-3 shrink-0" />
              <span>
                Покормить чужого котика ({formatCoinsCount(FEED_COST)} 🪙)
                {fedFriendCount > 0 ? ` · угощён ${fedFriendCount}×` : ''}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const CatStickerMessage: React.FC<{
  sticker: CatStickerPayload;
}> = ({ sticker }) => {
  return (
    <div
      data-testid="cat-sticker-message"
      className="w-44 sm:w-48 rounded-2xl bg-gradient-to-br from-slate-900/95 via-indigo-950/90 to-slate-900/95 border border-amber-400/35 p-2.5 text-center shadow-lg select-none"
    >
      <div className="flex items-center justify-between text-[11px] font-bold text-amber-200 px-1 mb-1">
        <span className="truncate">{sticker.catName || 'Космо-Котик'}</span>
        <span>{sticker.emoji}</span>
      </div>
      <div className="w-28 h-28 mx-auto">
        <CatSprite
          mood={sticker.mood === 'normal' ? 'purring' : sticker.mood}
          outfit={sticker.customization.outfit}
          isStarving={false}
          skin={sticker.customization.skin}
          isDancing={Boolean(sticker.isDancing)}
        />
      </div>
      <div className="mt-1 text-xs font-extrabold text-white leading-tight">
        {sticker.caption}
      </div>
    </div>
  );
};
