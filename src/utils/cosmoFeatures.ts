import {
  CoinEnvelopeData,
  MessageItem,
  OwnedGift,
  ProfileEmojiStatusId,
  ReplyPreview
} from '../types/chat';
import { getGiftCoinValue } from './catGameLogic';
import {
  COSMIC_HAMMER_GIFT,
  COSMIC_HAMMER_GIFT_ID,
  GIFT_CATALOG,
  getGiftCatalogItem,
  GiftCatalogItem
} from './giftCatalog';

export interface EmojiStatusItem {
  id: ProfileEmojiStatusId;
  emoji: string;
  title: string;
  starsCost: number;
}

export const EMOJI_STATUS_CATALOG: ReadonlyArray<EmojiStatusItem> = [
  { id: 'none', emoji: '', title: 'Без статуса', starsCost: 0 },
  { id: 'gem', emoji: '💎', title: 'Бриллиант', starsCost: 10 },
  { id: 'rocket', emoji: '🚀', title: 'Ракета', starsCost: 15 },
  { id: 'flame', emoji: '🔥', title: 'Вечный огонь', starsCost: 20 },
  { id: 'paw', emoji: '🐾', title: 'Кото-легенда', starsCost: 25 },
  { id: 'crown', emoji: '👑', title: 'Монарх чата', starsCost: 40 },
  { id: 'zap', emoji: '⚡', title: 'Молния', starsCost: 60 }
];

export function getEmojiStatusItem(id?: string | null): EmojiStatusItem {
  return EMOJI_STATUS_CATALOG.find(item => item.id === id) || EMOJI_STATUS_CATALOG[0];
}

export interface ChatWallpaperItem {
  id: string;
  title: string;
  minStreakDays: number;
  overlayClass: string;
  swatchClass: string;
}

export const CHAT_WALLPAPER_CATALOG: ReadonlyArray<ChatWallpaperItem> = [
  {
    id: 'default',
    title: 'Стандартный фон',
    minStreakDays: 0,
    overlayClass: '',
    swatchClass: 'bg-slate-900'
  },
  {
    id: 'moonlight',
    title: 'Лунная пыль',
    minStreakDays: 3,
    overlayClass: 'bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.14),_transparent_60%),radial-gradient(ellipse_at_bottom_right,_rgba(99,102,241,0.14),_transparent_60%)]',
    swatchClass: 'bg-gradient-to-br from-sky-900 to-indigo-950'
  },
  {
    id: 'nebula',
    title: 'Звёздный туман',
    minStreakDays: 7,
    overlayClass: 'bg-[radial-gradient(ellipse_at_top_left,_rgba(168,85,247,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(236,72,153,0.16),_transparent_55%)]',
    swatchClass: 'bg-gradient-to-br from-purple-800 to-fuchsia-950'
  },
  {
    id: 'plasma',
    title: 'Плазменная буря',
    minStreakDays: 14,
    overlayClass: 'bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(234,179,8,0.14),_transparent_60%)]',
    swatchClass: 'bg-gradient-to-br from-orange-700 to-amber-950'
  },
  {
    id: 'supernova',
    title: 'Сверхновая',
    minStreakDays: 30,
    overlayClass: 'bg-[radial-gradient(circle_at_30%_20%,_rgba(16,185,129,0.2),_transparent_45%),radial-gradient(circle_at_80%_80%,_rgba(245,158,11,0.2),_transparent_50%)]',
    swatchClass: 'bg-gradient-to-br from-emerald-600 via-teal-800 to-amber-900'
  }
];

export function getChatWallpaperItem(id?: string | null): ChatWallpaperItem {
  return CHAT_WALLPAPER_CATALOG.find(w => w.id === id) || CHAT_WALLPAPER_CATALOG[0];
}

export function isWallpaperUnlockedForStreak(wallpaperId: string, streakCount: number): boolean {
  const item = getChatWallpaperItem(wallpaperId);
  return streakCount >= item.minStreakDays;
}

