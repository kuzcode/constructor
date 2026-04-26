import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useAdminTheme } from '../context/AdminThemeContext';
import { Button } from './ui/Button';

export function DraftActionDock({ show, saving, onSave, onCancel }) {
  const { light } = useAdminTheme();
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="fixed bottom-6 right-0 z-[200] px-4 w-full max-w-md"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        >
          <div
            className={clsx(
              'rounded-2xl shadow-lifted px-4 py-3 flex items-center justify-between gap-3 border',
              light ? 'bg-white border-slate-200' : 'glass-panel border-white/15',
            )}
          >
            <p
              className={clsx('text-sm shrink min-w-0', light ? 'text-slate-700' : 'text-white/85')}
            >
              Есть несохранённые изменения
            </p>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
                Отменить
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={onSave}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
