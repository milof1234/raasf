import React, { useMemo, useState } from 'react';
import { Trophy, X, Coins, Star, Cat, Flame, Crown } from 'lucide-react';
import { GroupChat, UserProfile } from '../types/chat';
import {
  CAT_STORAGE_KEYS,
  formatCoinsCount,
  getCatLevelInfo,
  getUserCatStorageKey,
  readUserCatEconomy
} from '../utils/catGameLogic';
import { ChatStreakInfo, formatDaysLabel } from '../utils/streakLogic';
import { getEmojiStatusItem } from '../utils/cosmoFeatures';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  allUsers: Record<string, UserProfile>;
  allGroups: Record<string, GroupChat>;
  chatStreaks: Record<string, ChatStreakInfo>;
  onSelectUserProfile: (user: UserProfile) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  allGroups,
  chatStreaks,
  onSelectUserProfile
}) => {
  const [tab, setTab] = useState<'coins' | 'stars' | 'cats' | 'streaks'>('coins');

  const userRows = useMemo(() => {
    const myEconomy = readUserCatEconomy(currentUser.id);
    let mySwipes = 0;
    try {
      const rawSwipes = localStorage.getItem(getUserCatStorageKey(CAT_STORAGE_KEYS.swipes, currentUser.id));
      if (rawSwipes) mySwipes = Math.max(0, Number(rawSwipes) || 0);
    } catch {}
    const myLevelInfo = getCatLevelInfo(mySwipes);

    return Object.values(allUsers).map((u) => {
      const isMe = u.id === currentUser.id;
      const stats = u.catStats;
      const coins = isMe ? myEconomy.coins : (stats?.coins ?? 10);
      const stars = isMe ? myEconomy.stars : (stats?.stars ?? 0);
      const totalSwipes = isMe ? mySwipes : (stats?.totalSwipes ?? 0);
      const level = isMe ? myLevelInfo.level : (stats?.level ?? getCatLevelInfo(totalSwipes).level);
      const catName = isMe ? myEconomy.catName : (stats?.catName || 'Космо-Котик');
      return {
        user: u,
        isMe,
        coins,
        stars,
        totalSwipes,
        level,
        catName
      };
    });
  }, [allUsers, currentUser.id, isOpen]);

  const sortedUsers = useMemo(() => {
    const copy = [...userRows];
    if (tab === 'coins') {
      copy.sort((a, b) => b.coins - a.coins || b.stars - a.stars);
    } else if (tab === 'stars') {
      copy.sort((a, b) => b.stars - a.stars || b.coins - a.coins);
    } else {
      copy.sort((a, b) => b.totalSwipes - a.totalSwipes || b.level - a.level);
    }
    return copy;
  }, [userRows, tab]);

  const topStreaks = useMemo(() => {
    const entries: Array<{
      key: string;
      title: string;
      subtitle: string;
      count: number;
      isHotToday: boolean;
      isFrozenToday: boolean;
    }> = [];

    Object.values(chatStreaks).forEach((s) => {
      if (s.count <= 0) return;
      let title = 'Чат';
      let subtitle = s.customName || 'Огонёк';

      if (s.streakKey.startsWith('group_')) {
        const gid = s.streakKey.slice('group_'.length);
        const grp = allGroups[gid];
        title = grp ? `👥 ${grp.name}` : '👥 Группа';
      } else if (s.streakKey.startsWith('direct_self_')) {
        const uid = s.streakKey.slice('direct_self_'.length);
        const usr = allUsers[uid];
        title = usr ? `⭐ Избранное (${usr.name})` : '⭐ Избранное';
      } else if (s.streakKey.startsWith('direct_')) {
        const rawPair = s.streakKey.slice('direct_'.length);
        const parts = rawPair.split('__');
        const names = parts
          .map(id => allUsers[id]?.name || id)
          .filter(Boolean);
        title = names.join(' ↔ ');
      }

      entries.push({
        key: s.streakKey,
        title,
        subtitle,
        count: s.count,
        isHotToday: s.isHotToday,
        isFrozenToday: Boolean(s.isFrozenToday) && !s.isHotToday
      });
    });

    entries.sort((a, b) => b.count - a.count);
    return entries;
  }, [chatStreaks, allGroups, allUsers]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Рейтинг CosmoChat"
        data-testid="leaderboard-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--cc-bg-rail)] border border-[var(--cc-border-strong)] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88dvh] text-[var(--cc-text)] pb-[env(safe-area-inset-bottom)]"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[var(--cc-bg-header)] border-b border-[var(--cc-border)] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="text-[15px] font-bold truncate">Топ CosmoChat</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть рейтинг"
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] hover:bg-[var(--cc-bg-surface-hover)] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex sm:grid sm:grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] text-xs overflow-x-auto">
            <button
              type="button"
              data-testid="leaderboard-tab-coins"
              onClick={() => setTab('coins')}
              className={`flex-1 min-w-[78px] sm:min-w-0 py-2.5 sm:py-2 px-2 rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'coins'
                  ? 'bg-[var(--cc-bg-surface-elevated)] text-amber-300 shadow-sm'
                  : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
              }`}
            >
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span>Монеты</span>
            </button>
            <button
              type="button"
              data-testid="leaderboard-tab-stars"
              onClick={() => setTab('stars')}
              className={`flex-1 min-w-[78px] sm:min-w-0 py-2.5 sm:py-2 px-2 rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'stars'
                  ? 'bg-[var(--cc-bg-surface-elevated)] text-yellow-300 shadow-sm'
                  : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
              }`}
            >
              <Star className="w-3.5 h-3.5 shrink-0" />
              <span>Звёзды</span>
            </button>
            <button
              type="button"
              data-testid="leaderboard-tab-cats"
              onClick={() => setTab('cats')}
              className={`flex-1 min-w-[78px] sm:min-w-0 py-2.5 sm:py-2 px-2 rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'cats'
                  ? 'bg-[var(--cc-bg-surface-elevated)] text-cyan-300 shadow-sm'
                  : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
              }`}
            >
              <Cat className="w-3.5 h-3.5 shrink-0" />
              <span>Котики</span>
            </button>
            <button
              type="button"
              data-testid="leaderboard-tab-streaks"
              onClick={() => setTab('streaks')}
              className={`flex-1 min-w-[78px] sm:min-w-0 py-2.5 sm:py-2 px-2 rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'streaks'
                  ? 'bg-[var(--cc-bg-surface-elevated)] text-orange-300 shadow-sm'
                  : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span>Огоньки</span>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-1.5">
          {tab === 'streaks' ? (
            topStreaks.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--cc-text-muted)]">
                Активных огоньков пока нет — напишите друг другу в чате!
              </div>
            ) : (
              topStreaks.map((s, idx) => {
                const rankLabel = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                return (
                  <div
                    key={s.key}
                    className="p-3 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] flex items-center gap-3"
                  >
                    <div className="w-7 text-center font-bold text-sm tabular-nums shrink-0">
                      {rankLabel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[var(--cc-text)] truncate">{s.title}</div>
                      <div className="text-[11px] text-[var(--cc-text-muted)] truncate">
                        {s.subtitle} · {s.isFrozenToday ? '❄️ заморожен' : s.isHotToday ? '🔥 горит' : '⏳ ждёт ответа'}
                      </div>
                    </div>
                    <div className="text-sm font-black text-orange-300 tabular-nums shrink-0">
                      🔥 {formatDaysLabel(s.count)}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            sortedUsers.map((row, idx) => {
              const rankLabel = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
              return (
                <button
                  key={row.user.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectUserProfile(row.user);
                  }}
                  className={`w-full p-2.5 rounded-xl border flex items-center gap-3 text-left transition-colors cursor-pointer ${
                    row.isMe
                      ? 'bg-[var(--cc-accent-soft)] border-[var(--cc-accent)]/40'
                      : 'bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border-[var(--cc-border)]'
                  }`}
                >
                  <div className="w-7 text-center font-bold text-sm tabular-nums shrink-0">
                    {rankLabel}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[var(--cc-accent)] flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                    {row.user.avatar ? (
                      <img src={row.user.avatar} alt={row.user.name} className="w-full h-full object-cover" />
                    ) : (
                      row.user.name[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[var(--cc-text)] flex items-center gap-1 truncate">
                      <span className="truncate">{row.user.name}</span>
                      {getEmojiStatusItem(row.user.emojiStatus).emoji && (
                        <span title={getEmojiStatusItem(row.user.emojiStatus).title} className="text-xs leading-none shrink-0">
                          {getEmojiStatusItem(row.user.emojiStatus).emoji}
                        </span>
                      )}
                      {row.user.isAdmin && <Crown className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-[var(--cc-text-muted)] truncate">
                      🐱 {row.catName} · Ур. {row.level}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    {tab === 'coins' && (
                      <div className="text-xs font-extrabold text-amber-300">
                        {formatCoinsCount(row.coins)} 🪙
                      </div>
                    )}
                    {tab === 'stars' && (
                      <div className="text-xs font-extrabold text-yellow-300">
                        {row.stars} ⭐
                      </div>
                    )}
                    {tab === 'cats' && (
                      <div className="text-xs font-extrabold text-cyan-300">
                        {formatCoinsCount(row.totalSwipes)} 🐾
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
