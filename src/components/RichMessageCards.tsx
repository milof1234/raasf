import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Coins, Repeat, Check, X } from 'lucide-react';
import { CoinEnvelopeData, TradeOfferData } from '../types/chat';
import { formatCoinsCount } from '../utils/catGameLogic';
import { computeEnvelopeClaimShare, getNextVoiceSpeed } from '../utils/cosmoFeatures';

function useResolvedMediaUrl(rawUrl: string): string {
  const [resolvedUrl, setResolvedUrl] = useState<string>(rawUrl);

  useEffect(() => {
    if (!rawUrl || !rawUrl.startsWith('data:')) {
      setResolvedUrl(rawUrl);
      return;
    }

    let objectUrl: string | null = null;
    try {
      const commaIdx = rawUrl.indexOf(',');
      if (commaIdx === -1) {
        setResolvedUrl(rawUrl);
        return;
      }
      const header = rawUrl.slice(5, commaIdx);
      const base64Data = rawUrl.slice(commaIdx + 1);
      const mimeType = header.split(';')[0] || 'application/octet-stream';
      const byteString = atob(base64Data);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      objectUrl = URL.createObjectURL(blob);
      setResolvedUrl(objectUrl);
    } catch {
      setResolvedUrl(rawUrl);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [rawUrl]);

  return resolvedUrl;
}

export const VoicePlayerBubble: React.FC<{ audioUrl: string }> = ({ audioUrl }) => {
  const resolvedUrl = useResolvedMediaUrl(audioUrl);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [resolvedUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        el.playbackRate = speed;
        await el.play();
      } catch {
        setHasError(true);
      }
    } else {
      el.pause();
    }
  };

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const formatSec = (s: number) => {
    const clean = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
    return `${Math.floor(clean / 60)}:${String(clean % 60).padStart(2, '0')}`;
  };

  return (
    <div data-testid="voice-player-bubble" className="flex items-center gap-2 py-1 w-[224px] sm:w-[264px] max-w-full">
      <audio
        ref={audioRef}
        src={resolvedUrl}
        preload="auto"
        onError={() => setHasError(true)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
        }}
        className="hidden"
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести голосовое'}
        className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div
          onClick={(e) => {
            const el = audioRef.current;
            if (!el || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            el.currentTime = ratio * duration;
          }}
          className="h-2 rounded-full bg-black/25 overflow-hidden cursor-pointer"
        >
          <div
            className="h-full bg-white/85 rounded-full transition-all duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-85 tabular-nums">
          <span>{formatSec(isPlaying ? currentTime : duration)}</span>
          <span>{hasError ? 'Ошибка аудио' : 'Голосовое'}</span>
        </div>
      </div>

      <button
        type="button"
        data-testid="voice-speed-toggle-btn"
        onClick={() => setSpeed(prev => getNextVoiceSpeed(prev))}
        title="Скорость воспроизведения"
        className="px-2 py-1 rounded-lg bg-black/25 hover:bg-black/40 border border-white/15 text-[11px] font-bold text-white shrink-0 cursor-pointer tabular-nums"
      >
        {speed}x
      </button>
    </div>
  );
};

export const VideoCircleBubble: React.FC<{
  videoUrl: string;
  durationSec?: number;
}> = ({ videoUrl, durationSec }) => {
  const resolvedUrl = useResolvedMediaUrl(videoUrl);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [resolvedUrl]);

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      try {
        v.muted = false;
        setIsMuted(false);
        await v.play();
      } catch {
        try {
          v.muted = true;
          setIsMuted(true);
          await v.play();
        } catch {}
      }
    } else {
      v.pause();
    }
  };

  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div data-testid="video-circle-bubble" className="relative w-44 h-44 sm:w-48 sm:h-48 mx-auto my-1 select-none">
      <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-10" viewBox="0 0 196 196">
        <circle
          cx="98"
          cy="98"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="3.5"
        />
        <circle
          cx="98"
          cy="98"
          r={radius}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Остановить видеокружок' : 'Воспроизвести видеокружок'}
        className="w-full h-full rounded-full overflow-hidden bg-slate-950 border-2 border-white/15 relative cursor-pointer group block"
      >
        <video
          ref={videoRef}
          src={resolvedUrl}
          preload="auto"
          playsInline
          loop={false}
          muted={isMuted}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
          onTimeUpdate={(e) => {
            const rawD = e.currentTarget.duration;
            const d = Number.isFinite(rawD) && rawD > 0 ? rawD : (durationSec || 0);
            if (d > 0) setProgress(Math.min(1, e.currentTarget.currentTime / d));
          }}
          className="w-full h-full object-cover"
        />

        {!isPlaying && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-black/60 border border-white/30 flex items-center justify-center text-white shadow-lg">
              <Play className="w-5 h-5 ml-0.5 fill-white" />
            </div>
          </div>
        )}
      </button>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/70 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white tabular-nums">
        <span>🎥 {durationSec ? `${durationSec}с` : 'Кружок'}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (videoRef.current) {
              videoRef.current.muted = !videoRef.current.muted;
              setIsMuted(videoRef.current.muted);
            }
          }}
          aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
          className="hover:text-sky-300 cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
};

