import React, { useState } from 'react';
import { Users, X, Check } from 'lucide-react';
import { UserProfile } from '../types/chat';
import { containsProfanity } from '../utils/security';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUserId: string;
  onCreateGroup: (data: { name: string; description: string; avatarColor: string; memberIds: string[] }) => void;
}

const COLOR_OPTIONS = [
  { id: 'indigo', bg: 'bg-indigo-600' },
  { id: 'blue', bg: 'bg-blue-600' },
  { id: 'emerald', bg: 'bg-emerald-600' },
  { id: 'rose', bg: 'bg-rose-600' },
  { id: 'amber', bg: 'bg-amber-600' },
  { id: 'purple', bg: 'bg-purple-600' },
];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUserId,
  onCreateGroup
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchMember, setSearchMember] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleToggleMember = (userId: string) => {
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== userId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanDesc = description.trim();
    if (!cleanName) {
      setError('Введите название группы');
      return;
    }
    if (containsProfanity(cleanName)) {
      setError('Название этой группы с нецензурной лексикой');
      return;
    }
    if (cleanDesc && containsProfanity(cleanDesc)) {
      setError('Описание этой группы с нецензурной лексикой');
      return;
    }

    onCreateGroup({
      name: cleanName,
      description: cleanDesc,
      avatarColor: selectedColor,
      memberIds: Array.from(new Set([currentUserId, ...selectedMemberIds]))
    });

    setName('');
    setDescription('');
    setSelectedMemberIds([]);
    setError('');
    onClose();
  };

  const filteredUsers = users.filter(u => {
    if (u.id === currentUserId) return false;
    const q = searchMember.toLowerCase().trim();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

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
          aria-label="Закрыть создание группы"
          className="absolute top-3.5 right-3.5 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] rounded-xl hover:bg-[var(--cc-bg-surface-hover)] cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] flex items-center justify-center text-[var(--cc-accent-text)]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--cc-text)]">Новая группа</h3>
            <p className="text-xs text-[var(--cc-text-muted)]">Создайте групповой чат для команды или друзей</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--cc-text-muted)] mb-2">
              Оформление группы
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(c.id)}
                  className={`w-9 h-9 rounded-xl ${c.bg} ${selectedColor === c.id ? 'ring-2 ring-white scale-105 shadow-md' : 'opacity-65 hover:opacity-100'} text-xs font-bold flex items-center justify-center text-white transition-all cursor-pointer`}
                >
                  Г
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--cc-text-muted)] mb-1">
              Название группы *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Например: Команда проекта"
              className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2.5 text-[16px] sm:text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--cc-text-muted)] mb-1">
              Описание (необязательно)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(''); }}
              placeholder="О чём этот чат..."
              className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2.5 text-[16px] sm:text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--cc-text-muted)] mb-1">
              Добавить участников ({selectedMemberIds.length})
            </label>
            <input
              type="text"
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
              placeholder="Поиск людей..."
              className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3 py-2 text-[16px] sm:text-xs text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] mb-2 focus:outline-none"
            />
            <div className="max-h-40 overflow-y-auto space-y-1 bg-[var(--cc-bg-surface)] p-2 rounded-xl border border-[var(--cc-border)]">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-3 text-xs text-[var(--cc-text-muted)]">Пользователи не найдены</div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedMemberIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleToggleMember(u.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors text-left ${
                        isSelected
                          ? 'bg-[var(--cc-bg-active-row)] ring-1 ring-[var(--cc-accent)]/40'
                          : 'hover:bg-[var(--cc-bg-surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[var(--cc-bg-surface-elevated)] flex items-center justify-center text-xs font-semibold text-[var(--cc-text)] shrink-0 overflow-hidden">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            u.name[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--cc-text)] truncate">{u.name}</div>
                          <div className="text-[10px] text-[var(--cc-text-muted)] truncate">@{u.username}</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                        isSelected
                          ? 'bg-[var(--cc-accent)] border-[var(--cc-accent)] text-white'
                          : 'border-[var(--cc-border-strong)] bg-[var(--cc-bg-app)]'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {error && <div className="text-xs text-red-400 font-medium text-center">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] text-[var(--cc-text-secondary)] text-sm font-medium transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Создать группу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
