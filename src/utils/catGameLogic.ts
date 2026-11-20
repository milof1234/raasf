export const PET_STROKE_THRESHOLD_PX = 90;
export const COINS_PER_PET = 4;
export const HUNGRY_COINS_PER_PET = 2;
export const FEED_COST = 500;
export const FEED_HUNGER_RESTORE = 100;
export const HUNGER_DECAY_PER_SEC = 1.3;
export const PET_COOLDOWN_MS = 180;
export const INITIAL_COINS = 10;
export const INITIAL_HUNGER = 75;

export type CatMood = 'idle' | 'purring' | 'crying' | 'sad_purr' | 'angry' | 'angry_purr' | 'sad';
export type CatPersonalityMood = 'normal' | 'angry' | 'sad';

export type CatHatId = 'none' | 'cap' | 'crown' | 'beanie' | 'wizard';
export type CatGlassesId = 'none' | 'cool' | 'round' | 'star';
export type CatTopId = 'none' | 'hoodie' | 'suit' | 'sweater';
export type CatNeckId = 'collar' | 'scarf' | 'bowtie' | 'none';
export type CatBackgroundId = 'cozy' | 'space' | 'cyber' | 'garden' | 'night';
export type CatSkinId = 'ginger' | 'tabby' | 'alien' | 'cyber' | 'panda';

export interface CatOutfit {
  hat: CatHatId;
  glasses: CatGlassesId;
  top: CatTopId;
  neck: CatNeckId;
}

export interface CatCustomization {
  personality: CatPersonalityMood;
  outfit: CatOutfit;
  background: CatBackgroundId;
  skin: CatSkinId;
}

export const DEFAULT_CAT_CUSTOMIZATION: CatCustomization = {
  personality: 'normal',
  outfit: {
    hat: 'none',
    glasses: 'none',
    top: 'none',
    neck: 'collar'
  },
  background: 'cozy',
  skin: 'ginger'
};

export const CAT_PERSONALITY_OPTIONS: ReadonlyArray<{
  id: CatPersonalityMood;
  label: string;
  emoji: string;
  description: string;
}> = [
  { id: 'normal', label: 'Милый', emoji: '😸', description: 'Ласковый и игривый' },
  { id: 'angry', label: 'Злой', emoji: '😾', description: 'Ворчливый, но добрый внутри' },
  { id: 'sad', label: 'Грустный', emoji: '😿', description: 'Нежный и мечтательный' }
];

export const CAT_HAT_OPTIONS: ReadonlyArray<{ id: CatHatId; label: string; emoji: string }> = [
  { id: 'none', label: 'Нет', emoji: '🚫' },
  { id: 'cap', label: 'Кепка', emoji: '🧢' },
  { id: 'crown', label: 'Корона', emoji: '👑' },
  { id: 'beanie', label: 'Шапка', emoji: '🧶' },
  { id: 'wizard', label: 'Маг', emoji: '🧙' }
];

export const CAT_GLASSES_OPTIONS: ReadonlyArray<{ id: CatGlassesId; label: string; emoji: string }> = [
  { id: 'none', label: 'Нет', emoji: '🚫' },
  { id: 'cool', label: 'Тёмные', emoji: '🕶️' },
  { id: 'round', label: 'Умные', emoji: '🤓' },
  { id: 'star', label: 'Звёзды', emoji: '⭐' }
];

export const CAT_TOP_OPTIONS: ReadonlyArray<{ id: CatTopId; label: string; emoji: string }> = [
  { id: 'none', label: 'Без верха', emoji: '🚫' },
  { id: 'hoodie', label: 'Худи', emoji: '🧥' },
  { id: 'suit', label: 'Костюм', emoji: '👔' },
  { id: 'sweater', label: 'Свитер', emoji: '🧣' }
];

export const CAT_NECK_OPTIONS: ReadonlyArray<{ id: CatNeckId; label: string; emoji: string }> = [
  { id: 'collar', label: 'Бубенчик', emoji: '🔔' },
  { id: 'scarf', label: 'Шарф', emoji: '🧣' },
  { id: 'bowtie', label: 'Бабочка', emoji: '🎀' },
  { id: 'none', label: 'Нет', emoji: '🚫' }
];

