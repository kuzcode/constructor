import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublishedBySlug, getImagePreviewUrl } from '../services/appsService';
import { recordDailyVisit } from '../services/visitorsService';
import { normalizeFreePayload } from '../utils/normalizeFree';
import { ShopClientView } from '../components/shop/ShopClientView';
import { FreePublicRenderer } from '../components/free/FreePublicRenderer';
import clsx from 'clsx';
import { isPublicHostingOk } from '../constants/hosting';
import {
  initTelegramWebApp,
  readTelegramWebAppIdentity,
  persistPublicTelegramContext,
} from '../utils/telegramWebApp';

export function PublicMiniAppPage() {
  const { slug } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initTelegramWebApp();
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const d = await getPublishedBySlug(slug);
        if (!c) setDoc(d);
        if (d?.$id) {
          recordDailyVisit(d.$id);
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug || loading || !doc) return;
    if (doc.appType === 'shop') return;
    const tw = readTelegramWebAppIdentity();
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const fromQuery = params.get('tg_username')?.replace(/^@/, '').trim() || '';
    const username = (tw?.username || fromQuery || '').trim();
    const userId = (tw?.userId || '').trim();
    persistPublicTelegramContext(slug, { telegramUsername: username, telegramUserId: userId });
  }, [slug, loading, doc]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] text-white/50 text-sm">
        Загрузка…
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white px-6 text-center">
        <p className="text-lg font-medium">Страница не найдена</p>
        <p className="text-sm text-white/45 mt-2">Проверьте адрес или публикацию в конструкторе.</p>
      </div>
    );
  }

  if (!isPublicHostingOk(doc)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white px-6 text-center">
        <p className="text-lg font-medium">Страница временно недоступна</p>
        <p className="text-sm text-white/45 mt-2">Срок размещения истёк. Владелец может продлить в конструкторе.</p>
      </div>
    );
  }

  if (doc.appType === 'shop') {
    return <ShopClientView slug={slug} initialDoc={doc} />;
  }

  return <PublicFree doc={doc} slug={slug} />;
}

function PublicFree({ doc, slug }) {
  const free = useMemo(() => normalizeFreePayload(doc.freePayload), [doc.freePayload]);
  const varsInit = useMemo(() => {
    const m = {};
    (free.variables || []).forEach((v) => {
      m[v.id] = v.initialValue ?? '';
    });
    return m;
  }, [free.variables]);

  const [vals, setVals] = useState(varsInit);

  useEffect(() => {
    setVals(varsInit);
  }, [varsInit]);

  const bg = free.settings?.background || { type: 'color', color: '#0a0a0f' };
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY || 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const bgStyle = () => {
    if (bg.type === 'color') return { backgroundColor: bg.color };
    if (bg.type === 'gradient')
      return { backgroundImage: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` };
    return { backgroundColor: '#0a0a0f' };
  };

  const parallaxOffset = bg.type === 'image' && bg.mode === 'parallax' ? scrollY * 0.35 : 0;

  const applyButtonVariable = (block) => {
    const a = block.action;
    if (a?.kind !== 'variable') return;
    const v = (free.variables || []).find((x) => x.id === a.variableId);
    if (!v) return;
    setVals((prev) => {
      const cur = prev[v.id];
      if (v.varType === 'number') {
        const n = Number(cur) || 0;
        const d = Number(a.numberValue) || 0;
        let next = n;
        if (a.numberOp === 'add') next = n + d;
        else if (a.numberOp === 'sub') next = n - d;
        else next = d;
        return { ...prev, [v.id]: String(next) };
      }
      return { ...prev, [v.id]: a.textValue ?? '' };
    });
  };

  return (
    <div className="min-h-screen relative text-white" style={bgStyle()}>
      {bg.type === 'image' && bg.fileId ? (
        <div
          className={clsx('fixed inset-0 z-0 overflow-hidden pointer-events-none', bg.mode === 'fixed' && '!absolute')}
          style={bg.mode === 'parallax' ? { transform: `translateY(${parallaxOffset}px)` } : undefined}
        >
          <img
            src={getImagePreviewUrl(bg.fileId)}
            alt=""
            className={clsx(
              'w-full h-[55vh] object-cover opacity-40',
              bg.mode === 'fixed' && 'min-h-full h-full object-cover',
            )}
          />
        </div>
      ) : null}
      <div className="relative z-10 max-w-lg mx-auto px-4 py-10 space-y-4">
        <FreePublicRenderer
          slug={slug}
          free={free}
          vals={vals}
          setVals={setVals}
          applyButtonVariable={applyButtonVariable}
        />
      </div>
    </div>
  );
}
