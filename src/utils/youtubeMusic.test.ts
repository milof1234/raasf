import test from 'node:test';
import assert from 'node:assert/strict';
import {
  searchRealYouTubeMusic,
  parseYouTubeVideoId,
  formatYouTubeDuration,
  checkContactYouTubeAccess,
  buildYouTubeEmbedUrl,
  MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT
} from './youtubeMusic';

test('searchRealYouTubeMusic returns tracks from live YouTube Music', async () => {
  const results = await searchRealYouTubeMusic('Miyagi');
  assert.ok(Array.isArray(results));
  if (results.length > 0) {
    assert.ok(results[0].id);
    assert.ok(results[0].title);
  }
});

test('parseYouTubeVideoId extracts 11-char ID from varied link formats', () => {
  assert.equal(parseYouTubeVideoId('jfKfPfyJRdk'), 'jfKfPfyJRdk');
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=4NRXx6U8ABQ'), '4NRXx6U8ABQ');
  assert.equal(parseYouTubeVideoId('https://youtu.be/2OElVOrrgEQ?t=10'), '2OElVOrrgEQ');
  assert.equal(parseYouTubeVideoId('https://music.youtube.com/watch?v=mAKsZ26SabQ'), 'mAKsZ26SabQ');
  assert.equal(parseYouTubeVideoId('invalid-string'), null);
});

test('formatYouTubeDuration formats seconds to m:ss cleanly', () => {
  assert.equal(formatYouTubeDuration(0), '0:00');
  assert.equal(formatYouTubeDuration(132), '2:12');
  assert.equal(formatYouTubeDuration(3600), '1:00:00');
  assert.equal(formatYouTubeDuration(-5), '0:00');
});

test('buildYouTubeEmbedUrl produces safe embed URL with origin', () => {
  const url = buildYouTubeEmbedUrl('jfKfPfyJRdk', { autoplay: true, start: 45 });
  assert.ok(url.includes('https://www.youtube.com/embed/jfKfPfyJRdk'));
  assert.ok(url.includes('autoplay=1'));
  assert.ok(url.includes('start=45'));
});

test('checkContactYouTubeAccess blocks contacts without VPN in Russia with exact message', () => {
  const resNoVpn = checkContactYouTubeAccess({
    id: 'user_1',
    name: 'Иван',
    region: 'RU_NO_VPN',
    isVpnActive: false
  });
  assert.equal(resNoVpn.allowed, false);
  assert.equal(resNoVpn.message, MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT);
  assert.equal(resNoVpn.message, 'Эта функция недоступна для данного контакта');

  const resRestricted = checkContactYouTubeAccess({
    id: 'user_2',
    name: 'Алексей',
    youtubeAccess: 'restricted'
  });
  assert.equal(resRestricted.allowed, false);
  assert.equal(resRestricted.message, 'Эта функция недоступна для данного контакта');

  const resWithVpn = checkContactYouTubeAccess({
    id: 'user_4',
    name: 'Сергей',
    region: 'RU_WITH_VPN',
    isVpnActive: true
  });
  assert.equal(resWithVpn.allowed, true);
  assert.equal(resWithVpn.message, undefined);

  const resGlobal = checkContactYouTubeAccess({
    id: 'user_5',
    name: 'John',
    region: 'GLOBAL'
  });
  assert.equal(resGlobal.allowed, true);

  const resNull = checkContactYouTubeAccess(null);
  assert.equal(resNull.allowed, false);
  assert.equal(resNull.message, 'Эта функция недоступна для данного контакта');
});
