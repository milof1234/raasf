import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, CornerDownLeft, QrCode, User, HelpCircle, Trash2, ShieldAlert, Waves, Coffee } from 'lucide-react';
import { UserProfile, AppTheme } from '../types/chat';

interface CommandLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onOpenQrCode: () => void;
  onOpenProfile: () => void;
  onMatrixModeChange?: (active: boolean) => void;
  currentTheme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
  onTriggerMellstroy?: () => void;
  isBeeSwarmActive?: boolean;
  onToggleBees?: () => void;
  onTriggerFox?: () => void;
  onTriggerMinigame?: () => void;
  onToggleMusic?: () => void;
  isMusicActive?: boolean;
}

interface CommandLog {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'info' | 'matrix';
  text: string;
  timestamp: string;
}

export const CommandLineModal: React.FC<CommandLineModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  onOpenQrCode,
  onOpenProfile,
  onMatrixModeChange,
  currentTheme = 'default',
  onThemeChange,
  onTriggerMellstroy,
  isBeeSwarmActive = false,
  onToggleBees,
  onTriggerFox,
  onTriggerMinigame,
  onToggleMusic,
  isMusicActive = false
}) => {
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [isMatrixMode, setIsMatrixMode] = useState(false);
  const [matrixLines, setMatrixLines] = useState<string[]>([]);

  const [logs, setLogs] = useState<CommandLog[]>(() => [
    {
      id: 'init-1',
      type: 'info',
      text: '🚀 COSMO_OS v3.8 TERMINAL INITIALIZED',
      timestamp: new Date().toLocaleTimeString()
    },
    {
      id: 'init-2',
      type: 'output',
      text: `Текущий профиль: ${currentUser.name} (@${currentUser.username || 'user'}) | Роль: ${currentUser.isAdmin ? 'Admin' : 'User'}`,
      timestamp: new Date().toLocaleTimeString()
    },
    {
      id: 'init-3',
      type: 'success',
      text: '💡 Введите "qr" для генерации QR-кода быстрого входа с другого устройства или "help" для списка команд.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  const inputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && !isMatrixMode) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, isMatrixMode]);

  // Scroll to bottom on new logs
  useEffect(() => {
    if (logContainerRef.current && !isMatrixMode) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isMatrixMode]);

  // Matrix rain effect loop
  useEffect(() => {
    if (!isMatrixMode) return;
    const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$#@&%*<>~+-_/\\|';
    const interval = setInterval(() => {
      const randomLine = Array.from({ length: 45 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      setMatrixLines(prev => [randomLine, ...prev.slice(0, 30)]);
    }, 60);

    return () => clearInterval(interval);
  }, [isMatrixMode]);

  if (!isOpen) return null;

  const addLog = (type: CommandLog['type'], text: string) => {
    setLogs(prev => [
      ...prev,
      {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type,
        text,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const handleExecuteCommand = (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    // Save to history
    setHistory(prev => [...prev, trimmed]);
    setHistoryIdx(-1);

    // Echo input
    addLog('input', `$ ${trimmed}`);
    setInputVal('');

    // Normalize command (remove leading slash if present, lowercase)
    const normalized = trimmed.startsWith('/') ? trimmed.substring(1).trim().toLowerCase() : trimmed.toLowerCase();
    const parts = normalized.split(/\s+/);
    const cmd = parts[0];

    switch (cmd) {
      case 'matrixx':
      case 'matrix': {
        addLog('success', '[MATRIX_PROTOCOL] Инициация цифрового потока Зиона...');
        setIsMatrixMode(true);
        if (onMatrixModeChange) onMatrixModeChange(false); // keep messenger background normal, launch full screen matrix overlay
        break;
      }

      case 'mellstroy': {
        addLog('success', '[MELLSTROY] Запуск...');
        onClose();
        if (onTriggerMellstroy) {
          onTriggerMellstroy();
        }
        break;
      }

      case 'bee':
      case 'bees':
      case 'пчелы':
      case 'пчёлы': {
        const nextActive = !isBeeSwarmActive;
        if (nextActive) {
          addLog('success', '🐝 [BEE_SWARM] Пчёлы выпущены! Введите "bee" ещё раз или нажмите Esc, чтобы убрать их.');
        } else {
          addLog('info', '🍯 [BEE_SWARM] Пчёлы вернулись в улей.');
        }
        if (onToggleBees) {
          onToggleBees();
        }
        setTimeout(() => {
          onClose();
        }, 350);
        break;
      }

      case 'fox': {
        addLog('success', '🦊 [FOX] Открытие...');
        onClose();
        if (onTriggerFox) {
          onTriggerFox();
        }
        break;
      }

      case 'minigame':
      case 'game':
      case 'board':
      case 'vision':
      case 'excalidraw':
      case 'cat': {
        addLog('success', '🎨 [VISION_BOARD] Запуск доски пути пользователя и мини-игры...');
        onClose();
        if (onTriggerMinigame) {
          onTriggerMinigame();
        }
        break;
      }

      case 'music':
      case 'song':
      case 'player':
      case 'плейер':
      case 'музыка': {
        const nextActive = !isMusicActive;
        if (nextActive) {
          addLog('success', '🎵 [MUSIC_PLAYER] Плеер запущен сверху! Название трека отображается в центре.');
        } else {
          addLog('info', '🎵 [MUSIC_PLAYER] Музыкальный плеер скрыт.');
        }
        if (onToggleMusic) {
          onToggleMusic();
        }
        setTimeout(() => {
          onClose();
        }, 350);
        break;
      }

      case 'qr':
      case 'qrcode':
      case 'code': {
        addLog('info', `[COSMO_AUTH] Генерация сессионного QR-кода для @${currentUser.username}...`);
        addLog('success', `[COSMO_AUTH] Межпланетный QR-код готов! Переход к экрану сканирования...`);
        setTimeout(() => {
          onClose();
        }, 300);
        onOpenQrCode();
        break;
      }

      case 'wave':
      case 'волна': {
        const nextTheme: AppTheme = currentTheme === 'wave' ? 'default' : 'wave';
        if (nextTheme === 'wave') {
          addLog('success', '🌊 [WAVE_THEME] Тема оформления успешно изменена на «Волна»!');
          addLog('info', 'Океаническая палитра: глубокая морская лазурь, аквамарин и неоновые волны.');
        } else {
          addLog('info', '🚀 [COSMO_THEME] Возврат к классической космической теме CosmoChat.');
        }
        if (onThemeChange) {
          onThemeChange(nextTheme);
        }
        setTimeout(() => {
          onClose();
        }, 450);
        break;
      }

      case 'cofe':
      case 'coffee':
      case 'кофе': {
        const nextTheme: AppTheme = currentTheme === 'cofe' ? 'default' : 'cofe';
        if (nextTheme === 'cofe') {
          addLog('success', '☕ [COFE_THEME] Тема оформления успешно изменена на «Кофе»!');
          addLog('info', 'Тёплая палитра: эспрессо, тёмный шоколад, карамель и золотистая пенка.');
        } else {
          addLog('info', '🚀 [COSMO_THEME] Возврат к классической космической теме CosmoChat.');
        }
        if (onThemeChange) {
          onThemeChange(nextTheme);
        }
        setTimeout(() => {
          onClose();
        }, 450);
        break;
      }

      case 'help':
      case '?': {
        addLog('info', '━━━━━━━━━━━━━━━━ ДОСТУПНЫЕ КОМАНДЫ ━━━━━━━━━━━━━━━━');
        addLog('output', '• qr             - Сгенерировать QR-код для входа с другого устройства');
        addLog('output', '• wave           - Сменить тему оформления на «Волна» (океан / бирюза)');
        addLog('output', '• cofe           - Сменить тему оформления на «Кофе» (эспрессо / карамель)');
        addLog('output', '• bee            - Запустить / убрать летающих пчёл по экрану');
        addLog('output', '• fox            - Показать лисичку');
        addLog('output', '• minigame       - Открыть доску Vision Board (путь пользователя + котик)');
        addLog('output', '• music          - Включить / скрыть плеер (YouTube Музыка, совместное прослушивание, MP3 и Windows)');
        addLog('output', '• profile        - Открыть окно редактирования профиля');
        addLog('output', '• users          - Показать список активных пользователей');
        addLog('output', '• whoami         - Информация о текущем пользователе');
        addLog('output', '• status         - Проверка сетевого соединения');
        addLog('output', '• clear          - Очистить экран консоли');
        addLog('output', '• exit / close   - Закрыть терминал');
        addLog('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        break;
      }

      case 'profile':
      case 'settings': {
        addLog('info', 'Открытие настроек профиля...');
        setTimeout(() => {
          onClose();
          onOpenProfile();
        }, 250);
        break;
      }

      case 'users':
      case 'list': {
        addLog('info', `[USERS] Всего пользователей в сети: ${allUsers.length}`);
        allUsers.forEach((u, i) => {
          addLog(
            'output',
            ` ${i + 1}. ${u.name} (@${u.username || 'unknown'}) - ${u.phone} ${u.isAdmin ? '👑 [Admin]' : ''}`
          );
        });
        break;
      }

      case 'whoami': {
        addLog('output', `Имя: ${currentUser.name}`);
        addLog('output', `Username: @${currentUser.username}`);
        addLog('output', `Телефон: ${currentUser.phone}`);
        addLog('output', `ID: ${currentUser.id}`);
        addLog('output', `Администратор: ${currentUser.isAdmin ? 'Да' : 'Нет'}`);
        break;
      }

      case 'status': {
        addLog('success', '🟢 Сеть: Firebase Realtime Database подключена');
        addLog('info', `Время клиента: ${new Date().toLocaleString()}`);
        addLog('info', `Origin: ${window.location.origin}`);
        break;
      }

      case 'clear':
      case 'cls': {
        setLogs([]);
        break;
      }

      case 'exit':
      case 'close':
      case 'quit': {
        addLog('info', 'Закрытие терминала...');
        setTimeout(() => {
          onClose();
        }, 150);
        break;
      }

      default: {
        addLog(
          'error',
          `❌ Команда "${trimmed}" не распознана. Введите "qr" для QR-кода или "help" для списка команд.`
        );
        break;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecuteCommand(inputVal);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (isMatrixMode) {
        setIsMatrixMode(false);
        if (onMatrixModeChange) onMatrixModeChange(false);
      } else {
        onClose();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInputVal(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setInputVal('');
      } else {
        setHistoryIdx(nextIdx);
        setInputVal(history[nextIdx]);
      }
    }
  };

  if (isMatrixMode) {
    const handleExitMatrix = () => {
      setIsMatrixMode(false);
      if (onMatrixModeChange) onMatrixModeChange(false);
    };

    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-black/98 backdrop-blur-xl animate-fade-in font-mono select-none overflow-hidden"
        onClick={handleExitMatrix}
      >
        <div className="w-full max-w-4xl flex items-center justify-between border-b border-emerald-500/40 pb-3 z-10 bg-black/80 px-4 rounded-xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm tracking-widest">
            <ShieldAlert className="w-5 h-5 animate-pulse text-emerald-400" />
            <span>[ SYSTEM OVERRIDE // MATRIX RELAY ACTIVE ]</span>
          </div>
          <button
            onClick={handleExitMatrix}
            className="px-3 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            ВЫХОД [ESC]
          </button>
        </div>

        {/* Matrix rain display */}
        <div className="flex-1 w-full max-w-4xl my-4 overflow-hidden relative flex flex-col justify-end text-emerald-500 font-mono text-sm leading-tight drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />
          {matrixLines.map((line, idx) => (
            <div
              key={idx}
              className="whitespace-nowrap overflow-hidden text-ellipsis opacity-90"
              style={{
                color: idx === 0 ? '#ffffff' : idx < 5 ? '#34d399' : '#059669',
                textShadow: idx < 3 ? '0 0 10px #10b981' : 'none'
              }}
            >
              {line}
            </div>
          ))}
          <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs shadow-[0_0_25px_rgba(16,185,129,0.2)]">
            🟢 СИСТЕМА ВЗЛОМАНА: Соединение с защищенным сервером CosmoChat установлено. Квантовый шифратор активен. Нажмите любую клавишу или кликните для возврата в терминал.
          </div>
        </div>

        <div className="text-emerald-600 text-xs tracking-widest font-mono">
          SECURE_NODE: ZION_GRID_09 // PROTOCOL: MATRIX_X
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90dvh] bg-slate-950/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden font-mono"
        onClick={e => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div className="bg-slate-900/90 px-3 sm:px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <div className="flex items-center gap-2 sm:ml-2 min-w-0">
              <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-bold text-cyan-400 tracking-wider truncate">COSMO_OS // COMMAND</span>
              <span className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800 rounded font-sans shrink-0">
                Press [ / ]
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Terminal Log Output Window */}
        <div
          ref={logContainerRef}
          className="p-4 h-64 overflow-y-auto space-y-1.5 text-xs bg-black/60 select-text"
        >
          {logs.map(log => {
            let textColor = 'text-slate-300';
            if (log.type === 'input') textColor = 'text-cyan-400 font-bold';
            else if (log.type === 'success') textColor = 'text-emerald-400';
            else if (log.type === 'error') textColor = 'text-red-400';
            else if (log.type === 'info') textColor = 'text-indigo-400';

            return (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed break-words">
                <span className="text-slate-600 shrink-0 text-[10px] select-none">[{log.timestamp}]</span>
                <span className={textColor}>{log.text}</span>
              </div>
            );
          })}
        </div>

        {/* Command Quick Suggestions (Notice: matrixx is intentionally NOT here per instructions) */}
        <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-500 select-none">Быстрые команды:</span>
          <button
            type="button"
            onClick={() => handleExecuteCommand('qr')}
            className="px-2.5 py-1 text-xs bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/60 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)]"
          >
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            qr
          </button>
          <button
            type="button"
            onClick={() => handleExecuteCommand('wave')}
            className={`px-2.5 py-1 text-xs border rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] ${
              currentTheme === 'wave'
                ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400'
                : 'bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border-cyan-700/60'
            }`}
            title="Переключить тему на «Волна»"
          >
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            wave
          </button>
          <button
            type="button"
            onClick={() => handleExecuteCommand('cofe')}
            className={`px-2.5 py-1 text-xs border rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold shadow-[0_0_10px_rgba(217,119,6,0.15)] ${
              currentTheme === 'cofe'
                ? 'bg-amber-500/25 text-amber-200 border-amber-400'
                : 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border-amber-700/60'
            }`}
            title="Переключить тему на «Кофе»"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            cofe
          </button>
          <button
            type="button"
            onClick={() => handleExecuteCommand('help')}
            className="px-2 py-1 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3 h-3 text-slate-400" />
            help
          </button>
          <button
            type="button"
            onClick={() => handleExecuteCommand('users')}
            className="px-2 py-1 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
          >
            <User className="w-3 h-3 text-slate-400" />
            users
          </button>
          <button
            type="button"
            onClick={() => handleExecuteCommand('profile')}
            className="px-2 py-1 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
          >
            profile
          </button>
          <button
            type="button"
            onClick={() => handleExecuteCommand('clear')}
            className="px-2 py-1 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer ml-auto"
          >
            <Trash2 className="w-3 h-3 text-slate-400" />
            clear
          </button>
        </div>

        {/* Active Input Line */}
        <div className="p-2.5 sm:p-3 bg-slate-900 border-t border-cyan-500/30 flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 text-cyan-400 shrink-0 font-bold text-xs sm:text-sm">
            <span className="hidden sm:inline text-emerald-400 select-none">@{currentUser.username || 'milof'}</span>
            <span className="hidden sm:inline text-slate-500 select-none">:</span>
            <span className="hidden sm:inline text-cyan-400 select-none">~</span>
            <span className="text-slate-400 select-none">$</span>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите команду (например: qr)..."
            className="flex-1 min-w-0 bg-transparent border-none text-white text-sm focus:outline-none focus:ring-0 font-mono tracking-wide placeholder:text-slate-600"
            autoComplete="off"
            spellCheck={false}
          />

          <button
            type="button"
            onClick={() => handleExecuteCommand(inputVal)}
            disabled={!inputVal.trim()}
            className="px-2.5 sm:px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 text-white text-xs font-sans font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span className="hidden sm:inline">Выполнить</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
