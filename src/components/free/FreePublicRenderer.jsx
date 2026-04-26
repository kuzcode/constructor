import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { getImagePreviewUrl, getPublishedBySlug } from '../../services/appsService';
import { submitFreeFeedback } from '../../services/freeFeedbackService';
import { tryNotifyOwnerTelegram } from '../../services/ownerNotifyService';
import { replaceBracedVariables } from '../../utils/braceVars';

const textVariantClass = {
  heading: 'text-3xl font-bold tracking-tight',
  subheading: 'text-xl font-semibold',
  medium: 'text-lg font-medium',
  body: 'text-base leading-relaxed',
  small: 'text-sm opacity-90',
};

function CountdownView({ block, textColor }) {
  const pageOpenRef = useRef(Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const endMs = useMemo(() => {
    if (block.mode === 'session') {
      return pageOpenRef.current + Math.max(1, Number(block.sessionSeconds) || 0) * 1000;
    }
    const t = Date.parse(block.untilIso || '');
    return Number.isFinite(t) ? t : pageOpenRef.current + 3600000;
  }, [block.mode, block.untilIso, block.sessionSeconds]);

  const left = Math.max(0, endMs - now);
  const s = Math.floor(left / 1000);
  const dd = Math.floor(s / 86400);
  const hh = Math.floor((s % 86400) / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div
      className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center backdrop-blur-sm"
      style={{ color: textColor || '#fff' }}
    >
      {block.label ? <p className="text-sm opacity-80 mb-3">{block.label}</p> : null}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 font-mono text-2xl sm:text-4xl font-bold tracking-tight tabular-nums">
        {dd > 0 ? (
          <span>
            {dd}
            <span className="text-sm font-sans font-medium opacity-60 ml-1">д</span>
          </span>
        ) : null}
        <span>{pad(hh)}</span>
        <span className="opacity-40">:</span>
        <span>{pad(mm)}</span>
        <span className="opacity-40">:</span>
        <span>{pad(ss)}</span>
      </div>
    </div>
  );
}

export function FreePublicRenderer({ slug, free, vals, setVals, applyButtonVariable }) {
  const renderInner = (b) => {
    if (!b) return null;
    if (b.type === 'text') {
      return (
        <p
          className={clsx(
            'whitespace-pre-wrap',
            textVariantClass[b.textVariant] || textVariantClass.body,
            b.align === 'center' && 'text-center',
            b.align === 'right' && 'text-right',
          )}
          style={{ color: b.color }}
        >
          {replaceBracedVariables(b.content || '', free.variables, vals)}
        </p>
      );
    }
    if (b.type === 'image' && b.fileId) {
      return (
        <img src={getImagePreviewUrl(b.fileId)} alt="" className="w-full rounded-2xl object-cover max-h-[70vh]" />
      );
    }
    if (b.type === 'countdown') {
      return <CountdownView block={b} textColor={b.textColor} />;
    }
    if (b.type === 'stack') {
      const bg =
        b.bgColor === 'transparent' || !b.bgColor ? undefined : { backgroundColor: b.bgColor };
      return (
        <div
          className={clsx(
            'rounded-2xl p-3 space-y-3',
            b.layout === 'row' ? 'flex flex-row flex-wrap gap-3' : 'flex flex-col gap-3',
          )}
          style={bg}
        >
          {(b.children || []).map((c) => (
            <Fragment key={c.id}>{renderInner(c)}</Fragment>
          ))}
        </div>
      );
    }
    if (b.type === 'hscroll') {
      return (
        <div
          className="flex overflow-x-auto gap-3 pb-2 -mx-1 px-1 snap-x snap-mandatory"
          style={{ gap: Number(b.gap) || 12 }}
        >
          {(b.children || []).map((c) => (
            <div key={c.id} className="min-w-[min(280px,85vw)] shrink-0 snap-start">
              {renderInner(c)}
            </div>
          ))}
        </div>
      );
    }
    if (b.type === 'input') {
      const v = (free.variables || []).find((x) => x.id === b.variableId);
      const raw = vals[b.variableId] ?? '';
      const isNum = b.inputType === 'number' || v?.varType === 'number';
      return (
        <input
          type={isNum ? 'number' : 'text'}
          value={raw}
          placeholder={b.placeholder || ''}
          className="w-full rounded-2xl border border-white/10 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#3390ec]/40"
          style={{
            backgroundColor: b.bgColor === 'transparent' ? 'transparent' : b.bgColor || 'rgba(255,255,255,0.08)',
            color: b.textColor || '#fff',
          }}
          onChange={(e) => {
            const t = e.target.value;
            if (v?.varType === 'number' && t !== '' && t !== '-' && Number.isNaN(Number(t))) return;
            setVals((prev) => ({ ...prev, [b.variableId]: t }));
          }}
        />
      );
    }
    if (b.type === 'poll') {
      return <PollBlock block={b} slug={slug} free={free} vals={vals} />;
    }
    if (b.type === 'button') {
      return (
        <button
          type="button"
          className="inline-flex px-5 py-3 rounded-2xl text-[15px] font-semibold shadow-lg active:scale-[0.98] transition"
          style={{ background: b.bgColor, color: b.textColor }}
          onClick={async () => {
            if (b.action?.kind === 'link') {
              window.open(b.action.url, '_blank', 'noopener,noreferrer');
            } else if (b.action?.kind === 'variable') {
              applyButtonVariable(b);
            } else if (b.action?.kind === 'notifyAdmin') {
              const text = replaceBracedVariables(b.action.messageTemplate || '', free.variables, vals);
              try {
                const app = await getPublishedBySlug(slug);
                await submitFreeFeedback({
                  slug,
                  kind: 'button_notify',
                  blockId: b.id,
                  payload: { label: b.label, message: text },
                });
                if (app?.ownerId) await tryNotifyOwnerTelegram(app.ownerId, text);
              } catch (e) {
                alert(e.message || 'Не удалось отправить');
              }
            }
          }}
        >
          {replaceBracedVariables(b.label || '', free.variables, vals)}
        </button>
      );
    }
    return null;
  };

  return (
    <>
      {(free.blocks || []).map((b) => (
        <Fragment key={b.id}>{renderInner(b)}</Fragment>
      ))}
    </>
  );
}

function PollBlock({ block, slug, free, vals }) {
  const [selected, setSelected] = useState('');
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!selected || done) return;
    const opt = (block.options || []).find((o) => o.id === selected);
    if (!opt) return;
    const isQuiz = block.mode === 'quiz';
    let ok = true;
    if (isQuiz) {
      ok = !!opt.correct;
      setMsg(ok ? 'Верно!' : 'Неверно');
    } else {
      setMsg('Спасибо!');
    }
    setDone(true);
    const telegramText = [`Опрос: ${block.question}`, `Ответ: ${opt.label}`, isQuiz ? (ok ? '(верно)' : '(ошибка)') : '']
      .filter(Boolean)
      .join('\n');
    try {
      const app = await getPublishedBySlug(slug);
      await submitFreeFeedback({
        slug,
        kind: 'poll',
        blockId: block.id,
        payload: {
          question: block.question,
          optionId: opt.id,
          label: opt.label,
          mode: block.mode,
          correct: !!opt.correct,
        },
      });
      if (block.notifyAdmin && app?.ownerId) {
        await tryNotifyOwnerTelegram(app.ownerId, telegramText);
      }
    } catch (e) {
      setMsg(e.message || 'Ошибка отправки');
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 p-4 space-y-3 bg-white/[0.03]">
      <p className="font-semibold text-lg">{replaceBracedVariables(block.question || '', free.variables, vals)}</p>
      <div className="space-y-2">
        {(block.options || []).map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={done}
            onClick={() => setSelected(o.id)}
            className={clsx(
              'w-full text-left rounded-xl px-4 py-3 text-sm border transition',
              selected === o.id ? 'border-white/25' : 'border-white/10',
            )}
            style={{
              backgroundColor:
                selected === o.id ? block.optSelectedBg || 'rgba(51,144,236,0.35)' : block.optBg || 'rgba(255,255,255,0.08)',
            }}
          >
            {o.label}
            {block.mode === 'quiz' && done && o.correct ? (
              <span className="ml-2 text-emerald-300 text-xs">✓ верный</span>
            ) : null}
          </button>
        ))}
      </div>
      {!done ? (
        <button
          type="button"
          onClick={submit}
          disabled={!selected}
          className="w-full rounded-xl py-3 font-semibold bg-[#3390ec] text-white disabled:opacity-40"
        >
          Отправить
        </button>
      ) : (
        <p className="text-sm text-white/70">{msg}</p>
      )}
    </div>
  );
}
