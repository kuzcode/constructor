import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useAdminBodyClass, useAdminTheme } from '../context/AdminThemeContext';
import { Button } from './ui/Button';
import { StarsBalanceChip } from './stars/StarsBalanceChip';

export function Layout({ children, title, showNav = true }) {
  const { user, profile, logout } = useAuth();
  const { light, toggle } = useAdminTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useAdminBodyClass(showNav);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const profileName = profile?.firstName || profile?.username || user?.name || user?.email || user?.$id;
  const avatarUrl = profile?.avatarUrl || user?.prefs?.telegramAvatarUrl || '';

  return (
    <div
      className={clsx(
        'min-h-screen flex flex-col transition-colors duration-200',
        light ? 'bg-[#eef0f5] text-slate-900' : 'bg-tg-bg text-white',
      )}
    >
      {showNav ? (
        <header
          className={clsx(
            'sticky top-0 z-50 border-b backdrop-blur-xl transition-colors',
            light ? 'border-slate-200/90 bg-white/85' : 'border-white/10 bg-tg-bg/75',
          )}
        >
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <Link
              to="/admin"
              className={clsx('font-semibold text-[15px] tracking-tight', light ? 'text-slate-900' : 'text-white/95')}
            >
              β Конструктор
            </Link>
            <div className="flex items-center gap-2">
              <StarsBalanceChip />
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={toggle}
                aria-label={light ? 'Тёмная тема' : 'Светлая тема'}
                title={light ? 'Тёмная тема' : 'Светлая тема'}
              >
                {light ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
              {user ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className={clsx(
                      'flex items-center gap-2 rounded-xl px-2 py-1.5',
                      light ? 'hover:bg-slate-100' : 'hover:bg-white/5',
                    )}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-white/20" />
                    ) : (
                      <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold', light ? 'bg-slate-200 text-slate-700' : 'bg-white/15 text-white')}>
                        {String(profileName || 'U').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className={clsx('hidden sm:inline text-sm max-w-[140px] truncate', light ? 'text-slate-700' : 'text-white/90')}>
                      {profileName}
                    </span>
                  </button>
                  {menuOpen ? (
                    <div
                      className={clsx(
                        'absolute right-0 mt-2 w-40 rounded-2xl border p-1 shadow-lg',
                        light ? 'bg-white border-slate-200' : 'bg-[#14141c] border-white/10',
                      )}
                    >
                      <Button variant="ghost" size="sm" type="button" className="w-full justify-start" onClick={() => logout()}>
                        Выйти
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link to="/login">
                  <Button size="sm">Войти</Button>
                </Link>
              )}
            </div>
          </div>
        </header>
      ) : null}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {title ? (
          <h1
            className={clsx('text-3xl font-bold tracking-tight mb-2', light ? 'text-slate-900' : 'text-white')}
          >
            {title}
          </h1>
        ) : null}
        {children}
      </main>
    </div>
  );
}
