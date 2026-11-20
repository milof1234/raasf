import React from 'react';
import { CatMood, CatOutfit, CatSkinId } from '../utils/catGameLogic';

interface CatSpriteProps {
  mood: CatMood;
  outfit: CatOutfit;
  isStarving: boolean;
  skin?: CatSkinId;
  isBlinking?: boolean;
  isDancing?: boolean;
}

export const CatSprite: React.FC<CatSpriteProps> = ({
  mood,
  outfit,
  isStarving,
  skin = 'ginger',
  isBlinking = false,
  isDancing = false
}) => {
  const isAngry = mood === 'angry' || mood === 'angry_purr';
  const isAngryPurr = mood === 'angry_purr';
  const isSad = mood === 'sad' || mood === 'sad_purr' || mood === 'crying';
  const isPurringHappy = mood === 'purring';

  const skinColors = {
    ginger: {
      body: '#FDBA74',
      tail: '#FB923C',
      stripes: '#EA580C',
      belly: '#FFF7ED',
      paws: '#FED7AA'
    },
    tabby: {
      body: '#94A3B8',
      tail: '#64748B',
      stripes: '#334155',
      belly: '#F1F5F9',
      paws: '#CBD5E1'
    },
    alien: {
      body: '#38BDF8',
      tail: '#0284C7',
      stripes: '#8B5CF6',
      belly: '#E0F2FE',
      paws: '#BAE6FD'
    },
    cyber: {
      body: '#FACC15',
      tail: '#EAB308',
      stripes: '#D97706',
      belly: '#FEF9C3',
      paws: '#FEF08A'
    },
    panda: {
      body: '#F8FAFC',
      tail: '#E2E8F0',
      stripes: '#1E293B',
      belly: '#FFFFFF',
      paws: '#E2E8F0'
    }
  }[skin];

  const ariaLabel =
    mood === 'angry_purr'
      ? 'Злой котик ворчливо мурлычет'
      : mood === 'angry'
      ? 'Злой котик хмурится'
      : mood === 'sad_purr'
      ? 'Грустный котик жалобно мурлычет'
      : mood === 'crying' || mood === 'sad'
      ? 'Грустный котик плачет'
      : mood === 'purring'
      ? 'Довольный котик мурлычет'
      : 'Милый котик ждёт поглаживания';

  return (
    <svg
      viewBox="0 0 240 240"
      className={`w-full h-full drop-shadow-[0_8px_0_rgba(41,37,36,0.14)] pointer-events-none ${
        isDancing ? 'animate-bounce' : ''
      }`}
      aria-label={ariaLabel}
    >
      {/* Tail */}
      <g className={isStarving || isSad ? '' : 'animate-cat-tail'}>
        <path
          d={
            isStarving || isSad
              ? 'M162 184 C192 188, 206 198, 212 186 C217 176, 202 169, 195 178 C189 185, 174 176, 162 174 Z'
              : 'M160 182 C196 178, 216 146, 205 124 C198 112, 182 119, 187 132 C192 146, 180 166, 158 170 Z'
          }
          fill={skinColors.tail}
          stroke="#292524"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Cat Body + Head Group */}
      <g className="animate-cat-breathe">
        {/* Chubby Body */}
        <path
          d="M66 196 C62 150, 82 126, 120 126 C158 126, 178 150, 174 196 C173 206, 162 212, 120 212 C78 212, 67 206, 66 196 Z"
          fill={skinColors.body}
          stroke="#292524"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />

        {/* Belly Patch */}
        {outfit.top === 'none' && <ellipse cx="120" cy="176" rx="30" ry="26" fill={skinColors.belly} />}

        {/* Outfit: Top Clothing */}
        {outfit.top === 'hoodie' && (
          <g data-testid="cat-outfit-top-hoodie">
            <path
              d="M66 196 C62 150, 82 128, 120 128 C158 128, 178 150, 174 196 C173 206, 162 212, 120 212 C78 212, 67 206, 66 196 Z"
              fill="#3B82F6"
              stroke="#292524"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            {/* Hoodie Pocket */}
            <path
              d="M94 178 H146 L151 200 H89 Z"
              fill="#2563EB"
              stroke="#292524"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {/* Hoodie Drawstrings */}
            <line x1="110" y1="146" x2="108" y2="168" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
            <line x1="130" y1="146" x2="132" y2="168" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="108" cy="170" r="2.6" fill="#FFFFFF" stroke="#292524" strokeWidth="1.6" />
            <circle cx="132" cy="170" r="2.6" fill="#FFFFFF" stroke="#292524" strokeWidth="1.6" />
          </g>
        )}

        {outfit.top === 'suit' && (
          <g data-testid="cat-outfit-top-suit">
            <path
              d="M66 196 C62 150, 82 128, 120 128 C158 128, 178 150, 174 196 C173 206, 162 212, 120 212 C78 212, 67 206, 66 196 Z"
              fill="#1E293B"
              stroke="#292524"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            {/* White Shirt V */}
            <polygon points="102,132 138,132 120,188" fill="#F8FAFC" stroke="#292524" strokeWidth="3" strokeLinejoin="round" />
            {/* Red Tie */}
            <polygon points="116,142 124,142 126,174 120,185 114,174" fill="#EF4444" stroke="#292524" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Suit Buttons */}
            <circle cx="120" cy="197" r="2.5" fill="#94A3B8" />
          </g>
        )}

        {outfit.top === 'sweater' && (
          <g data-testid="cat-outfit-top-sweater">
            <path
              d="M66 196 C62 150, 82 128, 120 128 C158 128, 178 150, 174 196 C173 206, 162 212, 120 212 C78 212, 67 206, 66 196 Z"
              fill="#E11D48"
              stroke="#292524"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            {/* Cozy Stripes */}
            <path d="M69 162 Q120 172 171 162" fill="none" stroke="#FDE047" strokeWidth="6" />
            <path d="M67 182 Q120 192 173 182" fill="none" stroke="#FDA4AF" strokeWidth="5.5" />
            {/* Ribbed Neckband */}
            <path d="M84 134 Q120 148 156 134" fill="none" stroke="#9F1239" strokeWidth="7" strokeLinecap="round" />
          </g>
        )}

        {/* Front Paws */}
        <ellipse cx="94" cy="204" rx="14" ry="10" fill={skinColors.paws} stroke="#292524" strokeWidth="4" />
        <ellipse cx="146" cy="204" rx="14" ry="10" fill={skinColors.paws} stroke="#292524" strokeWidth="4" />

        {/* Left Ear */}
        <path
          d={isAngry ? 'M64 84 L44 42 L98 56 Z' : 'M64 82 L54 32 L98 56 Z'}
          fill={skinColors.tail}
          stroke="#292524"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <path d={isAngry ? 'M67 76 L54 51 L88 60 Z' : 'M68 74 L63 45 L89 60 Z'} fill="#FDA4AF" />

        {/* Right Ear */}
        <path
          d={isAngry ? 'M176 84 L196 42 L142 56 Z' : 'M176 82 L186 32 L142 56 Z'}
          fill={skinColors.tail}
          stroke="#292524"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <path d={isAngry ? 'M173 76 L186 51 L152 60 Z' : 'M172 74 L177 45 L151 60 Z'} fill="#FDA4AF" />

        {/* Head */}
        <ellipse cx="120" cy="96" rx="64" ry="52" fill={skinColors.body} stroke="#292524" strokeWidth="4.5" />

        {/* Forehead Stripes */}
        <path d="M120 46 V60" stroke={skinColors.stripes} strokeWidth="5" strokeLinecap="round" />
        <path d="M104 49 L109 61" stroke={skinColors.stripes} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M136 49 L131 61" stroke={skinColors.stripes} strokeWidth="4.5" strokeLinecap="round" />

        {/* Cheek Blushes */}
        <ellipse
          cx="78"
          cy="108"
          rx="11"
          ry="6.5"
          fill={isAngry ? '#FB7185' : '#FDA4AF'}
          opacity={isPurringHappy || isAngry ? '0.9' : '0.6'}
        />
        <ellipse
          cx="162"
          cy="108"
          rx="11"
          ry="6.5"
          fill={isAngry ? '#FB7185' : '#FDA4AF'}
          opacity={isPurringHappy || isAngry ? '0.9' : '0.6'}
        />

        {/* Eyes by Mood / Blinking */}
        {isBlinking ? (
          <g>
            <path d="M80 96 Q92 90 104 96" fill="none" stroke="#292524" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M136 96 Q148 90 160 96" fill="none" stroke="#292524" strokeWidth="4.2" strokeLinecap="round" />
          </g>
        ) : isAngryPurr ? (
          <g>
            {/* Grumpy Squinting Brows + Tight Eyes */}
            <path d="M77 77 L105 88" stroke="#292524" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M163 77 L135 88" stroke="#292524" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M80 94 L103 97 L82 101" fill="none" stroke="#292524" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M160 94 L137 97 L158 101" fill="none" stroke="#292524" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M46 76 Q40 86 46 96" fill="none" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M194 76 Q200 86 194 96" fill="none" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        ) : isAngry ? (
          <g>
            {/* Sharp Angry Furrowed V-Brows */}
            <path d="M76 76 L106 89" stroke="#292524" strokeWidth="5" strokeLinecap="round" />
            <path d="M164 76 L134 89" stroke="#292524" strokeWidth="5" strokeLinecap="round" />
            {/* Glaring Half-Lid Eyes */}
            <circle cx="92" cy="96" r="9.5" fill="#292524" />
            <circle cx="148" cy="96" r="9.5" fill="#292524" />
            <circle cx="90" cy="94" r="3" fill="#FEF08A" />
            <circle cx="146" cy="94" r="3" fill="#FEF08A" />
            {/* Anger Comic Vein Mark */}
            <g stroke="#EF4444" strokeWidth="3" strokeLinecap="round" fill="none">
              <path d="M164 56 Q168 62 162 66" />
              <path d="M174 58 Q169 64 174 69" />
              <path d="M160 69 Q166 67 170 72" />
              <path d="M175 56 Q170 59 165 55" />
            </g>
          </g>
        ) : isPurringHappy ? (
          <g>
            <path d="M80 94 Q92 80 104 94" fill="none" stroke="#292524" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M136 94 Q148 80 160 94" fill="none" stroke="#292524" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M46 76 Q40 86 46 96" fill="none" stroke="#FB7185" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M194 76 Q200 86 194 96" fill="none" stroke="#FB7185" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        ) : mood === 'sad_purr' ? (
          <g>
            <path d="M78 80 L102 86" stroke="#292524" strokeWidth="3.8" strokeLinecap="round" />
            <path d="M162 80 L138 86" stroke="#292524" strokeWidth="3.8" strokeLinecap="round" />
            <path d="M80 96 Q92 88 104 96" fill="none" stroke="#292524" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M136 96 Q148 88 160 96" fill="none" stroke="#292524" strokeWidth="4.2" strokeLinecap="round" />
            <g className="animate-cat-tear">
              <path d="M86 104 C82 111, 81 116, 86 118 C91 116, 90 111, 86 104 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.5" />
              <path d="M154 104 C150 111, 149 116, 154 118 C159 116, 158 111, 154 104 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.5" />
            </g>
            <path d="M47 78 Q42 87 47 96" fill="none" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
            <path d="M193 78 Q198 87 193 96" fill="none" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
          </g>
        ) : mood === 'crying' || mood === 'sad' ? (
          <g>
            <path d="M78 80 L102 87" stroke="#292524" strokeWidth="4" strokeLinecap="round" />
            <path d="M162 80 L138 87" stroke="#292524" strokeWidth="4" strokeLinecap="round" />
            <circle cx="92" cy="96" r="10.5" fill="#292524" />
            <circle cx="148" cy="96" r="10.5" fill="#292524" />
            <circle cx="88" cy="92" r="4" fill="#FFFFFF" />
            <circle cx="144" cy="92" r="4" fill="#FFFFFF" />
            <ellipse cx="92" cy="103" rx="6.5" ry="2.8" fill="#60A5FA" />
            <ellipse cx="148" cy="103" rx="6.5" ry="2.8" fill="#60A5FA" />
            <g className="animate-cat-tear">
              <path d="M86 108 C82 115, 81 120, 86 122 C91 120, 90 115, 86 108 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.6" />
              <path d="M154 108 C150 115, 149 120, 154 122 C159 120, 158 115, 154 108 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.6" />
            </g>
          </g>
        ) : (
          <g>
            <circle cx="92" cy="94" r="10" fill="#292524" />
            <circle cx="148" cy="94" r="10" fill="#292524" />
            <circle cx="88.5" cy="90" r="3.8" fill="#FFFFFF" />
            <circle cx="144.5" cy="90" r="3.8" fill="#FFFFFF" />
            <circle cx="95" cy="98" r="1.8" fill="#FFFFFF" />
            <circle cx="151" cy="98" r="1.8" fill="#FFFFFF" />
          </g>
        )}

        {/* Cute Pink Nose */}
        <polygon points="114,104 126,104 120,111" fill="#FB7185" stroke="#292524" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Mouth by Mood */}
        {isAngry ? (
          <g>
            <path d="M106 123 Q120 113 134 123" fill="none" stroke="#292524" strokeWidth="4" strokeLinecap="round" />
            {/* Tiny Cute Fang */}
            <polygon points="127,118 131,125 124,121" fill="#FFFFFF" stroke="#292524" strokeWidth="1.8" strokeLinejoin="round" />
          </g>
        ) : mood === 'crying' || mood === 'sad' ? (
          <path d="M107 122 Q120 112 133 122" fill="none" stroke="#292524" strokeWidth="3.8" strokeLinecap="round" />
        ) : mood === 'sad_purr' ? (
          <path d="M107 119 Q113 114 120 118 Q127 114 133 119" fill="none" stroke="#292524" strokeWidth="3.8" strokeLinecap="round" />
        ) : isPurringHappy ? (
          <g>
            <path d="M106 114 Q113 124 120 115 Q127 124 134 114" fill="none" stroke="#292524" strokeWidth="3.8" strokeLinecap="round" />
            <path d="M115 119 Q120 129 125 119 Z" fill="#FB7185" stroke="#292524" strokeWidth="2.5" />
          </g>
        ) : (
          <path d="M106 115 Q113 123 120 115 Q127 123 134 115" fill="none" stroke="#292524" strokeWidth="3.8" strokeLinecap="round" />
        )}

        {/* Whiskers */}
        <g stroke="#292524" strokeWidth="2.8" strokeLinecap="round">
          <line x1="46" y1="98" x2="68" y2="102" />
          <line x1="44" y1="110" x2="67" y2="110" />
          <line x1="172" y1="102" x2="194" y2="98" />
          <line x1="173" y1="110" x2="196" y2="110" />
        </g>

        {/* Neck Accessories (in front of lower chin) */}
        {outfit.neck === 'collar' && (
          <g data-testid="cat-outfit-neck-collar">
            <path d="M84 140 Q120 155 156 140" fill="none" stroke="#F43F5E" strokeWidth="8" strokeLinecap="round" />
            <path d="M84 140 Q120 155 156 140" fill="none" stroke="#292524" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="120" cy="153" r="7.5" fill="#FACC15" stroke="#292524" strokeWidth="3" />
          </g>
        )}

        {outfit.neck === 'scarf' && (
          <g data-testid="cat-outfit-neck-scarf">
            <path d="M134 145 L149 184 L131 187 L122 149 Z" fill="#10B981" stroke="#292524" strokeWidth="3.2" strokeLinejoin="round" />
            <path d="M132 164 L145 162" stroke="#FDE047" strokeWidth="4" />
            <path d="M80 137 Q120 156 160 137 Q162 149 120 160 Q78 149 80 137 Z" fill="#10B981" stroke="#292524" strokeWidth="3.5" strokeLinejoin="round" />
          </g>
        )}

        {outfit.neck === 'bowtie' && (
          <g data-testid="cat-outfit-neck-bowtie">
            <polygon points="99,144 117,153 99,162" fill="#EC4899" stroke="#292524" strokeWidth="3" strokeLinejoin="round" />
            <polygon points="141,144 123,153 141,162" fill="#EC4899" stroke="#292524" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="120" cy="153" r="5" fill="#F9A8D4" stroke="#292524" strokeWidth="2.8" />
          </g>
        )}

        {/* Outfit: Glasses */}
        {outfit.glasses === 'cool' && (
          <g data-testid="cat-outfit-glasses-cool">
            <rect x="73" y="84" width="38" height="22" rx="6" fill="#0F172A" stroke="#292524" strokeWidth="3.2" />
            <rect x="129" y="84" width="38" height="22" rx="6" fill="#0F172A" stroke="#292524" strokeWidth="3.2" />
            <line x1="111" y1="91" x2="129" y2="91" stroke="#292524" strokeWidth="3.5" />
            <line x1="60" y1="90" x2="73" y2="91" stroke="#292524" strokeWidth="3" />
            <line x1="167" y1="91" x2="180" y2="90" stroke="#292524" strokeWidth="3" />
            <line x1="80" y1="89" x2="88" y2="101" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
            <line x1="136" y1="89" x2="144" y2="101" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
          </g>
        )}

        {outfit.glasses === 'round' && (
          <g data-testid="cat-outfit-glasses-round">
            <circle cx="92" cy="95" r="16" fill="rgba(255,255,255,0.22)" stroke="#B45309" strokeWidth="3.5" />
            <circle cx="148" cy="95" r="16" fill="rgba(255,255,255,0.22)" stroke="#B45309" strokeWidth="3.5" />
            <path d="M108 94 Q120 89 132 94" fill="none" stroke="#B45309" strokeWidth="3.2" />
            <line x1="62" y1="93" x2="76" y2="94" stroke="#B45309" strokeWidth="2.8" />
            <line x1="164" y1="94" x2="178" y2="93" stroke="#B45309" strokeWidth="2.8" />
          </g>
        )}

        {outfit.glasses === 'star' && (
          <g data-testid="cat-outfit-glasses-star">
            <polygon
              points="92,76 97,88 110,88 100,96 104,109 92,101 80,109 84,96 74,88 87,88"
              fill="rgba(250, 204, 21, 0.38)"
              stroke="#D97706"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <polygon
              points="148,76 153,88 166,88 156,96 160,109 148,101 136,109 140,96 130,88 143,88"
              fill="rgba(250, 204, 21, 0.38)"
              stroke="#D97706"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <line x1="108" y1="92" x2="132" y2="92" stroke="#D97706" strokeWidth="3" />
          </g>
        )}

        {/* Outfit: Hats */}
        {outfit.hat === 'crown' && (
          <g data-testid="cat-outfit-hat-crown">
            <polygon
              points="88,52 84,22 104,38 120,16 136,38 156,22 152,52"
              fill="#FACC15"
              stroke="#292524"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <circle cx="120" cy="39" r="4" fill="#EF4444" stroke="#292524" strokeWidth="1.8" />
            <circle cx="99" cy="43" r="3" fill="#3B82F6" stroke="#292524" strokeWidth="1.5" />
            <circle cx="141" cy="43" r="3" fill="#10B981" stroke="#292524" strokeWidth="1.5" />
          </g>
        )}

        {outfit.hat === 'cap' && (
          <g data-testid="cat-outfit-hat-cap">
            <path d="M76 58 C78 26, 162 26, 164 58 Z" fill="#2563EB" stroke="#292524" strokeWidth="4" strokeLinejoin="round" />
            <path d="M72 58 Q128 50 184 62 Q156 68 72 58 Z" fill="#1D4ED8" stroke="#292524" strokeWidth="3.8" strokeLinejoin="round" />
            <circle cx="120" cy="42" r="6" fill="#FFFFFF" stroke="#292524" strokeWidth="2.2" />
          </g>
        )}

        {outfit.hat === 'beanie' && (
          <g data-testid="cat-outfit-hat-beanie">
            <circle cx="120" cy="21" r="9" fill="#FDE047" stroke="#292524" strokeWidth="3.5" />
            <path d="M76 56 C78 24, 162 24, 164 56 Z" fill="#EC4899" stroke="#292524" strokeWidth="4" strokeLinejoin="round" />
            <rect x="72" y="48" width="96" height="14" rx="7" fill="#DB2777" stroke="#292524" strokeWidth="3.8" />
            <line x1="94" y1="49" x2="94" y2="61" stroke="#292524" strokeWidth="2.5" />
            <line x1="120" y1="49" x2="120" y2="61" stroke="#292524" strokeWidth="2.5" />
            <line x1="146" y1="49" x2="146" y2="61" stroke="#292524" strokeWidth="2.5" />
          </g>
        )}

        {outfit.hat === 'wizard' && (
          <g data-testid="cat-outfit-hat-wizard">
            <ellipse cx="120" cy="54" rx="58" ry="10" fill="#4338CA" stroke="#292524" strokeWidth="4" />
            <path d="M84 52 L116 8 L138 22 L156 52 Z" fill="#4F46E5" stroke="#292524" strokeWidth="4" strokeLinejoin="round" />
            <path d="M90 48 Q120 53 150 48" fill="none" stroke="#FACC15" strokeWidth="5" />
            <polygon points="122,26 124,31 129,31 125,34 126,39 122,36 118,39 119,34 115,31 120,31" fill="#FDE047" />
          </g>
        )}
      </g>
    </svg>
  );
};
