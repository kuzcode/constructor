import clsx from 'clsx';
import { useAdminTheme } from '../../context/AdminThemeContext';

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  ...rest
}) {
  const { light } = useAdminTheme();
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-2xl transition-all tap-highlight-none disabled:opacity-45 disabled:pointer-events-none';
  const variants = {
    primary:
      'bg-[#3390ec] text-white shadow-lg shadow-blue-500/25 hover:bg-[#2b7fd4] active:scale-[0.98]',
    secondary: light
      ? 'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200/80'
      : 'bg-tg-surface text-white border border-tg-border hover:bg-white/10',
    ghost: light
      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
      : 'text-tg-muted hover:text-white hover:bg-white/5',
    danger: 'bg-red-500/90 text-white hover:bg-red-500',
  };
  const sizes = {
    sm: 'text-sm px-3 py-2',
    md: 'text-[15px] px-4 py-2.5',
    lg: 'text-base px-5 py-3',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      className={clsx(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