export function computeEnvelopeClaimShare(
  envelope: CoinEnvelopeData,
  claimerUserId: string
): { canClaim: boolean; amount: number; reason?: 'already_claimed' | 'empty' | 'invalid' } {
  if (!claimerUserId || envelope.totalCoins <= 0 || envelope.maxClaims <= 0) {
    return { canClaim: false, amount: 0, reason: 'invalid' };
  }
  const claimedBy = envelope.claimedBy;
  let claimsList: Array<{ userId: string; userName: string; amount: number; claimedAt: number }> = [];

  if (Array.isArray(claimedBy)) {
    claimsList = claimedBy.filter(Boolean);
  } else if (claimedBy && typeof claimedBy === 'object') {
    claimsList = Object.values(claimedBy).filter(Boolean);
  }

  const alreadyClaimed = claimsList.some(c => c && c.userId === claimerUserId);
  if (alreadyClaimed) {
    return { canClaim: false, amount: 0, reason: 'already_claimed' };
  }

  const claimedCount = claimsList.length;
  if (claimedCount >= envelope.maxClaims) {
    return { canClaim: false, amount: 0, reason: 'empty' };
  }
  const distributedCoins = claimsList.reduce((acc, c) => acc + (Number(c?.amount) || 0), 0);
  const remainingCoins = Math.max(0, envelope.totalCoins - distributedCoins);
  const remainingSlots = envelope.maxClaims - claimedCount;
  if (remainingCoins <= 0 || remainingSlots <= 0) {
    return { canClaim: false, amount: 0, reason: 'empty' };
  }
  const share = remainingSlots === 1
    ? remainingCoins
    : Math.max(1, Math.floor(remainingCoins / remainingSlots));

  return { canClaim: true, amount: share };
}

export const CRAFT_REQUIRED_COUNT = 10;

export interface CraftableGiftGroup {
  giftId: string;
  title: string;
  emoji: string;
  count: number;
  items: OwnedGift[];
  nextTierItem: {
    giftId: string;
    title: string;
    emoji: string;
    starsCost: number;
    isUnsellable?: boolean;
  } | null;
}

export interface GiftCraftRecipeStatus {
  sourceGift: GiftCatalogItem;
  targetGift: GiftCatalogItem;
  ownedCount: number;
  requiredCount: number;
  canCraft: boolean;
  isCosmicHammerTarget: boolean;
  craftableItems: OwnedGift[];
}

export function getNextCraftTargetCatalog(giftId: string): GiftCatalogItem | null {
  if (giftId === COSMIC_HAMMER_GIFT_ID) return null;
  const catIdx = GIFT_CATALOG.findIndex(c => c.giftId === giftId);
  if (catIdx < 0) return null;
  if (catIdx + 1 < GIFT_CATALOG.length) {
    return GIFT_CATALOG[catIdx + 1];
  }
  // 10 of the highest catalog gift ('cosmic_kitten') craft into the exclusive Cosmic Hammer
  return COSMIC_HAMMER_GIFT;
}

export function getGiftCraftRecipes(ownedGifts: ReadonlyArray<OwnedGift>): GiftCraftRecipeStatus[] {
  const byGiftId = new Map<string, OwnedGift[]>();
  for (const g of ownedGifts) {
    if (g.isHolo || g.giftId === COSMIC_HAMMER_GIFT_ID) continue;
    const arr = byGiftId.get(g.giftId) || [];
    arr.push(g);
    byGiftId.set(g.giftId, arr);
  }

  return GIFT_CATALOG.map((sourceGift) => {
    const targetGift = getNextCraftTargetCatalog(sourceGift.giftId) || COSMIC_HAMMER_GIFT;
    const matching = byGiftId.get(sourceGift.giftId) || [];
    return {
      sourceGift,
      targetGift,
      ownedCount: matching.length,
      requiredCount: CRAFT_REQUIRED_COUNT,
      canCraft: matching.length >= CRAFT_REQUIRED_COUNT,
      isCosmicHammerTarget: targetGift.giftId === COSMIC_HAMMER_GIFT_ID,
      craftableItems: matching.slice(0, CRAFT_REQUIRED_COUNT)
    };
  });
}

export function findCraftableGiftGroups(ownedGifts: ReadonlyArray<OwnedGift>): CraftableGiftGroup[] {
  const byGiftId = new Map<string, OwnedGift[]>();
  for (const g of ownedGifts) {
    if (g.isHolo || g.giftId === COSMIC_HAMMER_GIFT_ID) continue;
    const arr = byGiftId.get(g.giftId) || [];
    arr.push(g);
    byGiftId.set(g.giftId, arr);
  }

  const result: CraftableGiftGroup[] = [];
  byGiftId.forEach((items, giftId) => {
    if (items.length < CRAFT_REQUIRED_COUNT) return;
    const currentCatalog = getGiftCatalogItem(giftId);
    const nextCatalog = getNextCraftTargetCatalog(giftId);

    result.push({
      giftId,
      title: currentCatalog.title,
      emoji: currentCatalog.emoji,
      count: items.length,
      items: items.slice(0, CRAFT_REQUIRED_COUNT),
      nextTierItem: nextCatalog
        ? {
            giftId: nextCatalog.giftId,
            title: nextCatalog.title,
            emoji: nextCatalog.emoji,
            starsCost: nextCatalog.starsCost,
            isUnsellable: nextCatalog.giftId === COSMIC_HAMMER_GIFT_ID
          }
        : null
    });
  });

  return result;
}