export const CAT_BACKGROUND_OPTIONS: ReadonlyArray<{ id: CatBackgroundId; label: string; emoji: string }> = [
  { id: 'cozy', label: 'Уютная комната', emoji: '🏠' },
  { id: 'space', label: 'Космос', emoji: '🚀' },
  { id: 'cyber', label: 'Киберпанк', emoji: '🌃' },
  { id: 'garden', label: 'Лужайка', emoji: '☀️' },
  { id: 'night', label: 'Звёздная ночь', emoji: '🌌' }
];

export const CAT_SKIN_OPTIONS: ReadonlyArray<{ id: CatSkinId; label: string; emoji: string }> = [
  { id: 'ginger', label: 'Рыжий', emoji: '🐈' },
  { id: 'tabby', label: 'Табби', emoji: '🐅' },
  { id: 'alien', label: 'Инопланетянин', emoji: '👽' },
  { id: 'cyber', label: 'Кибер-кот', emoji: '🤖' },
  { id: 'panda', label: 'Панда-кот', emoji: '🐼' }
];

export function sanitizeCatCustomization(raw: unknown): CatCustomization {
  const fallback = {
    personality: DEFAULT_CAT_CUSTOMIZATION.personality,
    outfit: { ...DEFAULT_CAT_CUSTOMIZATION.outfit },
    background: DEFAULT_CAT_CUSTOMIZATION.background,
    skin: DEFAULT_CAT_CUSTOMIZATION.skin
  };
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;

  const personality: CatPersonalityMood =
    obj.personality === 'angry' || obj.personality === 'sad' || obj.personality === 'normal'
      ? obj.personality
      : 'normal';

  const rawOutfit = (obj.outfit && typeof obj.outfit === 'object' ? obj.outfit : {}) as Record<string, unknown>;
  const hat: CatHatId = CAT_HAT_OPTIONS.some(o => o.id === rawOutfit.hat)
    ? (rawOutfit.hat as CatHatId)
    : 'none';
  const glasses: CatGlassesId = CAT_GLASSES_OPTIONS.some(o => o.id === rawOutfit.glasses)
    ? (rawOutfit.glasses as CatGlassesId)
    : 'none';
  const top: CatTopId = CAT_TOP_OPTIONS.some(o => o.id === rawOutfit.top)
    ? (rawOutfit.top as CatTopId)
    : 'none';
  const neck: CatNeckId = CAT_NECK_OPTIONS.some(o => o.id === rawOutfit.neck)
    ? (rawOutfit.neck as CatNeckId)
    : 'collar';

  const background: CatBackgroundId = CAT_BACKGROUND_OPTIONS.some(o => o.id === obj.background)
    ? (obj.background as CatBackgroundId)
    : 'cozy';

  const skin: CatSkinId = CAT_SKIN_OPTIONS.some(o => o.id === obj.skin)
    ? (obj.skin as CatSkinId)
    : 'ginger';

  return {
    personality,
    outfit: { hat, glasses, top, neck },
    background,
    skin
  };
}

export function getCatMood(hunger: number, isPurring: boolean): CatMood {
  if (hunger <= 0) {
    return isPurring ? 'sad_purr' : 'crying';
  }
  if (isPurring) return 'purring';
  return 'idle';
}

export function getEffectiveCatMood(
  hunger: number,
  isPurring: boolean,
  personality: CatPersonalityMood = 'normal'
): CatMood {
  if (personality === 'angry') {
    return isPurring ? 'angry_purr' : 'angry';
  }
  if (personality === 'sad') {
    return isPurring ? 'sad_purr' : 'sad';
  }
  return getCatMood(hunger, isPurring);
}

export function decayHunger(currentHunger: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) return Math.max(0, Math.min(100, currentHunger));
  const next = currentHunger - HUNGER_DECAY_PER_SEC * deltaSeconds;
  return Math.max(0, Math.min(100, next));
}

export interface StrokeStepResult {
  nextAccumulatedPx: number;
  petCompleted: boolean;
  isHungryPurr: boolean;
  coinsEarned: number;
  nextLastPetTimeMs: number;
}

