import React, { useEffect, useState } from 'react';

export interface CelebrationEvent {
  id: string;
  title: string;
  emoji: string;
  subtitle?: string;
}

interface CelebrationOverlayProps {
  event: CelebrationEvent | null;
  onDone: () => void;
}

const PARTICLE_OFFSETS = [
  { x: -160, y: -120, r: -25, d: 0 },
  { x: 140, y: -140, r: 30, d: 60 },
  { x: -210, y: -40, r: -45, d: 110 },
  { x: 200, y: -30, r: 40, d: 80 },
  { x: -110, y: 120, r: -15, d: 140 },
  { x: 130, y: 110, r: 22, d: 100 },
  { x: 0, y: -180, r: 12, d: 40 },
  { x: -70, y: -170, r: -18, d: 90 },
  { x: 85, y: -165, r: 25, d: 130 },
  { x: -240, y: 70, r: -35, d: 70 },
  { x: 230, y: 80, r: 35, d: 120 },
  { x: 0, y: 150, r: 10, d: 50 }
];

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({ event, onDone }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!event) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, 2400);
    return () => clearTimeout(timer);
  }, [event, onDone]);

  if (!event || !visible) return null;

  const symbols = [event.emoji || '✨', '⭐', '✨', '🎉', event.emoji || '🌟', '💫'];

  return (
    <div
      data-testid="celebration-overlay"
      aria-live="polite"
      className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center overflow-hidden"
    >
      <div className="relative flex items-center justify-center">
        {PARTICLE_OFFSETS.map((p, idx) => (
          <span
            key={`${event.id}_${idx}`}
            style={{
              transform: `translate(${p.x}px, ${p.y}px) rotate(${p.r}deg)`,
              transitionDelay: `${p.d}ms`
            }}
            className="absolute text-3xl sm:text-4xl animate-bounce select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          >
            {symbols[idx % symbols.length]}
          </span>
        ))}

        <div className="px-6 py-4 rounded-2xl bg-slate-950/90 border border-amber-400/50 shadow-2xl text-center backdrop-blur-md animate-fade-in">
          <div className="text-4xl mb-1">{event.emoji}</div>
          <div className="text-sm font-black text-amber-200">{event.title}</div>
          {event.subtitle && (
            <div className="text-xs text-slate-300 mt-0.5">{event.subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
};