export function computeCraftedGiftResult(
  ingredients: ReadonlyArray<OwnedGift>,
  mode: 'next_tier' | 'holo' = 'next_tier',
  ownerId: string,
  ownerName: string,
  nowMs = Date.now(),
  assignedSerial?: number
): OwnedGift | null {
  if (ingredients.length < CRAFT_REQUIRED_COUNT) return null;
  const baseGiftId = ingredients[0].giftId;
  if (baseGiftId === COSMIC_HAMMER_GIFT_ID) return null;
  if (!ingredients.every(g => g.giftId === baseGiftId && !g.isHolo)) {
    return null;
  }

  const nextCatalog = getNextCraftTargetCatalog(baseGiftId);
  const useNextTier = mode === 'next_tier' && nextCatalog !== null;
  const targetCatalog = useNextTier ? nextCatalog! : getGiftCatalogItem(baseGiftId);
  const isHolo = !useNextTier;
  const isCosmicHammer = targetCatalog.giftId === COSMIC_HAMMER_GIFT_ID;
  const baseCoinVal = isCosmicHammer ? 0 : getGiftCoinValue(targetCatalog.starsCost);

  return {
    id: `own_craft_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
    giftId: targetCatalog.giftId,
    title: isHolo ? `${targetCatalog.title} ✨` : targetCatalog.title,
    emoji: targetCatalog.emoji,
    starsCost: isHolo ? targetCatalog.starsCost * 2 : targetCatalog.starsCost,
    coinValue: isHolo ? baseCoinVal * 2 : baseCoinVal,
    serialNumber: isCosmicHammer ? (assignedSerial ?? 1) : (assignedSerial ?? ingredients[0].serialNumber),
    isHolo,
    ...(isCosmicHammer ? { isUnsellable: true } : {}),
    senderId: ownerId,
    senderName: ownerName,
    originalSenderName: ingredients[0].originalSenderName || ingredients[0].senderName,
    message: isCosmicHammer
      ? `Выкован из ${CRAFT_REQUIRED_COUNT}× 😻 Космо-Котят · Нельзя купить или продать`
      : isHolo
      ? `Голографический крафт из ${CRAFT_REQUIRED_COUNT} подарков ✨`
      : `Скрафчено из ${CRAFT_REQUIRED_COUNT}× ${getGiftCatalogItem(baseGiftId).emoji}`,
    receivedAt: nowMs
  };
}

export const VOICE_SPEED_STEPS = [1, 1.5, 2] as const;

export function getNextVoiceSpeed(current: number): (typeof VOICE_SPEED_STEPS)[number] {
  const idx = VOICE_SPEED_STEPS.indexOf(current as (typeof VOICE_SPEED_STEPS)[number]);
  if (idx === -1) return 1.5;
  return VOICE_SPEED_STEPS[(idx + 1) % VOICE_SPEED_STEPS.length];
}

export function buildReplyPreview(msg: MessageItem, fallbackSender = 'Пользователь'): ReplyPreview {
  let preview = (msg.text || '').trim();
  if (!preview) {
    if (msg.type === 'image') preview = '📷 Фотография';
    else if (msg.type === 'voice') preview = '🎤 Голосовое сообщение';
    else if (msg.type === 'video_circle') preview = '🎥 Видеокружок';
    else if (msg.type === 'poll') preview = `📊 ${msg.poll?.question || 'Опрос'}`;
    else if (msg.type === 'music_share') preview = `🎵 ${msg.musicShare?.title || 'Трек'}`;
    else if (msg.type === 'cat_card') preview = `🐱 ${msg.catShare?.catName || 'Котик'}`;
    else if (msg.type === 'cat_sticker') preview = `🐾 ${msg.catSticker?.label || 'Стикер'}`;
    else if (msg.type === 'gift') preview = `🎁 ${msg.giftData?.title || 'Подарок'}`;
    else if (msg.type === 'coin_envelope') preview = `🧧 Конверт (${msg.coinEnvelope?.totalCoins || 0} 🪙)`;
    else if (msg.type === 'trade_offer') preview = '🔄 Предложение обмена подарками';
    else preview = 'Сообщение';
  }
  return {
    msgId: msg.id,
    senderName: msg.senderName || fallbackSender,
    previewText: preview.slice(0, 90)
  };
}

export function shouldTriggerGiftCelebration(starsCost?: number, isHolo?: boolean): boolean {
  return Boolean(isHolo) || (typeof starsCost === 'number' && starsCost >= 50);
}
