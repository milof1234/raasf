export const PET_STROKE_THRESHOLD_PX = 90;
export const COINS_PER_PET = 4;
export const HUNGRY_COINS_PER_PET = 2;
export const FEED_COST = 500;
export const FEED_HUNGER_RESTORE = 100;
export const HUNGER_DECAY_PER_SEC = 1.3;
export const PET_COOLDOWN_MS = 180;
export const CLICK_COOLDOWN_MS = 70;
export const INITIAL_COINS = 10;
export const INITIAL_HUNGER = 75;

export const CAT_LEVEL_1_GOAL = 1000;
export const CAT_LEVEL_2_GOAL = 2000;
export const CAT_LEVEL_3_GOAL = 1000;
export const CAT_LEVEL_4_GOAL = 4000;
export const CAT_LEVEL_2_UNLOCK_SWIPES = CAT_LEVEL_1_GOAL; // 1000 swipes
export const CAT_LEVEL_3_UNLOCK_SWIPES = CAT_LEVEL_1_GOAL + CAT_LEVEL_2_GOAL; // 3000 swipes
export const CAT_LEVEL_4_UNLOCK_SWIPES = 4000; // 4000 swipes

export type CatLevel = 1 | 2 | 3 | 4;

export type CatMood = 'idle' | 'purring' | 'crying' | 'sad_purr' | 'angry' | 'angry_purr' | 'sad';
export type CatPersonalityMood = 'normal' | 'angry' | 'sad';

export type CatHatId = 'none' | 'cap' | 'crown' | 'beanie' | 'wizard' | 'headphones' | 'astronaut' | 'president_hat';
export type CatGlassesId = 'none' | 'cool' | 'round' | 'star' | 'neon' | 'visor' | 'monocle';
export type CatTopId = 'none' | 'hoodie' | 'suit' | 'sweater' | 'jacket' | 'spacesuit' | 'presidential_suit';
export type CatNeckId = 'collar' | 'scarf' | 'bowtie' | 'none' | 'chain' | 'amulet' | 'medal';
export type CatBackgroundId = 'cozy' | 'space' | 'cyber' | 'garden' | 'night' | 'skyscrapers' | 'planets' | 'president_hall';
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

