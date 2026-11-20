import React from 'react';
import { Hammer, Lock, Gift, Sparkles } from 'lucide-react';
import { OwnedGift } from '../types/chat';
import { CRAFT_REQUIRED_COUNT, getGiftCraftRecipes } from '../utils/cosmoFeatures';

interface GiftCraftPanelProps {
  ownedGifts: OwnedGift[];
  onCraftGifts: (ingredients: OwnedGift[], mode: 'next_tier' | 'holo') => OwnedGift | null;
  onCrafted?: (crafted: OwnedGift) => void;
  testIdPrefix?: string;
}

export const GiftCraftPanel: React.FC<GiftCraftPanelProps> = ({
  ownedGifts,
  onCraftGifts,
  onCrafted,
  testIdPrefix = 'craft'
}) => {
  const recipes = getGiftCraftRecipes(ownedGifts);
  const readyCount = recipes.filter(r => r.canCraft).length;

  return (
    <div
      data-testid={`${testIdPrefix}-craft-panel`}
      className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-950/60 via-indigo-950/55 to-slate-900/90 border border-violet-400/35 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-amber-200 flex items-center gap-1.5">
            <Hammer className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Крафт подарков ({CRAFT_REQUIRED_COUNT} → 1)</span>
          </h4>
          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
            Объединяйте {CRAFT_REQUIRED_COUNT} одинаковых подарков в подарок уровнем выше.
          </p>
        </div>
        {readyCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-200 shrink-0 tabular-nums">
            Готово: {readyCount}
          </span>
        )}
      </div>

      {/* Cosmic Hammer Relic Highlight */}
      <div className="p-2.5 rounded-xl bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-amber-500/20 border border-amber-300/40 flex items-start gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-700 to-amber-500 border border-amber-200/60 flex items-center justify-center text-xl shrink-0 shadow-md">
          🔨
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-xs font-extrabold text-amber-100 flex items-center gap-1.5 flex-wrap">
            <span>Космический молот</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-300/35">
              10× 😻 Космо-Котёнок
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-200/90">
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <Gift className="w-3 h-3 shrink-0" /> Можно подарить
            </span>
            <span className="inline-flex items-center gap-1 text-rose-300">
              <Lock className="w-3 h-3 shrink-0" /> Нельзя купить и продать
            </span>
          </div>
        </div>
      </div>

      {/* All 5 Upgrade Recipes */}
      <div className="space-y-2">
        {recipes.map((recipe) => {
          const pct = Math.min(100, Math.round((recipe.ownedCount / recipe.requiredCount) * 100));
          const missing = Math.max(0, recipe.requiredCount - recipe.ownedCount);

          return (
            <div
              key={recipe.sourceGift.giftId}
              data-testid={`${testIdPrefix}-craft-recipe-${recipe.sourceGift.giftId}`}
              className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                recipe.canCraft
                  ? recipe.isCosmicHammerTarget
                    ? 'bg-gradient-to-r from-fuchsia-950/80 to-amber-950/60 border-amber-300/60 shadow-lg'
                    : 'bg-indigo-950/75 border-purple-400/50'
                  : 'bg-black/30 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-1.5 text-xs font-semibold text-white">
                  <span className="shrink-0">{recipe.requiredCount}× {recipe.sourceGift.emoji}</span>
                  <span className="text-slate-400 shrink-0">→</span>
                  <span className="shrink-0">{recipe.targetGift.emoji}</span>
                  <span className={`truncate ${recipe.isCosmicHammerTarget ? 'text-amber-200 font-bold' : ''}`}>
                    {recipe.targetGift.title}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-bold tabular-nums shrink-0 ${
                    recipe.canCraft ? 'text-emerald-300' : 'text-slate-300'
                  }`}
                >
                  {recipe.ownedCount}/{recipe.requiredCount}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      recipe.canCraft
                        ? recipe.isCosmicHammerTarget
                          ? 'bg-gradient-to-r from-fuchsia-400 via-amber-300 to-yellow-400'
                          : 'bg-gradient-to-r from-purple-400 to-emerald-400'
                        : recipe.isCosmicHammerTarget
                        ? 'bg-amber-400/70'
                        : 'bg-indigo-400/70'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {recipe.canCraft ? (
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-craft-next-${recipe.sourceGift.giftId}`}
                    onClick={() => {
                      const res = onCraftGifts(recipe.craftableItems, 'next_tier');
                      if (res && onCrafted) {
                        onCrafted(res);
                      }
                    }}
                    className={`min-h-[34px] px-3 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer transition-all active:scale-95 ${
                      recipe.isCosmicHammerTarget
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-fuchsia-400 text-slate-950 shadow-md hover:brightness-110'
                        : 'bg-purple-500 hover:bg-purple-400 text-white shadow-sm'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>{recipe.isCosmicHammerTarget ? 'Выковать 🔨' : 'Скрафтить'}</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                    ещё {missing}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
