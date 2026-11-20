import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COINS_PER_PET,
  DEFAULT_CAT_CUSTOMIZATION,
  FEED_COST,
  FEED_HUNGER_RESTORE,
  HUNGRY_COINS_PER_PET,
  PET_STROKE_THRESHOLD_PX,
  decayHunger,
  evaluatePetStroke,
  feedCat,
  generateCatSupportReply,
  getCatMood,
  getEffectiveCatMood,
  sanitizeCatCustomization
} from './catGameLogic';

test('getCatMood handles crying, sad_purr, purring, and idle states', () => {
  assert.equal(getCatMood(0, false), 'crying');
  assert.equal(getCatMood(0, true), 'sad_purr');
  assert.equal(getCatMood(40, true), 'purring');
  assert.equal(getCatMood(40, false), 'idle');
});

test('getEffectiveCatMood supports normal, angry, and sad personalities', () => {
  assert.equal(getEffectiveCatMood(50, false, 'normal'), 'idle');
  assert.equal(getEffectiveCatMood(50, true, 'normal'), 'purring');
  assert.equal(getEffectiveCatMood(0, false, 'normal'), 'crying');
  assert.equal(getEffectiveCatMood(50, false, 'angry'), 'angry');
  assert.equal(getEffectiveCatMood(50, true, 'angry'), 'angry_purr');
  assert.equal(getEffectiveCatMood(50, false, 'sad'), 'sad');
  assert.equal(getEffectiveCatMood(50, true, 'sad'), 'sad_purr');
});

test('sanitizeCatCustomization validates outfit slots and falls back safely', () => {
  assert.deepEqual(sanitizeCatCustomization(null), DEFAULT_CAT_CUSTOMIZATION);
  assert.deepEqual(
    sanitizeCatCustomization({
      personality: 'angry',
      outfit: { hat: 'crown', glasses: 'cool', top: 'hoodie', neck: 'scarf' },
      background: 'space',
      skin: 'cyber'
    }),
    {
      personality: 'angry',
      outfit: { hat: 'crown', glasses: 'cool', top: 'hoodie', neck: 'scarf' },
      background: 'space',
      skin: 'cyber'
    }
  );
  assert.deepEqual(
    sanitizeCatCustomization({
      personality: 'unknown',
      outfit: { hat: 'invalid_hat', glasses: 'star', top: 'bad', neck: 'bowtie' },
      background: 'invalid_bg',
      skin: 'invalid_skin'
    }),
    {
      personality: 'normal',
      outfit: { hat: 'none', glasses: 'star', top: 'none', neck: 'bowtie' },
      background: 'cozy',
      skin: 'ginger'
    }
  );
});

test('evaluatePetStroke awards 4 coins when fed and 2 coins + sad purr when hungry', () => {
  const fedResult = evaluatePetStroke({
    accumulatedPx: PET_STROKE_THRESHOLD_PX - 10,
    stepDistancePx: 20,
    hunger: 50,
    nowMs: 1000,
    lastPetTimeMs: 0
  });
  assert.equal(fedResult.petCompleted, true);
  assert.equal(fedResult.isHungryPurr, false);
  assert.equal(fedResult.coinsEarned, COINS_PER_PET);
  assert.equal(COINS_PER_PET, 4);

  const hungryResult = evaluatePetStroke({
    accumulatedPx: PET_STROKE_THRESHOLD_PX - 10,
    stepDistancePx: 20,
    hunger: 0,
    nowMs: 2000,
    lastPetTimeMs: 0
  });
  assert.equal(hungryResult.petCompleted, true);
  assert.equal(hungryResult.isHungryPurr, true);
  assert.equal(hungryResult.coinsEarned, HUNGRY_COINS_PER_PET);
  assert.equal(HUNGRY_COINS_PER_PET, 2);
});

test('decayHunger decreases smoothly and clamps at 0', () => {
  const afterTenSec = decayHunger(50, 10);
  assert.ok(afterTenSec < 50 && afterTenSec > 0);
  assert.equal(decayHunger(2, 10), 0);
});

test('feedCat costs 500 coins and restores hunger to 100%', () => {
  assert.equal(FEED_COST, 500);
  assert.equal(FEED_HUNGER_RESTORE, 100);

  const notEnough = feedCat(499, 0);
  assert.equal(notEnough.fed, false);
  assert.equal(notEnough.reason, 'insufficient_coins');

  const fed = feedCat(520, 20);
  assert.equal(fed.fed, true);
  assert.equal(fed.costPaid, 500);
  assert.equal(fed.nextCoins, 20);
  assert.equal(fed.nextHunger, 100);

  const fedFromZero = feedCat(500, 0);
  assert.equal(fedFromZero.fed, true);
  assert.equal(fedFromZero.nextCoins, 0);
  assert.equal(fedFromZero.nextHunger, 100);

  const alreadyFull = feedCat(1000, 100);
  assert.equal(alreadyFull.fed, false);
  assert.equal(alreadyFull.reason, 'full');
});

test('generateCatSupportReply responds warmly and adapts to angry/sad moods', () => {
  const sadReply = generateCatSupportReply('мне грустно', 0);
  assert.ok(sadReply.length > 20);
  assert.ok(/колен|лапк|рядом|груст|мур/i.test(sadReply));

  const tiredReply = generateCatSupportReply('я очень устал', 1);
  assert.ok(/отдох|устал|передышк|лапк/i.test(tiredReply));

  const angryReply = generateCatSupportReply('привет кот', 0, 'angry');
  assert.ok(/фыр|хр|суров|буз/i.test(angryReply));

  const moodySadReply = generateCatSupportReply('привет кот', 0, 'sad');
  assert.ok(/груст|тихо|вздох|мур/i.test(moodySadReply));
});
