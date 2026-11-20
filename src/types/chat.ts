export interface UserProfile {
  id: string;
  name: string;
  username: string;
  phone: string;
  passwordHash?: string;
  avatar?: string;
  isMuted?: boolean;
  isAdmin?: boolean;
  email?: string;
  twoFactorEnabled?: boolean;
  lastProfileChange?: number;
  lastSeen?: number;
  isOnline?: boolean;
  activity?: {
    status: 'idle' | 'typing' | 'recording';
    targetId?: string;
    updatedAt: number;
    userName?: string;
  };
  youtubeAccess?: 'available' | 'restricted' | 'auto';
  region?: 'RU_NO_VPN' | 'RU_WITH_VPN' | 'GLOBAL';
  isVpnActive?: boolean;
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

export interface MessageReaction {
  [emoji: string]: string[]; // array of user IDs
}

export interface MessageItem {
  id: string;
  senderId: string;
  senderName: string;
  senderPhone?: string;
  receiverId?: string; // for direct 1-to-1 chats (or currentUser.id for favorites)
  groupId?: string;    // for group chats
  time: string;
  type: 'text' | 'image' | 'video' | 'voice' | 'poll' | 'music_share';
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  poll?: PollData;
  musicShare?: SharedMusicData;
  reactions?: MessageReaction;
  readBy?: string[];
  editedAt?: string;
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
