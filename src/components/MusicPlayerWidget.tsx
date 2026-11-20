import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Disc,
  Radio,
  FolderOpen,
  Monitor,
  Copy,
  Check,
  Sparkles,
  X,
  Activity,
  Youtube,
  Users,
  Search,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import {
  WindowsNowPlayingState,
  buildWindowsOneLiner,
  computeAudioEnergyBars,
  computeLiveTrackProgress,
  formatAudioTime,
  getOrCreateMusicChannelId,
  parseAudioFileName
} from '../utils/musicLogic';
import {
  YouTubeTrack,
  YouTubeGenre,
  checkContactYouTubeAccess,
  formatYouTubeDuration,
  buildYouTubeEmbedUrl,
  MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT,
  parseYouTubeVideoId,
  probeBrowserYouTubeReachability
} from '../utils/youtubeMusic';
import { UserProfile, ListenTogetherSession } from '../types/chat';

interface MusicPlayerWidgetProps {
  isActive: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  activeContact?: UserProfile | null;
  onShareTrackToChat?: (track: YouTubeTrack) => void;
  initialTrack?: YouTubeTrack | null;
  listenSession?: ListenTogetherSession | null;
  onSyncListenSession?: (session: Partial<ListenTogetherSession>) => void;
}

interface LocalTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
}