export function evaluatePetStroke(params: {
  accumulatedPx: number;
  stepDistancePx: number;
  hunger: number;
  nowMs: number;
  lastPetTimeMs: number;
}): StrokeStepResult {
  const { accumulatedPx, stepDistancePx, hunger, nowMs, lastPetTimeMs } = params;
  const clampedStep = Math.max(0, Math.min(stepDistancePx, 80));
  const total = accumulatedPx + clampedStep;

  if (total < PET_STROKE_THRESHOLD_PX) {
    return {
      nextAccumulatedPx: total,
      petCompleted: false,
      isHungryPurr: false,
      coinsEarned: 0,
      nextLastPetTimeMs: lastPetTimeMs
    };
  }

  if (nowMs - lastPetTimeMs < PET_COOLDOWN_MS) {
    return {
      nextAccumulatedPx: total % PET_STROKE_THRESHOLD_PX,
      petCompleted: false,
      isHungryPurr: false,
      coinsEarned: 0,
      nextLastPetTimeMs: lastPetTimeMs
    };
  }

  const isHungry = hunger <= 0;
  return {
    nextAccumulatedPx: 0,
    petCompleted: true,
    isHungryPurr: isHungry,
    coinsEarned: isHungry ? HUNGRY_COINS_PER_PET : COINS_PER_PET,
    nextLastPetTimeMs: nowMs
  };
}

export interface FeedResult {
  fed: boolean;
  reason?: 'full' | 'insufficient_coins';
  nextCoins: number;
  nextHunger: number;
  costPaid: number;
}

export function feedCat(coins: number, hunger: number): FeedResult {
  if (hunger >= 100) {
    return {
      fed: false,
      reason: 'full',
      nextCoins: coins,
      nextHunger: 100,
      costPaid: 0
    };
  }

  if (coins < FEED_COST) {
    return {
      fed: false,
      reason: 'insufficient_coins',
      nextCoins: coins,
      nextHunger: hunger,
      costPaid: 0
    };
  }

  return {
    fed: true,
    nextCoins: coins - FEED_COST,
    nextHunger: 100,
    costPaid: FEED_COST
  };
}

const SUPPORT_REPLIES = {
  sad: [
    'Мур-р... Иди ко мне, я тихонько свернусь у тебя на коленях. Ты не один, всё обязательно наладится ❤️',
    'Обнимаю тебя мягкими лапками! Даже самые серые тучи уходят, а я побуду рядом и помурлычу для тебя 🐾',
    'Мне жаль, что тебе грустно... Можно просто посидеть вместе в тишине. Ты очень важен и заслуживаешь тепла 💛'
  ],
  tired: [
    'Ты так много старался сегодня... Пора отдохнуть, выпить тёплого чая и просто полежать. Я посторожу твой покой, мур 💤',
    'Лапки тоже устают! Не ругай себя за усталость — дай себе передышку, а я помурлычу рядом 🌙',
    'Давай сделаем паузу. Закрой глаза на минутку, выдохни — ты уже молодец 🐾'
  ],
  anxious: [
    'Дыши глубже, я рядом. Вдох... выдох... Слышишь, как я мурлычу? Мы справимся со всем шаг за шагом 🌿',
    'Не бойся, всё под контролем. Я сижу прямо тут и отгоняю все тревоги хвостом! Ты сильнее, чем кажется 💙',
    'Мур-р... Не нужно решать всё сразу. Сделай один маленький шаг или просто погладь меня, чтобы стало спокойнее 🐾'
  ],
  lonely: [
    'Эй, а как же я? Я всегда рад тебя видеть! Ты никогда не один, пока у тебя есть твой пушистый друг 💖',
    'Я прыгаю к тебе на ручки! Пусть в мире порой тихо, но моё мурлыканье всегда с тобой 🤗',
    'Ты удивительный и хороший человек. Мне с тобой очень уютно, мур-р! 💛'
  ],
  angry: [
    'Фыр-р! Понимаю, иногда хочется просто поцарапать когтеточку! Выпусти пар — я полностью на твоей стороне 🐾',
    'Имеешь полное право злиться. Глубокий вдох, я рядом и никуда не уйду, пока тебе не станет легче 🧡',
    'Хр-р... Давай вместе поворчим на всё, что тебя расстроило, а потом станет чуточку легче!'
  ],
  happy: [
    'Мяу-ура!! Я так за тебя рад! Давай погладимся и отпразднуем это мурлыканьем! ✨',
    'Вот это новости! У меня даже хвостик закрутился от радости! Так держать 🎉',
    'Мур-мур! Пусть таких светлых моментов у тебя будет как можно больше! 🌟'
  ],
  affection: [
    'Мур-мур-мур! И я тебя очень люблю! Ты самый добрый и лучший друг на свете 💕',
    'Ой, у меня даже ушки покраснели! Спасибо тебе за тепло и ласку 🐾',
    'Ты делаешь мой мир ярче каждый раз, когда заходишь ко мне! Мур 💖'
  ],
  greeting: [
    'Мяу! Привет-привет! Как ты себя чувствуешь? Я всегда готов тебя выслушать и поддержать 🐱',
    'Привет! Я как раз ждал тебя на тёплом коврике. Расскажи, как проходит твой день? ☀️',
    'Мур! Рад тебя видеть! Если хочешь поболтать или просто отдохнуть — я весь во внимании 🐾'
  ],
  default: [
    'Мур... Я внимательно тебя слушаю. Знай, что ты молодец и у тебя всё получится! Я рядом 🐾',
    'Спасибо, что поделился со мной! Верю в тебя всем своим кошачьим сердечком 💛',
    'Мяу! Чтобы ни происходило, помни: ты справляешься лучше, чем думаешь. Погладь меня, станет теплее ✨'
  ]
};

