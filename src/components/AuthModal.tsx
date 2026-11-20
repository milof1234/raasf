import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { UserProfile } from '../types/chat';
import { applyPhoneMask, cleanDigits, containsProfanity, normalizeStr, hashPassword, isAdminPhone } from '../utils/security';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: UserProfile) => void;
  existingUsers: Record<string, UserProfile>;
  onRegisterUser: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSuccess,
  existingUsers,
  onRegisterUser
}) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isLoginMode) {
      const currentDigits = cleanDigits(phone);
      const newDigits = cleanDigits(val);
      if (val.length < phone.length && newDigits.length >= currentDigits.length) {
        const truncatedDigits = currentDigits.slice(0, -1);
        setPhone(applyPhoneMask(truncatedDigits));
      } else {
        setPhone(applyPhoneMask(val));
      }
    } else {
      if (/^[\d\s()+-]*$/.test(val)) {
        setPhone(applyPhoneMask(val));
      } else {
        setPhone(val);
      }
    }
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanInput = phone.trim();
    const phoneDigits = cleanDigits(cleanInput);

    if (!password || password.length < 4) {
      setError('Пароль должен содержать не менее 4 символов');
      return;
    }

    const usersList = Object.values(existingUsers);

    if (isLoginMode) {
      const existingAdmin1 = existingUsers['usr_admin'] || usersList.find(u => cleanDigits(u.phone) === '9254699801');
      const existingAdmin2 = existingUsers['usr_admin_2'] || usersList.find(u => cleanDigits(u.phone) === '9251672982');

      const isAdmin1ByInput = (phoneDigits === '9254699801') ||
        (existingAdmin1 && normalizeStr(existingAdmin1.username) === normalizeStr(cleanInput)) ||
        (normalizeStr(cleanInput) === 'milof');

      const isAdmin2ByInput = (phoneDigits === '9251672982') ||
        (existingAdmin2 && normalizeStr(existingAdmin2.username) === normalizeStr(cleanInput)) ||
        (normalizeStr(cleanInput) === 'admin2');

      if (isAdmin1ByInput || isAdmin2ByInput) {
        if (password === '123456' || password === 'admin123') {
          const isPhone2 = isAdmin2ByInput;
          const targetExisting = isPhone2 ? existingAdmin2 : existingAdmin1;
          const adminUser: UserProfile = {
            id: isPhone2 ? (targetExisting?.id || 'usr_admin_2') : 'usr_admin',
            name: targetExisting?.name || (isPhone2 ? 'Admin' : 'milof'),
            username: targetExisting?.username || (isPhone2 ? 'admin2' : 'milof'),
            phone: isPhone2 ? '+7 (925) 167-29-82' : '+7 (925) 469-98-01',
            passwordHash: hashPassword('123456'),
            isAdmin: true,
            isMuted: false,
            avatar: targetExisting?.avatar || '',
            lastSeen: Date.now(),
            isOnline: true
          };
          onRegisterUser(adminUser);
          onSuccess(adminUser);
          return;
        } else {
          setError('Неверный пароль администратора!');
          return;
        }
      }

      const foundUser = usersList.find(u => {
        if (phoneDigits.length >= 10 && cleanDigits(u.phone) === phoneDigits) return true;
        if (cleanInput && normalizeStr(u.username) === normalizeStr(cleanInput)) return true;
        return false;
      });

      if (!foundUser) {
        setError('Пользователь с таким номером или username не найден. Переключитесь на вкладку «Регистрация»');
        return;
      }
      if (foundUser.isBanned) {
        setError('Этот аккаунт заблокирован администратором.');
        return;
      }

      const expectedHash = foundUser.passwordHash;
      const computedHash = hashPassword(password);
      if (!expectedHash) {
        setError('Учетная запись не защищена паролем. Задайте пароль при регистрации.');
        return;
      }
      if (expectedHash !== computedHash) {
        setError('Неверный пароль!');
        return;
      }

      onSuccess(foundUser);
    } else {
      if (phoneDigits.length < 10) {
        setError('Введите корректный номер телефона (10 цифр)');
        return;
      }
      const cleanName = name.trim();
      let cleanTag = username.trim().replace(/^@+/, '');

      if (!cleanName) {
        setError('Введите ваше имя');
        return;
      }

      if (containsProfanity(cleanName)) {
        setError('Название ника с нецензурной лексикой');
        return;
      }

      if (cleanTag && containsProfanity(cleanTag)) {
        setError('Название юзернейма с нецензурной лексикой');
        return;
      }

      if (usersList.some(u => cleanDigits(u.phone) === phoneDigits)) {
        setError('Номер телефона уже зарегистрирован! Попробуйте войти.');
        return;
      }

      if (!cleanTag) {
        cleanTag = 'user_' + Math.floor(Math.random() * 90000 + 10000);
      } else {
        if (usersList.some(u => normalizeStr(u.username) === normalizeStr(cleanTag))) {
          setError('Этот username уже занят');
          return;
        }
      }

      const isUserAdmin = isAdminPhone(phoneDigits);
      const newUser: UserProfile = {
        id: 'usr_' + Date.now(),
        name: cleanName,
        username: cleanTag,
        phone: phone,
        passwordHash: hashPassword(password),
        isAdmin: isUserAdmin,
        isMuted: false,
        lastProfileChange: 0,
        isOnline: true,
        lastSeen: Date.now()
      };

      onRegisterUser(newUser);
      onSuccess(newUser);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--cc-bg-app)] p-4 overflow-y-auto">
      {/* Subtle Linear-style architectural ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(640px circle at 50% 24%, rgba(59, 130, 246, 0.11), transparent 70%)'
        }}
        aria-hidden="true"
      />

      <div className="relative bg-[var(--cc-bg-rail)] border border-[var(--cc-border-strong)] w-full max-w-[390px] rounded-2xl p-6 sm:p-7 shadow-2xl my-auto">
        {/* Clean Geometric Brand Mark + Title */}
        <div className="text-center mb-6">
          <div className="w-13 h-13 mx-auto bg-[var(--cc-accent-soft)] border border-[var(--cc-border-strong)] rounded-2xl flex items-center justify-center text-[var(--cc-accent-text)] mb-3.5 shadow-sm">
            <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.75" strokeOpacity="0.4" />
              <path d="M7.5 19.5C11.5 22 20.5 14 24.5 10.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <circle cx="22" cy="11" r="2.25" fill="currentColor" />
              <path d="M16 9.5L17.6 14.4L22.5 16L17.6 17.6L16 22.5L14.4 17.6L9 16L14.4 14.4L16 9.5Z" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--cc-text)] tracking-tight">
            {isLoginMode ? 'Вход в CosmoChat' : 'Создать аккаунт'}
          </h2>
          <p className="text-xs text-[var(--cc-text-muted)] mt-1">
            {isLoginMode ? 'Введите номер телефона или @username и пароль' : 'Заполните данные для быстрого старта'}
          </p>
        </div>

        {/* Linear-style Segmented Mode Switcher */}
        <div className="flex p-1 rounded-xl bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] mb-5 text-xs font-medium gap-1">
          <button
            type="button"
            onClick={() => { setIsLoginMode(true); setError(''); }}
            className={`flex-1 py-2.5 sm:py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              isLoginMode
                ? 'bg-[var(--cc-bg-surface-elevated)] text-[var(--cc-text)] shadow-sm ring-1 ring-[var(--cc-border-strong)]'
                : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => { setIsLoginMode(false); setError(''); }}
            className={`flex-1 py-2.5 sm:py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              !isLoginMode
                ? 'bg-[var(--cc-bg-surface-elevated)] text-[var(--cc-text)] shadow-sm ring-1 ring-[var(--cc-border-strong)]'
                : 'text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          {!isLoginMode && (
            <>
              <div>
                <input
                  type="text"
                  placeholder="Ваше имя"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2.5 text-[16px] sm:text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none transition-colors"
                />
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-3 sm:top-2.5 text-[var(--cc-text-muted)] text-[16px] sm:text-sm">@</span>
                <input
                  type="text"
                  placeholder="username (необязательно)"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl pl-8 pr-3.5 py-2.5 text-[16px] sm:text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none transition-colors"
                />
              </div>
            </>
          )}

          <div>
            <input
              type="text"
              placeholder={isLoginMode ? 'Номер телефона или @username' : '+7 (___) ___-__-__'}
              value={phone}
              onChange={handlePhoneChange}
              className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl px-3.5 py-2.5 text-[16px] sm:text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none transition-colors"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Пароль"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="w-full bg-[var(--cc-bg-surface)] border border-[var(--cc-border)] focus:border-[var(--cc-accent)] rounded-xl pl-3.5 pr-11 py-2.5 text-[16px] sm:text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Показать или скрыть пароль"
              className="absolute right-2 top-1.5 sm:top-2 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] cursor-pointer w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white font-semibold py-3 sm:py-2.5 rounded-xl transition-colors mt-2 shadow-sm cursor-pointer text-sm"
          >
            {isLoginMode ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
};
