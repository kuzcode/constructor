import clsx from 'clsx';
import { forwardRef } from 'react';
import { useAdminTheme } from '../../context/AdminThemeContext';

const fieldClass = (light) =>
  clsx(
    'w-full rounded-xl border px-4 py-3 text-[15px] outline-none transition focus:border-[#3390ec]/80 focus:ring-2 focus:ring-[#3390ec]/25',
    light
      ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-500'
      : 'bg-tg-surface border-tg-border text-white placeholder:text-tg-muted',
  );

export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  const { light } = useAdminTheme();
  return <input ref={ref} className={clsx(fieldClass(light), className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...rest }, ref) {
  const { light } = useAdminTheme();
  return (
    <textarea
      ref={ref}
      className={clsx(fieldClass(light), 'min-h-[120px] resize-y', className)}
      {...rest}
    />
  );
});

export function Label({ children, className }) {
  const { light } = useAdminTheme();
  return (
    <label
      className={clsx(
        'block text-[13px] font-medium mb-1.5',
        light ? 'text-slate-700' : 'text-tg-muted',
        className,
      )}
    >
      {children}
    </label>
  );
}
