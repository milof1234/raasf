import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Info,
  VolumeX,
  Volume2,
  Search,
  Paperclip,
  BarChart3,
  Mic,
  Send,
  X,
  Bookmark,
  Crown,
  Check,
  CheckCheck,
  Edit2,
  Trash2,
  SmilePlus,
  Play,
  Youtube,
  ShieldAlert,
  Radio
} from 'lucide-react';
import { UserProfile, GroupChat, MessageItem, PollData, SharedMusicData } from '../types/chat';
import { formatLastSeen } from '../utils/security';
import {
  formatYouTubeDuration,
  checkContactYouTubeAccess,
  MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT,
  YouTubeTrack
} from '../utils/youtubeMusic';

interface ChatAreaProps {
  currentUser: UserProfile;
  activeUser: UserProfile | null;
  activeGroup: GroupChat | null;
  messages: MessageItem[];
  allUsers: Record<string, UserProfile>;
  onBackToSidebar: () => void;
  onOpenGroupInfo: () => void;
  onSendMessage: (msg: {
    type: 'text' | 'image' | 'video' | 'voice' | 'poll' | 'music_share';
    text?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    poll?: PollData;
    musicShare?: SharedMusicData;
  }) => void;
  onEditMessage: (msgId: string, newText: string) => void;
  onDeleteMessage: (msgId: string) => void;
  onToggleReaction: (msgId: string, emoji: string) => void;
  onSaveToBookmarks: (msg: MessageItem) => void;
  onVotePoll: (msgId: string, optionId: string) => void;
  onToggleMuteUser: (userId: string) => void;
  onOpenLightbox: (url: string) => void;
  onOpenPollModal: () => void;
  onSetActivity: (status: 'idle' | 'typing' | 'recording') => void;
  onOpenMusicPlayer?: (track?: YouTubeTrack) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentUser,
  activeUser,
  activeGroup,
  messages,
  allUsers,
  onBackToSidebar,
  onOpenGroupInfo,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onSaveToBookmarks,
  onVotePoll,
  onToggleMuteUser,
  onOpenLightbox,
  onOpenPollModal,
  onSetActivity,
  onOpenMusicPlayer
}) => {
  const [inputText, setInputText] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageItem | null>(null);
  const [openReactionPickerMsgId, setOpenReactionPickerMsgId] = useState<string | null>(null);
  const [musicAccessBanner, setMusicAccessBanner] = useState<string | null>(null);

  const handleStartListenTogether = () => {
    if (activeUser) {
      const check = checkContactYouTubeAccess(activeUser);
      if (!check.allowed) {
        setMusicAccessBanner(check.message || MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT);
        return;
      }
    }
    setMusicAccessBanner(null);
    onOpenMusicPlayer?.();
  };

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const voiceErrorTimeoutRef = useRef<any>(null);

  // Scroll only the messages list to bottom on new messages
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, activeUser?.id, activeGroup?.id]);

  // Close reaction picker on Escape or outside click
  useEffect(() => {
    if (!openReactionPickerMsgId) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-reaction-picker]')) {
        setOpenReactionPickerMsgId(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenReactionPickerMsgId(null);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [openReactionPickerMsgId]);

  // Reset transient editing/picker/recording state when switching chats or unmounting
  useEffect(() => {
    setEditingMsg(null);
    setOpenReactionPickerMsgId(null);
    setAttachedImage(null);
    return () => {
      clearTimeout(typingTimeoutRef.current);
      clearTimeout(voiceErrorTimeoutRef.current);
      clearInterval(recordIntervalRef.current);
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
          }
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        } catch {}
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
    };
  }, [activeUser?.id, activeGroup?.id]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputText, isRecording]);

  const isSavedMessages = !activeGroup && activeUser?.id === currentUser.id;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (val.trim()) {
      onSetActivity('typing');
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onSetActivity('idle');
      }, 3000);
    } else {
      onSetActivity('idle');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (currentUser.isMuted) return;

    if (editingMsg) {
      if (inputText.trim()) {
        onEditMessage(editingMsg.id, inputText.trim());
      }
      setEditingMsg(null);
      setInputText('');
      onSetActivity('idle');
      return;
    }

    if (attachedImage) {
      onSendMessage({
        type: 'image',
        imageUrl: attachedImage,
        text: inputText.trim() || undefined
      });
      setAttachedImage(null);
      setInputText('');
      onSetActivity('idle');
      return;
    }

    if (inputText.trim()) {
      onSendMessage({
        type: 'text',
        text: inputText.trim()
      });
      setInputText('');
      onSetActivity('idle');
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 900;
        let width = img.width, height = img.height;
        if (width > height) {
          if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        } else {
          if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setAttachedImage(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const showVoiceError = (message: string) => {
    clearTimeout(voiceErrorTimeoutRef.current);
    setVoiceError(message);
    voiceErrorTimeoutRef.current = setTimeout(() => setVoiceError(null), 8000);
  };

  // Voice recording
  const startRecording = async () => {
    if (currentUser.isMuted) return;
    setVoiceError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        showVoiceError('Запись голоса не поддерживается в этом браузере или открыта по небезопасному соединению.');
        return;
      }
      if (typeof MediaRecorder === 'undefined') {
        showVoiceError('Ваш браузер не поддерживает запись голосовых сообщений.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      onSetActivity('recording');

      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } catch (err: any) {
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setRecordSeconds(0);
      onSetActivity('idle');

      const errName = err?.name || '';
      if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        showVoiceError('Микрофон не найден на этом устройстве.');
      } else {
        showVoiceError(
          'Нет доступа к микрофону. Закройте плавающие окна/виджеты поверх экрана (например, боковую панель) и разрешите микрофон для сайта.'
        );
      }
    }
  };

  const stopMicrophoneTracks = (keepOnStopCallback = false) => {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      if (!keepOnStopCallback) {
        recorder.onstop = null;
      }
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        if (!keepOnStopCallback) {
          recorder.stream.getTracks().forEach(t => t.stop());
        }
      } catch {}
    }
    clearInterval(recordIntervalRef.current);
    setIsRecording(false);
    onSetActivity('idle');
  };

  const cancelRecording = () => {
    stopMicrophoneTracks(false);
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const sendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      stopMicrophoneTracks(false);
      mediaRecorderRef.current = null;
      showVoiceError('Не удалось сохранить запись — микрофон не был запущен.');
      return;
    }

    const mimeType = recorder.mimeType || 'audio/webm';
    recorder.onstop = () => {
      try {
        recorder.stream.getTracks().forEach(t => t.stop());
      } catch {}
      mediaRecorderRef.current = null;

      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];
      if (blob.size < 100) {
        showVoiceError('Запись слишком короткая — удерживайте чуть дольше и повторите.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          onSendMessage({
            type: 'voice',
            audioUrl: reader.result as string
          });
        }
      };
      reader.readAsDataURL(blob);
    };
    stopMicrophoneTracks(true);
  };

  // Filter messages by in-chat search
  const filteredMessages = messages.filter(m => {
    if (!chatSearch.trim()) return true;
    return m.text?.toLowerCase().includes(chatSearch.toLowerCase().trim());
  });

  return (
    <div className="flex-1 min-w-0 w-full flex flex-col cc-chat-backdrop relative h-full overflow-hidden">
      
      {/* Sticky Glass Chat Header */}
      <div className="h-[60px] border-b border-[var(--cc-border)] flex items-center px-3 sm:px-5 bg-[var(--cc-bg-header)] backdrop-blur-md justify-between gap-2 shrink-0 min-w-0 z-10">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBackToSidebar}
            aria-label="Назад к списку чатов"
            className="sm:hidden w-9 h-9 -ml-1 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative shrink-0">
            {isSavedMessages ? (
              <div className="w-10 h-10 rounded-full bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] flex items-center justify-center text-[var(--cc-accent-text)]">
                <Bookmark className="w-5 h-5" />
              </div>
            ) : activeGroup ? (
              <div className="w-10 h-10 rounded-2xl bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] flex items-center justify-center font-semibold text-base text-[var(--cc-text)]">
                {activeGroup.name[0]?.toUpperCase() || 'Г'}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border)] flex items-center justify-center font-semibold text-[var(--cc-text)] overflow-hidden">
                {activeUser?.avatar ? (
                  <img src={activeUser.avatar} alt={activeUser.name} className="w-full h-full object-cover" />
                ) : (
                  activeUser?.name[0]?.toUpperCase() || '?'
                )}
              </div>
            )}
            {activeUser && activeUser.isOnline && !isSavedMessages && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--cc-bg-rail)] rounded-full" />
            )}
          </div>

          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-[var(--cc-text)] flex items-center gap-1.5 truncate">
              <span className="truncate">{isSavedMessages ? 'Избранное' : activeGroup ? activeGroup.name : activeUser?.name}</span>
              {!isSavedMessages && activeUser?.isAdmin && (
                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
              )}
              {activeUser?.isMuted && (
                <span className="text-red-400 text-xs flex items-center gap-0.5 shrink-0">
                  <VolumeX className="w-3.5 h-3.5" /> (замучен)
                </span>
              )}
            </div>

            <div className="text-xs text-[var(--cc-text-muted)] truncate">
              {isSavedMessages ? (
                'Ваши личные заметки и сохранённые сообщения'
              ) : activeGroup ? (
                `${(activeGroup.memberIds || []).length} участников${activeGroup.description ? ' • ' + activeGroup.description : ''}`
              ) : (
                activeUser?.activity?.status === 'recording' ? (
                  <span className="text-rose-400 font-medium">записывает аудио...</span>
                ) : activeUser?.activity?.status === 'typing' ? (
                  <span className="text-[var(--cc-accent-text)] font-medium">печатает...</span>
                ) : (
                  formatLastSeen(activeUser?.lastSeen, activeUser?.isOnline).text
                )
              )}
            </div>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {activeGroup && (
            <button
              type="button"
              onClick={onOpenGroupInfo}
              aria-label="Информация о группе"
              className="w-9 h-9 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center transition-colors cursor-pointer"
              title="Информация о группе"
            >
              <Info className="w-[18px] h-[18px]" />
            </button>
          )}

          {currentUser.isAdmin && activeUser && activeUser.id !== currentUser.id && (
            <button
              type="button"
              onClick={() => onToggleMuteUser(activeUser.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer border ${
                activeUser.isMuted
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25'
              }`}
            >
              {activeUser.isMuted ? (
                <><Volume2 className="w-3.5 h-3.5" /> Размутить</>
              ) : (
                <><VolumeX className="w-3.5 h-3.5" /> Замутить</>
              )}
            </button>
          )}

          {/* Listen Together YouTube Button */}
          {activeUser && (
            <button
              type="button"
              data-testid="chat-listen-together-btn"
              onClick={handleStartListenTogether}
              title="Слушать YouTube Музыку вместе"
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] text-rose-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
            >
              <Youtube className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
              <span className="hidden sm:inline">Слушать вместе</span>
            </button>
          )}

          <div className="relative hidden md:flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-[var(--cc-text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Поиск в чате..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              className="bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none w-44 transition-colors"
            />
            {chatSearch && (
              <button
                type="button"
                onClick={() => setChatSearch('')}
                aria-label="Очистить поиск в чате"
                className="absolute right-2 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contact YouTube / VPN Access Alert Banner */}
      {musicAccessBanner && (
        <div
          data-testid="chat-music-access-banner"
          className="bg-rose-950/90 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between gap-3 text-xs text-rose-200 animate-fade-in z-20 shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{musicAccessBanner}</span>
            <span className="text-[11px] text-rose-300/80 hidden sm:inline truncate">
              (В регионе РФ без VPN доступ к YouTube заблокирован)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMusicAccessBanner(null)}
            className="text-rose-400 hover:text-white p-0.5 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Centered Messages Stream */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-4"
      >
        <div className="max-w-[840px] mx-auto w-full min-h-full flex flex-col justify-end gap-2.5">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center my-auto text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] flex items-center justify-center text-[var(--cc-accent-text)] mb-3">
                <Paperclip className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-[var(--cc-text)]">Сообщений пока нет</p>
              <p className="text-xs text-[var(--cc-text-muted)] mt-1 max-w-xs leading-relaxed">
                Напишите приветствие, отправьте фото, голосовое сообщение или создайте опрос.
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              const sender = allUsers[msg.senderId];
              const senderName = isMe ? 'Вы' : sender?.name || msg.senderName || 'Пользователь';
              const time = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isRead = (msg.readBy || []).some(id => id !== msg.senderId);
              const isPickerOpen = openReactionPickerMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`group/msg flex w-full items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border)] flex items-center justify-center text-xs font-semibold text-[var(--cc-text)] shrink-0 overflow-hidden mb-0.5">
                      {sender?.avatar ? (
                        <img src={sender.avatar} alt={sender.name} className="w-full h-full object-cover" />
                      ) : (
                        senderName[0]?.toUpperCase() || '?'
                      )}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Floating Action Toolbar (hidden until hover/focus on desktop; subtle accessible strip on mobile) */}
                    <div
                      className={`relative z-20 mb-1 flex items-center gap-0.5 rounded-xl bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] px-1.5 py-0.5 shadow-lg transition-opacity duration-150 ${
                        isPickerOpen
                          ? 'opacity-100 pointer-events-auto'
                          : 'opacity-100 md:opacity-0 md:pointer-events-none md:group-hover/msg:opacity-100 md:group-hover/msg:pointer-events-auto md:group-focus-within/msg:opacity-100 md:group-focus-within/msg:pointer-events-auto'
                      }`}
                    >
                      {(['👍', '❤️', '🔥'] as const).map((quickEmoji) => {
                        const rawList = msg.reactions?.[quickEmoji];
                        const list = Array.isArray(rawList)
                          ? rawList
                          : rawList && typeof rawList === 'object'
                          ? Object.values(rawList as Record<string, unknown>)
                          : [];
                        const isActive = list.includes(currentUser.id);
                        const label = quickEmoji === '👍' ? 'Лайк' : quickEmoji === '❤️' ? 'Сердце' : 'Огонь';
                        return (
                          <button
                            key={quickEmoji}
                            type="button"
                            onClick={() => {
                              onToggleReaction(msg.id, quickEmoji);
                              setOpenReactionPickerMsgId(null);
                            }}
                            className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs hover:bg-[var(--cc-bg-surface-hover)] transition-transform hover:scale-110 cursor-pointer ${
                              isActive ? 'bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent)]/50' : ''
                            }`}
                            title={label}
                          >
                            {quickEmoji}
                          </button>
                        );
                      })}

                      <div data-reaction-picker className="relative inline-flex items-center">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenReactionPickerMsgId(prev => (prev === msg.id ? null : msg.id))
                          }
                          aria-label="Выбрать реакцию"
                          title="Ещё реакции"
                          className={`w-6 h-6 flex items-center justify-center rounded-lg text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer ${
                            isPickerOpen ? 'bg-[var(--cc-accent-soft)] text-[var(--cc-text)]' : ''
                          }`}
                        >
                          <SmilePlus className="w-3.5 h-3.5" />
                        </button>

                        {isPickerOpen && (
                          <div className={`absolute bottom-full ${isMe ? 'right-0' : 'left-0'} mb-2 z-30 flex items-center gap-1 bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] rounded-xl px-2 py-1.5 shadow-2xl`}>
                            {['😂', '😮', '😢', '👏', '🎉', '🚀'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  onToggleReaction(msg.id, emoji);
                                  setOpenReactionPickerMsgId(null);
                                }}
                                className="text-base hover:scale-125 transition-transform p-1 rounded-lg hover:bg-[var(--cc-bg-surface-hover)] cursor-pointer leading-none"
                                title={`Реакция ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <span className="w-px h-3.5 bg-[var(--cc-border)] mx-0.5" aria-hidden="true" />

                      <button
                        type="button"
                        onClick={() => onSaveToBookmarks(msg)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--cc-text-muted)] hover:text-amber-300 hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer"
                        title="В Избранное"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>

                      {isMe && msg.type === 'text' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMsg(msg);
                            setInputText(msg.text || '');
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer"
                          title="Редактировать"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isMe && (
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(msg.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--cc-text-muted)] hover:text-red-400 hover:bg-[var(--cc-bg-surface-hover)] transition-colors cursor-pointer"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Clean Message Bubble */}
                    <div
                      className={`w-full min-w-0 rounded-2xl px-3.5 py-2.5 relative shadow-sm ${
                        isMe
                          ? 'bg-[var(--cc-bg-bubble-out)] border border-[var(--cc-bg-bubble-out-border)] text-white rounded-br-sm'
                          : 'bg-[var(--cc-bg-bubble-in)] border border-[var(--cc-border)] text-[var(--cc-text)] rounded-bl-sm'
                      }`}
                    >
                      {!isMe && (
                        <div className="text-xs font-semibold text-[var(--cc-accent-text)] mb-1">
                          {senderName}
                        </div>
                      )}

                      {/* Image */}
                      {msg.type === 'image' && msg.imageUrl && (
                        <div>
                          <div className="mb-1.5 -mx-1 -mt-0.5 rounded-xl overflow-hidden bg-black/25">
                            <img
                              src={msg.imageUrl}
                              alt="Прикрепленное фото"
                              onClick={() => onOpenLightbox(msg.imageUrl!)}
                              className="max-h-72 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                            />
                          </div>
                          {msg.text && msg.text !== '📷 Фото' && (
                            <div className="text-[13.5px] break-words leading-relaxed">{msg.text}</div>
                          )}
                        </div>
                      )}

                      {/* Poll */}
                      {msg.type === 'poll' && msg.poll && (
                        <div className="min-w-[210px] max-w-full py-0.5">
                          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1 opacity-75 flex items-center gap-1">
                            <BarChart3 className="w-3.5 h-3.5" /> Опрос
                          </div>
                          <div className="text-sm font-semibold mb-2">{msg.poll.question}</div>

                          {(() => {
                            const rawOptions = msg.poll.options as any;
                            const options = Array.isArray(rawOptions)
                              ? rawOptions
                              : rawOptions && typeof rawOptions === 'object'
                              ? Object.values(rawOptions)
                              : [];

                            const getVoters = (rawVoterIds: any): string[] =>
                              Array.isArray(rawVoterIds)
                                ? rawVoterIds.filter((x): x is string => typeof x === 'string')
                                : rawVoterIds && typeof rawVoterIds === 'object'
                                ? Object.values(rawVoterIds).filter((x): x is string => typeof x === 'string')
                                : [];

                            const totalVotes = options.reduce(
                              (acc: number, cur: any) => acc + getVoters(cur?.voterIds).length,
                              0
                            );
                            const userHasVoted = options.some((opt: any) =>
                              getVoters(opt?.voterIds).includes(currentUser.id)
                            );

                            return (
                              <>
                                {options.map((opt: any) => {
                                  const voters = getVoters(opt?.voterIds);
                                  const hasVoted = voters.includes(currentUser.id);
                                  const pct = totalVotes > 0 ? Math.round((voters.length / totalVotes) * 100) : 0;

                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => onVotePoll(msg.id, opt.id)}
                                      className={`w-full text-left rounded-xl p-2.5 mt-1.5 relative overflow-hidden border cursor-pointer block transition-all ${
                                        hasVoted
                                          ? 'border-emerald-400/70 bg-white/15'
                                          : 'border-white/12 bg-black/20 hover:bg-black/30'
                                      }`}
                                    >
                                      <div
                                        className={`absolute left-0 top-0 bottom-0 transition-all duration-300 ${
                                          hasVoted ? 'bg-emerald-400/25' : 'bg-white/12'
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                      <div className="relative z-10 flex items-center justify-between gap-2 text-xs font-medium">
                                        <span className="flex items-center gap-1.5">
                                          {hasVoted && <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
                                          <span>{opt.text}</span>
                                        </span>
                                        <span className="shrink-0 tabular-nums opacity-90">{pct}% ({voters.length})</span>
                                      </div>
                                    </button>
                                  );
                                })}
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] opacity-75">
                                  <span>
                                    {totalVotes > 0 ? `Всего голосов: ${totalVotes}` : 'Пока нет голосов'}
                                  </span>
                                  {userHasVoted && (
                                    <span>Нажмите ещё раз, чтобы отменить</span>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Voice */}
                      {msg.type === 'voice' && msg.audioUrl && (
                        <div className="py-0.5 w-full max-w-[260px] sm:min-w-[230px]">
                          <audio
                            controls
                            src={msg.audioUrl}
                            preload="metadata"
                            className="h-9 mt-0.5 w-full max-w-full"
                          />
                        </div>
                      )}

                      {/* Shared YouTube Music Track */}
                      {msg.type === 'music_share' && msg.musicShare && (
                        <div className="p-3 rounded-2xl bg-slate-900/90 border border-rose-500/35 w-full max-w-sm space-y-2.5 shadow-lg my-1">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-rose-400">
                            <Youtube className="w-3.5 h-3.5 fill-rose-500/30" />
                            <span>YouTube Music • Совместное прослушивание</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <img
                              src={msg.musicShare.thumbnail}
                              alt={msg.musicShare.title}
                              className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-950 border border-slate-800 shadow-sm"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-white truncate" title={msg.musicShare.title}>
                                {msg.musicShare.title}
                              </div>
                              <div className="text-xs text-slate-300 truncate mt-0.5">
                                {msg.musicShare.artist}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                                <span>{formatYouTubeDuration(msg.musicShare.durationSec)}</span>
                                {msg.musicShare.genre && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-rose-300 font-medium">
                                    {msg.musicShare.genre}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (activeUser) {
                                const check = checkContactYouTubeAccess(activeUser);
                                if (!check.allowed) {
                                  setMusicAccessBanner(check.message || MSG_YOUTUBE_UNAVAILABLE_FOR_CONTACT);
                                  return;
                                }
                              }
                              onOpenMusicPlayer?.({
                                id: msg.musicShare!.trackId,
                                title: msg.musicShare!.title,
                                artist: msg.musicShare!.artist,
                                durationSec: msg.musicShare!.durationSec,
                                thumbnail: msg.musicShare!.thumbnail,
                                genre: (msg.musicShare!.genre as any) || 'pop'
                              });
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Слушать в плеере</span>
                          </button>
                        </div>
                      )}

                      {/* Text */}
                      {msg.type === 'text' && (
                        <div className="text-[13.5px] break-words leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </div>
                      )}

                      {/* Active Reactions Row */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(msg.reactions).map(([emoji, rawUids]) => {
                            const uids = Array.isArray(rawUids)
                              ? rawUids.filter((x): x is string => typeof x === 'string')
                              : rawUids && typeof rawUids === 'object'
                              ? Object.values(rawUids as Record<string, unknown>).filter((x): x is string => typeof x === 'string')
                              : [];
                            if (uids.length === 0) return null;
                            const isMyReaction = uids.includes(currentUser.id);
                            const voterNames = uids
                              .map(uid => (uid === currentUser.id ? 'Вы' : allUsers[uid]?.name || 'Пользователь'))
                              .join(', ');
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => onToggleReaction(msg.id, emoji)}
                                title={voterNames}
                                className={`px-2 py-0.5 rounded-lg text-xs border transition-colors cursor-pointer tabular-nums ${
                                  isMyReaction
                                    ? 'bg-white/20 border-white/45 text-white font-semibold'
                                    : 'bg-black/20 border-white/12 text-[var(--cc-text-secondary)] hover:bg-black/30'
                                }`}
                              >
                                {emoji} {uids.length}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Compact Timestamp & Read Receipts */}
                      <div className="text-[10.5px] flex items-center justify-end gap-1 mt-1 opacity-75 tabular-nums">
                        {msg.editedAt && <span className="italic mr-0.5">изм.</span>}
                        <span>{time}</span>
                        {isMe && (
                          isRead ? (
                            <span title="Прочитано" className="inline-flex">
                              <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                            </span>
                          ) : (
                            <span title="Доставлено" className="inline-flex">
                              <Check className="w-3.5 h-3.5 text-white/75" />
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Bottom Composer */}
      <div className="px-3 sm:px-6 pb-3 sm:pb-4 pt-2 shrink-0 bg-gradient-to-t from-[var(--cc-bg-app)] via-[var(--cc-bg-app)]/95 to-transparent">
        <div className="max-w-[840px] mx-auto w-full">
          {currentUser.isMuted ? (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-2xl text-center text-xs text-red-400 font-medium">
              <VolumeX className="w-4 h-4 inline mr-1.5" />
              Вы замучены администратором и не можете отправлять сообщения.
            </div>
          ) : (
            <>
              {attachedImage && (
                <div className="mb-2 px-3 py-2 bg-[var(--cc-bg-surface)] border border-[var(--cc-border-strong)] rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <img
                      src={attachedImage}
                      alt="Превью"
                      className="w-11 h-11 rounded-lg object-cover border border-[var(--cc-border)] shrink-0"
                    />
                    <div className="text-xs">
                      <div className="text-[var(--cc-text)] font-medium">Фотография прикреплена</div>
                      <div className="text-[var(--cc-text-muted)] text-[11px]">Добавьте подпись или нажмите «Отправить»</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    aria-label="Убрать фото"
                    className="text-[var(--cc-text-muted)] hover:text-red-400 p-1.5 rounded-lg hover:bg-[var(--cc-bg-surface-hover)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {editingMsg && (
                <div className="mb-2 px-3 py-2 bg-[var(--cc-accent-soft)] border border-[var(--cc-accent)]/35 rounded-xl text-xs text-[var(--cc-text)] flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Edit2 className="w-3.5 h-3.5 text-[var(--cc-accent-text)] shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-[var(--cc-accent-text)] mr-1.5">Редактирование:</span>
                      <span className="text-[var(--cc-text-secondary)]">{editingMsg.text}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMsg(null);
                      setInputText('');
                    }}
                    aria-label="Отменить редактирование"
                    className="text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {voiceError && (
                <div className="mb-2 px-3 py-2 bg-red-950/80 border border-red-500/35 rounded-xl text-xs text-red-100 flex items-start justify-between gap-2 leading-relaxed">
                  <span>{voiceError}</span>
                  <button
                    type="button"
                    onClick={() => setVoiceError(null)}
                    aria-label="Закрыть предупреждение"
                    className="text-red-300 hover:text-white p-0.5 shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="w-full flex items-end gap-0.5 sm:gap-1.5 bg-[var(--cc-bg-surface)] border border-[var(--cc-border-strong)] focus-within:border-[var(--cc-accent)] rounded-2xl p-1 sm:p-1.5 shadow-lg transition-colors min-w-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Прикрепить изображение"
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Прикрепить фото"
                >
                  <Paperclip className="w-[18px] h-[18px]" />
                </button>

                <button
                  type="button"
                  onClick={onOpenPollModal}
                  aria-label="Создать опрос"
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Создать опрос"
                >
                  <BarChart3 className="w-[18px] h-[18px]" />
                </button>

                {isRecording ? (
                  <div className="flex-1 min-w-0 bg-rose-500/10 border border-rose-500/30 rounded-xl px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <span className="text-xs font-mono text-rose-400 font-bold tabular-nums shrink-0">
                        {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
                        {String(recordSeconds % 60).padStart(2, '0')}
                      </span>
                      <span className="text-xs text-rose-300 hidden sm:inline truncate">Запись аудио</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={cancelRecording}
                        className="text-xs text-[var(--cc-text-secondary)] hover:text-white px-2.5 py-1 rounded-lg bg-[var(--cc-bg-surface-elevated)] cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={sendRecording}
                        className="text-xs text-white px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 font-medium cursor-pointer"
                      >
                        Отправить
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      placeholder="Сообщение..."
                      value={inputText}
                      onChange={handleTextChange}
                      onKeyDown={handleKeyDown}
                      className="flex-1 min-w-0 self-center bg-transparent resize-none outline-none text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] placeholder:truncate px-2 sm:px-2.5 py-2.5 leading-5 text-[14px] max-h-32 min-h-[40px] overflow-y-auto"
                    />

                    <button
                      type="button"
                      onClick={startRecording}
                      aria-label="Записать голосовое сообщение"
                      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] rounded-xl transition-colors shrink-0 cursor-pointer"
                      title="Голосовое сообщение"
                    >
                      <Mic className="w-[18px] h-[18px]" />
                    </button>

                    <button
                      type="button"
                      onClick={handleSend}
                      aria-label="Отправить сообщение"
                      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white rounded-xl shadow-sm shrink-0 transition-colors cursor-pointer"
                      title="Отправить"
                    >
                      <Send className="w-[18px] h-[18px]" />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
};
