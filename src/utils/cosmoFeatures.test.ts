import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMOJI_STATUS_CATALOG,
  CHAT_WALLPAPER_CATALOG,
  CRAFT_REQUIRED_COUNT,
  computeEnvelopeClaimShare,
  findCraftableGiftGroups,
  getGiftCraftRecipes,
  computeCraftedGiftResult,
  getNextVoiceSpeed,
  isWallpaperUnlockedForStreak,
  buildReplyPreview,
  shouldTriggerGiftCelebration
} from './cosmoFeatures';
import {
  COSMIC_HAMMER_GIFT_ID,
  GIFT_CATALOG,
  isGiftCraftOnly,
  isGiftUnsellable
} from './giftCatalog';
import { OwnedGift, MessageItem } from '../types/chat';

test('EMOJI_STATUS_CATALOG provides free none status and purchasable Cosmo statuses', () => {
  assert.ok(EMOJI_STATUS_CATALOG.length >= 6);
  assert.equal(EMOJI_STATUS_CATALOG[0].id, 'none');
  assert.equal(EMOJI_STATUS_CATALOG[0].starsCost, 0);
  assert.ok(EMOJI_STATUS_CATALOG.some(s => s.id === 'crown' && s.starsCost > 0));
});

test('CHAT_WALLPAPER_CATALOG gates wallpapers behind streak thresholds accurately', () => {
  assert.ok(CHAT_WALLPAPER_CATALOG.length >= 5);
  assert.equal(isWallpaperUnlockedForStreak('default', 0), true);
  assert.equal(isWallpaperUnlockedForStreak('moonlight', 2), false);
  assert.equal(isWallpaperUnlockedForStreak('moonlight', 3), true);
  assert.equal(isWallpaperUnlockedForStreak('nebula', 7), true);
  assert.equal(isWallpaperUnlockedForStreak('supernova', 29), false);
  assert.equal(isWallpaperUnlockedForStreak('supernova', 30), true);
});

test('computeEnvelopeClaimShare splits totalCoins across maxClaims and prevents duplicate claims', () => {
  const env = {
    envelopeId: 'env_1',
    totalCoins: 1000,
    maxClaims: 3,
    senderId: 'usr_a',
    senderName: 'Alice',
    claimedBy: {} as Record<string, any>
  };

  const c1 = computeEnvelopeClaimShare(env, 'u1');
  assert.equal(c1.canClaim, true);
  assert.equal(c1.amount, 333);

  const dup = computeEnvelopeClaimShare({
    ...env,
    claimedBy: { u1: { userId: 'u1', userName: 'U1', amount: 333, claimedAt: 1 } }
  }, 'u1');
  assert.equal(dup.canClaim, false);
  assert.equal(dup.reason, 'already_claimed');

  const c2 = computeEnvelopeClaimShare({
    ...env,
    claimedBy: { u1: { userId: 'u1', userName: 'U1', amount: 333, claimedAt: 1 } }
  }, 'u2');
  assert.equal(c2.canClaim, true);
  assert.equal(c2.amount, 333);

  const c3 = computeEnvelopeClaimShare({
    ...env,
    claimedBy: {
      u1: { userId: 'u1', userName: 'U1', amount: 333, claimedAt: 1 },
      u2: { userId: 'u2', userName: 'U2', amount: 333, claimedAt: 2 }
    }
  }, 'u3');
  assert.equal(c3.canClaim, true);
  assert.equal(c3.amount, 334); // Exact remainder

  const c4 = computeEnvelopeClaimShare({
    ...env,
    claimedBy: {
      u1: { userId: 'u1', userName: 'U1', amount: 333, claimedAt: 1 },
      u2: { userId: 'u2', userName: 'U2', amount: 333, claimedAt: 2 },
      u3: { userId: 'u3', userName: 'U3', amount: 334, claimedAt: 3 }
    }
  }, 'u4');
  assert.equal(c4.canClaim, false);
  assert.equal(c4.reason, 'empty');
});

