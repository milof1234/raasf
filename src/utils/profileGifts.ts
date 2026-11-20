import { GroupChat, MessageItem, OwnedGift, UserProfile } from '../types/chat';
import { getGiftCoinValue } from './catGameLogic';
import { isGiftUnsellable } from './giftCatalog';

export type ClaimedGiftStatus = 'claimed' | 'exchanged' | 'regifted' | 'crafted';

export function resolveUserProfileGifts(params: {
  targetUserId: string;
  firebaseOwnedGifts?: Record<string, OwnedGift> | OwnedGift[] | null;
  claimedStatuses?: Record<string, ClaimedGiftStatus> | null;
  messages: MessageItem[];
  deletedMsgsMap?: Record<string, boolean>;
  usersMap?: Record<string, UserProfile>;
}): OwnedGift[] {
  const {
    targetUserId,
    firebaseOwnedGifts,
    claimedStatuses,
    messages,
    deletedMsgsMap = {},
    usersMap = {}
  } = params;

  if (!targetUserId) return [];

  const giftMap = new Map<string, OwnedGift>();

  // 1. Add authoritative active gifts from Firebase / local cache
  if (Array.isArray(firebaseOwnedGifts)) {
    firebaseOwnedGifts.forEach((g) => {
      if (g && g.id && g.title && g.emoji) {
        giftMap.set(g.id, g);
      }
    });
  } else if (firebaseOwnedGifts && typeof firebaseOwnedGifts === 'object') {
    Object.values(firebaseOwnedGifts).forEach((g) => {
      if (g && g.id && g.title && g.emoji) {
        giftMap.set(g.id, g);
      }
    });
  }

  // 2. Fallback for direct incoming gift messages that haven't been claimed/spent yet
  const claimed = claimedStatuses || {};
  for (const m of messages) {
    if (deletedMsgsMap[m.id]) continue;
    if (m.type !== 'gift' || !m.giftData) continue;
    if (m.groupId) continue;
    if (m.receiverId !== targetUserId) continue;

    const status = claimed[m.id];
    if (status === 'exchanged' || status === 'regifted' || status === 'claimed' || status === 'crafted') {
      continue;
    }

    const ownedId = `own_${m.id}`;
    if (giftMap.has(ownedId)) continue;

    const unsellable = isGiftUnsellable(m.giftData);
    const ts = Date.parse(m.time);
    const gift: OwnedGift = {
      id: ownedId,
      giftId: m.giftData.giftId,
      title: m.giftData.title,
      emoji: m.giftData.emoji,
      starsCost: m.giftData.starsCost,
      coinValue: unsellable ? 0 : getGiftCoinValue(m.giftData.starsCost),
      senderId: m.senderId,
      senderName: usersMap[m.senderId]?.name || m.senderName || 'Пользователь',
      receivedAt: Number.isFinite(ts) ? ts : 0,
      sourceMsgId: m.id
    };
    if (unsellable) gift.isUnsellable = true;
    if (m.giftData.isHolo) gift.isHolo = true;
    if (typeof m.giftData.serialNumber === 'number') gift.serialNumber = m.giftData.serialNumber;
    if (m.giftData.originalSenderName) gift.originalSenderName = m.giftData.originalSenderName;
    if (m.giftData.regiftedFrom) gift.regiftedFrom = m.giftData.regiftedFrom;
    if (m.giftData.message) gift.message = m.giftData.message;

    giftMap.set(ownedId, gift);
  }

  return Array.from(giftMap.values()).sort((a, b) => b.receivedAt - a.receivedAt);
}

export function getSharedMediaForUser(params: {
  currentUserId: string;
  targetUserId: string;
  messages: MessageItem[];
  deletedMsgsMap?: Record<string, boolean>;
}): MessageItem[] {
  const { currentUserId, targetUserId, messages, deletedMsgsMap = {} } = params;
  if (!currentUserId || !targetUserId) return [];

  return messages
    .filter((m) => {
      if (deletedMsgsMap[m.id]) return false;
      if (m.type !== 'image' || !m.imageUrl) return false;
      if (m.groupId) return false;
      if (currentUserId === targetUserId) {
        return m.senderId === currentUserId && m.receiverId === currentUserId;
      }
      return (
        (m.senderId === currentUserId && m.receiverId === targetUserId) ||
        (m.senderId === targetUserId && m.receiverId === currentUserId)
      );
    })
    .slice()
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}

export function getSharedGroupsForUser(params: {
  currentUserId: string;
  targetUserId: string;
  groups: GroupChat[];
}): GroupChat[] {
  const { currentUserId, targetUserId, groups } = params;
  if (!currentUserId || !targetUserId) return [];
  return groups.filter((g) => {
    const members = Array.isArray(g.memberIds) ? g.memberIds : [];
    return members.includes(currentUserId) && members.includes(targetUserId);
  });
}
