import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDigits, isAdminPhone, normalizeStr, applyPhoneMask, containsProfanity, hashPassword } from './security';

test('cleanDigits extracts 10 digits from masked phone', () => {
  assert.equal(cleanDigits('+7 (925) 469-98-01'), '9254699801');
  assert.equal(cleanDigits('89254699801'), '9254699801');
  assert.equal(cleanDigits('123'), '123');
});

test('isAdminPhone verifies admin phone correctly', () => {
  assert.equal(isAdminPhone('+7 (925) 469-98-01'), true);
  assert.equal(isAdminPhone('8 925 469 98 01'), true);
  assert.equal(isAdminPhone('+7 (925) 167-29-82'), true);
  assert.equal(isAdminPhone('89251672982'), true);
  assert.equal(isAdminPhone('+7 (999) 111-22-33'), false);
});

test('normalizeStr lowercases and strips whitespace/special chars', () => {
  assert.equal(normalizeStr('  @Cosmo_User-123! '), 'cosmouser123!');
  assert.equal(normalizeStr(null), '');
});

test('applyPhoneMask formats phone input properly', () => {
  const masked = applyPhoneMask('9254699801');
  assert.equal(masked, '+7 (925) 469-98-01');
});

test('containsProfanity flags banned words, transliterations, and obfuscated variations without false positives', () => {
  // Clean harmless words and nicknames
  assert.equal(containsProfanity('привет как дела'), false);
  assert.equal(containsProfanity('космос и звезды'), false);
  assert.equal(containsProfanity('небо и земля'), false);
  assert.equal(containsProfanity('ребенок хлеб сабля корабли'), false);
  assert.equal(containsProfanity('употреблять и оскорблять'), false);
  assert.equal(containsProfanity('Орбитальная станция Cosmo_2026'), false);
  assert.equal(containsProfanity('SkyWalker cocktail classic user'), false);
  assert.equal(containsProfanity('Hunter'), false);

  // Russian Cyrillic & obfuscations
  assert.equal(containsProfanity('сука'), true);
  assert.equal(containsProfanity('с.у.к.а'), true);
  assert.equal(containsProfanity('блядь'), true);
  assert.equal(containsProfanity('б_л_я_т_ь'), true);
  assert.equal(containsProfanity('пиздец'), true);
  assert.equal(containsProfanity('еблан'), true);
  assert.equal(containsProfanity('долбоеб'), true);
  assert.equal(containsProfanity('6лядь'), true);

  // Transliteration & mixed scripts
  assert.equal(containsProfanity('blyad'), true);
  assert.equal(containsProfanity('blyat'), true);
  assert.equal(containsProfanity('blya'), true);
  assert.equal(containsProfanity('b.l.y.a.d'), true);
  assert.equal(containsProfanity('suka'), true);
  assert.equal(containsProfanity('syka'), true);
  assert.equal(containsProfanity('cyka'), true);
  assert.equal(containsProfanity('suka_123'), true);
  assert.equal(containsProfanity('pizdec'), true);
  assert.equal(containsProfanity('xui'), true);
  assert.equal(containsProfanity('nahuy'), true);
  assert.equal(containsProfanity('pidor'), true);
  assert.equal(containsProfanity('eblan'), true);
  assert.equal(containsProfanity('zhopa'), true);
  assert.equal(containsProfanity('gandon'), true);

  // English profanity
  assert.equal(containsProfanity('fuck'), true);
  assert.equal(containsProfanity('bitch'), true);
});

test('hashPassword generates salted deterministic hash', () => {
  const h1 = hashPassword('mySecretPass123');
  const h2 = hashPassword('mySecretPass123');
  const h3 = hashPassword('differentPassword');
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.ok(h1.startsWith('h_'));
});
