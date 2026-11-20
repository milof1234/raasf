import { CatPersonalityMood } from './catGameLogic';

export interface GiftCatalogItem {
  giftId: string;
  title: string;
  emoji: string;
  starsCost: number;
  rarityLabel: string;
  gradientClass: string;
  borderClass: string;
  description: string;
}

export const GIFT_CATALOG: ReadonlyArray<GiftCatalogItem> = [
  {
    giftId: 'comet',
    title: 'Комета',
    emoji: '☄️',
    starsCost: 5,
    rarityLabel: 'Обычный',
    gradientClass: 'from-sky-600 via-cyan-700 to-slate-800',
    borderClass: 'border-sky-400/40',
    description: 'Лёгкий звёздный знак внимания в чат и профиль.'
  },
  {
    giftId: 'earth_planet',
    title: 'Планета Земля',
    emoji: '🌍',
    starsCost: 20,
    rarityLabel: 'Редкий',
    gradientClass: 'from-blue-600 via-indigo-700 to-purple-800',
    borderClass: 'border-amber-300/40',
    description: 'Живая голубая планета — классический подарок CosmoChat.'
  },
  {
    giftId: 'saturn_ring',
    title: 'Кольцо Сатурна',
    emoji: '🪐',
    starsCost: 50,
    rarityLabel: 'Эпический',
    gradientClass: 'from-amber-600 via-orange-700 to-rose-800',
    borderClass: 'border-amber-400/50',
    description: 'Орбитальный подарок с золотыми кольцами Сатурна.'
  },
  {
    giftId: 'golden_crown',
    title: 'Золотая корона',
    emoji: '👑',
    starsCost: 100,
    rarityLabel: 'Легендарный',
    gradientClass: 'from-yellow-500 via-amber-600 to-orange-800',
    borderClass: 'border-yellow-300/60',
    description: 'Королевский подарок для самых важных собеседников.'
  },
  {
    giftId: 'cosmic_kitten',
    title: 'Космо-Котёнок',
    emoji: '😻',
    starsCost: 250,
    rarityLabel: 'Мифический',
    gradientClass: 'from-fuchsia-600 via-purple-700 to-cyan-700',
    borderClass: 'border-fuchsia-300/60',
    description: 'Самый редкий мифический талисман вселенной CosmoChat.'
  }
];

export const COSMIC_HAMMER_GIFT_ID = 'cosmic_hammer';

export const COSMIC_HAMMER_GIFT: GiftCatalogItem = {
  giftId: COSMIC_HAMMER_GIFT_ID,
  title: 'Космический молот',
  emoji: '🔨',
  starsCost: 2500,
  rarityLabel: 'Реликвия крафта',
  gradientClass: 'from-violet-600 via-fuchsia-700 to-amber-500',
  borderClass: 'border-amber-300/80 ring-1 ring-amber-300/50',
  description: 'Уникальный артефакт из 10× Космо-Котят. Нельзя купить или продать — можно только скрафтить или получить в подарок.'
};

export function isGiftUnsellable(
  gift?: { giftId?: string | null; isUnsellable?: boolean } | null
): boolean {
  return Boolean(gift && (gift.isUnsellable || gift.giftId === COSMIC_HAMMER_GIFT_ID));
}

export function isGiftCraftOnly(giftId?: string | null): boolean {
  return giftId === COSMIC_HAMMER_GIFT_ID;
}

export function getGiftCatalogItem(giftId: string): GiftCatalogItem {
  if (giftId === COSMIC_HAMMER_GIFT_ID) {
    return COSMIC_HAMMER_GIFT;
  }
  return GIFT_CATALOG.find(g => g.giftId === giftId) || GIFT_CATALOG[1];
}

export interface ProfileBannerItem {
  id: 'default' | 'aurora' | 'galaxy' | 'sunset';
  title: string;
  starsCost: number;
  coverClass: string;
  avatarRingClass: string;
  previewText: string;
}

export const PROFILE_BANNER_CATALOG: ReadonlyArray<ProfileBannerItem> = [
  {
    id: 'default',
    title: 'Стандартный космос',
    starsCost: 0,
    coverClass: 'bg-gradient-to-br from-[var(--cc-accent)]/30 via-[var(--cc-bg-surface-elevated)] to-[var(--cc-bg-app)]',
    avatarRingClass: 'ring-[var(--cc-bg-rail)]',
    previewText: 'Классическая обложка профиля'
  },
  {
    id: 'aurora',
    title: 'Северное сияние',
    starsCost: 15,
    coverClass: 'bg-gradient-to-br from-emerald-500/45 via-teal-600/35 to-cyan-900/60',
    avatarRingClass: 'ring-emerald-400/80 shadow-[0_0_24px_rgba(16,185,129,0.45)]',
    previewText: 'Изумрудно-бирюзовое полярное свечение'
  },
  {
    id: 'galaxy',
    title: 'Туманность Галактики',
    starsCost: 30,
    coverClass: 'bg-gradient-to-br from-fuchsia-600/50 via-indigo-700/45 to-slate-950',
    avatarRingClass: 'ring-fuchsia-400/80 shadow-[0_0_26px_rgba(217,70,239,0.45)]',
    previewText: 'Глубокий неоновый космос вокруг профиля'
  },
  {
    id: 'sunset',
    title: 'Золотой закат',
    starsCost: 50,
    coverClass: 'bg-gradient-to-br from-amber-500/55 via-orange-600/45 to-rose-900/70',
    avatarRingClass: 'ring-amber-300/90 shadow-[0_0_28px_rgba(251,191,36,0.5)]',
    previewText: 'Королевское золотое сияние'
  }
];

