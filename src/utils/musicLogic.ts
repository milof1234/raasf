export interface ParsedTrackInfo {
  title: string;
  artist: string;
}

export interface WindowsNowPlayingState {
  connected: boolean;
  stale: boolean;
  title: string;
  artist: string;
  source: string;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
}

export function sanitizeChannelId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'cosmo_default';
}

export function getOrCreateMusicChannelId(): string {
  const storageKey = 'cosmo_music_channel_id';
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing && /^[a-zA-Z0-9_-]{6,64}$/.test(existing)) {
      return existing;
    }
    const created = 'win_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return 'win_' + Math.random().toString(36).slice(2, 10);
  }
}

export function parseWindowTitleToTrack(rawTitle: string, fallbackSource = 'Windows'): ParsedTrackInfo {
  const trimmed = rawTitle.trim();
  if (!trimmed) {
    return { title: 'Без названия', artist: fallbackSource };
  }
  const sepIdx = trimmed.indexOf(' - ');
  if (sepIdx > 0) {
    const artist = trimmed.slice(0, sepIdx).trim();
    const title = trimmed.slice(sepIdx + 3).trim();
    if (artist && title) {
      return { artist, title };
    }
  }
  return { title: trimmed, artist: fallbackSource };
}

export function parseAudioFileName(fileName: string): ParsedTrackInfo {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '').trim();
  return parseWindowTitleToTrack(withoutExt, 'Локальный файл');
}

export function buildWindowsOneLiner(origin: string, channel: string): string {
  const safeOrigin = origin.replace(/\/+$/, '');
  const safeChannel = sanitizeChannelId(channel);
  return `irm "${safeOrigin}/api/music/windows-script?channel=${safeChannel}&origin=${encodeURIComponent(safeOrigin)}" | iex`;
}

export function computeAudioEnergyBars(frequencyData: Uint8Array, barCount = 12): number[] {
  if (!frequencyData || frequencyData.length === 0 || barCount <= 0) {
    return Array.from({ length: Math.max(0, barCount) }, () => 0);
  }

  const usableBins = Math.min(frequencyData.length, Math.max(barCount * 4, 24));
  const step = Math.max(1, Math.floor(usableBins / barCount));
  const bars: number[] = [];

  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    let count = 0;
    const start = i * step;
    const end = Math.min(frequencyData.length, start + step);
    for (let j = start; j < end; j++) {
      sum += frequencyData[j];
      count++;
    }
    const avg = count > 0 ? sum / count : 0;
    bars.push(Math.min(1, Math.max(0, avg / 255)));
  }

  return bars;
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function computeLiveTrackProgress(
  basePositionSec: number,
  durationSec: number,
  syncedAtMs: number,
  isPlaying: boolean,
  nowMs: number
): { positionSec: number; durationSec: number; progressPct: number } {
  const safeDur = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  const safeBase = Number.isFinite(basePositionSec) && basePositionSec > 0 ? basePositionSec : 0;
  const elapsedSec = isPlaying && syncedAtMs > 0 ? Math.max(0, (nowMs - syncedAtMs) / 1000) : 0;
  let pos = safeBase + elapsedSec;
  if (safeDur > 0) {
    pos = Math.min(safeDur, pos);
  }
  const progressPct = safeDur > 0 ? Math.min(100, Math.max(0, (pos / safeDur) * 100)) : 0;
  return { positionSec: pos, durationSec: safeDur, progressPct };
}

export function getListenSessionKey(params: {
  currentUserId?: string | null;
  activeChatUserId?: string | null;
  activeGroupId?: string | null;
}): string | null {
  const sanitize = (s: string) => s.replace(/[.#$\[\]/]/g, '_');
  if (params.activeGroupId) {
    return `group_${sanitize(params.activeGroupId)}`;
  }
  if (params.currentUserId && params.activeChatUserId) {
    if (params.currentUserId === params.activeChatUserId) {
      return `dm_${sanitize(params.currentUserId)}`;
    }
    const sorted = [sanitize(params.currentUserId), sanitize(params.activeChatUserId)].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  }
  return null;
}

export function computeSynchronizedPositionSec(
  session: {
    isPlaying: boolean;
    positionSec: number;
    durationSec?: number;
    updatedAt: number;
  },
  nowServerMs: number
): number {
  const base = Number.isFinite(session.positionSec) && session.positionSec > 0 ? session.positionSec : 0;
  const elapsedSec =
    session.isPlaying && Number.isFinite(session.updatedAt) && session.updatedAt > 0
      ? Math.max(0, (nowServerMs - session.updatedAt) / 1000)
      : 0;
  let pos = base + elapsedSec;
  if (Number.isFinite(session.durationSec) && (session.durationSec || 0) > 0) {
    pos = Math.min(session.durationSec!, pos);
  }
  return Math.max(0, pos);
}

export function shouldResyncPlayback(
  localPosSec: number,
  targetPosSec: number,
  thresholdSec = 1.8
): boolean {
  if (!Number.isFinite(localPosSec) || !Number.isFinite(targetPosSec)) return false;
  return Math.abs(localPosSec - targetPosSec) > thresholdSec;
}