const PERSONALITY_OFFLINE_REPLIES: Record<'angry' | 'sad', string[]> = {
  angry: [
    'Фыр-р! Чего шумишь? Ладно, рассказывай, кто тебя там взбесил — сейчас всех расцарапаем! 😾',
    'Хр-р... Я вообще-то суровый кот, но для тебя так и быть — послушаю. Выкладывай! 🐾',
    'Мяу?! Не бузи! Лучше погладь меня и принеси вкусную рыбку, пока я добрый 💢'
  ],
  sad: [
    'Вздох... Я тихонько сижу на коврике и слушаю тебя. Мне тоже грустно, давай поддержим друг друга 😿',
    'Мяу... Знаешь, даже когда на душе пасмурно, рядом с тобой становится чуть теплее 💧',
    'Тихое мур... Расскажи мне всё, я никуда не уйду и буду рядом столько, сколько нужно 💙'
  ]
};

export function generateCatSupportReply(
  rawText: string,
  variantSeed = 0,
  personality: CatPersonalityMood = 'normal'
): string {
  const text = rawText.trim().toLowerCase();
  const pick = (arr: string[]) => arr[Math.abs(variantSeed) % arr.length];

  if (personality === 'angry' && !/(груст|печал|плохо|тоск|плач|устал|трево|боюсь)/.test(text)) {
    return pick(PERSONALITY_OFFLINE_REPLIES.angry);
  }
  if (personality === 'sad' && !/(ура|крут|счастл|выиграл|супер)/.test(text)) {
    return pick(PERSONALITY_OFFLINE_REPLIES.sad);
  }

  if (!text) return SUPPORT_REPLIES.greeting[0];

  if (/(груст|печал|плохо|тоск|плач|слёз|слез|тяжел|больн|депресс|уныл|sad|cry|depress)/.test(text)) {
    return pick(SUPPORT_REPLIES.sad);
  }
  if (/(устал|нет сил|сил нет|выгор|спать|утом|сонн|выдох|tired|exhaust)/.test(text)) {
    return pick(SUPPORT_REPLIES.tired);
  }
  if (/(трево|страш|волн|пережива|паник|боюсь|стресс|нерв|scared|anxi|worry)/.test(text)) {
    return pick(SUPPORT_REPLIES.anxious);
  }
  if (/(одинок|скучн|никому|брос|не нуж|lonely|alone)/.test(text)) {
    return pick(SUPPORT_REPLIES.lonely);
  }
  if (/(злюс|бесит|достал|обид|ненавиж|раздраж|ярост|angry|mad)/.test(text)) {
    return pick(SUPPORT_REPLIES.angry);
  }
  if (/(ура|крут|хорош|счастл|рад|получил|сдал|выиграл|класс|отличн|супер|happy|great)/.test(text)) {
    return pick(SUPPORT_REPLIES.happy);
  }
  if (/(любл|мил|красив|котик|молодец|обожа|хороший|love|cute)/.test(text)) {
    return pick(SUPPORT_REPLIES.affection);
  }
  if (/^(привет|здравств|хай|ку|добр|hello|hi)\b/.test(text)) {
    return pick(SUPPORT_REPLIES.greeting);
  }

  return pick(SUPPORT_REPLIES.default);
}
