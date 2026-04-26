import clsx from 'clsx';
import { useAdminTheme } from '../../context/AdminThemeContext';

function smoothPath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) * 0.42;
    d += ` C ${p0.x + dx} ${p0.y}, ${p1.x - dx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

const ACCENTS = {
  blue: {
    light: { stroke: '#1d4ed8', fill: 'rgba(37, 99, 235, 0.18)' },
    dark: { stroke: '#60a5fa', fill: 'rgba(96, 165, 250, 0.22)' },
  },
  emerald: {
    light: { stroke: '#00bd42', fill: 'rgba(0, 189, 66, 0.2)' },
    dark: { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.2)' },
  },
};

export function StatLineChart({ title, data, valueKey = 'count', className, accent = 'blue' }) {
  const { light } = useAdminTheme();
  const n = data?.length || 0;
  const values = (data || []).map((row) => Number(row[valueKey]) || 0);
  const total = values.reduce((a, v) => a + v, 0);
  const max = Math.max(...values, 1);
  const w = 320;
  const h = 120;
  const padX = 4;
  const padY = 6;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const step = n <= 1 ? innerW / 2 : innerW / (n - 1);
  const points = values.map((v, i) => ({
    x: padX + (n <= 1 ? innerW / 2 : i * step),
    y: padY + innerH - (v / max) * innerH,
  }));
  const lineD = smoothPath(points);
  const areaD =
    points.length > 0
      ? `${lineD} L ${points[points.length - 1].x} ${h - padY} L ${points[0].x} ${h - padY} Z`
      : '';

  const pal = ACCENTS[accent] || ACCENTS.blue;
  const { stroke, fill } = light ? pal.light : pal.dark;
  const grid = light ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.08)';
  const labelColor = light ? 'rgba(15, 23, 42, 0.62)' : 'rgba(255,255,255,0.45)';

  return (
    <div
      className={clsx(
        'rounded-2xl border p-4',
        light ? 'border-slate-200/90 bg-white shadow-sm' : 'border-tg-border bg-tg-surface/10',
        className,
      )}
    >
      <div className="mb-1">
        <h3 className={clsx('text-sm font-medium', light ? 'text-slate-800' : 'text-white/90')}>{title}</h3>
        <p className={clsx('text-lg font-semibold tabular-nums', light ? 'text-slate-900' : 'text-white')}>
          {total.toLocaleString('ru-RU')}
        </p>
      </div>
      <div className="relative w-full overflow-hidden rounded-xl" style={{ minHeight: h + 28 }}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-auto block"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke={grid} strokeWidth="1" />
          <path d={areaD} fill={fill} />
          <path
            d={lineD}
            fill="none"
            stroke={stroke}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          className="flex justify-between gap-0.5 mt-1 px-0.5"
          style={{ fontSize: n > 18 ? '8px' : n > 12 ? '9px' : '10px' }}
        >
          {(data || []).map((row) => (
            <span
              key={row.day}
              className="flex-1 min-w-0 text-center truncate leading-tight"
              style={{ color: labelColor }}
              title={row.day}
            >
              {row.day.slice(5)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
