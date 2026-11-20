export interface ChatStreakInfo {
  streakKey: string;
  count: number;
  lastActiveDay: string;
  customName: string;
  isHotToday: boolean;
  isAtRisk: boolean;
  isFrozenToday?: boolean;
  frozenDays?: string[];
  canRescueYesterday?: boolean;
  rescuableCount?: number;
  pendingToday?: boolean;
  todaySenderIds?: string[];
  requiredSenders?: number;
}

export interface StreakVisualMeta {
  tier: 0 | 1 | 2 | 3 | 4;
  tierTitle: string;
  badgeGradient: string;
  textColor: string;
  ringColor: string;
  emoji: string;
}

export function getLocalDayKey(dateInput: number | string | Date = Date.now()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDayKey(dayKey: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return '';
  const utcMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays);
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function extractFrozenDays(rawFrozen: unknown): string[] {
  if (!rawFrozen) return [];
  const isDayKey = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (Array.isArray(rawFrozen)) {
    return Array.from(new Set(rawFrozen.filter((x): x is string => typeof x === 'string' && isDayKey(x)))).sort();
  }
  if (typeof rawFrozen === 'object') {
    return Object.entries(rawFrozen as Record<string, unknown>)
      .filter(([k, v]) => isDayKey(k) && Boolean(v))
      .map(([k]) => k)
      .sort();
  }
  return [];
}

export function getStreakChatKey(params: {
  currentUserId?: string | null;
  targetUserId?: string | null;
  groupId?: string | null;
}): string | null {
  const { currentUserId, targetUserId, groupId } = params;
  const sanitize = (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (groupId) {
    return `group_${sanitize(groupId)}`;
  }
  if (currentUserId && targetUserId) {
    if (currentUserId === targetUserId) {
      return `direct_self_${sanitize(currentUserId)}`;
    }
    const pair = [sanitize(currentUserId), sanitize(targetUserId)].sort();
    return `direct_${pair[0]}__${pair[1]}`;
  }
  return null;
}

export function computeChatStreakFromMessages(
  messages: ReadonlyArray<{ time: string; senderId?: string }>,
  nowMs: number = Date.now(),
  options?: { requiredSenders?: number; frozenDays?: Iterable<string> }
): {
  count: number;
  lastActiveDay: string;
  isHotToday: boolean;
  isAtRisk: boolean;
  isFrozenToday: boolean;
  frozenDays: string[];
  canRescueYesterday: boolean;
  rescuableCount: number;
  pendingToday: boolean;
  todaySenderIds: string[];
  requiredSenders: number;
} {
  const requiredSenders = Math.max(1, options?.requiredSenders ?? 2);
  const frozenSet = new Set<string>();
  if (options?.frozenDays) {
    for (const d of options.frozenDays) {
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        frozenSet.add(d);
      }
    }
  }
  const frozenDays = Array.from(frozenSet).sort();

  const daySenders = new Map<string, Set<string>>();
  let latestAnyDay = '';
  let latestCompletedDay = '';

  for (const m of messages) {
    const dk = getLocalDayKey(m.time);
    if (!dk) continue;
    let senders = daySenders.get(dk);
    if (!senders) {
      senders = new Set<string>();
      daySenders.set(dk, senders);
    }
    const sender = m.senderId && m.senderId.trim() ? m.senderId.trim() : '__unknown_sender__';
    senders.add(sender);

    if (!latestAnyDay || dk > latestAnyDay) {
      latestAnyDay = dk;
    }
    if (senders.size >= requiredSenders && (!latestCompletedDay || dk > latestCompletedDay)) {
      latestCompletedDay = dk;
    }
  }

  const todayKey = getLocalDayKey(nowMs);
  const yesterdayKey = shiftDayKey(todayKey, -1);
  const dayBeforeYesterdayKey = shiftDayKey(yesterdayKey, -1);
  const todaySenderIds = Array.from(daySenders.get(todayKey) || []);
  const isMutualDay = (dk: string) => (daySenders.get(dk)?.size ?? 0) >= requiredSenders;
  const isFrozenDay = (dk: string) => frozenSet.has(dk);
  const isBridgedDay = (dk: string) => isMutualDay(dk) || isFrozenDay(dk);

  const countMutualAlongBridge = (startDay: string): number => {
    let total = 0;
    let cursor = startDay;
    let steps = 0;
    while (cursor && isBridgedDay(cursor) && steps < 3650) {
      if (isMutualDay(cursor)) {
        total += 1;
      }
      cursor = shiftDayKey(cursor, -1);
      steps += 1;
    }
    return total;
  };

  if (daySenders.size === 0 && frozenSet.size === 0) {
    return {
      count: 0,
      lastActiveDay: '',
      isHotToday: false,
      isAtRisk: false,
      isFrozenToday: false,
      frozenDays,
      canRescueYesterday: false,
      rescuableCount: 0,
      pendingToday: false,
      todaySenderIds: [],
      requiredSenders
    };
  }

  const todayMutual = isMutualDay(todayKey);
  const todayFrozen = isFrozenDay(todayKey);
  const pendingToday =
    requiredSenders > 1 && todaySenderIds.length > 0 && todaySenderIds.length < requiredSenders;

  if (todayMutual) {
    const count = countMutualAlongBridge(todayKey);
    return {
      count,
      lastActiveDay: todayKey,
      isHotToday: true,
      isAtRisk: false,
      isFrozenToday: todayFrozen,
      frozenDays,
      canRescueYesterday: false,
      rescuableCount: 0,
      pendingToday: false,
      todaySenderIds,
      requiredSenders
    };
  }

  if (todayFrozen) {
    const count = countMutualAlongBridge(todayKey);
    return {
      count,
      lastActiveDay: latestCompletedDay || todayKey,
      isHotToday: false,
      isAtRisk: false,
      isFrozenToday: true,
      frozenDays,
      canRescueYesterday: false,
      rescuableCount: 0,
      pendingToday,
      todaySenderIds,
      requiredSenders
    };
  }

  if (isBridgedDay(yesterdayKey)) {
    const count = countMutualAlongBridge(yesterdayKey);
    return {
      count,
      lastActiveDay: yesterdayKey,
      isHotToday: false,
      isAtRisk: count > 0,
      isFrozenToday: false,
      frozenDays,
      canRescueYesterday: false,
      rescuableCount: 0,
      pendingToday,
      todaySenderIds,
      requiredSenders
    };
  }

  const rescuableCount = isBridgedDay(dayBeforeYesterdayKey)
    ? countMutualAlongBridge(dayBeforeYesterdayKey)
    : 0;

  return {
    count: 0,
    lastActiveDay: latestCompletedDay || latestAnyDay,
    isHotToday: false,
    isAtRisk: false,
    isFrozenToday: false,
    frozenDays,
    canRescueYesterday: rescuableCount > 0,
    rescuableCount,
    pendingToday,
    todaySenderIds,
    requiredSenders
  };
}

export function getStreakVisualMeta(
  count: number,
  isHotToday: boolean,
  isFrozenToday: boolean = false
): StreakVisualMeta {
  if (count <= 0) {
    return {
      tier: 0,
      tierTitle: 'Искра ждёт',
      badgeGradient: 'from-slate-800 to-slate-900',
      textColor: 'text-slate-300',
      ringColor: 'border-slate-600/60',
      emoji: '🔥'
    };
  }

  if (isFrozenToday && !isHotToday) {
    return {
      tier: count >= 30 ? 4 : count >= 10 ? 3 : count >= 3 ? 2 : 1,
      tierTitle: 'Замороженный щит',
      badgeGradient: 'from-cyan-600 via-sky-500 to-blue-600',
      textColor: 'text-white',
      ringColor: 'border-cyan-300/80',
      emoji: '🔥'
    };
  }

  if (count >= 30) {
    return {
      tier: 4,
      tierTitle: 'Космический огонь',
      badgeGradient: isHotToday
        ? 'from-fuchsia-600 via-amber-500 to-cyan-500'
        : 'from-fuchsia-900/70 via-amber-800/70 to-cyan-900/70',
      textColor: isHotToday ? 'text-white' : 'text-amber-200',
      ringColor: 'border-fuchsia-400/70',
      emoji: '🔥'
    };
  }

  if (count >= 10) {
    return {
      tier: 3,
      tierTitle: 'Неоновое пламя',
      badgeGradient: isHotToday
        ? 'from-rose-500 via-pink-500 to-amber-500'
        : 'from-rose-900/70 via-pink-900/70 to-amber-800/70',
      textColor: isHotToday ? 'text-white' : 'text-rose-200',
      ringColor: 'border-pink-400/70',
      emoji: '🔥'
    };
  }

  if (count >= 3) {
    return {
      tier: 2,
      tierTitle: 'Яркий огонёк',
      badgeGradient: isHotToday
        ? 'from-orange-500 via-rose-500 to-amber-400'
        : 'from-orange-900/70 to-amber-900/70',
      textColor: isHotToday ? 'text-white' : 'text-amber-200',
      ringColor: 'border-orange-400/70',
      emoji: '🔥'
    };
  }

  return {
    tier: 1,
    tierTitle: 'Первая искра',
    badgeGradient: isHotToday
      ? 'from-amber-500 to-orange-600'
      : 'from-amber-900/70 to-orange-950/70',
    textColor: isHotToday ? 'text-white' : 'text-amber-200',
    ringColor: 'border-amber-400/60',
    emoji: '🔥'
  };
}

export function formatDaysLabel(count: number): string {
  const abs = Math.abs(Math.floor(count));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${abs} дней`;
  if (mod10 === 1) return `${abs} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${abs} дня`;
  return `${abs} дней`;
}
