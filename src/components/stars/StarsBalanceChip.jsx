import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useAdminTheme } from '../../context/AdminThemeContext';
import { config } from '../../config';
import { getOrCreateWallet } from '../../services/walletsService';
import { createTopUpIntent, getPaymentIntentById } from '../../services/paymentIntentsService';
import { buildPaymentBotDeepLink, getTelegramUserIdFromBrowser } from '../../utils/telegramPayment';
import { STARS_TO_RUB } from '../../services/telegramStars';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Label } from '../ui/Input';

export function StarsBalanceChip() {
  const { user } = useAuth();
  const { light } = useAdminTheme();
  const [balance, setBalance] = useState(null);
  const [open, setOpen] = useState(false);
  const [starsIn, setStarsIn] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [intentId, setIntentId] = useState(null);
  const [payPhase, setPayPhase] = useState('form');
  const [checkBusy, setCheckBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.$id || !config.walletsCollectionId) return;
    try {
      const w = await getOrCreateWallet(user.$id);
      setBalance(w.balanceStars ?? 0);
    } catch {
      setBalance(0);
    }
  }, [user?.$id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) {
      setPayPhase('form');
      setIntentId(null);
      setMsg('');
    }
  }, [open]);

  if (!user || !config.walletsCollectionId) return null;

  const n = Math.max(0, Math.floor(Number(starsIn) || 0));
  const rub = (n * STARS_TO_RUB).toFixed(2);
  const canStartPay = n > 0 && !busy && !!config.paymentIntentsCollectionId;
  const botLink = intentId ? buildPaymentBotDeepLink(intentId) : '';

  const startPayment = async () => {
    if (!canStartPay) return;
    setMsg('');
    setBusy(true);
    try {
      const doc = await createTopUpIntent({
        userId: user.$id,
        stars: n,
        telegramUserId: getTelegramUserIdFromBrowser(),
      });
      setIntentId(doc.$id);
      setPayPhase('wait');
    } catch (e) {
      setMsg(e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const checkPayment = async () => {
    if (!intentId) return;
    setCheckBusy(true);
    setMsg('');
    try {
      const doc = await getPaymentIntentById(intentId);
      if (doc.status === 'completed') {
        await load();
        setStarsIn('');
        setPayPhase('form');
        setIntentId(null);
        setMsg('Оплата прошла успешно');
        return;
      }
      if (doc.status === 'failed') {
        setMsg('Платёж отклонён. Создайте новый.');
        return;
      }
      setMsg('Ожидаем оплату в Telegram…');
    } catch (e) {
      setMsg(e.message || 'Ошибка проверки');
    } finally {
      setCheckBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          'inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium border transition',
          light ? 'border-slate-200 bg-white text-slate-800' : 'border-white/15 bg-white/5 text-white/90',
        )}
      >
        <span className="tabular-nums">{balance ?? '…'}</span>
        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/90" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Ваш баланс" stackOrder={140}>
        <div className="space-y-4">
          <p className={clsx('text-sm', light ? 'text-slate-700' : 'text-tg-muted')}>
            На балансе {balance ?? 0} ⭐
          </p>

          {payPhase === 'form' ? (
            <>
              <div>
                <Label>Сколько звёзд пополнить</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1 text-lg font-semibold text-center"
                  placeholder="0"
                  value={starsIn}
                  onChange={(e) => setStarsIn(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-center gap-2 text-lg">
                <span className={clsx(light ? 'text-slate-600' : 'text-tg-muted')}>≈</span>
                <span className={clsx('font-semibold tabular-nums', light ? 'text-slate-900' : 'text-white')}>
                  {rub} ₽
                </span>
                <span className={clsx('text-xs', light ? 'text-slate-600' : 'text-white/45')}>(×{STARS_TO_RUB})</span>
              </div>
              {!config.paymentIntentsCollectionId ? (
                <p className="text-sm text-amber-600">Задайте REACT_APP_APPWRITE_COL_PAYMENT_INTENTS_ID в .env</p>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-tg-border bg-tg-surface/5 p-4 space-y-3">
              <p className={clsx('text-sm', light ? 'text-slate-700' : 'text-tg-muted')}>
                Откройте бота и он отправит счёт на оплату
              </p>
              {botLink ? (
                <a
                  href={botLink}
                  target="_blank"
                  rel="noreferrer"
                  className={clsx(
                    'flex items-center justify-center w-full rounded-2xl py-3 text-sm font-semibold',
                    'bg-[#3390ec] text-white hover:bg-[#2b7fd4]',
                  )}
                >
                  Открыть
                </a>
              ) : null}
            </div>
          )}

          {msg ? (
            <p className={clsx('text-sm text-center', light ? 'text-amber-800' : 'text-amber-200')}>{msg}</p>
          ) : null}

          {payPhase === 'form' ? (
            <Button type="button" className="w-full text-base py-4" disabled={!canStartPay} onClick={startPayment}>
              {busy ? 'Создаём платёж…' : 'Пополить'}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full text-base py-4"
              disabled={checkBusy || !intentId}
              onClick={checkPayment}
            >
              {checkBusy ? 'Проверка…' : 'Проверить оплату'}
            </Button>
          )}
        </div>
      </Modal>
    </>
  );
}
