import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeChatStreakFromMessages,
  formatDaysLabel,
  getLocalDayKey,
  getStreakChatKey,
  getStreakVisualMeta,
  shiftDayKey
} from './streakLogic';

test('getStreakChatKey produces symmetric keys for direct chats and unique keys for groups', () => {
  const k1 = getStreakChatKey({ currentUserId: 'usr_a', targetUserId: 'usr_b' });
  const k2 = getStreakChatKey({ currentUserId: 'usr_b', targetUserId: 'usr_a' });
  assert.equal(k1, k2);
  assert.equal(k1, 'direct_usr_a__usr_b');

  assert.equal(
    getStreakChatKey({ currentUserId: 'usr_a', targetUserId: 'usr_a' }),
    'direct_self_usr_a'
  );
  assert.equal(
    getStreakChatKey({ currentUserId: 'usr_a', groupId: 'grp_123' }),
    'group_grp_123'
  );
});

test('computeChatStreakFromMessages requires mutual messages in direct chats and handles pending/at-risk/expired states', () => {
  const now = new Date(2026, 4, 15, 14, 0, 0).getTime();
  const day0A = new Date(2026, 4, 15, 10, 0, 0).toISOString();
  const day0B = new Date(2026, 4, 15, 11, 0, 0).toISOString();
  const day1A = new Date(2026, 4, 14, 18, 0, 0).toISOString();
  const day1B = new Date(2026, 4, 14, 19, 0, 0).toISOString();
  const day2A = new Date(2026, 4, 13, 9, 0, 0).toISOString();
  const day2B = new Date(2026, 4, 13, 12, 0, 0).toISOString();
  const day4A = new Date(2026, 4, 11, 9, 0, 0).toISOString();
  const day4B = new Date(2026, 4, 11, 10, 0, 0).toISOString(); // gap on May 12

  // Both participants wrote on days 0, 1, 2 -> 3-day mutual streak burning today
  const hot = computeChatStreakFromMessages(
    [
      { time: day4A, senderId: 'usr_a' },
      { time: day4B, senderId: 'usr_b' },
      { time: day2A, senderId: 'usr_a' },
      { time: day2B, senderId: 'usr_b' },
      { time: day1A, senderId: 'usr_a' },
      { time: day1B, senderId: 'usr_b' },
      { time: day0A, senderId: 'usr_a' },
      { time: day0B, senderId: 'usr_b' }
    ],
    now,
    { requiredSenders: 2 }
  );
  assert.equal(hot.count, 3);
  assert.equal(hot.isHotToday, true);
  assert.equal(hot.isAtRisk, false);
  assert.equal(hot.pendingToday, false);
  assert.deepEqual(hot.todaySenderIds.sort(), ['usr_a', 'usr_b']);

  // Only one participant wrote across multiple days -> streak stays 0, pendingToday = true today
  const oneSidedOnly = computeChatStreakFromMessages(
    [
      { time: day2A, senderId: 'usr_a' },
      { time: day1A, senderId: 'usr_a' },
      { time: day0A, senderId: 'usr_a' }
    ],
    now,
    { requiredSenders: 2 }
  );
  assert.equal(oneSidedOnly.count, 0);
  assert.equal(oneSidedOnly.isHotToday, false);
  assert.equal(oneSidedOnly.isAtRisk, false);
  assert.equal(oneSidedOnly.pendingToday, true);
  assert.deepEqual(oneSidedOnly.todaySenderIds, ['usr_a']);

  // Yesterday was mutual (day1 + day2), today only usr_a wrote -> still at risk (count 2, pendingToday true) until usr_b replies
  const waitingForReply = computeChatStreakFromMessages(
    [
      { time: day2A, senderId: 'usr_a' },
      { time: day2B, senderId: 'usr_b' },
      { time: day1A, senderId: 'usr_a' },
      { time: day1B, senderId: 'usr_b' },
      { time: day0A, senderId: 'usr_a' }
    ],
    now,
    { requiredSenders: 2 }
  );
  assert.equal(waitingForReply.count, 2);
  assert.equal(waitingForReply.isHotToday, false);
  assert.equal(waitingForReply.isAtRisk, true);
  assert.equal(waitingForReply.pendingToday, true);
  assert.deepEqual(waitingForReply.todaySenderIds, ['usr_a']);

  // Neither wrote today, yesterday was mutual -> at risk, not pending
  const atRisk = computeChatStreakFromMessages(
    [
      { time: day2A, senderId: 'usr_a' },
      { time: day2B, senderId: 'usr_b' },
      { time: day1A, senderId: 'usr_a' },
      { time: day1B, senderId: 'usr_b' }
    ],
    now,
    { requiredSenders: 2 }
  );
  assert.equal(atRisk.count, 2);
  assert.equal(atRisk.isHotToday, false);
  assert.equal(atRisk.isAtRisk, true);
  assert.equal(atRisk.pendingToday, false);

  // Expired streak (only day 4 mutual)
  const expired = computeChatStreakFromMessages(
    [
      { time: day4A, senderId: 'usr_a' },
      { time: day4B, senderId: 'usr_b' }
    ],
    now,
    { requiredSenders: 2 }
  );
  assert.equal(expired.count, 0);
  assert.equal(expired.isHotToday, false);
  assert.equal(expired.isAtRisk, false);
  assert.equal(expired.pendingToday, false);

  // Saved messages (self chat, requiredSenders: 1) still counts single sender
  const selfChat = computeChatStreakFromMessages(
    [
      { time: day1A, senderId: 'usr_a' },
      { time: day0A, senderId: 'usr_a' }
    ],
    now,
    { requiredSenders: 1 }
  );
  assert.equal(selfChat.count, 2);
  assert.equal(selfChat.isHotToday, true);
  assert.equal(selfChat.pendingToday, false);
});

