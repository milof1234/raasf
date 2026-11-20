import React, { useEffect, useRef } from 'react';

interface BeeSwarmOverlayProps {
  isActive: boolean;
}

interface BeeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  speed: number;
  turnTimer: number;
}

const BEE_COUNT = 18;

export const BeeSwarmOverlay: React.FC<BeeSwarmOverlayProps> = ({ isActive }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const beeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!isActive) return;

    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 800;

    const bees: BeeState[] = Array.from({ length: BEE_COUNT }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.6 + Math.random() * 2.2;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 26 + (i % 4) * 5 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
        speed,
        turnTimer: 30 + Math.floor(Math.random() * 90)
      };
    });

    let rafId = 0;
    let tick = 0;

    const animate = () => {
      tick += 1;
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 800;

      bees.forEach((bee, idx) => {
        bee.turnTimer -= 1;
        if (bee.turnTimer <= 0) {
          const currentAngle = Math.atan2(bee.vy, bee.vx);
          const delta = (Math.random() - 0.5) * 1.6;
          const nextAngle = currentAngle + delta;
          bee.vx = Math.cos(nextAngle) * bee.speed;
          bee.vy = Math.sin(nextAngle) * bee.speed;
          bee.turnTimer = 25 + Math.floor(Math.random() * 75);
        }

        // Gentle buzzing wave perpendicular to motion
        const buzzY = Math.sin(tick * 0.16 + bee.phase) * 0.9;
        const buzzX = Math.cos(tick * 0.12 + bee.phase) * 0.4;

        bee.x += bee.vx + buzzX;
        bee.y += bee.vy + buzzY;

        // Soft wrap-around edges
        const pad = 60;
        if (bee.x < -pad) bee.x = w + pad;
        if (bee.x > w + pad) bee.x = -pad;
        if (bee.y < -pad) bee.y = h + pad;
        if (bee.y > h + pad) bee.y = -pad;

        const el = beeRefs.current[idx];
        if (el) {
          const facingRight = bee.vx >= 0 ? 1 : -1;
          const tiltDeg = Math.max(-18, Math.min(18, bee.vy * 5)) * facingRight;
          el.style.transform = `translate3d(${bee.x.toFixed(1)}px, ${bee.y.toFixed(1)}px, 0) scaleX(${facingRight}) rotate(${tiltDeg.toFixed(1)}deg)`;
        }
      });

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      ref={containerRef}
      aria-label="Летающие пчёлы"
      data-testid="bee-swarm-overlay"
      className="fixed inset-0 z-40 pointer-events-none overflow-hidden select-none"
    >
      {Array.from({ length: BEE_COUNT }).map((_, idx) => {
        const size = 28 + (idx % 4) * 5;
        return (
          <div
            key={idx}
            ref={(el) => {
              beeRefs.current[idx] = el;
            }}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              willChange: 'transform'
            }}
            className="absolute top-0 left-0 drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
          >
            <svg viewBox="0 0 64 64" className="w-full h-full overflow-visible">
              {/* Back wing */}
              <ellipse
                cx="26"
                cy="18"
                rx="11"
                ry="7"
                transform="rotate(-25 26 18)"
                fill="rgba(224, 242, 254, 0.85)"
                stroke="#bae6fd"
                strokeWidth="1.5"
                className="animate-bee-wing-back"
              />
              {/* Stinger */}
              <polygon points="8,36 16,33 16,39" fill="#1e293b" />
              {/* Body */}
              <ellipse cx="32" cy="36" rx="18" ry="12" fill="#facc15" stroke="#1e293b" strokeWidth="2.5" />
              {/* Stripes */}
              <path d="M23 25.5 C21 32, 21 40, 23 46.5" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" fill="none" />
              <path d="M32 24.5 C30 32, 30 40, 32 47.5" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" fill="none" />
              {/* Front wing */}
              <ellipse
                cx="34"
                cy="19"
                rx="12"
                ry="7.5"
                transform="rotate(-12 34 19)"
                fill="rgba(255, 255, 255, 0.9)"
                stroke="#e0f2fe"
                strokeWidth="1.5"
                className="animate-bee-wing-front"
              />
              {/* Head & Eyes */}
              <circle cx="48" cy="34" r="8" fill="#1e293b" />
              <circle cx="51" cy="32" r="2.2" fill="#ffffff" />
              <circle cx="51.6" cy="32" r="1" fill="#0f172a" />
              {/* Antennae */}
              <path d="M51 27 Q54 20 58 21" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M47 26 Q48 19 52 19" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        );
      })}
    </div>
  );
};
