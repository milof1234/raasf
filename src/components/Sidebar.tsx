import React, { useState } from 'react';
import {
  Plus,
  Settings,
  LogOut,
  Search,
  X,
  Bookmark,
  Crown,
  VolumeX,
  Mic,
  PenLine,
  Trash2,
  Terminal,
  QrCode
} from 'lucide-react';
import { UserProfile, GroupChat } from '../types/chat';
import { normalizeStr, cleanDigits } from '../utils/security';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  currentUser: UserProfile;
  users: UserProfile[];
  groups: GroupChat[];
  activeChatUserId: string | null;
  activeGroupId: string | null;
  onSelectDirectChat: (user: UserProfile) => void;
  onSelectGroupChat: (group: GroupChat) => void;
  onOpenCreateGroup: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentTab: 'all' | 'direct' | 'groups';
  onTabChange: (tab: 'all' | 'direct' | 'groups') => void;
  onDeleteAllNumbers?: () => Promise<void> | void;
  onOpenCommandLine?: () => void;
  onOpenQrCode?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  users,
  groups,
  activeChatUserId,
  activeGroupId,
  onSelectDirectChat,
  onSelectGroupChat,
  onOpenCreateGroup,
  onOpenProfile,
  onLogout,
  searchQuery,
  onSearchChange,
  currentTab,
  onTabChange,
  onDeleteAllNumbers,
  onOpenCommandLine,
  onOpenQrCode
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Purely for admin's phone number +7 (925) 469-98-01
  const isAdminNumber = cleanDigits(currentUser.phone) === '9254699801';
  const otherUsersCount = users.filter(
    u => u.id !== currentUser.id && cleanDigits(u.phone) !== '9254699801'
  ).length;

  const normQuery = normalizeStr(searchQuery);

  // Filter groups
  const userGroups = groups.filter(g => {
    const members = Array.isArray(g.memberIds) ? g.memberIds : [];
    if (!members.includes(currentUser.id)) return false;
    if (!normQuery) return true;
    return normalizeStr(g.name).includes(normQuery) || normalizeStr(g.description).includes(normQuery);
  });

  // Filter direct users (never show self or duplicate of self in contact list)
  const directUsers = users.filter(u => {
    if (u.id === currentUser.id) return false;
    if (cleanDigits(u.phone) && cleanDigits(u.phone) === cleanDigits(currentUser.phone)) return false;
    if (u.username && currentUser.username && u.username.toLowerCase() === currentUser.username.toLowerCase()) return false;
    if (cleanDigits(u.phone) === '9254699801' && cleanDigits(currentUser.phone) === '9254699801') return false;
    if (cleanDigits(u.phone) === '9254699801' && u.id !== 'usr_admin') return false;
    if (!normQuery) return true;
    return (
      normalizeStr(u.name).includes(normQuery) ||
      normalizeStr(u.username).includes(normQuery) ||
      normalizeStr(u.phone).includes(normQuery)
    );
  });

  const isSavedActive = activeChatUserId === currentUser.id && !activeGroupId;

  return (
    <aside className="w-full sm:w-[320px] lg:w-[344px] min-w-0 sm:border-r border-[var(--cc-border)] flex flex-col bg-[var(--cc-bg-rail)] shrink-0 h-full overflow-hidden">
      {/* Clean Top Brand & Quick Actions Bar */}
      <div className="h-[60px] px-4 border-b border-[var(--cc-border)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] flex items-center justify-center text-[var(--cc-accent-text)] shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.4" />
              <path d="M16 9L17.8 14.2L23 16L17.8 17.8L16 23L14.2 17.8L9 16L14.2 14.2L16 9Z" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--cc-text)] truncate">
            CosmoChat
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenCommandLine && (
            <button
              type="button"
              onClick={onOpenCommandLine}
              aria-label="Командная строка (/)"
              className="w-9 h-9 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center transition-colors cursor-pointer relative"
              title="Командная строка (нажмите /)"
            >
              <Terminal className="w-[18px] h-[18px]" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCreateGroup}
            aria-label="Создать группу"
            className="w-9 h-9 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center transition-colors cursor-pointer"
            title="Создать группу"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Global Search + Segmented Filter Control */}
      <div className="px-3 pt-3 pb-2.5 space-y-2.5 border-b border-[var(--cc-border)] shrink-0">
        <div className="relative flex items-center bg-[var(--cc-bg-surface)] rounded-xl border border-[var(--cc-border)] focus-within:border-[var(--cc-accent)] transition-colors">
          <Search className="w-4 h-4 absolute left-3 text-[var(--cc-text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск людей и групп..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent pl-9 pr-8 py-2 text-[13px] text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Очистить поиск"
              className="absolute right-2.5 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center p-1 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] text-xs gap-1">
          <button
            type="button"
            onClick={() => onTabChange('all')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer ${
              currentTab === 'all'
                ? 'bg-[var(--cc-bg-surface-elevated)] text-[var(--cc-text)] shadow-sm ring-1 ring-[var(--cc-border-strong)]'
                : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
            }`}
          >
            Все
          </button>
          <button
            type="button"
            onClick={() => onTabChange('direct')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer ${
              currentTab === 'direct'
                ? 'bg-[var(--cc-bg-surface-elevated)] text-[var(--cc-text)] shadow-sm ring-1 ring-[var(--cc-border-strong)]'
                : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
            }`}
          >
            Личные
          </button>
          <button
            type="button"
            onClick={() => onTabChange('groups')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
              currentTab === 'groups'
                ? 'bg-[var(--cc-bg-surface-elevated)] text-[var(--cc-text)] shadow-sm ring-1 ring-[var(--cc-border-strong)]'
                : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
            }`}
          >
            Группы ({userGroups.length})
          </button>
        </div>
      </div>

      {/* Subtle Admin Database Bar (only for admin phone) */}
      {isAdminNumber && (
        <div className="mx-3 mt-2.5 px-3 py-2 rounded-xl bg-[var(--cc-bg-surface)] border border-red-500/25 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-[var(--cc-text-secondary)] font-medium truncate">
              {otherUsersCount > 0 ? `Номеров в базе: ${otherUsersCount}` : 'База очищена'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteSuccess(false);
              setShowConfirmDelete(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            title="Удалить все сторонние номера из базы"
          >
            <Trash2 className="w-3 h-3" /> Удалить все номера
          </button>
        </div>
      )}

      {/* Scrollable Conversations List */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {/* Saved Messages */}
        {currentTab !== 'groups' && !searchQuery && (
          <button
            type="button"
            onClick={() => onSelectDirectChat(currentUser)}
            className={`w-full text-left flex items-center gap-3 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all min-h-[58px] ${
              isSavedActive
                ? 'bg-[var(--cc-bg-active-row)] ring-1 ring-[var(--cc-accent)]/35'
                : 'hover:bg-[var(--cc-bg-surface-hover)]/70'
            }`}
          >
            <div className="w-11 h-11 rounded-full bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] flex items-center justify-center text-[var(--cc-accent-text)] shrink-0">
              <Bookmark className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-[var(--cc-text)] truncate">
                Избранное
              </div>
              <div className="text-xs text-[var(--cc-text-muted)] truncate mt-0.5">
                Сохранённые сообщения и заметки
              </div>
            </div>
          </button>
        )}

        {/* Groups Section */}
        {(currentTab === 'all' || currentTab === 'groups') && userGroups.length > 0 && (
          <>
            {currentTab === 'all' && (
              <div className="px-2.5 pt-3 pb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[var(--cc-text-muted)] uppercase tracking-wider">
                  Группы
                </span>
                <button
                  type="button"
                  onClick={onOpenCreateGroup}
                  className="text-[11px] text-[var(--cc-accent-text)] hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Новая
                </button>
              </div>
            )}
            {userGroups.map((grp) => {
              const isActive = activeGroupId === grp.id;
              const memberCount = (grp.memberIds || []).length;

              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => onSelectGroupChat(grp)}
                  className={`w-full text-left flex items-center gap-3 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all min-h-[58px] ${
                    isActive
                      ? 'bg-[var(--cc-bg-active-row)] ring-1 ring-[var(--cc-accent)]/35'
                      : 'hover:bg-[var(--cc-bg-surface-hover)]/70'
                  }`}
                >
                  <div className="w-11 h-11 rounded-2xl bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] flex items-center justify-center font-semibold text-base text-[var(--cc-text)] shrink-0">
                    {grp.name[0]?.toUpperCase() || 'Г'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-[var(--cc-text)] truncate">
                      {grp.name}
                    </div>
                    <div className="text-xs text-[var(--cc-text-muted)] truncate mt-0.5">
                      {memberCount} участников
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* Direct Contacts Section */}
        {(currentTab === 'all' || currentTab === 'direct') && (
          <>
            {currentTab === 'all' && directUsers.length > 0 && userGroups.length > 0 && (
              <div className="px-2.5 pt-3 pb-1 text-[11px] font-semibold text-[var(--cc-text-muted)] uppercase tracking-wider">
                Личные сообщения
              </div>
            )}
            {directUsers.map((user) => {
              const isActive = activeChatUserId === user.id && !activeGroupId;
              const isOnline = user.isOnline;
              const act = user.activity;

              let subline = `@${user.username}`;
              if (act && act.status === 'recording') {
                subline = 'записывает аудио...';
              } else if (act && act.status === 'typing') {
                subline = 'печатает...';
              } else if (isOnline) {
                subline = 'в сети';
              }

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onSelectDirectChat(user)}
                  className={`w-full text-left flex items-center gap-3 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all min-h-[58px] ${
                    isActive
                      ? 'bg-[var(--cc-bg-active-row)] ring-1 ring-[var(--cc-accent)]/35'
                      : 'hover:bg-[var(--cc-bg-surface-hover)]/70'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border)] flex items-center justify-center font-semibold text-base text-[var(--cc-text)] shrink-0 overflow-hidden">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.name[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[var(--cc-bg-rail)] rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-[var(--cc-text)] truncate flex items-center gap-1.5">
                      <span className="truncate">{user.name}</span>
                      {user.isAdmin && (
                        <Crown className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-xs truncate mt-0.5 flex items-center gap-1">
                      {act && act.status === 'recording' ? (
                        <span className="text-rose-400 font-medium flex items-center gap-1">
                          <Mic className="w-3 h-3 shrink-0" /> {subline}
                        </span>
                      ) : act && act.status === 'typing' ? (
                        <span className="text-[var(--cc-accent-text)] font-medium flex items-center gap-1">
                          <PenLine className="w-3 h-3 shrink-0" /> {subline}
                        </span>
                      ) : isOnline ? (
                        <span className="text-emerald-400 font-medium">{subline}</span>
                      ) : (
                        <span className="text-[var(--cc-text-muted)]">{subline}</span>
                      )}
                    </div>
                  </div>

                  {user.isMuted && (
                    <VolumeX className="w-4 h-4 text-red-400 shrink-0 ml-auto" />
                  )}
                </button>
              );
            })}
          </>
        )}

        {directUsers.length === 0 && userGroups.length === 0 && (
          <div className="p-6 text-center text-xs text-[var(--cc-text-muted)]">
            {searchQuery ? 'Ничего не найдено' : 'Нет диалогов или групп.'}
          </div>
        )}
      </div>

      {/* Discord-style Bottom Profile Dock */}
      <div className="h-[64px] px-3 border-t border-[var(--cc-border)] bg-black/20 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 min-w-0 flex-1 rounded-xl p-1 -ml-1 hover:bg-[var(--cc-bg-surface-hover)]/70 transition-colors cursor-pointer text-left"
          title="Открыть профиль и настройки"
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-[var(--cc-accent)] flex items-center justify-center font-semibold text-sm text-white shrink-0 overflow-hidden">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser.name[0]?.toUpperCase() || '?'
              )}
            </div>
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--cc-bg-rail)] rounded-full"
              title="В сети"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[var(--cc-text)] truncate flex items-center gap-1">
              <span className="truncate">{currentUser.name}</span>
              {currentUser.isAdmin && (
                <Crown className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
              )}
              {currentUser.isMuted && (
                <VolumeX className="w-3 h-3 text-red-400 shrink-0" />
              )}
            </div>
            <div className="text-[11px] text-[var(--cc-text-muted)] truncate">
              @{currentUser.username}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          <PWAInstallButton />
          {onOpenQrCode && (
            <button
              type="button"
              onClick={onOpenQrCode}
              aria-label="QR-код профиля"
              className="w-9 h-9 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center transition-colors cursor-pointer"
              title="QR-код для быстрого входа с другого устройства"
            >
              <QrCode className="w-[18px] h-[18px]" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="Настройки профиля"
            className="w-9 h-9 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center transition-colors cursor-pointer"
            title="Настройки профиля"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Выйти из аккаунта"
            className="w-9 h-9 rounded-xl text-[var(--cc-text-muted)] hover:text-red-400 hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center transition-colors cursor-pointer"
            title="Выйти"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Admin Deletion */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[var(--cc-bg-rail)] border border-[var(--cc-border-strong)] w-full max-w-sm rounded-2xl p-5 shadow-2xl relative">
            <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>

            <h3 className="text-base font-semibold text-[var(--cc-text)] text-center mb-1">
              Удалить все номера?
            </h3>

            <p className="text-xs text-[var(--cc-text-muted)] text-center mb-4 leading-relaxed">
              Это действие удалит из базы данных всех остальных зарегистрированных пользователей. В системе останется исключительно ваш номер администратора <strong className="text-[var(--cc-text)]">+7 (925) 469-98-01</strong>.
            </p>

            {deleteSuccess && (
              <div className="p-2.5 mb-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-center text-emerald-300 text-xs font-medium">
                Все сторонние номера успешно удалены из базы!
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDeleteAllNumbers?.();
                    setDeleteSuccess(true);
                    setTimeout(() => {
                      setShowConfirmDelete(false);
                      setDeleteSuccess(false);
                      setIsDeleting(false);
                    }, 1200);
                  } catch {
                    setIsDeleting(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                {isDeleting ? 'Удаление...' : 'Да, удалить все'}
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2.5 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] text-[var(--cc-text-secondary)] text-xs font-medium cursor-pointer transition-colors border border-[var(--cc-border)]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
