import React, { useState } from 'react';
import { X, Crown, UserPlus, Trash2, LogOut } from 'lucide-react';
import { GroupChat, UserProfile } from '../types/chat';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupChat | null;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onAddMember: (groupId: string, userId: string) => void;
  onRemoveMember: (groupId: string, userId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onLeaveGroup: (groupId: string) => void;
  onOpenUserProfile?: (user: UserProfile) => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  isOpen,
  onClose,
  group,
  currentUser,
  allUsers,
  onAddMember,
  onRemoveMember,
  onDeleteGroup,
  onLeaveGroup,
  onOpenUserProfile
}) => {
  const [showAddSection, setShowAddSection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState<'delete' | 'leave' | null>(null);

  if (!isOpen || !group) return null;

  const isCreator = group.creatorId === currentUser.id;
  const memberIds = Array.isArray(group.memberIds) ? group.memberIds : [];
  const nonMembers = allUsers.filter(u => !memberIds.includes(u.id) && (
    !searchQuery ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--cc-bg-rail)] border border-[var(--cc-border-strong)] w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl relative my-auto max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть информацию о группе"
          className="absolute top-3.5 right-3.5 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] rounded-xl hover:bg-[var(--cc-bg-surface-hover)] cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--cc-bg-surface-elevated)] border border-[var(--cc-border-strong)] flex items-center justify-center text-2xl font-semibold text-[var(--cc-text)] mb-3">
            {group.name[0]?.toUpperCase() || 'Г'}
          </div>
          <h3 className="text-lg font-semibold text-[var(--cc-text)]">{group.name}</h3>
          {group.description && (
            <p className="text-xs text-[var(--cc-text-muted)] mt-1 max-w-xs mx-auto">{group.description}</p>
          )}
          <div className="text-xs text-[var(--cc-accent-text)] mt-1.5 font-medium">
            {memberIds.length} участников
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">Участники</span>
            {isCreator && (
              <button
                type="button"
                onClick={() => setShowAddSection(!showAddSection)}
                className="text-xs text-[var(--cc-accent-text)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{showAddSection ? 'Скрыть' : 'Добавить'}</span>
              </button>
            )}
          </div>

          {showAddSection && (
            <div className="mb-3 p-3 bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--cc-text)]">Добавить в группу</span>
                <button
                  type="button"
                  onClick={() => setShowAddSection(false)}
                  className="text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Поиск людей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--cc-bg-app)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-lg px-3 py-2 text-[16px] sm:text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none"
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {nonMembers.length === 0 ? (
                  <div className="text-xs text-[var(--cc-text-muted)] py-2 text-center">Все найденные уже в группе</div>
                ) : (
                  nonMembers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[var(--cc-bg-surface-hover)]">
                      <span className="text-xs text-[var(--cc-text)] truncate mr-2">{u.name} (@{u.username})</span>
                      <button
                        type="button"
                        onClick={() => onAddMember(group.id, u.id)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
                      >
                        Добавить
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-[var(--cc-bg-surface)] p-2 rounded-xl border border-[var(--cc-border)]">
            {memberIds.map((mId) => {
              const matchedUser = allUsers.find(x => x.id === mId) || (mId === currentUser.id ? currentUser : null);
              const u = matchedUser || {
                id: mId,
                name: 'Участник',
                username: 'user',
                avatar: ''
              };
              const isMemberCreator = group.creatorId === mId;
              const isMe = currentUser.id === mId;
              const canInspect = Boolean(matchedUser && onOpenUserProfile);

              return (
                <div
                  key={mId}
                  className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-[var(--cc-bg-surface-hover)] transition-colors"
                >
                  <button
                    type="button"
                    data-testid={`group-member-profile-${mId}`}
                    disabled={!canInspect}
                    onClick={() => {
                      if (!matchedUser || !onOpenUserProfile) return;
                      onClose();
                      onOpenUserProfile(matchedUser);
                    }}
                    className={`flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-lg p-0.5 ${
                      canInspect ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[var(--cc-bg-surface-elevated)] flex items-center justify-center text-xs font-semibold text-[var(--cc-text)] shrink-0 overflow-hidden">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.name[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--cc-text)] flex items-center gap-1.5 truncate">
                        <span>{u.name}</span>
                        {isMe && <span className="text-[10px] text-[var(--cc-text-muted)] font-normal">(вы)</span>}
                        {isMemberCreator && (
                          <span className="text-[10px] text-amber-400 font-medium inline-flex items-center gap-0.5">
                            <Crown className="w-3 h-3 text-amber-400" /> Владелец
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--cc-text-muted)] truncate">@{u.username}</div>
                    </div>
                  </button>

                  {isCreator && !isMemberCreator && (
                    <button
                      type="button"
                      onClick={() => onRemoveMember(group.id, mId)}
                      className="text-xs text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Удалить из группы"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--cc-border)] flex flex-col gap-2">
          {confirmAction ? (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/35 flex flex-col gap-2">
              <span className="text-xs text-red-200 text-center font-medium">
                {confirmAction === 'delete'
                  ? 'Вы уверены, что хотите удалить эту группу для всех?'
                  : 'Вы уверены, что хотите покинуть группу?'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmAction === 'delete') {
                      onDeleteGroup(group.id);
                    } else {
                      onLeaveGroup(group.id);
                    }
                    setConfirmAction(null);
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Да, подтвердить
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2 rounded-lg bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] text-[var(--cc-text-secondary)] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <>
              {isCreator ? (
                <button
                  type="button"
                  onClick={() => setConfirmAction('delete')}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Удалить группу
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmAction('leave')}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Покинуть группу
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
