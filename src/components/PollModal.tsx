import React, { useState } from 'react';
import { BarChart3, X } from 'lucide-react';
import { PollData } from '../types/chat';

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (poll: PollData) => void;
}

export const PollModal: React.FC<PollModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [question, setQuestion] = useState('');
  const [optionsText, setOptionsText] = useState('Да\nНет\nОбсудим позже');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      setError('Введите вопрос для опроса');
      return;
    }

    const options = optionsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    if (options.length < 2) {
      setError('Укажите минимум 2 варианта ответа');
      return;
    }

    onSubmit({
      question: cleanQuestion,
      options: options.slice(0, 6).map((opt, idx) => ({
        id: `opt_${idx}`,
        text: opt,
        voterIds: []
      }))
    });

    setQuestion('');
    setOptionsText('Да\nНет\nОбсудим позже');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--cc-bg-rail)] border border-[var(--cc-border-strong)] w-full max-w-md rounded-2xl p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть создание опроса"
          className="absolute top-4 right-4 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] p-1.5 rounded-lg hover:bg-[var(--cc-bg-surface-hover)] cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] flex items-center justify-center text-[var(--cc-accent-text)]">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--cc-text)]">Создать опрос</h3>
            <p className="text-xs text-[var(--cc-text-muted)]">Голосование в реальном времени</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[var(--cc-text-muted)] mb-1">
              Вопрос опроса *
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => { setQuestion(e.target.value); setError(''); }}
              placeholder="Например: Во сколько сегодня созвон?"
              className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--cc-text-muted)] mb-1">
              Варианты ответа (по одному на строку, минимум 2)
            </label>
            <textarea
              rows={4}
              required
              value={optionsText}
              onChange={(e) => { setOptionsText(e.target.value); setError(''); }}
              placeholder="Да&#10;Нет&#10;Обсудим позже"
              className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none resize-none font-sans transition-colors"
            />
          </div>

          {error && <div className="text-xs text-red-400 font-medium text-center">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[var(--cc-bg-surface)] hover:bg-[var(--cc-bg-surface-hover)] border border-[var(--cc-border)] text-[var(--cc-text-secondary)] py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Отправить опрос
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