export interface CatOptionMeta<T extends string> {
  id: T;
  label: string;
  emoji: string;
  requiredLevel?: CatLevel;
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

export const CAT_HAT_OPTIONS: ReadonlyArray<CatOptionMeta<CatHatId>> = [
  { id: 'none', label: 'Нет', emoji: '🚫', requiredLevel: 1 },
  { id: 'cap', label: 'Кепка', emoji: '🧢', requiredLevel: 1 },
  { id: 'crown', label: 'Корона', emoji: '👑', requiredLevel: 1 },
  { id: 'beanie', label: 'Шапка', emoji: '🧶', requiredLevel: 1 },
  { id: 'wizard', label: 'Маг', emoji: '🧙', requiredLevel: 1 },
  { id: 'headphones', label: 'Наушники', emoji: '🎧', requiredLevel: 2 },
  { id: 'astronaut', label: 'Шлем космо', emoji: '👨‍🚀', requiredLevel: 3 },
  { id: 'president_hat', label: 'Цилиндр Президента', emoji: '🎩', requiredLevel: 4 }
];

export const CAT_GLASSES_OPTIONS: ReadonlyArray<CatOptionMeta<CatGlassesId>> = [
  { id: 'none', label: 'Нет', emoji: '🚫', requiredLevel: 1 },
  { id: 'cool', label: 'Тёмные', emoji: '🕶️', requiredLevel: 1 },
  { id: 'round', label: 'Умные', emoji: '🤓', requiredLevel: 1 },
  { id: 'star', label: 'Звёзды', emoji: '⭐', requiredLevel: 1 },
  { id: 'neon', label: 'Неон-сити', emoji: '🌆', requiredLevel: 2 },
  { id: 'visor', label: 'Космо-визор', emoji: '🥽', requiredLevel: 3 },
  { id: 'monocle', label: 'Золотой монокль', emoji: '🧐', requiredLevel: 4 }
];

export const CAT_TOP_OPTIONS: ReadonlyArray<CatOptionMeta<CatTopId>> = [
  { id: 'none', label: 'Без верха', emoji: '🚫', requiredLevel: 1 },
  { id: 'hoodie', label: 'Худи', emoji: '🧥', requiredLevel: 1 },
  { id: 'suit', label: 'Костюм', emoji: '👔', requiredLevel: 1 },
  { id: 'sweater', label: 'Свитер', emoji: '🧣', requiredLevel: 1 },
  { id: 'jacket', label: 'Бомбер', emoji: '🧥', requiredLevel: 2 },
  { id: 'spacesuit', label: 'Скафандр', emoji: '🚀', requiredLevel: 3 },
  { id: 'presidential_suit', label: 'Парадный китель', emoji: '🎖️', requiredLevel: 4 }
];

export const CAT_NECK_OPTIONS: ReadonlyArray<CatOptionMeta<CatNeckId>> = [
  { id: 'collar', label: 'Бубенчик', emoji: '🔔', requiredLevel: 1 },
  { id: 'scarf', label: 'Шарф', emoji: '🧣', requiredLevel: 1 },
  { id: 'bowtie', label: 'Бабочка', emoji: '🎀', requiredLevel: 1 },
  { id: 'none', label: 'Нет', emoji: '🚫', requiredLevel: 1 },
  { id: 'chain', label: 'Золотая цепь', emoji: '⛓️', requiredLevel: 2 },
  { id: 'amulet', label: 'Космо-амулет', emoji: '✨', requiredLevel: 3 },
  { id: 'medal', label: 'Орден Президента', emoji: '🏅', requiredLevel: 4 }
];

export const CAT_BACKGROUND_OPTIONS: ReadonlyArray<CatOptionMeta<CatBackgroundId>> = [
  { id: 'cozy', label: 'Уютная комната', emoji: '🏠', requiredLevel: 1 },
  { id: 'space', label: 'Космос', emoji: '🚀', requiredLevel: 1 },
  { id: 'cyber', label: 'Киберпанк', emoji: '🌃', requiredLevel: 1 },
  { id: 'garden', label: 'Лужайка', emoji: '☀️', requiredLevel: 1 },
  { id: 'night', label: 'Звёздная ночь', emoji: '🌌', requiredLevel: 1 },
  { id: 'skyscrapers', label: 'Небоскрёбы', emoji: '🏙️', requiredLevel: 2 },
  { id: 'planets', label: 'Луна, Марс и Венера', emoji: '🪐', requiredLevel: 3 },
  { id: 'president_hall', label: 'Зал Президента', emoji: '🏛️', requiredLevel: 4 }
];

export const CAT_SKIN_OPTIONS: ReadonlyArray<{ id: CatSkinId; label: string; emoji: string }> = [
  { id: 'ginger', label: 'Рыжий', emoji: '🐈' },
  { id: 'tabby', label: 'Табби', emoji: '🐅' },
  { id: 'alien', label: 'Инопланетянин', emoji: '👽' },
  { id: 'cyber', label: 'Кибер-кот', emoji: '🤖' },
  { id: 'panda', label: 'Панда-кот', emoji: '🐼' }
];

export interface CatLevelInfo {
  level: CatLevel;
  title: string;
  totalSwipes: number;
  stageSwipes: number;
  stageGoal: number;
  remainingToNext: number;
  progressPct: number;
  isMaxLevel: boolean;
}

export function getCatLevelInfo(rawSwipes: number): CatLevelInfo {
  const totalSwipes = Number.isFinite(rawSwipes) && rawSwipes > 0 ? Math.floor(rawSwipes) : 0;

  if (totalSwipes < CAT_LEVEL_2_UNLOCK_SWIPES) {
    const remainingToNext = CAT_LEVEL_2_UNLOCK_SWIPES - totalSwipes;
    return {
      level: 1,
      title: 'Обычный котик',
      totalSwipes,
      stageSwipes: totalSwipes,
      stageGoal: CAT_LEVEL_1_GOAL,
      remainingToNext,
      progressPct: Math.min(100, Math.round((totalSwipes / CAT_LEVEL_1_GOAL) * 100)),
      isMaxLevel: false
    };
  }

  if (totalSwipes < CAT_LEVEL_3_UNLOCK_SWIPES) {
    const stageSwipes = totalSwipes - CAT_LEVEL_2_UNLOCK_SWIPES;
    const remainingToNext = CAT_LEVEL_3_UNLOCK_SWIPES - totalSwipes;
    return {
      level: 2,
      title: 'Городской стиль',
      totalSwipes,
      stageSwipes,
      stageGoal: CAT_LEVEL_2_GOAL,
      remainingToNext,
      progressPct: Math.min(100, Math.round((stageSwipes / CAT_LEVEL_2_GOAL) * 100)),
      isMaxLevel: false
    };
  }

  if (totalSwipes < CAT_LEVEL_4_UNLOCK_SWIPES) {
    const stageSwipes = totalSwipes - CAT_LEVEL_3_UNLOCK_SWIPES;
    const remainingToNext = CAT_LEVEL_4_UNLOCK_SWIPES - totalSwipes;
    return {
      level: 3,
      title: 'Космический кот',
      totalSwipes,
      stageSwipes,
      stageGoal: CAT_LEVEL_3_GOAL,
      remainingToNext,
      progressPct: Math.min(100, Math.round((stageSwipes / CAT_LEVEL_3_GOAL) * 100)),
      isMaxLevel: false
    };
  }

  return {
    level: 4,
    title: 'Кот Президент',
    totalSwipes,
    stageSwipes: totalSwipes,
    stageGoal: CAT_LEVEL_4_GOAL,
    remainingToNext: 0,
    progressPct: 100,
    isMaxLevel: true
  };
}

export function isCatOptionUnlocked(requiredLevel: CatLevel | undefined, currentLevel: CatLevel): boolean {
  return (requiredLevel ?? 1) <= currentLevel;
}

export function getLevelUpgradeCustomization(
  current: CatCustomization,
  newLevel: CatLevel
): CatCustomization {
  if (newLevel === 2) {
    return {
      ...current,
      background: 'skyscrapers',
      outfit: {
        hat: 'headphones',
        glasses: 'neon',
        top: 'jacket',
        neck: 'chain'
      }
    };
  }
  if (newLevel === 3) {
    return {
      ...current,
      background: 'planets',
      outfit: {
        hat: 'astronaut',
        glasses: 'visor',
        top: 'spacesuit',
        neck: 'amulet'
      }
    };
  }
  if (newLevel === 4) {
    return {
      ...current,
      background: 'president_hall',
      outfit: {
        hat: 'president_hat',
        glasses: 'monocle',
        top: 'presidential_suit',
        neck: 'medal'
      }
    };
  }
  return current;
}

export function sanitizeCatCustomization(raw: unknown, unlockedLevel: CatLevel = 4): CatCustomization {
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
  const hatOpt = CAT_HAT_OPTIONS.find(o => o.id === rawOutfit.hat);
  const hat: CatHatId = hatOpt && isCatOptionUnlocked(hatOpt.requiredLevel, unlockedLevel)
    ? hatOpt.id
    : 'none';

  const glassesOpt = CAT_GLASSES_OPTIONS.find(o => o.id === rawOutfit.glasses);
  const glasses: CatGlassesId = glassesOpt && isCatOptionUnlocked(glassesOpt.requiredLevel, unlockedLevel)
    ? glassesOpt.id
    : 'none';

  const topOpt = CAT_TOP_OPTIONS.find(o => o.id === rawOutfit.top);
  const top: CatTopId = topOpt && isCatOptionUnlocked(topOpt.requiredLevel, unlockedLevel)
    ? topOpt.id
    : 'none';

  const neckOpt = CAT_NECK_OPTIONS.find(o => o.id === rawOutfit.neck);
  const neck: CatNeckId = neckOpt && isCatOptionUnlocked(neckOpt.requiredLevel, unlockedLevel)
    ? neckOpt.id
    : 'collar';

  const bgOpt = CAT_BACKGROUND_OPTIONS.find(o => o.id === obj.background);
  const background: CatBackgroundId = bgOpt && isCatOptionUnlocked(bgOpt.requiredLevel, unlockedLevel)
    ? bgOpt.id
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

export const COINS_PER_STAR = 1000;
export const EARTH_GIFT_STARS = 20;
export const STREAK_FREEZE_STARS = 10;
export const ADMIN_INITIAL_COINS = 999_999_999;

export const CAT_STORAGE_KEYS = {
  coins: 'cosmo_cat_minigame_coins',
  stars: 'cosmo_cat_stars',
  catName: 'cosmo_cat_custom_name',
  hunger: 'cosmo_cat_minigame_hunger',
  swipes: 'cosmo_cat_minigame_swipes',
  customization: 'cosmo_cat_minigame_customization'
} as const;

export interface CatStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface UserCatEconomy {
  coins: number;
  stars: number;
  catName: string;
}

export function getUserCatStorageKey(baseKey: string, userId?: string | null): string {
  const cleanId = typeof userId === 'string' ? userId.trim() : '';
  return cleanId ? `${baseKey}__${cleanId}` : baseKey;
}

function getDefaultBrowserStorage(): CatStorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function readUserCatEconomy(
  userId?: string | null,
  storage: Pick<CatStorageLike, 'getItem'> | null = getDefaultBrowserStorage()
): UserCatEconomy {
  let coins = INITIAL_COINS;
  let stars = 0;
  let catName = 'Космо-Котик';

  if (!storage || !userId) {
    return { coins, stars, catName };
  }

  try {
    const isInfiniteCoins =
      userId === 'usr_admin' ||
      userId.includes('9254699801') ||
      userId.includes('9251672982') ||
      storage.getItem(getUserCatStorageKey('cosmo_infinite_coins', userId)) === '1' ||
      storage.getItem(`cosmo_user_phone_${userId}`) === '9254699801' ||
      storage.getItem(`cosmo_user_phone_${userId}`) === '9251672982';

    const rawCoins = storage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.coins, userId));
    if (rawCoins !== null) {
      const parsed = Number(rawCoins);
      if (Number.isFinite(parsed) && parsed >= 0) coins = Math.floor(parsed);
    }
    if (isInfiniteCoins || coins < ADMIN_INITIAL_COINS) {
      if (isInfiniteCoins) {
        coins = ADMIN_INITIAL_COINS;
      }
    }
    const rawStars = storage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.stars, userId));
    if (rawStars !== null) {
      const parsed = Number(rawStars);
      if (Number.isFinite(parsed) && parsed >= 0) stars = Math.floor(parsed);
    }
    if (isInfiniteCoins) {
      if (stars < 99999) {
        stars = 99999;
      }
    }
    const rawName = storage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.catName, userId));
    if (rawName) catName = rawName;
  } catch {}

  return { coins, stars, catName };
}

