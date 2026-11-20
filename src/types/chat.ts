import type { CatCustomization, SharedCatData } from '../utils/catGameLogic';
export type { SharedCatData };

export type ProfileEmojiStatusId = 'none' | 'gem' | 'rocket' | 'flame' | 'paw' | 'crown' | 'zap';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  phone: string;
  passwordHash?: string;
  avatar?: string;
  isMuted?: boolean;
  isAdmin?: boolean;
  isVerified?: boolean;
  isBanned?: boolean;
  email?: string;
  twoFactorEnabled?: boolean;
  lastProfileChange?: number;
  lastSeen?: number;
  isOnline?: boolean;
  activity?: {
    status: 'idle' | 'typing' | 'recording' | 'cat_game' | 'listening';
    targetId?: string;
    detail?: string;
    updatedAt: number;
    userName?: string;
  };
  youtubeAccess?: 'available' | 'restricted' | 'auto';
  region?: 'RU_NO_VPN' | 'RU_WITH_VPN' | 'GLOBAL';
  isVpnActive?: boolean;
  profileBannerId?: 'default' | 'aurora' | 'galaxy' | 'sunset';
  unlockedBanners?: string[];
  emojiStatus?: ProfileEmojiStatusId;
  unlockedStatuses?: string[];
  pinnedGiftIds?: string[];
  catCustomization?: CatCustomization;
  catStats?: {
    coins: number;
    stars: number;
    totalSwipes: number;
    level: number;
    catName?: string;
    customization?: CatCustomization;
    hunger?: number;
    updatedAt?: number;
  };
}

export interface SharedMusicData {
  trackId: string;
  title: string;
  artist: string;
  durationSec: number;
  thumbnail: string;
  genre?: string;
}

export interface ListenTogetherSession {
  trackId: string;
  title: string;
  artist: string;
  durationSec: number;
  thumbnail: string;
  genre?: string;
  isPlaying: boolean;
  positionSec: number;
  updatedAt: number;
  updatedBy: string;
  updatedByName?: string;
}

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface PollData {
  question: string;
  options: PollOption[];
}

export interface CatStickerPayload {
  presetId: string;
  label: string;
  emoji: string;
  caption: string;
  mood: 'normal' | 'angry' | 'sad';
  isDancing?: boolean;
  customization: CatCustomization;
  catName?: string;
}

export interface MessageReaction {
  [emoji: string]: string[]; // array of user IDs
}

export interface GiftData {
  giftId: string;
  title: string;
  emoji: string;
  starsCost: number;
  serialNumber?: number;
  isHolo?: boolean;
  isUnsellable?: boolean;
  message?: string;
  giftInstanceId?: string;
  originalSenderName?: string;
  regiftedFrom?: string;
}

export interface OwnedGift {
  id: string;
  giftId: string;
  title: string;
  emoji: string;
  starsCost: number;
  coinValue: number;
  serialNumber?: number;
  isHolo?: boolean;
  isUnsellable?: boolean;
  senderId: string;
  senderName: string;
  originalSenderName?: string;
  regiftedFrom?: string;
  message?: string;
  receivedAt: number;
  sourceMsgId?: string;
}

export interface CoinEnvelopeClaim {
  userId: string;
  userName: string;
  amount: number;
  claimedAt: number;
}

export interface CoinEnvelopeData {
  envelopeId: string;
  totalCoins: number;
  maxClaims: number;
  senderId: string;
  senderName: string;
  note?: string;
  claimedBy?: Record<string, CoinEnvelopeClaim>;
}

export interface TradeOfferData {
  tradeId: string;
  proposerId: string;
  proposerName: string;
  proposerGift: OwnedGift;
  recipientId: string;
  recipientName: string;
  recipientGift: OwnedGift;
  note?: string;
  status: 'pending' | 'accepted' | 'declined';
  updatedAt: number;
}

export interface ReplyPreview {
  msgId: string;
  senderName: string;
  previewText: string;
}

export interface MessageItem {
  id: string;
  senderId: string;
  senderName: string;
  senderPhone?: string;
  receiverId?: string; // for direct 1-to-1 chats (or currentUser.id for favorites)
  groupId?: string;    // for group chats
  time: string;
  type:
    | 'text'
    | 'image'
    | 'video'
    | 'video_circle'
    | 'voice'
    | 'poll'
    | 'music_share'
    | 'cat_card'
    | 'cat_sticker'
    | 'gift'
    | 'coin_envelope'
    | 'trade_offer';
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  videoDurationSec?: number;
  poll?: PollData;
  musicShare?: SharedMusicData;
  catShare?: SharedCatData;
  catSticker?: CatStickerPayload;
  giftData?: GiftData;
  coinEnvelope?: CoinEnvelopeData;
  tradeOffer?: TradeOfferData;
  replyTo?: ReplyPreview;
  reactions?: MessageReaction;
  readBy?: string[];
  editedAt?: string;
  ttlSeconds?: number;
  expiresAt?: number;
}

export type AppTheme = 'default' | 'wave' | 'cofe';

export interface GroupChat {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  creatorId: string;
  memberIds: string[];
  createdAt: number;
}

export interface ChatStreakData {
  count: number;
  lastActiveDay: string;
  customName?: string;
  wallpaperId?: string;
  updatedAt: number;
}
