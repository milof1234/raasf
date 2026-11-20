export type YouTubeGenre = 'all' | 'phonk' | 'lofi' | 'space' | 'pop' | 'rock' | 'hiphop' | 'ru';

export interface YouTubeTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  thumbnail: string;
  genre?: string;
  views?: string;
}

export interface ContactYouTubeStatus {
  isAvailable: boolean;
  region: 'RU_NO_VPN' | 'RU_WITH_VPN' | 'GLOBAL';
  reason?: string;
}

export const MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT = 'Эта функция недоступна для данного контакта';

const GENRE_SEARCH_QUERIES: Record<string, string> = {
  all: 'Top Global Music Hits 2025',
  ru: 'Русские музыкальные хиты',
  phonk: 'Drift Phonk Music',
  lofi: 'Lofi Hip Hop Beats',
  space: 'Synthwave Space Music',
  pop: 'Pop Music Hits',
  rock: 'Rock Classics Hits',
  hiphop: 'Hip Hop Rap Hits'
};

export function parseYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // URL patterns: youtube.com/watch?v=ID, youtu.be/ID, music.youtube.com/watch?v=ID, embed/ID
  const urlMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
  );
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  return null;
}

export function parseDurationLabelToSec(label: string): number {
  if (!label) return 0;
  const trimmed = label.trim();
  if (!/^\d+(?::\d{1,2}){1,2}$/.test(trimmed)) return 0;
  const parts = trimmed.split(':').map(Number);
  if (parts.some(n => !Number.isFinite(n))) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

export function formatYouTubeDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  options: { autoplay?: boolean; start?: number } = {}
): string {
  const safeId = encodeURIComponent(videoId);
  const autoplay = options.autoplay ? 1 : 0;
  const start = options.start && options.start > 0 ? `&start=${Math.floor(options.start)}` : '';
  return `https://www.youtube.com/embed/${safeId}?autoplay=${autoplay}&enablejsapi=1&rel=0&modestbranding=1&origin=${encodeURIComponent(
    typeof window !== 'undefined' ? window.location.origin : 'https://cosmochat.ai.studio'
  )}${start}`;
}

/**
 * Parses real YouTube Music InnerTube search JSON (`music.youtube.com/youtubei/v1/search`)
 */
export function parseYouTubeMusicSearchResponse(data: any, genreLabel?: string): YouTubeTrack[] {
  const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
  const sections = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  const results: YouTubeTrack[] = [];
  const seenIds = new Set<string>();

  for (const sec of sections) {
    const shelf = sec?.musicShelfRenderer;
    if (!shelf || !Array.isArray(shelf.contents)) continue;

    for (const item of shelf.contents) {
      const renderer = item?.musicResponsiveListItemRenderer;
      if (!renderer) continue;

      const videoId: string | undefined =
        renderer?.playlistItemData?.videoId ||
        renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
          ?.playNavigationEndpoint?.watchEndpoint?.videoId;

      if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId) || seenIds.has(videoId)) {
        continue;
      }

      const flexCols = Array.isArray(renderer.flexColumns) ? renderer.flexColumns : [];
      const colTexts: string[] = flexCols.map((c: any) => {
        const runs = c?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        return runs.map((r: any) => r?.text || '').join('').trim();
      });

      const title = colTexts[0] || 'YouTube Music Track';
      const metaLine = colTexts[1] || '';
      const metaParts = metaLine.split(' • ').map(p => p.trim()).filter(Boolean);

      let durationSec = 0;
      if (metaParts.length > 0) {
        const maybeDur = parseDurationLabelToSec(metaParts[metaParts.length - 1]);
        if (maybeDur > 0) {
          durationSec = maybeDur;
          metaParts.pop();
        }
      }

      // Skip prefix if first part is "Песня" / "Song" / "Видео" / "Video"
      if (metaParts.length > 1 && /^(песня|song|видео|video)$/i.test(metaParts[0])) {
        metaParts.shift();
      }

      const artist = metaParts[0] || 'YouTube Music';
      const album = metaParts.length > 1 ? metaParts.slice(1).join(' • ') : undefined;
      const views = colTexts[2] || undefined;

      const thumbs = renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      let thumbnail: string = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      if (thumbnail.includes('w120-h120')) {
        thumbnail = thumbnail.replace('w120-h120', 'w300-h300');
      }

      seenIds.add(videoId);
      results.push({
        id: videoId,
        title,
        artist,
        album,
        durationSec,
        thumbnail,
        genre: genreLabel && genreLabel !== 'all' ? genreLabel : undefined,
        views
      });
    }
  }

  return results;
}

/**
 * Fetches real tracks from YouTube Music (`music.youtube.com/youtubei/v1/search`)
 * or resolves a direct YouTube / YouTube Music link via oEmbed.
 */