export function migrateLegacyCatStorageForUser(
  userId: string,
  isAdminPhoneUser: boolean,
  storage: CatStorageLike | null = getDefaultBrowserStorage()
): void {
  if (!storage || !userId) return;
  try {
    const legacyKeys = Object.values(CAT_STORAGE_KEYS);
    if (isAdminPhoneUser) {
      for (const baseKey of legacyKeys) {
        const scopedKey = getUserCatStorageKey(baseKey, userId);
        const legacyVal = storage.getItem(baseKey);
        if (legacyVal !== null && storage.getItem(scopedKey) === null) {
          storage.setItem(scopedKey, legacyVal);
        }
      }
    }
    for (const baseKey of legacyKeys) {
      storage.removeItem(baseKey);
    }
  } catch {}
}

export function formatCoinsCount(value: number): string {
  const safe = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  return safe.toLocaleString('ru-RU');
}

export function getGiftCoinValue(starsCost: number): number {
  const safeStars = Number.isFinite(starsCost) && starsCost > 0 ? Math.floor(starsCost) : 0;
  return safeStars * COINS_PER_STAR;
}

export function exchangeCoinsForStar(coins: number, stars: number): {
  exchanged: boolean;
  nextCoins: number;
  nextStars: number;
} {
  return exchangeCoinsForStarsBatch(coins, stars, 1);
}