test('shiftDayKey and getLocalDayKey handle month boundaries accurately', () => {
  assert.equal(shiftDayKey('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDayKey('2026-01-01', -1), '2025-12-31');
  const d = new Date(2026, 0, 5, 12, 0, 0);
  assert.equal(getLocalDayKey(d), '2026-01-05');
});

test('getStreakVisualMeta and formatDaysLabel return proper tiers and Russian plurals', () => {
  assert.equal(getStreakVisualMeta(0, false).tier, 0);
  assert.equal(getStreakVisualMeta(1, true).tier, 1);
  assert.equal(getStreakVisualMeta(5, true).tier, 2);
  assert.equal(getStreakVisualMeta(15, true).tier, 3);
  assert.equal(getStreakVisualMeta(35, true).tier, 4);

  const frozenMeta = getStreakVisualMeta(7, false, true);
  assert.equal(frozenMeta.tierTitle, 'Замороженный щит');
  assert.ok(frozenMeta.badgeGradient.includes('cyan'));

  assert.equal(formatDaysLabel(1), '1 день');
  assert.equal(formatDaysLabel(2), '2 дня');
  assert.equal(formatDaysLabel(5), '5 дней');
  assert.equal(formatDaysLabel(11), '11 дней');
  assert.equal(formatDaysLabel(21), '21 день');
});

test('computeChatStreakFromMessages supports freezing today and rescuing yesterday without inflating count', () => {
  const nowMay15 = new Date(2026, 4, 15, 14, 0, 0).getTime();
  const may13A = new Date(2026, 4, 13, 10, 0, 0).toISOString();
  const may13B = new Date(2026, 4, 13, 11, 0, 0).toISOString();
  const may14A = new Date(2026, 4, 14, 10, 0, 0).toISOString();
  const may14B = new Date(2026, 4, 14, 11, 0, 0).toISOString();
  const may15A = new Date(2026, 4, 15, 12, 0, 0).toISOString();
  const may15B = new Date(2026, 4, 15, 13, 0, 0).toISOString();
  const may16A = new Date(2026, 4, 16, 12, 0, 0).toISOString();
  const may16B = new Date(2026, 4, 16, 13, 0, 0).toISOString();

  // 1) Proactive freeze on May 15 preserves 2-day streak from May 13-14 without inflating count
  const frozenToday = computeChatStreakFromMessages(
    [
      { time: may13A, senderId: 'usr_a' },
      { time: may13B, senderId: 'usr_b' },
      { time: may14A, senderId: 'usr_a' },
      { time: may14B, senderId: 'usr_b' }
    ],
    nowMay15,
    { requiredSenders: 2, frozenDays: ['2026-05-15'] }
  );
  assert.equal(frozenToday.count, 2);
  assert.equal(frozenToday.isFrozenToday, true);
  assert.equal(frozenToday.isAtRisk, false);
  assert.equal(frozenToday.isHotToday, false);

  // 2) If both participants actually reply on a frozen May 15, it counts as mutual hot day (+1 = 3)
  const frozenThenMutual = computeChatStreakFromMessages(
    [
      { time: may13A, senderId: 'usr_a' },
      { time: may13B, senderId: 'usr_b' },
      { time: may14A, senderId: 'usr_a' },
      { time: may14B, senderId: 'usr_b' },
      { time: may15A, senderId: 'usr_a' },
      { time: may15B, senderId: 'usr_b' }
    ],
    nowMay15,
    { requiredSenders: 2, frozenDays: ['2026-05-15'] }
  );
  assert.equal(frozenThenMutual.count, 3);
  assert.equal(frozenThenMutual.isHotToday, true);

  // 3) Bridging into May 16 after frozen May 15 keeps May 13-14 + adds May 16 = 3
  const nowMay16 = new Date(2026, 4, 16, 15, 0, 0).getTime();
  const bridgedNextDay = computeChatStreakFromMessages(
    [
      { time: may13A, senderId: 'usr_a' },
      { time: may13B, senderId: 'usr_b' },
      { time: may14A, senderId: 'usr_a' },
      { time: may14B, senderId: 'usr_b' },
      { time: may16A, senderId: 'usr_a' },
      { time: may16B, senderId: 'usr_b' }
    ],
    nowMay16,
    { requiredSenders: 2, frozenDays: ['2026-05-15'] }
  );
  assert.equal(bridgedNextDay.count, 3);
  assert.equal(bridgedNextDay.isHotToday, true);

  // 4) Missed yesterday (May 14): before rescue shows canRescueYesterday = true with rescuableCount = 1
  const brokenYesterday = computeChatStreakFromMessages(
    [
      { time: may13A, senderId: 'usr_a' },
      { time: may13B, senderId: 'usr_b' }
    ],
    nowMay15,
    { requiredSenders: 2 }
  );
  assert.equal(brokenYesterday.count, 0);
  assert.equal(brokenYesterday.canRescueYesterday, true);
  assert.equal(brokenYesterday.rescuableCount, 1);

  // After rescuing May 14 with freeze -> streak restores to 1 (at risk today)
  const rescuedYesterday = computeChatStreakFromMessages(
    [
      { time: may13A, senderId: 'usr_a' },
      { time: may13B, senderId: 'usr_b' }
    ],
    nowMay15,
    { requiredSenders: 2, frozenDays: ['2026-05-14'] }
  );
  assert.equal(rescuedYesterday.count, 1);
  assert.equal(rescuedYesterday.isAtRisk, true);
  assert.equal(rescuedYesterday.canRescueYesterday, false);
});
