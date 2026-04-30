import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';
import { DraftActionDock } from '../components/DraftActionDock';
import { StatLineChart } from '../components/admin/StatLineChart';
import { getAppById, updateAppDocument, isSlugTaken } from '../services/appsService';
import { listOrdersForApp, listOrdersInRange } from '../services/ordersService';
import { listFreeFeedbackForApp } from '../services/freeFeedbackService';
import { fetchVisitorHistogram } from '../services/visitorsService';
import { normalizeSlug, isValidSlug } from '../utils/slug';
import { defaultFreePayload } from '../models/defaults';
import { normalizeShopPayload } from '../utils/normalizeShop';
import clsx from 'clsx';
import { chartDayRange, mergeSparseSeries } from '../utils/chartDays';
import { useAdminTheme } from '../context/AdminThemeContext';
import { feedbackKindLabel, feedbackPayloadRows } from '../utils/freeFeedbackDisplay';
import {
  HOSTING_STARS_MONTHLY,
  HOSTING_STARS_YEARLY,
  computeHostingPaidUntil,
  hasActiveHosting,
  needsHostingPaymentToPublish,
} from '../constants/hosting';
import { createHostingIntent, getPaymentIntentById } from '../services/paymentIntentsService';
import { buildPaymentBotDeepLink, getTelegramUserIdFromBrowser } from '../utils/telegramPayment';
import { config } from '../config';
import { Modal } from '../components/ui/Modal';
import {
  buildTelegramMiniAppOpenUrlWithProfile,
  getAdminTelegramUsernameFromPrefs,
  readTelegramProfileFromRuntime,
} from '../utils/telegramWebApp';
import { getOrCreateWallet, spendStarsFromWallet } from '../services/walletsService';