export function exchangeCoinsForStarsBatch(coins: number, stars: number, starsToBuy: number): {
  exchanged: boolean;
  starsAdded: number;
  nextCoins: number;
  nextStars: number;
} {
  const safeCoins = Number.isFinite(coins) && coins > 0 ? Math.floor(coins) : 0;
  const safeStars = Number.isFinite(stars) && stars > 0 ? Math.floor(stars) : 0;
  const count = Number.isFinite(starsToBuy) && starsToBuy > 0 ? Math.floor(starsToBuy) : 1;
  const totalCost = count * COINS_PER_STAR;
  if (safeCoins < totalCost) {
    return { exchanged: false, starsAdded: 0, nextCoins: safeCoins, nextStars: safeStars };
  }
  return {
    exchanged: true,
    starsAdded: count,
    nextCoins: safeCoins - totalCost,
    nextStars: safeStars + count
  };
}

export function spendStarsForEarthGift(stars: number): {
  purchased: boolean;
  nextStars: number;
} {
  const safeStars = Number.isFinite(stars) && stars > 0 ? Math.floor(stars) : 0;
  if (safeStars < EARTH_GIFT_STARS) {
    return { purchased: false, nextStars: safeStars };
  }
  return {
    purchased: true,
    nextStars: safeStars - EARTH_GIFT_STARS
  };
}

