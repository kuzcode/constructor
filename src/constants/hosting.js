export const HOSTING_STARS_MONTHLY = 500;
export const HOSTING_STARS_YEARLY = 5000;

export function hasActiveHosting(doc) {
  const until = doc?.hostingPaidUntil;
  if (!until) return false;
  const ms = new Date(until).getTime();
  if (!Number.isFinite(ms)) return false;
  return ms > Date.now();
}

export function computeHostingPaidUntil(previousUntilIso, plan) {
  const nowMs = Date.now();
  const prev = previousUntilIso ? new Date(previousUntilIso).getTime() : 0;
  const baseMs = prev > nowMs ? prev : nowMs;
  const d = new Date(baseMs);
  if (plan === 'yearly') d.setUTCDate(d.getUTCDate() + 365);
  else d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString();
}

/** Публичная страница доступна: нет даты (старые приложения) или срок в будущем. */
export function isPublicHostingOk(doc) {
  const u = doc?.hostingPaidUntil;
  if (u == null || u === '') return true;
  return new Date(u) > new Date();
}

/**
 * Перед сохранением с published=true: нужен платёж, если это первая публикация без даты
 * или срок hostingPaidUntil истёк.
 */
export function needsHostingPaymentToPublish(doc, wantPublished) {
  if (!wantPublished) return false;
  return !hasActiveHosting(doc);
}
