import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_INITIAL_COINS,
  CAT_BACKGROUND_OPTIONS,
  CAT_GLASSES_OPTIONS,
  CAT_LEVEL_2_UNLOCK_SWIPES,
  CAT_LEVEL_3_UNLOCK_SWIPES,
  CAT_STORAGE_KEYS,
  CLICK_COOLDOWN_MS,
  COINS_PER_PET,
  DEFAULT_CAT_CUSTOMIZATION,
  FEED_COST,
  FEED_HUNGER_RESTORE,
  HUNGRY_COINS_PER_PET,
  INITIAL_COINS,
  PET_STROKE_THRESHOLD_PX,
  STREAK_FREEZE_STARS,
  buildSharedCatData,
  decayHunger,
  evaluatePetClick,
  evaluatePetStroke,
  exchangeCoinsForStar,
  exchangeCoinsForStarsBatch,
  exchangeGiftForCoins,
  feedCat,
  generateCatSupportReply,
  getCatLevelInfo,
  getCatMood,
  getCatOutfitLabels,
  getEffectiveCatMood,
  getGiftCoinValue,
  getLevelUpgradeCustomization,
  getUserCatStorageKey,
  grantAdminCoinsIfEligible,
  isCatOptionUnlocked,
  migrateLegacyCatStorageForUser,
  readUserCatEconomy,
  sanitizeCatCustomization,
  spendStarsForEarthGift,
  spendStarsForStreakFreeze
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

test('getCatLevelInfo computes 1000 / 2000 / 3000 swipe thresholds cleanly', () => {
  const start = getCatLevelInfo(0);
  assert.equal(start.level, 1);
  assert.equal(start.stageSwipes, 0);
  assert.equal(start.stageGoal, 1000);
  assert.equal(start.progressPct, 0);

  const almostLv2 = getCatLevelInfo(999);
  assert.equal(almostLv2.level, 1);
  assert.equal(almostLv2.remainingToNext, 1);

  const lv2 = getCatLevelInfo(CAT_LEVEL_2_UNLOCK_SWIPES);
  assert.equal(lv2.level, 2);
  assert.equal(lv2.stageSwipes, 0);
  assert.equal(lv2.stageGoal, 2000);
  assert.equal(lv2.remainingToNext, 2000);

  const midLv2 = getCatLevelInfo(2000);
  assert.equal(midLv2.level, 2);
  assert.equal(midLv2.stageSwipes, 1000);
  assert.equal(midLv2.progressPct, 50);

  const lv3 = getCatLevelInfo(CAT_LEVEL_3_UNLOCK_SWIPES);
  assert.equal(lv3.level, 3);
  assert.equal(lv3.stageSwipes, 0);
  assert.equal(lv3.stageGoal, 3000);
  assert.equal(lv3.isMaxLevel, true);
});

test('level unlocks gate skyscrapers/neon at Lv2 and Moon/Mars/Venus cosmic items at Lv3', () => {
  const skyscrapers = CAT_BACKGROUND_OPTIONS.find(b => b.id === 'skyscrapers');
  const planets = CAT_BACKGROUND_OPTIONS.find(b => b.id === 'planets');
  const neonGlasses = CAT_GLASSES_OPTIONS.find(g => g.id === 'neon');
  const visorGlasses = CAT_GLASSES_OPTIONS.find(g => g.id === 'visor');

  assert.equal(isCatOptionUnlocked(skyscrapers?.requiredLevel, 1), false);
  assert.equal(isCatOptionUnlocked(skyscrapers?.requiredLevel, 2), true);
  assert.equal(isCatOptionUnlocked(neonGlasses?.requiredLevel, 1), false);
  assert.equal(isCatOptionUnlocked(neonGlasses?.requiredLevel, 2), true);

  assert.equal(isCatOptionUnlocked(planets?.requiredLevel, 2), false);
  assert.equal(isCatOptionUnlocked(planets?.requiredLevel, 3), true);
  assert.equal(isCatOptionUnlocked(visorGlasses?.requiredLevel, 2), false);
  assert.equal(isCatOptionUnlocked(visorGlasses?.requiredLevel, 3), true);

  const lv2Preset = getLevelUpgradeCustomization(DEFAULT_CAT_CUSTOMIZATION, 2);
  assert.equal(lv2Preset.background, 'skyscrapers');
  assert.equal(lv2Preset.outfit.glasses, 'neon');
  assert.equal(lv2Preset.outfit.hat, 'headphones');
  assert.equal(lv2Preset.outfit.top, 'jacket');
  assert.equal(lv2Preset.outfit.neck, 'chain');

  // At Level 1, Level 2 items sanitize back to defaults
  const lockedSanitized = sanitizeCatCustomization(lv2Preset, 1);
  assert.equal(lockedSanitized.background, 'cozy');
  assert.equal(lockedSanitized.outfit.glasses, 'none');

  const lv3Preset = getLevelUpgradeCustomization(lv2Preset, 3);
  assert.equal(lv3Preset.background, 'planets');
  assert.equal(lv3Preset.outfit.glasses, 'visor');
  assert.equal(lv3Preset.outfit.hat, 'astronaut');
  assert.equal(lv3Preset.outfit.top, 'spacesuit');
  assert.equal(lv3Preset.outfit.neck, 'amulet');
});