export function spendStarsForStreakFreeze(stars: number): {
  purchased: boolean;
  nextStars: number;
} {
  const safeStars = Number.isFinite(stars) && stars > 0 ? Math.floor(stars) : 0;
  if (safeStars < STREAK_FREEZE_STARS) {
    return { purchased: false, nextStars: safeStars };
  }
  return {
    purchased: true,
    nextStars: safeStars - STREAK_FREEZE_STARS
  };
}

export function exchangeGiftForCoins(giftStarsCost: number, currentCoins: number): {
  coinsEarned: number;
  nextCoins: number;
} {
  const safeCoins = Number.isFinite(currentCoins) && currentCoins > 0 ? Math.floor(currentCoins) : 0;
  const coinsEarned = getGiftCoinValue(giftStarsCost);
  return {
    coinsEarned,
    nextCoins: safeCoins + coinsEarned
  };
}

export function grantAdminCoinsIfEligible(
  isAdmin: boolean,
  currentCoins: number,
  alreadyGranted: boolean
): {
  granted: boolean;
  nextCoins: number;
} {
  const safeCoins = Number.isFinite(currentCoins) && currentCoins > 0 ? Math.floor(currentCoins) : 0;
  if (!isAdmin) {
    return { granted: false, nextCoins: safeCoins };
  }
  if (!alreadyGranted || safeCoins < ADMIN_INITIAL_COINS) {
    return {
      granted: true,
      nextCoins: Math.max(safeCoins, ADMIN_INITIAL_COINS)
    };
  }
  return { granted: false, nextCoins: safeCoins };
}

export interface SharedCatData {
  customization: CatCustomization;
  level: number;
  levelTitle: string;
  totalSwipes: number;
  note?: string;
  catName?: string;
}

export function buildSharedCatData(
  customization: CatCustomization,
  totalSwipes: number,
  note?: string,
  catName?: string
): SharedCatData {
  const levelInfo = getCatLevelInfo(totalSwipes);
  const result: SharedCatData = {
    customization: sanitizeCatCustomization(customization, levelInfo.level),
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    totalSwipes: levelInfo.totalSwipes
  };
  if (typeof note === 'string' && note.trim()) {
    result.note = note.trim();
  }
  if (typeof catName === 'string' && catName.trim()) {
    result.catName = catName.trim();
  }
  return result;
}

export function getCatOutfitLabels(customization: CatCustomization): {
  hat: string;
  glasses: string;
  top: string;
  neck: string;
  background: string;
  skin: string;
} {
  const hat = CAT_HAT_OPTIONS.find(o => o.id === customization.outfit.hat)?.label || 'Нет';
  const glasses = CAT_GLASSES_OPTIONS.find(o => o.id === customization.outfit.glasses)?.label || 'Нет';
  const top = CAT_TOP_OPTIONS.find(o => o.id === customization.outfit.top)?.label || 'Без верха';
  const neck = CAT_NECK_OPTIONS.find(o => o.id === customization.outfit.neck)?.label || 'Нет';
  const bg = CAT_BACKGROUND_OPTIONS.find(o => o.id === customization.background)?.label || 'Уютная комната';
  const skin = CAT_SKIN_OPTIONS.find(o => o.id === customization.skin)?.label || 'Рыжий';
  return { hat, glasses, top, neck, background: bg, skin };
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

export interface ClickStepResult {
  petCompleted: boolean;
  isHungryPurr: boolean;
  coinsEarned: number;
  nextLastClickTimeMs: number;
}

export function evaluatePetClick(params: {
  hunger: number;
  nowMs: number;
  lastClickTimeMs: number;
}): ClickStepResult {
  const { hunger, nowMs, lastClickTimeMs } = params;
  if (nowMs - lastClickTimeMs < CLICK_COOLDOWN_MS) {
    return {
      petCompleted: false,
      isHungryPurr: false,
      coinsEarned: 0,
      nextLastClickTimeMs: lastClickTimeMs
    };
  }

  const isHungry = hunger <= 0;
  return {
    petCompleted: true,
    isHungryPurr: isHungry,
    coinsEarned: isHungry ? HUNGRY_COINS_PER_PET : COINS_PER_PET,
    nextLastClickTimeMs: nowMs
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
