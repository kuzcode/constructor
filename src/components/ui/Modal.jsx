import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { useAdminTheme } from '../../context/AdminThemeContext';

export function Modal({ open, title, children, onClose, wide, className, stackOrder = 100, tone = 'auto' }) {
  const { light } = useAdminTheme();
  const isLight = tone === 'light' ? true : tone === 'dark' ? false : light;
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          style={{ zIndex: stackOrder }}
          className="fixed inset-0 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            className={clsx('absolute inset-0 backdrop-blur-sm', isLight ? 'bg-slate-900/25' : 'bg-black/55')}
            aria-label="Закрыть"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal
            className={clsx(
              'relative z-10 w-full rounded-3xl max-h-[92vh] overflow-hidden flex flex-col border shadow-lifted',
              isLight ? 'bg-white border-slate-200/90' : 'glass-panel border-tg-border',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
              className,
            )}
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div
              className={clsx(
                'flex items-center justify-between px-5 py-4 border-b',
                isLight ? 'border-slate-200' : 'border-tg-border',
              )}
            >
              <h2
                className={clsx('text-lg font-semibold tracking-tight', isLight ? 'text-slate-900' : 'text-white')}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className={clsx(
                  'p-2 rounded-xl',
                  isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-tg-muted hover:text-white hover:bg-white/5',
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