test('10 identical gifts craft into 1 next-tier gift and 10 cosmic_kittens craft into unsellable Cosmic Hammer', () => {
  assert.equal(CRAFT_REQUIRED_COUNT, 10);
  // Cosmic Hammer must NOT be purchasable in shop catalog
  assert.equal(GIFT_CATALOG.some(g => g.giftId === COSMIC_HAMMER_GIFT_ID), false);
  assert.equal(isGiftCraftOnly(COSMIC_HAMMER_GIFT_ID), true);

  const makeGift = (id: string, giftId: string, starsCost: number): OwnedGift => ({
    id,
    giftId,
    title: giftId,
    emoji: giftId === 'cosmic_kitten' ? '😻' : '☄️',
    starsCost,
    coinValue: starsCost * 1000,
    serialNumber: 7,
    senderId: 'u1',
    senderName: 'Test',
    receivedAt: 1000
  });

  // 9 comets are NOT enough; 10 comets are craftable into earth_planet
  const nineComets = Array.from({ length: 9 }, (_, idx) => makeGift(`c_${idx}`, 'comet', 5));
  assert.equal(findCraftableGiftGroups(nineComets).length, 0);

  const tenComets = [...nineComets, makeGift('c_9', 'comet', 5)];
  const cometGroups = findCraftableGiftGroups(tenComets);
  assert.equal(cometGroups.length, 1);
  assert.equal(cometGroups[0].giftId, 'comet');
  assert.equal(cometGroups[0].nextTierItem?.giftId, 'earth_planet');

  const upgraded = computeCraftedGiftResult(cometGroups[0].items, 'next_tier', 'u_me', 'Me', 5000);
  assert.ok(upgraded);
  assert.equal(upgraded.giftId, 'earth_planet');
  assert.equal(upgraded.starsCost, 20);
  assert.equal(upgraded.coinValue, 20000);
  assert.equal(isGiftUnsellable(upgraded), false);

  // 10 cosmic_kittens (highest tier) craft into the Cosmic Hammer relic
  const tenKittens = Array.from({ length: 10 }, (_, idx) => makeGift(`k_${idx}`, 'cosmic_kitten', 250));
  const recipes = getGiftCraftRecipes(tenKittens);
  const kittenRecipe = recipes.find(r => r.sourceGift.giftId === 'cosmic_kitten');
  assert.ok(kittenRecipe);
  assert.equal(kittenRecipe.canCraft, true);
  assert.equal(kittenRecipe.isCosmicHammerTarget, true);
  assert.equal(kittenRecipe.targetGift.giftId, COSMIC_HAMMER_GIFT_ID);

  const hammer = computeCraftedGiftResult(kittenRecipe.craftableItems, 'next_tier', 'u_me', 'Me', 6000, 1);
  assert.ok(hammer);
  assert.equal(hammer.giftId, COSMIC_HAMMER_GIFT_ID);
  assert.equal(hammer.title, 'Космический молот');
  assert.equal(hammer.emoji, '🔨');
  assert.equal(hammer.coinValue, 0);
  assert.equal(hammer.isUnsellable, true);
  assert.equal(hammer.serialNumber, 1);
  assert.equal(isGiftUnsellable(hammer), true);

  // Even 10 Cosmic Hammers cannot be crafted further
  const tenHammers = Array.from({ length: 10 }, (_, idx) => ({ ...hammer, id: `h_${idx}` }));
  assert.equal(findCraftableGiftGroups(tenHammers).length, 0);
  assert.equal(computeCraftedGiftResult(tenHammers, 'next_tier', 'u_me', 'Me', 7000), null);
});

test('getNextVoiceSpeed cycles 1 -> 1.5 -> 2 -> 1 cleanly', () => {
  assert.equal(getNextVoiceSpeed(1), 1.5);
  assert.equal(getNextVoiceSpeed(1.5), 2);
  assert.equal(getNextVoiceSpeed(2), 1);
});

test('buildReplyPreview and shouldTriggerGiftCelebration work cleanly', () => {
  const msg: MessageItem = {
    id: 'm1',
    senderId: 'u1',
    senderName: 'milof',
    time: new Date().toISOString(),
    type: 'video_circle'
  };
  const reply = buildReplyPreview(msg);
  assert.equal(reply.msgId, 'm1');
  assert.equal(reply.senderName, 'milof');
  assert.equal(reply.previewText, '🎥 Видеокружок');

  assert.equal(shouldTriggerGiftCelebration(20, false), false);
  assert.equal(shouldTriggerGiftCelebration(50, false), true);
  assert.equal(shouldTriggerGiftCelebration(5, true), true);
});
