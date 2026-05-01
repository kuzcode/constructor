import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpDown, Trash2, Heart, Search } from 'lucide-react';
import clsx from 'clsx';
import { getImagePreviewUrl, getPublishedBySlug } from '../../services/appsService';
import { submitShopOrder } from '../../services/ordersService';
import { shopThemeClass } from '../../themes/shopThemes';
import {
  initTelegramWebApp,
  readTelegramWebAppIdentity,
  loadPublicTelegramContext,
  persistPublicTelegramContext,
  tryRequestTelegramContactPhone,
} from '../../utils/telegramWebApp';
import { isVariabilityActive } from '../../utils/productModel';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Label, Textarea } from '../ui/Input';

function lineKey(productId, colorHex, sizeName) {
  return `${productId}|${colorHex || ''}|${sizeName || ''}`;
}

function defaultVariants(p) {
  const c = (p.colors || []).find((x) => x.hex)?.hex ?? null;
  const s = (p.sizes || []).find((x) => x.name)?.name ?? null;
  return { colorHex: c, sizeName: s };
}

export function ShopClientView({ slug, initialDoc }) {
  const navigate = useNavigate();
  const [doc, setDoc] = useState(initialDoc);
  const shop = doc?.shopPayload || {};
  const theme = shopThemeClass(shop.styleId);
  const modalTone = [1, 2, 6].includes(Number(shop.styleId) || 1) ? 'light' : 'dark';

  const [cart, setCart] = useState([]);
  const [detailProduct, setDetailProduct] = useState(null);
  const [detailColor, setDetailColor] = useState(null);
  const [detailSize, setDetailSize] = useState(null);
  const [detailPhoto, setDetailPhoto] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [sortKey, setSortKey] = useState('relevance');
  const [catEnabled, setCatEnabled] = useState({});
  const [query, setQuery] = useState('');
  const [favIds, setFavIds] = useState([]);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderErr, setOrderErr] = useState('');
  const orderSubmitLock = useRef(false);

  const [cust, setCust] = useState({ name: '', address: '', phone: '' });
  const [tgBuyer, setTgBuyer] = useState({ username: '', userId: '' });
  const [phoneViaContact, setPhoneViaContact] = useState(false);

  const refresh = useCallback(async () => {
    const d = await getPublishedBySlug(slug);
    if (d) setDoc(d);
  }, [slug]);

  const categories = useMemo(
    () => (Array.isArray(shop.categories) ? shop.categories : []),
    [shop.categories],
  );
  const products = useMemo(() => shop.products || [], [shop.products]);
  const showCatFilter = categories.length >= 2;
  const hasUncat = products.some((p) => !p.categoryId);

  useEffect(() => {
    const m = {};
    categories.forEach((c) => {
      m[c.id] = true;
    });
    if (hasUncat) m.__none = true;
    setCatEnabled(m);
  }, [slug, categories, hasUncat]);

  useEffect(() => {
    initTelegramWebApp();
    const tw = readTelegramWebAppIdentity();
    const stored = loadPublicTelegramContext(slug);
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const fromQuery = params.get('tg_username')?.replace(/^@/, '').trim() || '';
    const username = (tw?.username || stored.telegramUsername || fromQuery || '').trim();
    const userId = (tw?.userId || stored.telegramUserId || '').trim();
    persistPublicTelegramContext(slug, { telegramUsername: username, telegramUserId: userId });
    setTgBuyer({ username, userId });
    const savedPhone = String(stored.phone || '').trim();
    if (savedPhone) {
      setCust((c) => ({ ...c, phone: savedPhone }));
      setPhoneViaContact(!!stored.phoneFromContact);
    }
  }, [slug]);

  const inTelegramMiniApp = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;

  const sharePhoneFromTelegram = async () => {
    setOrderErr('');
    const p = await tryRequestTelegramContactPhone();
    if (!p) {
      setOrderErr('Не удалось получить номер из Telegram. Введите номер вручную.');
      return;
    }
    setCust((c) => ({ ...c, phone: p }));
    setPhoneViaContact(true);
    persistPublicTelegramContext(slug, { phone: p, phoneFromContact: true });
  };

  const filterOptions = useMemo(() => {
    const map = {};
    for (const p of products) {
      for (const sp of p.specs || []) {
        if (!sp.filterable || !sp.name) continue;
        if (!map[sp.name]) map[sp.name] = new Set();
        if (sp.value) map[sp.name].add(sp.value);
      }
    }
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]]));
  }, [products]);

  const hasSpecFilters = Object.keys(filterOptions).length > 0;
  const showFiltersButton = showCatFilter || hasSpecFilters;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`miniapp_shop_favs_${slug}`);
      const parsed = JSON.parse(raw || '[]');
      setFavIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setFavIds([]);
    }
  }, [slug]);

  const toggleFav = (pid) => {
    setFavIds((prev) => {
      const next = prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid];
      try {
        localStorage.setItem(`miniapp_shop_favs_${slug}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const filteredBySpecs = useMemo(() => {
    return products.filter((p) => {
      for (const [fname, fval] of Object.entries(activeFilters)) {
        if (!fval) continue;
        const ok = (p.specs || []).some((s) => s.filterable && s.name === fname && s.value === fval);
        if (!ok) return false;
      }
      return true;
    });
  }, [products, activeFilters]);

  const filteredByCat = useMemo(() => {
    if (!showCatFilter) return filteredBySpecs;
    return filteredBySpecs.filter((p) => {
      if (!p.categoryId) return catEnabled.__none !== false;
      return catEnabled[p.categoryId] !== false;
    });
  }, [filteredBySpecs, showCatFilter, catEnabled]);

  const displayedProducts = useMemo(() => {
    const arr = [...filteredByCat];
    const q = query.trim().toLowerCase();
    const base = q
      ? arr.filter((p) => {
          const txt = `${p.name || ''} ${p.description || ''} ${(p.specs || []).map((s) => `${s.name}:${s.value}`).join(' ')}`.toLowerCase();
          return txt.includes(q);
        })
      : arr;
    if (sortKey === 'priceAsc') arr.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    else if (sortKey === 'priceDesc') arr.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    if (sortKey === 'favorites') {
      base.sort((a, b) => Number(favIds.includes(b.id)) - Number(favIds.includes(a.id)));
      return base;
    }
    base.sort((a, b) => arr.findIndex((x) => x.id === a.id) - arr.findIndex((x) => x.id === b.id));
    return base;
  }, [filteredByCat, sortKey, query, favIds]);

  const qtyForProduct = useCallback(
    (productId) => cart.filter((l) => l.productId === productId).reduce((a, l) => a + l.qty, 0),
    [cart],
  );

  const addLine = (p, colorHex, sizeName, qty = 1) => {
    const stock = Math.max(0, Number(p.stock) || 0);
    const cur = qtyForProduct(p.id);
    if (cur >= stock) return;
    const add = Math.min(qty, stock - cur);
    if (add <= 0) return;
    const k = lineKey(p.id, colorHex, sizeName);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.key === k);
      if (i >= 0) {
        const next = [...prev];
        const line = { ...next[i], qty: Math.min(stock, next[i].qty + add) };
        next[i] = line;
        return next;
      }
      return [
        ...prev,
        {
          key: k,
          productId: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          qty: add,
          colorHex,
          sizeName,
          maxStock: stock,
        },
      ];
    });
  };

  const cartTotal = cart.reduce((a, l) => a + l.price * l.qty, 0);
  const cartCount = cart.reduce((a, l) => a + l.qty, 0);

  const openDetail = (p) => {
    setDetailProduct(p);
    const d = defaultVariants(p);
    setDetailColor(d.colorHex);
    setDetailSize(d.sizeName);
    setDetailPhoto(0);
  };

  const submitOrder = async () => {
    const ch = shop.checkout || {};
    setOrderErr('');
    const tgU = tgBuyer.username.trim();
    if (ch.requireName && !cust.name.trim()) {
      setOrderErr('Укажите имя');
      return;
    }
    if (ch.requireAddress && !cust.address.trim()) {
      setOrderErr('Укажите адрес');
      return;
    }
    if (!tgU && !cust.phone.trim()) {
      setOrderErr('Укажите телефон');
      return;
    }
    if (orderSubmitLock.current) {
      return;
    }
    orderSubmitLock.current = true;
    setOrderBusy(true);
    try {
      await submitShopOrder({
        slug,
        lines: cart.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          colorHex: l.colorHex,
          sizeName: l.sizeName,
        })),
        customer: {
          ...cust,
          ...(tgU ? { telegramUsername: tgU, ...(tgBuyer.userId ? { telegramUserId: tgBuyer.userId } : {}) } : {}),
        },
        total: cartTotal,
      });
      setCart([]);
      setCheckoutOpen(false);
      await refresh();
      navigate(`/${slug}/ordered`);
    } catch (e) {
      setOrderErr(e.message || 'Ошибка заказа');
    } finally {
      orderSubmitLock.current = false;
      setOrderBusy(false);
    }
  };

  const renderProductCard = (p) => {
    const stock = Math.max(0, Number(p.stock) || 0);
    const inCart = qtyForProduct(p.id);
    const disabled = stock <= 0;
    const ov = isVariabilityActive(p);

    return (
      <div
        key={p.id}
        role="button"
        tabIndex={0}
        onClick={() => openDetail(p)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail(p);
          }
        }}
        className={clsx(
          'rounded-2xl border overflow-hidden text-left transition flex flex-col cursor-pointer',
          theme.card,
          disabled && 'opacity-70',
        )}
      >
        <div className="aspect-square relative bg-black/20">
          {p.imageFileIds?.[0] ? (
            <img src={getImagePreviewUrl(p.imageFileIds[0])} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-white/35">Нет фото</div>
          )}
          {disabled ? (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-xs font-medium text-white/90 px-2 text-center pointer-events-none">
              Нет в наличии
            </div>
          ) : null}
          <button
            type="button"
            aria-label="В избранное"
            onClick={(e) => {
              e.stopPropagation();
              toggleFav(p.id);
            }}
            className={clsx(
              'absolute top-2 right-2 p-1.5 rounded-full border',
              favIds.includes(p.id)
                ? 'bg-red-500/85 border-red-300/60 text-white'
                : 'bg-black/45 border-white/20 text-white/80',
            )}
          >
            <Heart className="w-4 h-4" fill={favIds.includes(p.id) ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="p-3 flex flex-col flex-1 gap-2">
          <p className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{p.name}</p>
          <button
            type="button"
            disabled={disabled || (ov && stock <= inCart)}
            onClick={(e) => {
              e.stopPropagation();
              if (ov) {
                openDetail(p);
                return;
              }
              addLine(p, null, null, 1);
            }}
            className={clsx(
              'mt-auto flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
              theme.btn,
              (disabled || (ov && stock <= inCart)) && 'opacity-40 pointer-events-none',
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{Number(p.price) || 0} ₽</span>
          </button>
        </div>
      </div>
    );
  };

  const sortLabel =
    sortKey === 'priceAsc'
      ? 'Цена ↑'
      : sortKey === 'priceDesc'
        ? 'Цена ↓'
        : sortKey === 'favorites'
          ? 'Избранное'
          : 'По релевантности';

  return (
    <div className={clsx('min-h-screen pb-24 relative', theme.shell, theme.font)}>
      {cartCount > 0 ? (
        <FloatingCart cartCount={cartCount} cartTotal={cartTotal} theme={theme} onOpen={() => setCheckoutOpen(true)} />
      ) : null}

      <div className="max-w-lg mx-auto px-3 pt-6 pb-4">
        <header className="mb-6 pr-14">
          <h1 className={clsx('text-2xl sm:text-3xl font-bold tracking-tight', theme.accent)}>{shop.name || doc.title}</h1>
          {shop.description ? <p className={clsx('mt-2 text-sm', theme.muted)}>{shop.description}</p> : null}
        </header>

        <div className="flex items-center justify-between gap-2 mb-4">
          <div className={clsx('flex items-center gap-2 rounded-2xl border px-3 py-2.5 flex-1 min-w-0', theme.card)}>
            <Search className="w-4 h-4 shrink-0 opacity-70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по товарам"
              className="bg-transparent outline-none text-sm w-full"
            />
          </div>
          <div className="min-w-0">
            {showFiltersButton ? (
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium',
                  theme.card,
                )}
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                Фильтры
              </button>
            ) : (
              <span />
            )}
          </div>
          <button
            type="button"
            onClick={() => setSortOpen(true)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium shrink-0',
              theme.card,
            )}
          >
            <ArrowUpDown className="w-4 h-4 shrink-0" />
            {sortLabel}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {displayedProducts.length === 0 ? (
            <p className={clsx('col-span-2 text-center text-sm py-12', theme.muted)}>Нет товаров по фильтрам</p>
          ) : (
            displayedProducts.map((p) => renderProductCard(p))
          )}
        </div>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Фильтры" wide tone={modalTone} className={clsx(theme.panel, theme.panelText)}>
        <div className={clsx('space-y-5', theme.panelText)}>
          {showCatFilter ? (
            <div>
              <Label className={theme.panelSubtle}>Категории</Label>
              <div className="mt-2 space-y-2">
                {hasUncat ? (
                  <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={catEnabled.__none !== false}
                      onChange={(e) => setCatEnabled((m) => ({ ...m, __none: e.target.checked }))}
                    />
                    Без категории
                  </label>
                ) : null}
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={catEnabled[c.id] !== false}
                      onChange={(e) => setCatEnabled((m) => ({ ...m, [c.id]: e.target.checked }))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {Object.entries(filterOptions).map(([name, values]) => (
            <div key={name}>
              <Label className={theme.panelSubtle}>{name}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setActiveFilters((f) => ({ ...f, [name]: '' }))}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs border',
                    !activeFilters[name] ? 'border-[#3390ec] bg-[#3390ec]/20' : theme.panelBorder,
                  )}
                >
                  Все
                </button>
                {values.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setActiveFilters((f) => ({ ...f, [name]: v }))}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-xs border',
                      activeFilters[name] === v ? 'border-[#3390ec] bg-[#3390ec]/20' : theme.panelBorder,
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button type="button" className="w-full" onClick={() => setFiltersOpen(false)}>
            Готово
          </Button>
        </div>
      </Modal>

      <Modal open={sortOpen} onClose={() => setSortOpen(false)} title="Сортировать" tone={modalTone} className={clsx(theme.panel, theme.panelText)}>
        <div className="space-y-2">
          {[
            ['relevance', 'По релевантности'],
            ['priceAsc', 'Цена по возрастанию'],
            ['priceDesc', 'Цена по убыванию'],
            ['favorites', 'Сначала избранное'],
          ].map(([k, lab]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setSortKey(k);
                setSortOpen(false);
              }}
              className={clsx(
                'w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition',
                sortKey === k ? 'border-[#3390ec] bg-[#3390ec]/15' : clsx(theme.panelBorder, 'bg-transparent'),
              )}
            >
              {lab}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        title={detailProduct?.name || ''}
        wide
        tone={modalTone}
        className={clsx(theme.panel, theme.panelText)}
      >
        {detailProduct ? (
          <div className="space-y-4">
            {detailProduct.imageFileIds?.length ? (
              <div className="relative rounded-2xl overflow-hidden bg-black/30 aspect-square">
                <img
                  src={getImagePreviewUrl(detailProduct.imageFileIds[detailPhoto])}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {detailProduct.imageFileIds.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50"
                      onClick={() =>
                        setDetailPhoto((i) => (i - 1 + detailProduct.imageFileIds.length) % detailProduct.imageFileIds.length)
                      }
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50"
                      onClick={() => setDetailPhoto((i) => (i + 1) % detailProduct.imageFileIds.length)}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            <p className={clsx('text-sm', theme.panelSubtle)}>{detailProduct.description}</p>
            {(detailProduct.specs || []).some((s) => s.name && s.value) ? (
              <div className={clsx('rounded-2xl border overflow-hidden', theme.panelBorder)}>
                <table className="w-full text-sm">
                  <tbody>
                    {(detailProduct.specs || [])
                      .filter((s) => s.name && s.value)
                      .map((s) => (
                        <tr key={s.id} className={clsx('border-b last:border-0', theme.panelBorder)}>
                          <td className={clsx('py-2 px-3 w-[40%]', theme.panelSubtle)}>{s.name}</td>
                          <td className="py-2 px-3">{s.value}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {isVariabilityActive(detailProduct) ? (
              <div className="space-y-3">
                {(detailProduct.colors || []).filter((c) => c.hex).length >= 1 ? (
                  <div>
                    <Label className={theme.panelSubtle}>Цвет</Label>
                    <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
                      {(detailProduct.colors || [])
                        .filter((c) => c.hex)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setDetailColor(c.hex)}
                            className={clsx(
                              'w-10 h-10 rounded-full border-2 shrink-0 transition',
                              detailColor === c.hex ? 'border-[#3390ec] scale-110' : 'border-transparent',
                            )}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                    </div>
                  </div>
                ) : null}
                {(detailProduct.sizes || []).filter((s) => s.name).length >= 1 ? (
                  <div>
                    <Label className={theme.panelSubtle}>Размер</Label>
                    <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
                      {(detailProduct.sizes || [])
                        .filter((s) => s.name)
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setDetailSize(s.name)}
                            className={clsx(
                              'px-3 py-2 rounded-xl text-xs font-medium border shrink-0 whitespace-nowrap',
                              detailSize === s.name ? 'border-[#3390ec] bg-[#3390ec]/20' : theme.panelBorder,
                            )}
                          >
                            {s.name}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className={clsx('text-lg font-bold', theme.accent)}>{Number(detailProduct.price) || 0} ₽</p>
              <div className="flex items-center gap-2">
                {(() => {
                  const st = Math.max(0, Number(detailProduct.stock) || 0);
                  const needC = (detailProduct.colors || []).filter((c) => c.hex).length >= 1;
                  const needS = (detailProduct.sizes || []).filter((s) => s.name).length >= 1;
                  const varOk = !isVariabilityActive(detailProduct) || ((!needC || detailColor) && (!needS || detailSize));
                  const k = lineKey(detailProduct.id, detailColor, detailSize);
                  const lineQty = cart.find((l) => l.key === k)?.qty || 0;
                  const totalP = qtyForProduct(detailProduct.id);
                  return (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={lineQty <= 0}
                        onClick={() =>
                          setCart((prev) => {
                            const next = [...prev];
                            const i = next.findIndex((l) => l.key === k);
                            if (i < 0) return prev;
                            const line = { ...next[i], qty: next[i].qty - 1 };
                            if (line.qty <= 0) next.splice(i, 1);
                            else next[i] = line;
                            return next;
                          })
                        }
                      >
                        −
                      </Button>
                      <span className="text-sm w-8 text-center">{lineQty}</span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!varOk || totalP >= st}
                        onClick={() => addLine(detailProduct, detailColor, detailSize, 1)}
                      >
                        +
                      </Button>
                    </>
                  );
                })()}
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={(() => {
                const st = Math.max(0, Number(detailProduct.stock) || 0);
                const totalP = qtyForProduct(detailProduct.id);
                if (totalP >= st) return true;
                if (!isVariabilityActive(detailProduct)) return false;
                const needC = (detailProduct.colors || []).filter((c) => c.hex).length >= 1;
                const needS = (detailProduct.sizes || []).filter((s) => s.name).length >= 1;
                return (needC && !detailColor) || (needS && !detailSize);
              })()}
              onClick={() => {
                addLine(detailProduct, detailColor, detailSize, 1);
                setDetailProduct(null);
              }}
            >
              В корзину
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Оформление заказа" wide tone={modalTone} className={clsx(theme.panel, theme.panelText)}>
        <div className="space-y-4">
          {cart.length === 0 ? (
            <p className={clsx('text-sm', theme.panelSubtle)}>Корзина пуста</p>
          ) : (
            <>
              <ul className="space-y-3 text-sm max-h-64 overflow-y-auto">
                {cart.map((l) => (
                  <li key={l.key} className={clsx('flex flex-wrap items-center gap-2 border-b pb-3', theme.panelBorder)}>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">
                        {l.name}
                        {l.colorHex ? ` · ${l.colorHex}` : ''}
                        {l.sizeName ? ` · ${l.sizeName}` : ''}
                      </p>
                      <p className={clsx('text-xs mt-0.5', theme.panelSubtle)}>{l.price} ₽ × {l.qty}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={l.qty <= 0}
                        onClick={() =>
                          setCart((prev) => {
                            const next = [...prev];
                            const i = next.findIndex((x) => x.key === l.key);
                            if (i < 0) return prev;
                            const line = { ...next[i], qty: next[i].qty - 1 };
                            if (line.qty <= 0) next.splice(i, 1);
                            else next[i] = line;
                            return next;
                          })
                        }
                      >
                        −
                      </Button>
                      <span className="w-7 text-center tabular-nums">{l.qty}</span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={l.qty >= (l.maxStock ?? l.qty)}
                        onClick={() =>
                          setCart((prev) => {
                            const next = [...prev];
                            const i = next.findIndex((x) => x.key === l.key);
                            if (i < 0) return prev;
                            const max = Math.max(0, Number(l.maxStock) || 0);
                            if (next[i].qty >= max) return prev;
                            next[i] = { ...next[i], qty: next[i].qty + 1 };
                            return next;
                          })
                        }
                      >
                        +
                      </Button>
                      <button
                        type="button"
                        className={clsx('p-2 rounded-xl ml-1', theme.panelSubtle)}
                        aria-label="Удалить"
                        onClick={() => setCart((prev) => prev.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="w-full text-right font-semibold">{l.price * l.qty} ₽</span>
                  </li>
                ))}
              </ul>
              <p className="font-semibold">Итого: {cartTotal} ₽</p>
              {(shop.checkout?.requireName ?? true) ? (
                <div>
                  <Label className={theme.panelSubtle}>Имя</Label>
                  <Input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
                </div>
              ) : null}
              {shop.checkout?.requireAddress ? (
                <div>
                  <Label className={theme.panelSubtle}>Адрес</Label>
                  <Textarea value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
                </div>
              ) : null}
              {tgBuyer.username.trim() ? (
                <div>
                  <Label className={theme.panelSubtle}>Telegram</Label>
                  <p className={clsx('text-sm rounded-xl border px-4 py-3', theme.card, theme.muted)}>
                    @{tgBuyer.username.replace(/^@/, '')}
                  </p>
                </div>
              ) : (
                <>
                  {inTelegramMiniApp && !phoneViaContact ? (
                    <div>
                      <Button type="button" variant="secondary" className="w-full" onClick={sharePhoneFromTelegram}>
                        Поделиться телефоном из Telegram
                      </Button>
                    </div>
                  ) : null}
                  {phoneViaContact && cust.phone.trim() ? (
                    <div>
                        <Label className={theme.panelSubtle}>Телефон</Label>
                      <p className={clsx('text-sm rounded-xl border px-4 py-3', theme.card, theme.muted)}>
                        {cust.phone}
                      </p>
                    </div>
                  ) : (
                    <div>
                        <Label className={theme.panelSubtle}>Телефон</Label>
                      <Input value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
                    </div>
                  )}
                </>
              )}
              {orderErr ? <p className="text-sm text-red-300">{orderErr}</p> : null}
              <Button type="button" className="w-full" disabled={orderBusy} onClick={submitOrder}>
                {orderBusy ? 'Отправка…' : 'Заказать'}
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function FloatingCart({ cartCount, cartTotal, theme, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        'fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl border px-3 py-2 shadow-lg',
        theme.card,
      )}
      style={{ animation: 'cartPeek 0.45s ease-out' }}
    >
      <ShoppingCart className="w-5 h-5" />
      <div className="text-left text-xs leading-tight">
        <p className="font-semibold">{cartCount} шт.</p>
        <p className="text-white/60">{cartTotal} ₽</p>
      </div>
      <style>{`@keyframes cartPeek { from { transform: translateY(-120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </button>
  );
}