test('evaluatePetClick awards coins on click and respects click cooldown', () => {
  const fedClick = evaluatePetClick({
    hunger: 80,
    nowMs: 1000,
    lastClickTimeMs: 0
  });
  assert.equal(fedClick.petCompleted, true);
  assert.equal(fedClick.isHungryPurr, false);
  assert.equal(fedClick.coinsEarned, COINS_PER_PET);

  const tooFast = evaluatePetClick({
    hunger: 80,
    nowMs: 1000 + CLICK_COOLDOWN_MS - 10,
    lastClickTimeMs: 1000
  });
  assert.equal(tooFast.petCompleted, false);
  assert.equal(tooFast.coinsEarned, 0);

  const hungryClick = evaluatePetClick({
    hunger: 0,
    nowMs: 1000 + CLICK_COOLDOWN_MS,
    lastClickTimeMs: 1000
  });
  assert.equal(hungryClick.petCompleted, true);
  assert.equal(hungryClick.isHungryPurr, true);
  assert.equal(hungryClick.coinsEarned, HUNGRY_COINS_PER_PET);
});

test('buildSharedCatData formats clean share data and sanitizes by level', () => {
  const lv2Preset = getLevelUpgradeCustomization(DEFAULT_CAT_CUSTOMIZATION, 2);
  const shareAtLv2 = buildSharedCatData(lv2Preset, 1500, 'Зацени котика!', 'Барсик');
  assert.equal(shareAtLv2.level, 2);
  assert.equal(shareAtLv2.levelTitle, 'Городской стиль');
  assert.equal(shareAtLv2.totalSwipes, 1500);
  assert.equal(shareAtLv2.note, 'Зацени котика!');
  assert.equal(shareAtLv2.catName, 'Барсик');
  assert.equal(shareAtLv2.customization.background, 'skyscrapers');
  assert.equal(shareAtLv2.customization.outfit.glasses, 'neon');

  const labels = getCatOutfitLabels(shareAtLv2.customization);
  assert.equal(labels.glasses, 'Неон-сити');
  assert.equal(labels.hat, 'Наушники');
  assert.equal(labels.top, 'Бомбер');
  assert.equal(labels.neck, 'Золотая цепь');
  assert.equal(labels.background, 'Небоскрёбы');
});

test('exchangeCoinsForStar (1000 coins -> 1 star) and spendStarsForEarthGift (20 stars)', () => {
  const failExchange = exchangeCoinsForStar(999, 0);
  assert.equal(failExchange.exchanged, false);
  assert.equal(failExchange.nextCoins, 999);
  assert.equal(failExchange.nextStars, 0);

  const okExchange = exchangeCoinsForStar(1500, 2);
  assert.equal(okExchange.exchanged, true);
  assert.equal(okExchange.nextCoins, 500);
  assert.equal(okExchange.nextStars, 3);

  const failGift = spendStarsForEarthGift(19);
  assert.equal(failGift.purchased, false);
  assert.equal(failGift.nextStars, 19);

  const okGift = spendStarsForEarthGift(22);
  assert.equal(okGift.purchased, true);
  assert.equal(okGift.nextStars, 2);
});