export const CoinEnvelopeCard: React.FC<{
  msgId: string;
  envelope: CoinEnvelopeData;
  currentUserId: string;
  onClaimEnvelope?: (msgId: string, envelope: CoinEnvelopeData) => void;
}> = ({ msgId, envelope, currentUserId, onClaimEnvelope }) => {
  const claimedList = Array.isArray(envelope.claimedBy)
    ? envelope.claimedBy.filter(Boolean)
    : envelope.claimedBy && typeof envelope.claimedBy === 'object'
    ? Object.values(envelope.claimedBy).filter(Boolean)
    : [];
  const myClaim = claimedList.find(c => c && c.userId === currentUserId);
  const check = computeEnvelopeClaimShare(envelope, currentUserId);
  const claimedSum = claimedList.reduce((acc, c) => acc + (Number(c?.amount) || 0), 0);
  const remaining = Math.max(0, envelope.totalCoins - claimedSum);

  return (
    <div
      data-testid="coin-envelope-card"
      className="w-full max-w-[288px] sm:max-w-[310px] rounded-2xl bg-gradient-to-br from-rose-700 via-red-800 to-amber-800 border-2 border-amber-300/60 p-3.5 sm:p-4 text-white shadow-xl space-y-2.5 my-1"
    >
      <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-amber-200">
        <span>🧧 Конверт с монетами</span>
        <span className="tabular-nums">
          {claimedList.length}/{envelope.maxClaims} забрали
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-2xl shrink-0">
          🪙
        </div>
        <div className="min-w-0">
          <div className="text-base font-black text-amber-100 tabular-nums">
            {formatCoinsCount(envelope.totalCoins)} 🪙
          </div>
          <div className="text-[11px] text-rose-100/90 truncate">
            от {envelope.senderName} · осталось {formatCoinsCount(remaining)} 🪙
          </div>
        </div>
      </div>

      {envelope.note && (
        <div className="px-3 py-1.5 rounded-xl bg-black/25 border border-white/15 text-xs text-amber-100 italic">
          «{envelope.note}»
        </div>
      )}

      {myClaim ? (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/45 text-xs font-bold text-emerald-200 text-center tabular-nums">
          ✓ Вы забрали +{formatCoinsCount(myClaim.amount)} 🪙!
        </div>
      ) : check.canClaim && !claimedList.some(c => c && c.userId === currentUserId) ? (
        <button
          type="button"
          data-testid="coin-envelope-claim-btn"
          onClick={() => {
            if (claimedList.some(c => c && c.userId === currentUserId)) return;
            onClaimEnvelope?.(msgId, envelope);
          }}
          className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 tabular-nums"
        >
          <Coins className="w-4 h-4 shrink-0" />
          <span>Забрать долю (~{formatCoinsCount(check.amount)} 🪙)</span>
        </button>
      ) : (
        <div className="px-3 py-2 rounded-xl bg-black/30 text-xs text-white/75 text-center font-semibold">
          Все монеты в конверте уже разобрали
        </div>
      )}

      {claimedList.length > 0 && (
        <div className="pt-1.5 border-t border-white/15 space-y-1">
          {claimedList.slice(0, 4).map((c) => (
            <div key={c.userId} className="flex items-center justify-between text-[11px] text-amber-100/90 tabular-nums">
              <span className="truncate">{c.userName}</span>
              <span className="font-bold">+{formatCoinsCount(c.amount)} 🪙</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const TradeOfferCard: React.FC<{
  msgId: string;
  offer: TradeOfferData;
  currentUserId: string;
  onRespondTrade?: (msgId: string, offer: TradeOfferData, decision: 'accepted' | 'declined') => void;
}> = ({ msgId, offer, currentUserId, onRespondTrade }) => {
  const isRecipient = offer.recipientId === currentUserId;
  const isPending = offer.status === 'pending';

  return (
    <div
      data-testid="trade-offer-card"
      className="w-full max-w-[292px] sm:max-w-[320px] rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border border-indigo-400/50 p-3 sm:p-3.5 text-white shadow-xl space-y-2.5 my-1"
    >
      <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-indigo-200">
        <span className="flex items-center gap-1.5">
          <Repeat className="w-3.5 h-3.5" /> Предложение обмена
        </span>
        <span className="text-[11px]">
          {offer.status === 'accepted' ? '✅ Принято' : offer.status === 'declined' ? '✕ Отклонено' : '⏳ Ожидает'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="p-2 rounded-xl bg-black/30 border border-white/10">
          <div className="text-[10px] text-slate-400 truncate">{offer.proposerName} даёт</div>
          <div className="text-2xl my-1">{offer.proposerGift.emoji}</div>
          <div className="font-bold truncate">{offer.proposerGift.title}</div>
          <div className="text-[10px] text-amber-300 tabular-nums">
            {offer.proposerGift.serialNumber ? `#${offer.proposerGift.serialNumber} · ` : ''}
            {offer.proposerGift.starsCost} ⭐
          </div>
        </div>
        <div className="p-2 rounded-xl bg-black/30 border border-white/10">
          <div className="text-[10px] text-slate-400 truncate">За подарок {offer.recipientName}</div>
          <div className="text-2xl my-1">{offer.recipientGift.emoji}</div>
          <div className="font-bold truncate">{offer.recipientGift.title}</div>
          <div className="text-[10px] text-amber-300 tabular-nums">
            {offer.recipientGift.serialNumber ? `#${offer.recipientGift.serialNumber} · ` : ''}
            {offer.recipientGift.starsCost} ⭐
          </div>
        </div>
      </div>

      {offer.note && (
        <div className="text-[11px] text-indigo-100/90 italic px-2.5 py-1.5 rounded-xl bg-black/25">
          «{offer.note}»
        </div>
      )}

      {isPending && isRecipient && onRespondTrade && (
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            data-testid="trade-offer-accept-btn"
            onClick={() => onRespondTrade(msgId, offer, 'accepted')}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Принять</span>
          </button>
          <button
            type="button"
            data-testid="trade-offer-decline-btn"
            onClick={() => onRespondTrade(msgId, offer, 'declined')}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Отклонить</span>
          </button>
        </div>
      )}
    </div>
  );
};