const BAR_COUNT = 12;

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string | HTMLElement, options: any) => any;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const MusicPlayerWidget: React.FC<MusicPlayerWidgetProps> = ({
  isActive,
  onClose,
  currentUser,
  activeContact,
  onShareTrackToChat,
  initialTrack,
  listenSession,
  onSyncListenSession
}) => {
  const [channelId] = useState<string>(() => getOrCreateMusicChannelId());
  const [windowsState, setWindowsState] = useState<WindowsNowPlayingState>({
    connected: false,
    stale: true,
    title: '',
    artist: '',
    source: '',
    isPlaying: false,
    positionSec: 0,
    durationSec: 0,
    updatedAt: 0
  });
  const [windowsSyncedAtMs, setWindowsSyncedAtMs] = useState<number>(0);
  const [liveNowMs, setLiveNowMs] = useState<number>(() => Date.now());

  // Real YouTube Music backend state
  const [ytTracks, setYtTracks] = useState<YouTubeTrack[]>([]);
  const [isLoadingYt, setIsLoadingYt] = useState<boolean>(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [currentYouTubeTrack, setCurrentYouTubeTrack] = useState<YouTubeTrack | null>(initialTrack || null);
  const [youtubePlaying, setYoutubePlaying] = useState<boolean>(Boolean(initialTrack));
  const [showYouTubeCatalog, setShowYouTubeCatalog] = useState(false);
  const [youtubeSearch, setYoutubeSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<YouTubeGenre>('ru');
  const [contactVpnOverride, setContactVpnOverride] = useState<boolean | null>(null);
  const [contactAccessNotice, setContactAccessNotice] = useState<string | null>(null);
  const [sharedWithContact, setSharedWithContact] = useState<boolean>(false);

  // YouTube IPlayer states & refs
  const [ytTime, setYtTime] = useState<number>(0);
  const [ytDuration, setYtDuration] = useState<number>(0);
  const ytPlayerContainerId = useRef<string>('cosmo-yt-iframe-player-' + Math.random().toString(36).slice(2, 8));
  const ytPlayerRef = useRef<any>(null);
  const ytApiReadyRef = useRef<boolean>(false);

  // Local MP3 playlist state
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [localIndex, setLocalIndex] = useState(0);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [localDuration, setLocalDuration] = useState(0);

  // Live system audio capture (getDisplayMedia)
  const [isCapturingAudio, setIsCapturingAudio] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Setup popover & copy state
  const [showWindowsSetup, setShowWindowsSetup] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Refs for 60fps DOM animation without React re-render overhead
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const discPulseRef = useRef<HTMLDivElement | null>(null);
  const glowBarRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Web Audio & Media refs
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const captureSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasLocalTrack = localTracks.length > 0 && Boolean(localTracks[localIndex]);
  const hasYouTubeTrack = Boolean(currentYouTubeTrack);
  const isWindowsActive = windowsState.connected && Boolean(windowsState.title);

  // Determine effective playback state & displayed metadata
  const effectivePlaying = hasLocalTrack
    ? localPlaying
    : hasYouTubeTrack
      ? youtubePlaying
      : isWindowsActive
        ? windowsState.isPlaying
        : isCapturingAudio;

  const displayTitle = hasLocalTrack
    ? localTracks[localIndex].title
    : hasYouTubeTrack
      ? currentYouTubeTrack!.title
      : isWindowsActive
        ? windowsState.title
        : 'Нет активного трека';

  const displayArtist = hasLocalTrack
    ? localTracks[localIndex].artist
    : hasYouTubeTrack
      ? currentYouTubeTrack!.artist
      : isWindowsActive
        ? windowsState.artist || windowsState.source || 'Windows'
        : windowsState.connected
          ? 'Включите музыку в Spotify / плеере'
          : 'Выберите трек из базы YouTube Музыки или MP3';

  const displaySource = hasLocalTrack
    ? 'MP3'
    : hasYouTubeTrack
      ? (sharedWithContact ? 'Слушаем вместе 🎵' : 'YouTube Music')
      : isWindowsActive
        ? windowsState.source || 'Windows'
        : isCapturingAudio
          ? 'Звук ПК'
          : '';

  // Fetch real YouTube Music tracks from backend API
  useEffect(() => {
    let cancelled = false;
    const fetchCatalog = async () => {
      setIsLoadingYt(true);
      setYtError(null);
      try {
        const queryParam = youtubeSearch.trim() ? `&q=${encodeURIComponent(youtubeSearch.trim())}` : '';
        const res = await fetch(`/api/music/youtube/tracks?genre=${selectedGenre}${queryParam}`, {
          cache: 'no-store'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.tracks)) {
          setYtTracks(data.tracks);
        }
      } catch (err: any) {
        if (!cancelled) {
          setYtError(err?.message || 'Ошибка загрузки каталога');
        }
      } finally {
        if (!cancelled) setIsLoadingYt(false);
      }
    };

    const timer = window.setTimeout(fetchCatalog, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [youtubeSearch, selectedGenre]);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) {
      ytApiReadyRef.current = true;
      return;
    }

    if (!document.getElementById('youtube-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      ytApiReadyRef.current = true;
    };
  }, []);

  // Initialize or update official YT.Player when currentYouTubeTrack changes
  useEffect(() => {
    if (!currentYouTubeTrack) {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }
      return;
    }

    const videoId = currentYouTubeTrack.id;
    if (!videoId) return;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.loadVideoById({ videoId, startSeconds: 0 });
          if (youtubePlaying) {
            ytPlayerRef.current.playVideo();
          } else {
            ytPlayerRef.current.pauseVideo();
          }
          return;
        } catch {
          // recreate if needed
          ytPlayerRef.current = null;
        }
      }

      const containerEl = document.getElementById(ytPlayerContainerId.current);
      if (!containerEl) return;

      try {
        ytPlayerRef.current = new window.YT.Player(ytPlayerContainerId.current, {
          height: '100%',
          width: '100%',
          videoId,
          playerVars: {
            autoplay: youtubePlaying ? 1 : 0,
            controls: 1,
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0
          },
          events: {
            onReady: (event: any) => {
              const dur = event.target.getDuration?.() || currentYouTubeTrack.durationSec || 0;
              setYtDuration(dur);
              if (youtubePlaying) {
                event.target.playVideo();
              }
            },
            onStateChange: (event: any) => {
              const state = event.data;
              const YTState = window.YT?.PlayerState || { PLAYING: 1, PAUSED: 2, ENDED: 0 };
              if (state === YTState.PLAYING) {
                setYoutubePlaying(true);
                const dur = event.target.getDuration?.() || 0;
                if (dur > 0) setYtDuration(dur);
              } else if (state === YTState.PAUSED) {
                setYoutubePlaying(false);
              } else if (state === YTState.ENDED) {
                setYoutubePlaying(false);
                handleNextYouTubeTrack();
              }
            }
          }
        });
      } catch {
        // fallback
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const interval = window.setInterval(() => {
        if (window.YT && window.YT.Player) {
          window.clearInterval(interval);
          initPlayer();
        }
      }, 250);
      return () => window.clearInterval(interval);
    }
  }, [currentYouTubeTrack?.id]);

  // Sync play/pause state with YT.Player instance
  useEffect(() => {
    if (!ytPlayerRef.current || typeof ytPlayerRef.current.playVideo !== 'function') return;
    try {
      if (youtubePlaying) {
        ytPlayerRef.current.playVideo();
      } else {
        ytPlayerRef.current.pauseVideo();
      }
    } catch {}
  }, [youtubePlaying]);

  // Poll YT.Player current time every 500ms
  useEffect(() => {
    if (!hasYouTubeTrack || !youtubePlaying) return;
    const timer = window.setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const t = ytPlayerRef.current.getCurrentTime() || 0;
          const d = ytPlayerRef.current.getDuration() || currentYouTubeTrack?.durationSec || 0;
          setYtTime(t);
          if (d > 0) setYtDuration(d);
        } catch {}
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [hasYouTubeTrack, youtubePlaying, currentYouTubeTrack?.durationSec]);

  // Sync initialTrack prop
  useEffect(() => {
    if (initialTrack) {
      setCurrentYouTubeTrack(initialTrack);
      setYoutubePlaying(true);
      setShowYouTubeCatalog(true);
    }
  }, [initialTrack]);

  const emitListenSessionUpdate = (track: YouTubeTrack, isPlaying: boolean, positionSec: number) => {
    if (!onSyncListenSession || !currentUser) return;
    onSyncListenSession({
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      durationSec: track.durationSec,
      thumbnail: track.thumbnail,
      genre: track.genre,
      isPlaying,
      positionSec,
      updatedAt: Date.now(),
      updatedBy: currentUser.id,
      updatedByName: currentUser.name
    });
  };

  const handlePlayYouTubeSolo = (track: YouTubeTrack) => {
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    setLocalPlaying(false);
    setCurrentYouTubeTrack(track);
    setYoutubePlaying(true);
    setSharedWithContact(false);
    setContactAccessNotice(null);
    setYtTime(0);
    setYtDuration(track.durationSec || 0);
  };

  const handleListenTogether = (track: YouTubeTrack) => {
    if (!activeContact) {
      handlePlayYouTubeSolo(track);
      return;
    }

    const effectiveContact = {
      ...activeContact,
      isVpnActive: contactVpnOverride !== null ? contactVpnOverride : activeContact.isVpnActive ?? false,
      region: (contactVpnOverride !== null
        ? (contactVpnOverride ? 'RU_WITH_VPN' : 'RU_NO_VPN')
        : (activeContact.region || 'RU_NO_VPN')) as any
    };

    const access = checkContactYouTubeAccess(effectiveContact);
    if (!access.allowed) {
      setContactAccessNotice(access.message || MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT);
      return;
    }

    setContactAccessNotice(null);
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    setLocalPlaying(false);
    setCurrentYouTubeTrack(track);
    setYoutubePlaying(true);
    setSharedWithContact(true);
    setYtTime(0);
    setYtDuration(track.durationSec || 0);
    onShareTrackToChat?.(track);
    emitListenSessionUpdate(track, true, 0);
  };

  const handleNextYouTubeTrack = () => {
    if (ytTracks.length === 0) return;
    const idx = ytTracks.findIndex(t => t.id === currentYouTubeTrack?.id);
    const nextIdx = (idx + 1) % ytTracks.length;
    const nextTrack = ytTracks[nextIdx];
    setCurrentYouTubeTrack(nextTrack);
    setYoutubePlaying(true);
    setYtTime(0);
    if (sharedWithContact) {
      emitListenSessionUpdate(nextTrack, true, 0);
    }
  };

  const handlePrevYouTubeTrack = () => {
    if (ytTracks.length === 0) return;
    const idx = ytTracks.findIndex(t => t.id === currentYouTubeTrack?.id);
    const prevIdx = (idx - 1 + ytTracks.length) % ytTracks.length;
    const prevTrack = ytTracks[prevIdx];
    setCurrentYouTubeTrack(prevTrack);
    setYoutubePlaying(true);
    setYtTime(0);
    if (sharedWithContact) {
      emitListenSessionUpdate(prevTrack, true, 0);
    }
  };

  const handleNextTrack = () => {
    if (hasLocalTrack) {
      handleNextLocal();
      return;
    }
    if (hasYouTubeTrack) {
      handleNextYouTubeTrack();
      return;
    }
  };

  const handlePrevTrack = () => {
    if (hasLocalTrack) {
      handlePrevLocal();
      return;
    }
    if (hasYouTubeTrack) {
      handlePrevYouTubeTrack();
      return;
    }
  };

  const handleTogglePlay = () => {
    if (hasLocalTrack) {
      setLocalPlaying(p => !p);
      return;
    }
    if (hasYouTubeTrack) {
      const nextPlay = !youtubePlaying;
      setYoutubePlaying(nextPlay);
      if (sharedWithContact && currentYouTubeTrack) {
        emitListenSessionUpdate(currentYouTubeTrack, nextPlay, ytTime);
      }
      return;
    }
  };

  const oneLinerCommand =
    typeof window !== 'undefined'
      ? buildWindowsOneLiner(window.location.origin, channelId)
      : '';

  // Cleanup Web Audio / capture stream helper
  const stopCaptureStream = useCallback(() => {
    if (captureSourceRef.current) {
      try {
        captureSourceRef.current.disconnect();
      } catch {}
      captureSourceRef.current = null;
    }
    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach(t => t.stop());
      captureStreamRef.current = null;
    }
    setIsCapturingAudio(false);
  }, []);

  // Poll Windows SMTC bridge from backend every 1s while widget is active
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

    const pollNowPlaying = async () => {
      try {
        const res = await fetch(`/api/music/now-playing?channel=${encodeURIComponent(channelId)}`, {
          cache: 'no-store'
        });
        if (!res.ok || cancelled) return;
        const data: WindowsNowPlayingState = await res.json();
        if (!cancelled) {
          const now = Date.now();
          setWindowsState(data);
          setWindowsSyncedAtMs(now);
          setLiveNowMs(now);
        }
      } catch {}
    };

    pollNowPlaying();
    const timer = window.setInterval(pollNowPlaying, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isActive, channelId]);

  useEffect(() => {
    if (!isActive || hasLocalTrack || hasYouTubeTrack || !isWindowsActive || !windowsState.isPlaying || windowsState.durationSec <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setLiveNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [isActive, hasLocalTrack, hasYouTubeTrack, isWindowsActive, windowsState.isPlaying, windowsState.durationSec]);

  const ensureAudioAnalyser = useCallback(() => {
    if (audioCtxRef.current && analyserRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return { ctx: audioCtxRef.current, analyser: analyserRef.current };
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.78;
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    return { ctx, analyser };
  }, []);

  const handleToggleCaptureAudio = async () => {
    setCaptureError(null);
    if (isCapturingAudio) {
      stopCaptureStream();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setCaptureError('Браузер не поддерживает захват системного звука');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      stream.getVideoTracks().forEach(track => track.stop());
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop());
        setCaptureError('Отметьте «Поделиться аудио» при выборе окна/экрана');
        return;
      }

      const { ctx, analyser } = ensureAudioAnalyser();
      const source = ctx.createMediaStreamSource(new MediaStream(audioTracks));
      source.connect(analyser);

      audioTracks[0].addEventListener('ended', () => {
        stopCaptureStream();
      });

      captureStreamRef.current = stream;
      captureSourceRef.current = source;
      setIsCapturingAudio(true);
    } catch {
      setCaptureError('Захват звука отменён');
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const added: LocalTrack[] = files.map((file, idx) => {
      const parsed = parseAudioFileName(file.name);
      return {
        id: `${Date.now()}_${idx}_${file.name}`,
        url: URL.createObjectURL(file),
        title: parsed.title,
        artist: parsed.artist
      };
    });

    setLocalTracks(prev => {
      const next = [...prev, ...added];
      if (prev.length === 0) {
        setLocalIndex(0);
      } else {
        setLocalIndex(prev.length);
      }
      return next;
    });
    setLocalPlaying(true);
    setShowWindowsSetup(false);
    e.target.value = '';
  };

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio || !hasLocalTrack) return;

    const track = localTracks[localIndex];
    if (audio.src !== track.url) {
      audio.src = track.url;
      setLocalTime(0);
      setLocalDuration(0);
    }

    if (localPlaying) {
      try {
        const { ctx, analyser } = ensureAudioAnalyser();
        if (!mediaSourceNodeRef.current) {
          const mediaSource = ctx.createMediaElementSource(audio);
          mediaSource.connect(analyser);
          analyser.connect(ctx.destination);
          mediaSourceNodeRef.current = mediaSource;
        }
      } catch {}
      audio.play().catch(() => {
        setLocalPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [hasLocalTrack, localIndex, localTracks, localPlaying, ensureAudioAnalyser]);

  // Equalizer & beat-pulse animation loop
  useEffect(() => {
    if (!isActive) return;

    const freqData = new Uint8Array(64);
    let phase = 0;

    const renderFrame = () => {
      phase += 0.08;
      let bars: number[];
      const hasLiveAudioSignal =
        (isCapturingAudio || (hasLocalTrack && localPlaying) || (hasYouTubeTrack && youtubePlaying)) && analyserRef.current;

      if (hasLiveAudioSignal && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(freqData);
        bars = computeAudioEnergyBars(freqData, BAR_COUNT);
      } else if (effectivePlaying) {
        bars = Array.from({ length: BAR_COUNT }, (_, idx) => {
          const wave1 = Math.sin(phase * 1.4 + idx * 0.55) * 0.32;
          const wave2 = Math.cos(phase * 2.1 - idx * 0.35) * 0.22;
          return Math.min(1, Math.max(0.18, 0.52 + wave1 + wave2));
        });
      } else {
        bars = Array.from({ length: BAR_COUNT }, () => 0.14);
      }

      let energySum = 0;
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = bars[i] ?? 0.14;
        energySum += val;
        const el = barRefs.current[i];
        if (el) {
          const clamped = Math.max(0.14, Math.min(1, val));
          el.style.transform = `scaleY(${clamped.toFixed(3)})`;
          el.style.opacity = effectivePlaying ? (0.55 + clamped * 0.45).toFixed(2) : '0.3';
        }
      }

      const avgEnergy = energySum / BAR_COUNT;
      if (discPulseRef.current) {
        const scale = effectivePlaying ? 1 + avgEnergy * 0.24 : 1;
        discPulseRef.current.style.transform = `scale(${scale.toFixed(3)})`;
        discPulseRef.current.style.opacity = effectivePlaying
          ? (0.35 + avgEnergy * 0.55).toFixed(2)
          : '0.15';
      }
      if (glowBarRef.current) {
        glowBarRef.current.style.opacity = effectivePlaying
          ? (0.45 + avgEnergy * 0.5).toFixed(2)
          : '0.2';
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    };

    rafRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isActive, isCapturingAudio, hasLocalTrack, localPlaying, hasYouTubeTrack, youtubePlaying, effectivePlaying]);

  useEffect(() => {
    if (!isActive) {
      stopCaptureStream();
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
      setLocalPlaying(false);
    }
  }, [isActive, stopCaptureStream]);

  useEffect(() => {
    return () => {
      stopCaptureStream();
      localTracks.forEach(t => URL.revokeObjectURL(t.url));
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isActive) return null;

  const handleCopyCommand = async () => {
    if (!oneLinerCommand) return;
    try {
      await navigator.clipboard.writeText(oneLinerCommand);
      setCopiedCommand(true);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = oneLinerCommand;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopiedCommand(true);
      } finally {
        document.body.removeChild(textarea);
      }
    }
    window.setTimeout(() => setCopiedCommand(false), 2000);
  };

  const handlePrevLocal = () => {
    if (localTracks.length === 0) return;
    setLocalIndex(i => (i - 1 + localTracks.length) % localTracks.length);
    setLocalPlaying(true);
  };

  const handleNextLocal = () => {
    if (localTracks.length === 0) return;
    setLocalIndex(i => (i + 1) % localTracks.length);
    setLocalPlaying(true);
  };

  const handleClearLocal = () => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.removeAttribute('src');
    }
    localTracks.forEach(t => URL.revokeObjectURL(t.url));
    setLocalTracks([]);
    setLocalIndex(0);
    setLocalPlaying(false);
    setLocalTime(0);
    setLocalDuration(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));

    if (hasLocalTrack) {
      const audio = audioElRef.current;
      if (!audio || !localDuration) return;
      audio.currentTime = ratio * localDuration;
      setLocalTime(audio.currentTime);
      return;
    }

    if (hasYouTubeTrack && ytDuration > 0 && ytPlayerRef.current) {
      const targetSec = ratio * ytDuration;
      try {
        ytPlayerRef.current.seekTo(targetSec, true);
        setYtTime(targetSec);
        if (sharedWithContact && currentYouTubeTrack) {
          emitListenSessionUpdate(currentYouTubeTrack, youtubePlaying, targetSec);
        }
      } catch {}
    }
  };

  const windowsTimeline = computeLiveTrackProgress(
    windowsState.positionSec,
    windowsState.durationSec,
    windowsSyncedAtMs,
    windowsState.isPlaying,
    liveNowMs
  );
  const hasWindowsTimeline = !hasLocalTrack && !hasYouTubeTrack && isWindowsActive && windowsTimeline.durationSec > 0;
  const hasYouTubeTimeline = !hasLocalTrack && hasYouTubeTrack && ytDuration > 0;

  const progressPct = hasLocalTrack
    ? localDuration > 0
      ? Math.min(100, (localTime / localDuration) * 100)
      : 0
    : hasYouTubeTimeline
      ? Math.min(100, (ytTime / ytDuration) * 100)
      : hasWindowsTimeline
        ? windowsTimeline.progressPct
        : 0;

  // Real contact YouTube availability status from Firebase
  const contactAccessCheck =
    activeContact && activeContact.id !== currentUser?.id
      ? checkContactYouTubeAccess(activeContact)
      : null;

  return (
    <div
      data-testid="music-player-widget"
      className="fixed top-2.5 left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-[640px] flex flex-col items-center pointer-events-none"
    >
      {/* Hidden audio element & file picker */}
      <audio
        ref={audioElRef}
        onTimeUpdate={e => setLocalTime(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setLocalDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          if (localTracks.length > 1) {
            handleNextLocal();
          } else {
            setLocalPlaying(false);
          }
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* Main Cosmic Media Capsule */}
      <div className="relative w-full pointer-events-auto rounded-2xl bg-slate-950/95 border border-cyan-500/45 shadow-[0_8px_32px_rgba(6,182,212,0.28)] px-3.5 py-2.5 text-white overflow-visible">
        <div
          ref={glowBarRef}
          className="pointer-events-none absolute inset-x-4 -top-px h-[2px] rounded-full bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-emerald-400 transition-opacity duration-200"
        />

        {effectivePlaying && (
          <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
            <span
              className="animate-music-note absolute -top-2 left-8 text-cyan-300 text-xs font-bold select-none"
              style={{ animationDelay: '0s' }}
            >
              ♪
            </span>
            <span
              className="animate-music-note absolute -top-3 left-14 text-fuchsia-300 text-xs font-bold select-none"
              style={{ animationDelay: '0.8s' }}
            >
              ♫
            </span>
            <span
              className="animate-music-note absolute -top-2 right-24 text-emerald-300 text-[11px] font-bold select-none"
              style={{ animationDelay: '1.5s' }}
            >
              ✦
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Disc / YouTube Cover */}
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <div
              ref={discPulseRef}
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/50 via-fuchsia-500/40 to-indigo-500/50 transition-transform duration-75"
            />
            {hasYouTubeTrack && currentYouTubeTrack?.thumbnail ? (
              <img
                src={currentYouTubeTrack.thumbnail}
                alt={currentYouTubeTrack.title}
                className={`relative w-9 h-9 rounded-full object-cover border border-rose-400/70 shadow-[0_0_14px_rgba(244,63,94,0.45)] ${
                  effectivePlaying ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '8s' }}
              />
            ) : (
              <div
                className={`relative w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-600 via-indigo-600 to-fuchsia-600 border border-cyan-300/70 flex items-center justify-center shadow-[0_0_14px_rgba(6,182,212,0.5)] ${
                  effectivePlaying ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '5s' }}
              >
                <Disc className="w-5 h-5 text-cyan-100" />
                <div className="absolute w-2.5 h-2.5 rounded-full bg-slate-950 border border-cyan-200" />
              </div>
            )}
          </div>

          {/* Track Metadata + Live Equalizer */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles
                className={`w-3.5 h-3.5 shrink-0 ${
                  effectivePlaying ? 'text-cyan-400 animate-pulse' : 'text-slate-500'
                }`}
              />
              <span
                data-testid="music-track-title"
                className="text-xs font-bold text-cyan-200 truncate"
              >
                {displayTitle}
              </span>
              {displaySource && (
                <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-500/40 whitespace-nowrap">
                  {isWindowsActive && !hasYouTubeTrack && !hasLocalTrack && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  {displaySource}
                </span>
              )}
              {(hasLocalTrack || hasYouTubeTimeline || hasWindowsTimeline) && (
                <span
                  data-testid="music-track-time"
                  className="shrink-0 text-[10px] font-mono text-cyan-200/80 ml-auto"
                >
                  {hasLocalTrack
                    ? `${formatAudioTime(localTime)} / ${formatAudioTime(localDuration)}`
                    : hasYouTubeTimeline
                      ? `${formatYouTubeDuration(ytTime)} / ${formatYouTubeDuration(ytDuration)}`
                      : `${formatAudioTime(windowsTimeline.positionSec)} / ${formatAudioTime(windowsTimeline.durationSec)}`}
                </span>
              )}
            </div>

            <div
              data-testid="music-track-artist"
              className="text-[11px] text-slate-400 truncate mt-0.5"
            >
              {displayArtist}
            </div>

            {/* Equalizer Bars + Live Track Progress Bar */}
            <div className="flex items-center gap-2 mt-1.5">
              {hasLocalTrack || hasYouTubeTimeline ? (
                <div
                  onClick={handleSeek}
                  className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden cursor-pointer"
                  title="Перемотать трек"
                >
                  <div
                    data-testid="music-progress-fill"
                    className="h-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 transition-all duration-150"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              ) : hasWindowsTimeline ? (
                <div className="flex-1 h-1.5 bg-slate-800/95 rounded-full overflow-hidden">
                  <div
                    data-testid="music-progress-fill"
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-emerald-400 transition-all duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              ) : (
                <div className="flex-1 h-1 bg-slate-800/90 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-emerald-400 transition-all duration-500 ${
                      effectivePlaying ? 'w-full opacity-90' : 'w-1/4 opacity-35'
                    }`}
                  />
                </div>
              )}

              {/* 12-Bar Beat-Reactive Equalizer */}
              <div
                className="flex items-end gap-[2px] h-3.5 shrink-0"
                aria-hidden="true"
              >
                {Array.from({ length: BAR_COUNT }).map((_, i) => (
                  <span
                    key={i}
                    ref={el => {
                      barRefs.current[i] = el;
                    }}
                    className="w-[2.5px] h-3.5 origin-bottom rounded-full bg-gradient-to-t from-cyan-500 via-indigo-400 to-fuchsia-400"
                    style={{ transform: 'scaleY(0.14)', opacity: 0.3 }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="flex items-center gap-1 shrink-0 border-l border-slate-800 pl-2.5">
            {(hasLocalTrack || hasYouTubeTrack) && (
              <>
                <button
                  type="button"
                  onClick={hasLocalTrack ? handlePrevLocal : handlePrevTrack}
                  aria-label="Предыдущий трек"
                  className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  aria-label={effectivePlaying ? 'Пауза' : 'Воспроизвести'}
                  className="w-7 h-7 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {effectivePlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={hasLocalTrack ? handleNextLocal : handleNextTrack}
                  aria-label="Следующий трек"
                  className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {/* YouTube Music Database & Listen Together Toggle */}
            <button
              type="button"
              data-testid="youtube-catalog-btn"
              onClick={() => {
                setShowYouTubeCatalog(s => !s);
                setShowWindowsSetup(false);
              }}
              aria-label="База YouTube Музыки"
              title="База YouTube Музыки и совместное прослушивание"
              className={`h-7 px-2 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                hasYouTubeTrack
                  ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 hover:bg-rose-900/80'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Youtube className="w-3.5 h-3.5 text-rose-500 shrink-0 fill-rose-500/20" />
              <span className="hidden sm:inline">
                {hasYouTubeTrack ? 'YouTube 🎵' : 'YouTube Музыка'}
              </span>
            </button>

            {/* Windows Live Sync Setup Toggle */}
            <button
              type="button"
              data-testid="windows-setup-btn"
              onClick={() => {
                setShowWindowsSetup(s => !s);
                setShowYouTubeCatalog(false);
              }}
              aria-label="Привязать плеер Windows"
              title="Привязать Spotify / плеер Windows"
              className={`h-7 px-2 rounded-lg border text-[11px] font-medium flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                isWindowsActive
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/80'
                  : 'bg-cyan-950/90 border-cyan-400/60 text-cyan-200 hover:bg-cyan-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {isWindowsActive ? 'Windows ✓' : 'Привязать PC'}
              </span>
            </button>

            {/* System Audio Spectrum Capture */}
            <button
              type="button"
              data-testid="capture-audio-btn"
              onClick={handleToggleCaptureAudio}
              aria-label={isCapturingAudio ? 'Остановить захват звука ПК' : 'Захват бита со звука ПК'}
              title="Живой эквалайзер со звука ПК"
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                isCapturingAudio
                  ? 'bg-fuchsia-950 border-fuchsia-400 text-fuchsia-300 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>

            {/* Local Audio File Picker */}
            <button
              type="button"
              data-testid="open-local-audio-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Выбрать MP3 файл с компьютера"
              title="Открыть локальный аудиофайл"
              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>

            {/* Close Widget */}
            <button
              type="button"
              data-testid="close-music-widget-btn"
              onClick={onClose}
              aria-label="Закрыть плеер"
              className="w-7 h-7 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {captureError && (
          <div className="mt-1.5 text-[11px] text-amber-300 flex items-center justify-between gap-2 px-1">
            <span>{captureError}</span>
            <button
              type="button"
              onClick={() => setCaptureError(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              Скрыть
            </button>
          </div>
        )}
      </div>

      {/* Windows Sync Setup Popover */}
      {showWindowsSetup && (
        <div
          data-testid="windows-setup-popover"
          className="mt-2 w-full pointer-events-auto rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl p-4 text-left text-xs text-slate-200 animate-fade-in"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 font-bold text-cyan-300">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>Привязка к плееру Windows (Spotify, Яндекс, AIMP)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowWindowsSetup(false)}
              aria-label="Закрыть инструкцию"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
            Браузер не имеет прямого доступа к трекам Windows из-за защиты ОС. Запустите встроенный
            мост через PowerShell (без установки программ) — он будет передавать текущий трек прямо в этот плеер:
          </p>

          <ol className="space-y-1.5 text-[11px] text-slate-300 mb-3 list-decimal list-inside">
            <li>
              Нажмите <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-cyan-300">Win + R</kbd>, введите{' '}
              <code className="px-1 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">powershell</code> и нажмите Enter.
            </li>
            <li>Вставьте эту команду и нажмите Enter:</li>
          </ol>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-2 mb-3">
            <code
              data-testid="windows-oneliner-code"
              className="flex-1 text-[11px] font-mono text-emerald-300 break-all select-all"
            >
              {oneLinerCommand}
            </code>
            <button
              type="button"
              data-testid="copy-oneliner-btn"
              onClick={handleCopyCommand}
              className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer"
            >
              {copiedCommand ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  windowsState.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className={windowsState.connected ? 'text-emerald-300' : 'text-slate-400'}>
                {windowsState.connected
                  ? isWindowsActive
                    ? `Подключено: ${windowsState.source} — ${windowsState.title}`
                    : 'Мост подключён, ожидаем воспроизведения трека'
                  : 'Ожидание подключения PowerShell-моста...'}
              </span>
            </div>

            {hasLocalTrack && (
              <button
                type="button"
                onClick={handleClearLocal}
                className="text-rose-300 hover:text-rose-200 underline cursor-pointer"
              >
                Сбросить MP3
              </button>
            )}
          </div>
        </div>
      )}

      {/* YouTube Music Database & Listen Together Popover */}
      {showYouTubeCatalog && (
        <div
          data-testid="youtube-catalog-popover"
          className="mt-2 w-full pointer-events-auto rounded-2xl bg-slate-950/95 border border-rose-500/40 shadow-2xl p-4 text-left text-xs text-slate-200 animate-fade-in max-h-[82vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <Youtube className="w-4 h-4 text-rose-500 fill-rose-500/30" />
              <span>YouTube Music (Реальная база) & Совместное прослушивание</span>
            </div>
            <button
              type="button"
              onClick={() => setShowYouTubeCatalog(false)}
              aria-label="Закрыть каталог"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Contact & VPN Status Bar (if activeContact is provided) */}
          {activeContact && (
            <div className="mb-3 p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-200">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Собеседник:</span>
                  <span className="font-semibold text-white">{activeContact.name}</span>
                  <span className="text-slate-400">(@{activeContact.username})</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">Режим контакта:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setContactVpnOverride(false);
                      setContactAccessNotice(MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                      (contactVpnOverride === false || (contactVpnOverride === null && activeContact.region === 'RU_NO_VPN'))
                        ? 'bg-rose-950 text-rose-300 border-rose-500/70 font-semibold'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    🇷🇺 Без VPN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContactVpnOverride(true);
                      setContactAccessNotice(null);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                      (contactVpnOverride === true || (contactVpnOverride === null && activeContact.isVpnActive))
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/70 font-semibold'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    🌐 С VPN (Доступен)
                  </button>
                </div>
              </div>

              {/* Exact Notification Required by User */}
              {contactAccessNotice && (
                <div
                  data-testid="contact-access-warning"
                  className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/50 text-[11px] text-rose-200 font-semibold flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <div>{contactAccessNotice}</div>
                    <div className="text-[10px] text-rose-300/80 font-normal">
                      У собеседника не работает YouTube без VPN в регионе РФ. Подключите VPN для совместного прослушивания.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Bar + Genre Chips */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Поиск по YouTube Music: введите трек, артиста или вставьте ссылку..."
                value={youtubeSearch}
                onChange={(e) => setYoutubeSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-rose-500 transition-colors"
              />
              {youtubeSearch && (
                <button
                  type="button"
                  onClick={() => setYoutubeSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Genre Filters */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {[
                { id: 'ru', label: '🇷🇺 Русские хиты' },
                { id: 'all', label: '🔥 Топ мира' },
                { id: 'phonk', label: '🏎️ Phonk' },
                { id: 'lofi', label: '☕ Lo-Fi' },
                { id: 'space', label: '🌌 Космос' },
                { id: 'pop', label: '✨ Pop' },
                { id: 'rock', label: '🎸 Rock' },
                { id: 'hiphop', label: '🎤 Hip-Hop' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedGenre(cat.id as YouTubeGenre)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition-colors cursor-pointer border ${
                    selectedGenre === cat.id
                      ? 'bg-rose-950 text-rose-200 border-rose-500/70 font-semibold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tracks List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-52">
            {isLoadingYt ? (
              <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
                <span>Загружаем реальные треки из YouTube Music...</span>
              </div>
            ) : ytError ? (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-center">
                {ytError}
              </div>
            ) : ytTracks.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                Треки не найдены. Попробуйте другой запрос или жанр.
              </div>
            ) : (
              ytTracks.map((track) => {
                const isCurrent = currentYouTubeTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`p-2 rounded-xl border flex items-center gap-2.5 transition-colors ${
                      isCurrent
                        ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500/30'
                        : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-950"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                        <span>{track.title}</span>
                        {isCurrent && youtubePlaying && (
                          <span className="text-[10px] text-rose-400 font-normal animate-pulse">▶ играет</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                        <span>{track.artist}</span>
                        {track.durationSec > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatYouTubeDuration(track.durationSec)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePlayYouTubeSolo(track)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        {isCurrent && youtubePlaying ? 'Пауза' : 'Слушать'}
                      </button>

                      {activeContact && (
                        <button
                          type="button"
                          onClick={() => handleListenTogether(track)}
                          title="Слушать вместе с собеседником"
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Users className="w-3 h-3" />
                          <span className="hidden sm:inline">Слушать вместе</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Visible YouTube IFrame Player Container */}
          {currentYouTubeTrack && (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                  <span className="truncate">
                    YouTube Player: <strong className="text-white">{currentYouTubeTrack.artist} — {currentYouTubeTrack.title}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentYouTubeTrack(null);
                    setYoutubePlaying(false);
                    setSharedWithContact(false);
                  }}
                  className="text-rose-400 hover:text-rose-300 underline cursor-pointer shrink-0"
                >
                  Закрыть плеер
                </button>
              </div>

              {/* Visible YouTube Player Box */}
              <div className="relative w-full h-36 bg-black rounded-xl overflow-hidden border border-rose-500/40 shadow-inner flex items-center justify-center">
                <div id={ytPlayerContainerId.current} className="w-full h-full" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
