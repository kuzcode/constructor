import clsx from 'clsx';
import { useAdminTheme } from '../../context/AdminThemeContext';

export function Card({ children, className, interactive, onClick }) {
  const { light } = useAdminTheme();
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={clsx(
        'rounded-3xl p-5 border transition-colors',
        light
          ? 'bg-white border-slate-200/90 shadow-sm'
          : 'glass-panel border-tg-border',
        interactive &&
          (light
            ? 'cursor-pointer hover:border-slate-300 hover:bg-slate-50/80'
            : 'cursor-pointer hover:border-white/15 hover:bg-white/[0.04]'),
        className,
      )}
    >
      {children}
    </div>
  );
}
