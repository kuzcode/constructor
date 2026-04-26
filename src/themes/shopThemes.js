/** Стили витрины (заглушки — можно править под бренд). @param {number} styleId */
export function shopThemeClass(styleId) {
  const id = Number(styleId) || 1;
  const map = {
    1: {
      shell: 'bg-[#0c0c12] text-white',
      card: 'bg-white/[0.06] border-white/10',
      accent: 'text-[#3390ec]',
      btn: 'bg-[#3390ec] text-white',
      muted: 'text-white/55',
    },
    2: {
      shell: 'bg-gradient-to-b from-[#1a1025] to-[#0a0a10] text-white',
      card: 'bg-violet-500/10 border-violet-500/20',
      accent: 'text-violet-300',
      btn: 'bg-violet-500 text-white',
      muted: 'text-white/55',
    },
    3: {
      shell: 'bg-[#0f1419] text-white',
      card: 'bg-slate-800/50 border-slate-600/30',
      accent: 'text-cyan-300',
      btn: 'bg-cyan-500 text-slate-950',
      muted: 'text-slate-400',
    },
    4: {
      shell: 'bg-[#12100e] text-stone-100',
      card: 'bg-amber-900/15 border-amber-700/25',
      accent: 'text-amber-200',
      btn: 'bg-amber-500 text-stone-950',
      muted: 'text-stone-400',
    },
    5: {
      shell: 'bg-[#0b1210] text-emerald-50',
      card: 'bg-emerald-900/20 border-emerald-600/25',
      accent: 'text-emerald-300',
      btn: 'bg-emerald-500 text-emerald-950',
      muted: 'text-emerald-100/45',
    },
    6: {
      shell: 'bg-gradient-to-br from-[#1c1c24] via-[#101018] to-[#0a0a0f] text-white',
      card: 'bg-white/[0.07] border-white/10 backdrop-blur-md',
      accent: 'text-sky-300',
      btn: 'bg-sky-500 text-white',
      muted: 'text-white/50',
    },
  };
  return map[id] || map[1];
}

export const SHOP_STYLE_LABELS = [
  { id: 1, name: 'Ночной синий' },
  { id: 2, name: 'Фиолетовый градиент' },
  { id: 3, name: 'Сланец / циан' },
  { id: 4, name: 'Тёплый янтарь' },
  { id: 5, name: 'Изумруд' },
  { id: 6, name: 'Стекло / небо' },
];
