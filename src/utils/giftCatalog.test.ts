import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAT_STICKER_PRESETS,
  GIFT_CATALOG,
  MAX_PINNED_GIFTS,
  PROFILE_BANNER_CATALOG,
  STREAK_MILESTONES,
  computeNextGiftSerial,
  getGiftCatalogItem,
  getProfileBannerItem,
  getStreakMilestonesState,
  spendStarsAmount,
  togglePinnedGiftId
} from './giftCatalog';

test('GIFT_CATALOG contains 5 tiered gifts including Comet (5) to Cosmic Kitten (250)', () => {
  assert.equal(GIFT_CATALOG.length, 5);
  assert.equal(getGiftCatalogItem('comet').starsCost, 5);
  assert.equal(getGiftCatalogItem('earth_planet').starsCost, 20);
  assert.equal(getGiftCatalogItem('saturn_ring').starsCost, 50);
  assert.equal(getGiftCatalogItem('golden_crown').starsCost, 100);
  assert.equal(getGiftCatalogItem('cosmic_kitten').starsCost, 250);
});

test('computeNextGiftSerial increments monotonically per giftId', () => {
  const msgs = [
    { type: 'gift', giftData: { giftId: 'comet', serialNumber: 1 } },
    { type: 'gift', giftData: { giftId: 'comet', serialNumber: 4 } },
    { type: 'gift', giftData: { giftId: 'earth_planet', serialNumber: 2 } }
  ];
  assert.equal(computeNextGiftSerial('comet', msgs), 5);
  assert.equal(computeNextGiftSerial('earth_planet', msgs), 3);
  assert.equal(computeNextGiftSerial('golden_crown', msgs), 1);
  assert.equal(computeNextGiftSerial('comet', msgs, 10), 11);
});

test('togglePinnedGiftId pins up to 3 favorites and rotates oldest when adding 4th', () => {
  let pinned: string[] = [];
  pinned = togglePinnedGiftId(pinned, 'g1');
  pinned = togglePinnedGiftId(pinned, 'g2');
  pinned = togglePinnedGiftId(pinned, 'g3');
  assert.equal(pinned.length, MAX_PINNED_GIFTS);
  assert.deepEqual(pinned, ['g1', 'g2', 'g3']);

  // Adding 4th drops oldest (g1)
  pinned = togglePinnedGiftId(pinned, 'g4');
  assert.deepEqual(pinned, ['g2', 'g3', 'g4']);

  // Unpinning g3 removes it cleanly
  pinned = togglePinnedGiftId(pinned, 'g3');
  assert.deepEqual(pinned, ['g2', 'g4']);
});

test('spendStarsAmount deducts arbitrary gift or banner cost accurately', () => {
  assert.deepEqual(spendStarsAmount(14, 15), { purchased: false, nextStars: 14 });
  assert.deepEqual(spendStarsAmount(50, 15), { purchased: true, nextStars: 35 });
  assert.equal(PROFILE_BANNER_CATALOG.length, 4);
  assert.equal(getProfileBannerItem('aurora').starsCost, 15);
  assert.equal(getProfileBannerItem('unknown').id, 'default');
});

test('getStreakMilestonesState unlocks 7, 14, and 30 day rewards cleanly', () => {
  assert.equal(STREAK_MILESTONES.length, 3);
  const at15Claimed7 = getStreakMilestonesState(15, [7]);
  assert.equal(at15Claimed7[0].reached, true);
  assert.equal(at15Claimed7[0].claimed, true);
  assert.equal(at15Claimed7[0].claimable, false);
  assert.equal(at15Claimed7[1].reached, true);
  assert.equal(at15Claimed7[1].claimable, true);
  assert.equal(at15Claimed7[2].reached, false);
  assert.equal(at15Claimed7[2].claimable, false);

  assert.equal(CAT_STICKER_PRESETS.length, 6);
});
