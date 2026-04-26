/** YYYY-MM-DD */
export function utcTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Inclusive range of calendar days in UTC. */
export function enumerateDaysUtc(startDay, endDay) {
  if (!startDay || !endDay || startDay > endDay) return [endDay].filter(Boolean);
  const out = [];
  const [ys, ms, ds] = startDay.split('-').map(Number);
  let y = ys;
  let m = ms;
  let d = ds;
  const pad = (n) => String(n).padStart(2, '0');
  for (;;) {
    const cur = `${y}-${pad(m)}-${pad(d)}`;
    out.push(cur);
    if (cur === endDay) break;
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth() + 1;
    d = dt.getUTCDate();
  }
  return out;
}

/**
 * @param {'7d'|'30d'|'all'} period
 * @param {string} appCreatedAt ISO from Appwrite
 */
export function chartDayRange(period, appCreatedAt) {
  const end = utcTodayIso();
  let start;
  if (period === '7d') {
    const e = new Date(`${end}T12:00:00.000Z`);
    e.setUTCDate(e.getUTCDate() - 6);
    start = e.toISOString().slice(0, 10);
  } else if (period === '30d') {
    const e = new Date(`${end}T12:00:00.000Z`);
    e.setUTCDate(e.getUTCDate() - 29);
    start = e.toISOString().slice(0, 10);
  } else {
    start = (appCreatedAt || end).slice(0, 10);
    if (start > end) start = end;
  }
  return enumerateDaysUtc(start, end);
}

/**
 * @param {Array<{day: string}>} sparse
 * @param {string[]} days
 * @param {string} valueKey
 */
export function mergeSparseSeries(sparse, days, valueKey) {
  const map = {};
  for (const row of sparse || []) {
    if (row?.day) map[row.day] = Number(row[valueKey]) || 0;
  }
  return days.map((day) => ({ day, [valueKey]: map[day] ?? 0 }));
}
