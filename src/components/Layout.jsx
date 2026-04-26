import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useAdminBodyClass, useAdminTheme } from '../context/AdminThemeContext';
import { Button } from './ui/Button';
import { StarsBalanceChip } from './stars/StarsBalanceChip';

export function Layout({ children, title, showNav = true }) {
  const { user, logout } = useAuth();
  const { light, toggle } = useAdminTheme();
  useAdminBodyClass(showNav);

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
                <>
                  <span
                    className={clsx(
                      'hidden sm:inline text-sm max-w-[200px] truncate',
                      light ? 'text-slate-600' : 'text-tg-muted',
                    )}
                  >
                    {user.email || user.name || user.$id}
                  </span>
                  <Button variant="ghost" size="sm" type="button" onClick={() => logout()}>
                    Выйти
                  </Button>
                </>
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