export function getProfileBannerItem(bannerId?: string | null): ProfileBannerItem {
  return PROFILE_BANNER_CATALOG.find(b => b.id === bannerId) || PROFILE_BANNER_CATALOG[0];
}

export function spendStarsAmount(stars: number, cost: number): {
  purchased: boolean;
  nextStars: number;
} {
  const safeStars = Number.isFinite(stars) && stars > 0 ? Math.floor(stars) : 0;
  const safeCost = Number.isFinite(cost) && cost >= 0 ? Math.floor(cost) : 0;
  if (safeStars < safeCost) {
    return { purchased: false, nextStars: safeStars };
  }
  return {
    purchased: true,
    nextStars: safeStars - safeCost
  };
}

export function computeNextGiftSerial(
  giftId: string,
  existingMessages: ReadonlyArray<{ type?: string; giftData?: { giftId?: string; serialNumber?: number } }>,
  counterFromDb?: number
): number {
  let maxSerial = Number.isFinite(counterFromDb) && (counterFromDb as number) > 0
    ? Math.floor(counterFromDb as number)
    : 0;
  let matchingCount = 0;

  for (const m of existingMessages) {
    if (m.type === 'gift' && m.giftData?.giftId === giftId) {
      matchingCount += 1;
      if (typeof m.giftData.serialNumber === 'number' && m.giftData.serialNumber > maxSerial) {
        maxSerial = m.giftData.serialNumber;
      }
    }
  }

  return Math.max(maxSerial, matchingCount) + 1;
}

export const MAX_PINNED_GIFTS = 3;

export function togglePinnedGiftId(currentPinned: ReadonlyArray<string>, giftId: string): string[] {
  const clean = currentPinned.filter((id, idx, arr) => typeof id === 'string' && id && arr.indexOf(id) === idx);
  if (clean.includes(giftId)) {
    return clean.filter(id => id !== giftId);
  }
  if (clean.length >= MAX_PINNED_GIFTS) {
    return [...clean.slice(1), giftId];
  }
  return [...clean, giftId];
}

export interface StreakMilestoneDef {
  days: number;
  title: string;
  badge: string;
  rewardCoins: number;
}

export const STREAK_MILESTONES: ReadonlyArray<StreakMilestoneDef> = [
  { days: 7, title: 'Недельная искра', badge: '🥉', rewardCoins: 1000 },
  { days: 14, title: 'Две недели огня', badge: '🥈', rewardCoins: 2500 },
  { days: 30, title: 'Космический союз', badge: '🏆', rewardCoins: 10000 }
];

export function getStreakMilestonesState(
  streakCount: number,
  claimedDays: ReadonlyArray<number>
): Array<StreakMilestoneDef & { reached: boolean; claimed: boolean; claimable: boolean }> {
  const claimedSet = new Set(claimedDays);
  return STREAK_MILESTONES.map((m) => {
    const reached = streakCount >= m.days;
    const claimed = claimedSet.has(m.days);
    return {
      ...m,
      reached,
      claimed,
      claimable: reached && !claimed
    };
  });
}

export interface CatStickerPreset {
  id: string;
  label: string;
  emoji: string;
  mood: CatPersonalityMood;
  isDancing?: boolean;
  caption: string;
}

export const CAT_STICKER_PRESETS: ReadonlyArray<CatStickerPreset> = [
  { id: 'hi', label: 'Привет!', emoji: '👋', mood: 'normal', isDancing: true, caption: 'Мяу! Привет!' },
  { id: 'love', label: 'Мур-любовь', emoji: '❤️', mood: 'normal', isDancing: true, caption: 'Обнимаю лапками!' },
  { id: 'laugh', label: 'Хе-хе', emoji: '😹', mood: 'normal', isDancing: true, caption: 'Мур-ха-ха!' },
  { id: 'cool', label: 'Крутой', emoji: '😎', mood: 'normal', isDancing: false, caption: 'Всё под контролем' },
  { id: 'angry', label: 'Фыр!', emoji: '😾', mood: 'angry', isDancing: false, caption: 'Ш-ш-ш, не зли меня!' },
  { id: 'sad', label: 'Грущу', emoji: '😿', mood: 'sad', isDancing: false, caption: 'Погладь меня...' }
];

export const SECRET_MESSAGE_TTL_OPTIONS: ReadonlyArray<{ seconds: number; label: string }> = [
  { seconds: 0, label: 'Выкл' },
  { seconds: 10, label: '10 сек' },
  { seconds: 60, label: '1 мин' },
  { seconds: 300, label: '5 мин' }
];