export async function searchRealYouTubeMusic(query: string, genre = 'all'): Promise<YouTubeTrack[]> {
  const trimmed = (query || '').trim();
  const directVideoId = parseYouTubeVideoId(trimmed);

  if (directVideoId) {
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${directVideoId}`)}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        return [
          {
            id: directVideoId,
            title: oembed?.title || `YouTube Track (${directVideoId})`,
            artist: oembed?.author_name || 'YouTube Music',
            durationSec: 0,
            thumbnail: oembed?.thumbnail_url || `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
            genre: genre !== 'all' ? genre : undefined
          }
        ];
      }
    } catch {
      // Fall through to InnerTube search by ID
    }
  }

  const effectiveQuery = trimmed || GENRE_SEARCH_QUERIES[genre] || GENRE_SEARCH_QUERIES.all;

  const response = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      Origin: 'https://music.youtube.com',
      Referer: 'https://music.youtube.com/'
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20241106.01.00',
          hl: 'ru',
          gl: 'US'
        }
      },
      query: effectiveQuery,
      // Filter: Songs (EgWKAQIIAWoMEAMQBBAJEAoQBRAV)
      params: directVideoId ? undefined : 'EgWKAQIIAWoMEAMQBBAJEAoQBRAV'
    }),
    signal: AbortSignal.timeout(7000)
  });

  if (!response.ok) {
    throw new Error(`YouTube Music API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const parsed = parseYouTubeMusicSearchResponse(data, genre);

  if (parsed.length === 0 && directVideoId) {
    return [
      {
        id: directVideoId,
        title: `YouTube Track (${directVideoId})`,
        artist: 'YouTube',
        durationSec: 0,
        thumbnail: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`
      }
    ];
  }

  return parsed;
}

export interface ContactAccessInput {
  id?: string;
  name?: string;
  phone?: string;
  youtubeAccess?: 'available' | 'restricted' | 'auto';
  region?: 'RU_NO_VPN' | 'RU_WITH_VPN' | 'GLOBAL' | 'RU';
  isVpnActive?: boolean;
}

/**
 * Validates whether YouTube Music / Listen Together is accessible for the contact.
 * If the contact is without VPN in Russia or has restricted access,
 * it returns allowed: false and the exact required message:
 * "Эта функция недоступна для данного контакта"
 */
export function checkContactYouTubeAccess(contact?: ContactAccessInput | null): {
  allowed: boolean;
  message?: string;
  region: 'RU_NO_VPN' | 'RU_WITH_VPN' | 'GLOBAL';
} {
  if (!contact) {
    return {
      allowed: false,
      message: MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT,
      region: 'RU_NO_VPN'
    };
  }

  const isRuNoVpn =
    contact.youtubeAccess === 'restricted' ||
    contact.region === 'RU_NO_VPN' ||
    (contact.region === 'RU' && contact.isVpnActive === false);

  if (isRuNoVpn) {
    return {
      allowed: false,
      message: MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT,
      region: 'RU_NO_VPN'
    };
  }

  const effectiveRegion: 'RU_NO_VPN' | 'RU_WITH_VPN' | 'GLOBAL' =
    contact.region === 'GLOBAL' ? 'GLOBAL' : 'RU_WITH_VPN';

  return {
    allowed: true,
    region: effectiveRegion
  };
}

/**
 * Client-side real reachability check for YouTube in the current browser.
 * Detects if the user's connection can load YouTube resources (e.g. VPN on / outside RU)
 * or if YouTube is blocked/throttled (Russia without VPN).
 */
export async function probeBrowserYouTubeReachability(timeoutMs = 3500): Promise<{
  reachable: boolean;
  isRussianEnv: boolean;
  region: 'RU_NO_VPN' | 'RU_WITH_VPN' | 'GLOBAL';
}> {
  const isRussianTz = (() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /Moscow|Samara|Kaliningrad|Yekaterinburg|Omsk|Novosibirsk|Krasnoyarsk|Irkutsk|Yakutsk|Vladivostok|Magadan|Kamchatka|Anadyr|Kirov|Saratov|Astrakhan|Volgograd|Ulyanovsk|Tomsk|Barnaul|Chita/i.test(
        tz
      );
    } catch {
      return false;
    }
  })();

  let serverCountry = '';
  try {
    const geoRes = await fetch('/api/music/youtube/client-status', {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500)
    });
    if (geoRes.ok) {
      const geo = await geoRes.json();
      serverCountry = (geo?.countryCode || '').toUpperCase();
    }
  } catch {
    // ignore
  }

  const isRussianEnv = serverCountry === 'RU' || (serverCountry === '' && isRussianTz);

  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return {
      reachable: !isRussianEnv,
      isRussianEnv,
      region: isRussianEnv ? 'RU_NO_VPN' : 'GLOBAL'
    };
  }

  // Real browser network probe to YouTube image CDN (no-CORS blocked Image load test)
  const canLoadImage = (url: string) =>
    new Promise<boolean>((resolve) => {
      const img = new Image();
      let settled = false;
      const timer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          img.src = '';
          resolve(false);
        }
      }, timeoutMs);

      img.onload = () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(true);
        }
      };
      img.onerror = () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(false);
        }
      };
      img.src = `${url}?t=${Date.now()}`;
    });

  const [ytimgOk, ytFaviconOk] = await Promise.all([
    canLoadImage('https://i.ytimg.com/vi/jfKfPfyJRdk/default.jpg'),
    canLoadImage('https://www.youtube.com/favicon.ico')
  ]);

  const reachable = ytimgOk && ytFaviconOk;

  if (!reachable) {
    return {
      reachable: false,
      isRussianEnv: true,
      region: 'RU_NO_VPN'
    };
  }

  return {
    reachable: true,
    isRussianEnv,
    region: isRussianEnv ? 'RU_WITH_VPN' : 'GLOBAL'
  };
}
