import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWindowsOneLiner,
  computeAudioEnergyBars,
  computeLiveTrackProgress,
  computeSynchronizedPositionSec,
  formatAudioTime,
  getListenSessionKey,
  parseAudioFileName,
  parseWindowTitleToTrack,
  sanitizeChannelId,
  shouldResyncPlayback
} from './musicLogic';

test('parseWindowTitleToTrack splits Artist - Title cleanly', () => {
  const parsed = parseWindowTitleToTrack('Sh0tty - For my girl - remix');
  assert.equal(parsed.artist, 'Sh0tty');
  assert.equal(parsed.title, 'For my girl - remix');

  const noDash = parseWindowTitleToTrack('Ambient Track');
  assert.equal(noDash.title, 'Ambient Track');
  assert.equal(noDash.artist, 'Windows');
});

test('parseAudioFileName strips extension and parses artist/title', () => {
  const parsed = parseAudioFileName('Daft Punk - Instant Crush.mp3');
  assert.equal(parsed.artist, 'Daft Punk');
  assert.equal(parsed.title, 'Instant Crush');
});

test('buildWindowsOneLiner builds safe PowerShell irm | iex command', () => {
  const cmd = buildWindowsOneLiner('https://cosmochat.ai.studio/', 'win_abc123!');
  assert.equal(
    cmd,
    'irm "https://cosmochat.ai.studio/api/music/windows-script?channel=win_abc123&origin=https%3A%2F%2Fcosmochat.ai.studio" | iex'
  );
  assert.equal(sanitizeChannelId('***'), 'cosmo_default');
});

test('computeAudioEnergyBars normalizes bins between 0 and 1', () => {
  const data = new Uint8Array(48);
  data.fill(255, 0, 4);
  data.fill(128, 4, 8);
  const bars = computeAudioEnergyBars(data, 12);
  assert.equal(bars.length, 12);
  assert.equal(bars[0], 1);
  assert.ok(bars[1] > 0.49 && bars[1] < 0.51);
  assert.equal(bars[11], 0);
});

test('formatAudioTime formats seconds as m:ss', () => {
  assert.equal(formatAudioTime(0), '0:00');
  assert.equal(formatAudioTime(65), '1:05');
  assert.equal(formatAudioTime(208), '3:28');
});

test('computeLiveTrackProgress interpolates while playing, freezes on pause, and clamps at duration', () => {
  const playing = computeLiveTrackProgress(30, 120, 1000, true, 6000);
  assert.equal(playing.positionSec, 35);
  assert.ok(Math.abs(playing.progressPct - (35 / 120) * 100) < 0.001);

  const paused = computeLiveTrackProgress(30, 120, 1000, false, 6000);
  assert.equal(paused.positionSec, 30);
  assert.equal(paused.progressPct, 25);

  const clamped = computeLiveTrackProgress(118, 120, 1000, true, 10000);
  assert.equal(clamped.positionSec, 120);
  assert.equal(clamped.progressPct, 100);
});

test('getListenSessionKey returns identical symmetric key for both participants', () => {
  const k1 = getListenSessionKey({ currentUserId: 'usr_a', activeChatUserId: 'usr_b' });
  const k2 = getListenSessionKey({ currentUserId: 'usr_b', activeChatUserId: 'usr_a' });
  assert.equal(k1, k2);
  assert.equal(k1, 'dm_usr_a_usr_b');

  const g = getListenSessionKey({ currentUserId: 'usr_a', activeGroupId: 'grp_1' });
  assert.equal(g, 'group_grp_1');
});

test('computeSynchronizedPositionSec computes shared live timestamp and shouldResyncPlayback detects drift', () => {
  const pos = computeSynchronizedPositionSec(
    { isPlaying: true, positionSec: 42, durationSec: 200, updatedAt: 10_000 },
    25_000
  );
  assert.equal(pos, 57);

  const pausedPos = computeSynchronizedPositionSec(
    { isPlaying: false, positionSec: 42, durationSec: 200, updatedAt: 10_000 },
    25_000
  );
  assert.equal(pausedPos, 42);

  assert.equal(shouldResyncPlayback(56.2, 57, 1.8), false);
  assert.equal(shouldResyncPlayback(54.0, 57, 1.8), true);
});