function periodStartIso(period) {
  if (period === 'all') return null;
  const d = new Date();
  if (period === '7d') d.setDate(d.getDate() - 7);
  if (period === '30d') d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export function AppManagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { light } = useAdminTheme();
  const [doc, setDoc] = useState(null);
  const [pubBase, setPubBase] = useState({ slug: '', published: false });
  const [pubDraft, setPubDraft] = useState({ slug: '', published: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('orders');
  const [period, setPeriod] = useState('7d');
  const [orders, setOrders] = useState([]);
  const [visitorSeries, setVisitorSeries] = useState([]);
  const [orderSeries, setOrderSeries] = useState([]);
  const [freeFeedback, setFreeFeedback] = useState([]);
  const [hostingModalOpen, setHostingModalOpen] = useState(false);
  const [hostingPlan, setHostingPlan] = useState('monthly');
  const [hostingBusy, setHostingBusy] = useState(false);
  const [hostingMsg, setHostingMsg] = useState('');
  const [hostingIntentId, setHostingIntentId] = useState(null);
  const [walletStars, setWalletStars] = useState(0);
  const publishRequestedRef = useRef(false);

  const reloadFreeFeedback = useCallback(async () => {
    if (!id) return;
    try {
      const res = await listFreeFeedbackForApp(id);
      setFreeFeedback(res.documents || []);
    } catch {
      setFreeFeedback([]);
    }
  }, [id]);

  const reloadOrders = useCallback(async () => {
    if (!id) return;
    try {
      const res = await listOrdersForApp(id);
      setOrders(res.documents || []);
    } catch {
      setOrders([]);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getAppById(id);
        if (cancelled) return;
        if (d.ownerId !== user?.$id) {
          navigate('/admin', { replace: true });
          return;
        }
        setDoc(d);
        const pb = { slug: d.slug || '', published: !!d.published };
        setPubBase(pb);
        setPubDraft(pb);
        await reloadOrders();
      } catch {
        navigate('/admin', { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, navigate, reloadOrders]);

  useEffect(() => {
    if (!doc?.$id) return;
    setTab(doc.appType === 'shop' ? 'orders' : 'overview');
  }, [doc?.$id, doc?.appType]);

  useEffect(() => {
    if (!doc || doc.appType !== 'free' || tab !== 'feedback') return;
    reloadFreeFeedback();
  }, [doc, tab, reloadFreeFeedback]);

  const loadCharts = useCallback(async () => {
    if (!doc?.$id) return;
    const from = periodStartIso(period);
    try {
      const [v, o] = await Promise.all([
        fetchVisitorHistogram(doc.$id, from),
        listOrdersInRange(doc.$id, from),
      ]);
      setVisitorSeries(v);
      setOrderSeries(o.series || []);
    } catch {
      setVisitorSeries([]);
      setOrderSeries([]);
    }
  }, [doc?.$id, period]);

  useEffect(() => {
    if (!doc || tab !== 'overview') return;
    loadCharts();
  }, [doc, tab, period, loadCharts]);

  const chartDays = useMemo(
    () => chartDayRange(period, doc?.$createdAt || new Date().toISOString()),
    [period, doc?.$createdAt],
  );
  const visitorChart = useMemo(
    () => mergeSparseSeries(visitorSeries, chartDays, 'count'),
    [visitorSeries, chartDays],
  );
  const orderChart = useMemo(
    () => mergeSparseSeries(orderSeries, chartDays, 'sum'),
    [orderSeries, chartDays],
  );

  const pubDirty = doc && (pubDraft.slug !== pubBase.slug || pubDraft.published !== pubBase.published);

  const loadWallet = useCallback(async () => {
    if (!user?.$id) return;
    try {
      const w = await getOrCreateWallet(user.$id);
      setWalletStars(Math.max(0, Number(w.balanceStars) || 0));
    } catch {
      setWalletStars(0);
    }
  }, [user?.$id]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const persistPubWith = useCallback(async (nextDraft) => {
    if (!doc || !user) return false;
    setErr('');
    const s = normalizeSlug(nextDraft.slug);
    if (s && !isValidSlug(s)) {
      setErr('Адрес: только латиница, цифры и дефис, от 2 символов');
      return false;
    }
    if (nextDraft.published) {
      if (!isValidSlug(s)) {
        setErr('Для публикации задайте корректный адрес');
        return false;
      }
      const taken = await isSlugTaken(s, doc.$id);
      if (taken) {
        setErr('Такой адрес уже занят');
        return false;
      }
    }
    if (needsHostingPaymentToPublish(doc, nextDraft.published)) {
      setHostingMsg('');
      setHostingPlan('monthly');
      setHostingModalOpen(true);
      return false;
    }
    setSaving(true);
    try {
      const payload = {
        ownerId: user.$id,
        appType: doc.appType,
        title: doc.title,
        slug: s,
        published: nextDraft.published,
        shopPayload: doc.appType === 'shop' ? normalizeShopPayload(doc.shopPayload) : null,
        freePayload: doc.appType === 'free' ? doc.freePayload ?? defaultFreePayload() : null,
        hostingPaidUntil: doc.hostingPaidUntil ?? null,
        hostingPlan: doc.hostingPlan ?? null,
      };
      await updateAppDocument(doc.$id, payload, user.$id, nextDraft.published);
      setDoc({ ...doc, ...payload, shopPayload: payload.shopPayload, freePayload: payload.freePayload });
      const nb = { slug: s, published: nextDraft.published };
      setPubBase(nb);
      setPubDraft(nb);
      return true;
    } catch (e) {
      setErr(e.message || 'Ошибка сохранения');
      return false;
    } finally {
      setSaving(false);
    }
  }, [doc, user]);

  const persistPub = async () => persistPubWith(pubDraft);

  const hostingBotLink = hostingIntentId ? buildPaymentBotDeepLink(hostingIntentId) : '';

  const startHostingTelegramPayment = async () => {
    if (!doc || !user) return;
    setHostingMsg('');
    if (!config.paymentIntentsCollectionId) {
      setHostingMsg('Задайте REACT_APP_APPWRITE_COL_PAYMENT_INTENTS_ID');
      return;
    }
    const s = normalizeSlug(pubDraft.slug);
    const stars = hostingPlan === 'yearly' ? HOSTING_STARS_YEARLY : HOSTING_STARS_MONTHLY;
    const planKey = hostingPlan === 'yearly' ? 'yearly' : 'monthly';
    setHostingBusy(true);
    try {
      const created = await createHostingIntent({
        userId: user.$id,
        appId: doc.$id,
        plan: planKey,
        slug: s,
        stars,
        appType: doc.appType,
        telegramUserId: getTelegramUserIdFromBrowser(),
      });
      setHostingIntentId(created.$id);
    } catch (e) {
      setHostingMsg(e.message || 'Ошибка');
    } finally {
      setHostingBusy(false);
    }
  };

  const checkHostingPayment = async () => {
    if (!hostingIntentId || !doc) return;
    setHostingBusy(true);
    setHostingMsg('');
    try {
      const intent = await getPaymentIntentById(hostingIntentId);
      if (intent.status === 'completed') {
        const fresh = await getAppById(doc.$id);
        setDoc(fresh);
        const ns = normalizeSlug(pubDraft.slug);
        setPubBase({ slug: ns, published: true });
        setPubDraft({ slug: ns, published: true });
        setHostingModalOpen(false);
        setHostingIntentId(null);
        return;
      }
      if (intent.status === 'failed') {
        setHostingMsg('Платёж не прошёл. Создайте новый.');
        return;
      }
      setHostingMsg('Ожидаем оплату в Telegram…');
    } catch (e) {
      setHostingMsg(e.message || 'Ошибка проверки');
    } finally {
      setHostingBusy(false);
    }
  };

  const payHostingFromBalance = async () => {
    if (!doc || !user) return;
    const stars = hostingPlan === 'yearly' ? HOSTING_STARS_YEARLY : HOSTING_STARS_MONTHLY;
    setHostingBusy(true);
    setHostingMsg('');
    try {
      await spendStarsFromWallet(user.$id, stars);
      const nextUntil = computeHostingPaidUntil(doc.hostingPaidUntil, hostingPlan);
      const payload = {
        ownerId: user.$id,
        appType: doc.appType,
        title: doc.title,
        slug: normalizeSlug(pubDraft.slug),
        published: true,
        shopPayload: doc.appType === 'shop' ? normalizeShopPayload(doc.shopPayload) : null,
        freePayload: doc.appType === 'free' ? doc.freePayload ?? defaultFreePayload() : null,
        hostingPaidUntil: nextUntil,
        hostingPlan,
      };
      await updateAppDocument(doc.$id, payload, user.$id, true);
      setDoc({ ...doc, ...payload, shopPayload: payload.shopPayload, freePayload: payload.freePayload });
      const ns = normalizeSlug(pubDraft.slug);
      setPubBase({ slug: ns, published: true });
      setPubDraft({ slug: ns, published: true });
      setHostingModalOpen(false);
      setHostingMsg('');
      await loadWallet();
    } catch (e) {
      setHostingMsg(e.message || 'Не удалось списать Stars');
    } finally {
      setHostingBusy(false);
    }
  };

  useEffect(() => {
    if (!doc?.$id || publishRequestedRef.current) return;
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (params.get('publish') !== '1') return;
    publishRequestedRef.current = true;
    setTab('overview');
    if (doc.published) return;
    const s = normalizeSlug(pubDraft.slug || doc.slug || '');
    const next = { slug: s, published: true };
    setPubDraft(next);
    persistPubWith(next);
  }, [doc?.$id, doc?.published, doc?.slug, pubDraft.slug, persistPubWith]);

  const revertPub = () => setPubDraft({ ...pubBase });

  if (loading || !doc) {
    return (
      <Layout>
        <p className="text-tg-muted text-sm">Загрузка…</p>
      </Layout>
    );
  }

  const editPath = doc.appType === 'shop' ? `/admin/apps/${doc.$id}/shop` : `/admin/apps/${doc.$id}/free`;
  const previewPath = doc.slug ? `/${doc.slug}` : null;
  const isShop = doc.appType === 'shop';
  const absPreviewUrl =
    previewPath && typeof window !== 'undefined' ? `${window.location.origin}${previewPath}` : null;
  const slugForTg = normalizeSlug(pubDraft.slug) || doc.slug || '';
  const runtimeTgProfile = readTelegramProfileFromRuntime() || null;
  const telegramMiniAppUrl = slugForTg ? buildTelegramMiniAppOpenUrlWithProfile(slugForTg, runtimeTgProfile || undefined) : '';
  const ownerTg = getAdminTelegramUsernameFromPrefs(user);
  const publicUrlWithOwnerTg =
    absPreviewUrl && ownerTg ? `${absPreviewUrl}?tg_owner=${encodeURIComponent(ownerTg)}` : absPreviewUrl;
  const hostingActive = hasActiveHosting(doc);

  return (
    <Layout title={doc.title || 'Проект'}>
      <div className="flex flex-wrap gap-2 mb-6">
        <Link to={editPath}>
          <Button>
            <Pencil className="w-4 h-4" />
            Редактировать страницу
          </Button>
        </Link>
        {!doc.published ? (
          <Button
            type="button"
            className="bg-[#3390ec] hover:bg-[#2b7fd4] text-white"
            onClick={() => {
              setTab('overview');
              const s = normalizeSlug(pubDraft.slug || doc.slug || '');
              setPubDraft({ slug: s, published: true });
              persistPubWith({ slug: s, published: true });
            }}
          >
            Опубликовать
          </Button>
        ) : null}
        {previewPath && doc.published ? (
          <>
            {telegramMiniAppUrl ? (
              <a href={telegramMiniAppUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <ExternalLink className="w-4 h-4" />
                  Открыть в Telegram
                </Button>
              </a>
            ) : null}
            <a href={publicUrlWithOwnerTg || previewPath} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="w-4 h-4" />
                {telegramMiniAppUrl ? 'В браузере' : 'Открыть витрину'}
              </Button>
            </a>
          </>
        ) : null}
      </div>

      {isShop ? (
        <div
          className={clsx(
            'flex gap-1 p-2 rounded-2xl w-fit mb-6 border',
            light ? 'bg-slate-100 border-slate-200' : 'bg-tg-surface/10 border-tg-border',
          )}
        >
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition',
              tab === 'orders'
                ? 'bg-[#3390ec] text-white'
                : light
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-tg-muted hover:text-white',
            )}
          >
            Заказы
          </button>
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition',
              tab === 'overview'
                ? 'bg-[#3390ec] text-white'
                : light
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-tg-muted hover:text-white',
            )}
          >
            Общая
          </button>
        </div>
      ) : (
        <div
          className={clsx(
            'flex gap-1 p-2 rounded-2xl w-fit mb-6 border',
            light ? 'bg-slate-100 border-slate-200' : 'bg-tg-surface/10 border-tg-border',
          )}
        >
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition',
              tab === 'overview'
                ? 'bg-[#3390ec] text-white'
                : light
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-tg-muted hover:text-white',
            )}
          >
            Обзор
          </button>
          <button
            type="button"
            onClick={() => setTab('feedback')}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition',
              tab === 'feedback'
                ? 'bg-[#3390ec] text-white'
                : light
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-tg-muted hover:text-white',
            )}
          >
            Отправки
          </button>
        </div>
      )}

      {err ? (
        <div
          className={clsx(
            'mb-4 text-sm rounded-xl px-3 py-2 border',
            light
              ? 'text-red-800 bg-red-50 border-red-200'
              : 'text-red-300 bg-red-500/10 border-red-500/25',
          )}
        >
          {err}
        </div>
      ) : null}

      {isShop && tab === 'orders' ? (
        <Card className="!p-0 overflow-hidden">
          <div
            className={clsx(
              'px-5 py-4 border-b flex items-center justify-between',
              light ? 'border-slate-200' : 'border-tg-border',
            )}
          >
            <h2 className={clsx('text-lg font-semibold', light ? 'text-slate-900' : '')}>Заказы</h2>
            <Button type="button" size="sm" variant="secondary" onClick={reloadOrders}>
              Обновить
            </Button>
          </div>
          <ul className={clsx('max-h-[520px] overflow-y-auto', light ? 'divide-y divide-slate-200' : 'divide-y divide-tg-border')}>
            {orders.length === 0 ? (
              <li className={clsx('px-5 py-10 text-center text-sm', light ? 'text-slate-600' : 'text-tg-muted')}>
                Пока нет заказов
              </li>
            ) : (
              orders.map((o) => {
                let items = [];
                let customer = {};
                try {
                  items = JSON.parse(o.itemsJson || '[]');
                } catch {
                  items = [];
                }
                try {
                  customer = JSON.parse(o.customerJson || '{}');
                } catch {
                  customer = {};
                }
                const tgU = String(customer.telegramUsername || '').replace(/^@/, '').trim();
                const phone = String(customer.phone || '').trim();
                return (
                  <li key={o.$id} className="px-5 py-4 text-sm">
                    <div className="flex justify-between gap-2 mb-2">
                      <span className={clsx('text-xs', light ? 'text-slate-500' : 'text-tg-muted')}>
                        {new Date(o.$createdAt).toLocaleString('ru-RU')}
                      </span>
                      <span className="font-semibold text-[#3390ec]">{o.total} ₽</span>
                    </div>
                    <div className={clsx('text-xs space-y-0.5 mb-2', light ? 'text-slate-700' : 'text-white/80')}>
                      {customer.name ? <p>Имя: {customer.name}</p> : null}
                      {phone ? <p>Телефон: {phone}</p> : null}
                      {tgU ? <p>Telegram: @{tgU}</p> : null}
                      {customer.address ? <p>Адрес: {customer.address}</p> : null}
                    </div>
                    <ul className={clsx('text-xs space-y-1', light ? 'text-slate-600' : 'text-white/75')}>
                      {items.map((it, i) => (
                        <li key={i}>
                          {it.name} ×{it.qty}
                          {it.colorHex ? ` · ${it.colorHex}` : ''}
                          {it.sizeName ? ` · ${it.sizeName}` : ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })
            )}
          </ul>
        </Card>
      ) : null}

      {!isShop && tab === 'feedback' ? (
        <Card className="!p-0 overflow-hidden">
          <div
            className={clsx(
              'px-5 py-4 border-b flex items-center justify-between',
              light ? 'border-slate-200' : 'border-tg-border',
            )}
          >
            <h2 className={clsx('text-lg font-semibold', light ? 'text-slate-900' : '')}>Отправки со страницы</h2>
            <Button type="button" size="sm" variant="secondary" onClick={reloadFreeFeedback}>
              Обновить
            </Button>
          </div>
          <ul className={clsx('max-h-[520px] overflow-y-auto', light ? 'divide-y divide-slate-200' : 'divide-y divide-tg-border')}>
            {freeFeedback.length === 0 ? (
              <li className={clsx('px-5 py-10 text-center text-sm', light ? 'text-slate-600' : 'text-tg-muted')}>
                Пока нет записей
              </li>
            ) : (
              freeFeedback.map((row) => {
                let payload = {};
                try {
                  payload = JSON.parse(row.payloadJson || '{}');
                } catch {
                  payload = {};
                }
                const rows = feedbackPayloadRows(row.kind, payload);
                return (
                  <li key={row.$id} className="px-5 py-4 text-sm">
                    <div className="flex justify-between gap-2 mb-2">
                      <span className={clsx('text-xs', light ? 'text-slate-500' : 'text-tg-muted')}>
                        {new Date(row.$createdAt).toLocaleString('ru-RU')}
                      </span>
                      <span className="text-xs font-medium text-[#3390ec]">{feedbackKindLabel(row.kind)}</span>
                    </div>
                    <div
                      className={clsx(
                        'rounded-xl border overflow-hidden text-xs',
                        light ? 'border-slate-200 bg-white' : 'border-white/10',
                      )}
                    >
                      <table className="w-full">
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.key} className={clsx('border-b last:border-0', light ? 'border-slate-200' : 'border-white/5')}>
                              <td className={clsx('py-2 px-3 w-[36%] align-top', light ? 'text-slate-500' : 'text-white/50')}>
                                {r.label}
                              </td>
                              <td className={clsx('py-2 px-3 whitespace-pre-wrap break-words', light ? 'text-slate-800' : 'text-white/85')}>
                                {r.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </Card>
      ) : null}

      {tab === 'overview' ? (
        <div className="space-y-6">
          <Card className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold mb-1">Адрес и публикация</h2>
              {doc.published && previewPath ? (
                <div className="space-y-2 mt-3">
                  {telegramMiniAppUrl ? (
                    <p className={clsx('text-sm', light ? 'text-slate-600' : 'text-tg-muted')}>
                      <span className={light ? 'font-medium text-slate-800' : 'font-medium text-white/90'}>
                        Клиенты в Telegram Mini App
                      </span>
                      {' — '}
                      их @username попадёт в заказ автоматически. Ссылка:{' '}
                      <a
                        href={telegramMiniAppUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline break-all text-[#3390ec]"
                      >
                        {telegramMiniAppUrl}
                      </a>
                    </p>
                  ) : (
                    <p className={clsx('text-sm', light ? 'text-slate-600' : 'text-tg-muted')}>
                      Чтобы в заказе автоматически появлялся @username клиента, задайте в окружении{' '}
                      <code className={clsx('text-xs', light ? 'text-slate-800' : 'text-white/85')}>
                        REACT_APP_TELEGRAM_WEBAPP_SHORT_NAME
                      </code>{' '}
                      (короткое имя Mini App в BotFather) и открывайте витрину через «Открыть в Telegram».
                    </p>
                  )}
                  {ownerTg && publicUrlWithOwnerTg ? (
                    <p className={clsx('text-sm', light ? 'text-slate-600' : 'text-tg-muted')}>
                      Ссылка с вашим Telegram-ником в параметре{' '}
                      <code className={clsx('text-xs', light ? 'text-slate-800' : 'text-white/85')}>tg_owner</code>:{' '}
                      <span className="font-mono text-xs break-all">{publicUrlWithOwnerTg}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div>
              <Label>Введите уникальный адрес (id) для вашего проекта</Label>
              <Input value={pubDraft.slug} onChange={(e) => setPubDraft({ ...pubDraft, slug: e.target.value })} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={clsx('text-sm', light ? 'text-slate-600' : 'text-tg-muted')}>
                Статус: {pubDraft.published ? 'опубликовано' : 'черновик'}
              </span>
              {!pubDraft.published ? (
                <Button
                  type="button"
                  className="bg-[#3390ec] hover:bg-[#2b7fd4] text-white"
                  onClick={() => persistPubWith({ ...pubDraft, published: true })}
                >
                  Опубликовать
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPubDraft({ ...pubDraft, published: false })}
                >
                  Снять с публикации
                </Button>
              )}
            </div>
            {doc.hostingPaidUntil ? (
              <p className={clsx('text-sm', light ? 'text-slate-600' : 'text-tg-muted')}>
                Размещение оплачено до{' '}
                <span className={light ? 'text-slate-900 font-medium' : 'text-white/90 font-medium'}>
                  {new Date(doc.hostingPaidUntil).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                {!hostingActive ? (
                  <span className={light ? 'text-amber-700' : 'text-amber-200'}>
                    {' '}
                    — срок истёк, витрина скрыта до продления
                  </span>
                ) : null}
              </p>
            ) : null}
          </Card>

          <div>
            <p className="text-sm text-tg-muted mb-2">Период графиков</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                ['7d', '7 дней'],
                ['30d', '30 дней'],
                ['all', 'Всё время'],
              ].map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPeriod(k)}
                  className={clsx(
                    'px-3 py-2 rounded-xl text-sm border',
                    period === k
                      ? 'border-[#3390ec] bg-[#3390ec]/15'
                      : light
                        ? 'border-slate-200 bg-white'
                        : 'border-tg-border bg-tg-surface',
                  )}
                >
                  {lab}
                </button>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <StatLineChart
                title="Посещения"
                data={visitorChart}
                valueKey="count"
              />
              {isShop && (
                <StatLineChart
                  title="Выручка, ₽"
                  data={orderChart}
                  valueKey="sum"
                  accent="emerald"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <DraftActionDock show={!!pubDirty} saving={saving} onSave={persistPub} onCancel={revertPub} />

      <Modal
        open={hostingModalOpen}
        onClose={() => {
          if (!hostingBusy) {
            setHostingModalOpen(false);
            setHostingIntentId(null);
            setHostingMsg('');
          }
        }}
        title="Оплата размещения"
        wide
        stackOrder={150}
      >
        <div className="space-y-4">
          <p className={clsx('text-sm', light ? 'text-slate-600' : 'text-tg-muted')}>
            Публикация — платная услуга. Можно оплатить через бота или списать Stars с баланса. После оплаты
            публикация включится автоматически, а поле <span className="font-mono">hostingPaidUntil</span> обновится.
          </p>
          {!hostingIntentId ? (
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="hosting-plan"
                  checked={hostingPlan === 'monthly'}
                  onChange={() => setHostingPlan('monthly')}
                />
                <span>
                  <strong>{HOSTING_STARS_MONTHLY} ⭐</strong> в месяц
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="hosting-plan"
                  checked={hostingPlan === 'yearly'}
                  onChange={() => setHostingPlan('yearly')}
                />
                <span>
                  <strong>{HOSTING_STARS_YEARLY} ⭐</strong> в год
                </span>
              </label>
            </div>
          ) : (
            <div className="rounded-2xl border border-tg-border bg-tg-surface/40 p-4 space-y-3">
              <p className={clsx('text-sm', light ? 'text-slate-600' : 'text-tg-muted')}>
                Перейдите к боту — пришлётся счёт. Затем вернитесь сюда и нажмите «Проверить оплату».
              </p>
              {hostingBotLink ? (
                <a
                  href={hostingBotLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center w-full rounded-2xl py-3 text-sm font-semibold bg-[#3390ec] text-white hover:bg-[#2b7fd4]"
                >
                  Открыть бота
                </a>
              ) : null}
            </div>
          )}
          {hostingMsg ? (
            <p className={clsx('text-sm text-center', light ? 'text-amber-800' : 'text-amber-200')}>{hostingMsg}</p>
          ) : null}
          {!hostingIntentId ? (
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full text-base py-4"
                disabled={hostingBusy}
                onClick={startHostingTelegramPayment}
              >
                {hostingBusy ? 'Создаём платёж…' : 'Оплатить через Telegram'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full text-base py-4"
                disabled={hostingBusy}
                onClick={payHostingFromBalance}
              >
                {hostingBusy ? 'Списываем…' : `Оплатить с баланса (${walletStars} ⭐)`}
              </Button>
            </div>
          ) : (
            <Button type="button" className="w-full text-base py-4" disabled={hostingBusy} onClick={checkHostingPayment}>
              {hostingBusy ? 'Проверка…' : 'Проверить оплату'}
            </Button>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
