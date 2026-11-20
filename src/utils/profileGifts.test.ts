import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSharedGroupsForUser,
  getSharedMediaForUser,
  resolveUserProfileGifts
} from './profileGifts';
import { GroupChat, MessageItem, OwnedGift, UserProfile } from '../types/chat';

const usersMap: Record<string, UserProfile> = {
  u1: { id: 'u1', name: 'Алекс', username: 'alex', phone: '+7 900 111-11-11' },
  u2: { id: 'u2', name: 'Мария', username: 'maria', phone: '+7 900 222-22-22' }
};

test('resolveUserProfileGifts combines owned inventory and unclaimed direct gifts while respecting exchanged/regifted tombstones', () => {
  const owned: Record<string, OwnedGift> = {
    own_m1: {
      id: 'own_m1',
      giftId: 'earth_planet',
      title: 'Планета Земля',
      emoji: '🌍',
      starsCost: 20,
      coinValue: 20000,
      senderId: 'u1',
      senderName: 'Алекс',
      receivedAt: 2000,
      sourceMsgId: 'm1'
    }
  };

  const messages: MessageItem[] = [
    {
      id: 'm1',
      senderId: 'u1',
      senderName: 'Алекс',
      receiverId: 'u2',
      time: new Date(2000).toISOString(),
      type: 'gift',
      giftData: { giftId: 'earth_planet', title: 'Планета Земля', emoji: '🌍', starsCost: 20 }
    },
    {
      id: 'm2_unclaimed',
      senderId: 'u1',
      senderName: 'Алекс',
      receiverId: 'u2',
      time: new Date(3000).toISOString(),
      type: 'gift',
      giftData: {
        giftId: 'earth_planet',
        title: 'Планета Земля',
        emoji: '🌍',
        starsCost: 20,
        message: 'С днём рождения!'
      }
    },
    {
      id: 'm3_exchanged',
      senderId: 'u1',
      senderName: 'Алекс',
      receiverId: 'u2',
      time: new Date(4000).toISOString(),
      type: 'gift',
      giftData: { giftId: 'earth_planet', title: 'Планета Земля', emoji: '🌍', starsCost: 20 }
    },
    {
      id: 'm4_deleted',
      senderId: 'u1',
      senderName: 'Алекс',
      receiverId: 'u2',
      time: new Date(5000).toISOString(),
      type: 'gift',
      giftData: { giftId: 'earth_planet', title: 'Планета Земля', emoji: '🌍', starsCost: 20 }
    },
    {
      id: 'm5_crafted',
      senderId: 'u1',
      senderName: 'Алекс',
      receiverId: 'u2',
      time: new Date(6000).toISOString(),
      type: 'gift',
      giftData: { giftId: 'comet', title: 'Комета', emoji: '☄️', starsCost: 5 }
    },
    {
      id: 'm6_hammer',
      senderId: 'u1',
      senderName: 'Алекс',
      receiverId: 'u2',
      time: new Date(7000).toISOString(),
      type: 'gift',
      giftData: {
        giftId: 'cosmic_hammer',
        title: 'Космический молот',
        emoji: '🔨',
        starsCost: 2500,
        isUnsellable: true,
        serialNumber: 1
      }
    }
  ];

  const resolved = resolveUserProfileGifts({
    targetUserId: 'u2',
    firebaseOwnedGifts: owned,
    claimedStatuses: { m3_exchanged: 'exchanged', m5_crafted: 'crafted' },
    messages,
    deletedMsgsMap: { m4_deleted: true },
    usersMap
  });

  assert.equal(resolved.length, 3);
  assert.equal(resolved[0].id, 'own_m6_hammer');
  assert.equal(resolved[0].isUnsellable, true);
  assert.equal(resolved[0].coinValue, 0);
  assert.equal(resolved[1].id, 'own_m2_unclaimed');
  assert.equal(resolved[1].senderName, 'Алекс');
  assert.equal(resolved[1].message, 'С днём рождения!');
  assert.equal(resolved[2].id, 'own_m1');
});

test('getSharedMediaForUser and getSharedGroupsForUser filter accurately', () => {
  const messages: MessageItem[] = [
    {
      id: 'img1',
      senderId: 'u1',
      senderName: 'Алекс',
      receiverId: 'u2',
      time: '2026-11-16T08:00:00.000Z',
      type: 'image',
      imageUrl: 'data:image/png;base64,a'
    },
    {
      id: 'img2',
      senderId: 'u2',
      senderName: 'Мария',
      receiverId: 'u1',
      time: '2026-11-16T09:00:00.000Z',
      type: 'image',
      imageUrl: 'data:image/png;base64,b'
    },
    {
      id: 'txt1',
      senderId: 'u1',
      senderName: 'Алекс',
      receiverId: 'u2',
      time: '2026-11-16T10:00:00.000Z',
      type: 'text',
      text: 'hi'
    }
  ];

  const media = getSharedMediaForUser({ currentUserId: 'u1', targetUserId: 'u2', messages });
  assert.equal(media.length, 2);
  assert.equal(media[0].id, 'img2');
  assert.equal(media[1].id, 'img1');

  const groups: GroupChat[] = [
    { id: 'g1', name: 'Космос', creatorId: 'u1', memberIds: ['u1', 'u2'], createdAt: 1 },
    { id: 'g2', name: 'Только u1', creatorId: 'u1', memberIds: ['u1'], createdAt: 2 }
  ];
  const sharedGroups = getSharedGroupsForUser({ currentUserId: 'u1', targetUserId: 'u2', groups });
  assert.equal(sharedGroups.length, 1);
  assert.equal(sharedGroups[0].id, 'g1');
});