test('exchangeGiftForCoins converts stars value back to coins (20 stars -> 20000 coins)', () => {
  assert.equal(getGiftCoinValue(20), 20_000);
  const res = exchangeGiftForCoins(20, 500);
  assert.equal(res.coinsEarned, 20_000);
  assert.equal(res.nextCoins, 20_500);

  const batchOk = exchangeCoinsForStarsBatch(25_000, 1, 20);
  assert.equal(batchOk.exchanged, true);
  assert.equal(batchOk.starsAdded, 20);
  assert.equal(batchOk.nextCoins, 5_000);
  assert.equal(batchOk.nextStars, 21);

  const batchFail = exchangeCoinsForStarsBatch(19_999, 1, 20);
  assert.equal(batchFail.exchanged, false);
  assert.equal(batchFail.nextCoins, 19_999);
});

test('grantAdminCoinsIfEligible grants 999,999,999 coins to admin phone and replenishes if below limit', () => {
  assert.equal(ADMIN_INITIAL_COINS, 999_999_999);

  const nonAdmin = grantAdminCoinsIfEligible(false, 10, false);
  assert.equal(nonAdmin.granted, false);
  assert.equal(nonAdmin.nextCoins, 10);

  const adminFirstGrant = grantAdminCoinsIfEligible(true, 10, false);
  assert.equal(adminFirstGrant.granted, true);
  assert.equal(adminFirstGrant.nextCoins, 999_999_999);

  const adminAlreadySufficient = grantAdminCoinsIfEligible(true, 999_999_999, true);
  assert.equal(adminAlreadySufficient.granted, false);
  assert.equal(adminAlreadySufficient.nextCoins, 999_999_999);

  const adminDroppedReplenish = grantAdminCoinsIfEligible(true, 500_000_000, true);
  assert.equal(adminDroppedReplenish.granted, true);
  assert.equal(adminDroppedReplenish.nextCoins, 999_999_999);
});

test('per-user cat storage isolates coins and prevents legacy 100M admin leak to non-admin users', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); }
  };

  // Simulate legacy leak where global key had admin's 100,000,000 coins
  mockStorage.setItem(CAT_STORAGE_KEYS.coins, String(ADMIN_INITIAL_COINS));
  mockStorage.setItem(CAT_STORAGE_KEYS.stars, '50');

  // Non-admin user logs in: must NOT receive legacy 100M coins and legacy keys must be cleared
  migrateLegacyCatStorageForUser('usr_regular', false, mockStorage);
  assert.equal(mockStorage.getItem(CAT_STORAGE_KEYS.coins), null);
  assert.equal(readUserCatEconomy('usr_regular', mockStorage).coins, INITIAL_COINS);
  assert.equal(readUserCatEconomy('usr_regular', mockStorage).stars, 0);

  // Admin logs in on their scoped key and gets 100M isolated only to usr_admin
  mockStorage.setItem(getUserCatStorageKey(CAT_STORAGE_KEYS.coins, 'usr_admin'), String(ADMIN_INITIAL_COINS));
  assert.equal(readUserCatEconomy('usr_admin', mockStorage).coins, ADMIN_INITIAL_COINS);
  assert.equal(readUserCatEconomy('usr_regular', mockStorage).coins, INITIAL_COINS);
});

test('spendStarsForStreakFreeze deducts exactly 10 stars when sufficient', () => {
  assert.equal(STREAK_FREEZE_STARS, 10);

  const insufficient = spendStarsForStreakFreeze(9);
  assert.equal(insufficient.purchased, false);
  assert.equal(insufficient.nextStars, 9);

  const exact = spendStarsForStreakFreeze(10);
  assert.equal(exact.purchased, true);
  assert.equal(exact.nextStars, 0);

  const extra = spendStarsForStreakFreeze(25);
  assert.equal(extra.purchased, true);
  assert.equal(extra.nextStars, 15);
});
