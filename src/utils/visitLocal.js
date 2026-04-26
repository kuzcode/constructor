/** Календарный день UTC в формате YYYY-MM-DD (как в БД). */
export function utcCalendarDay() {
  return new Date().toISOString().slice(0, 10);
}

const PREFIX = 'miniapp_visit_sent_';

export function wasVisitSentToday(appDocumentId, dayYyyyMmDd) {
  try {
    return localStorage.getItem(`${PREFIX}${appDocumentId}_${dayYyyyMmDd}`) === '1';
  } catch {
    return false;
  }
}

export function markVisitSentToday(appDocumentId, dayYyyyMmDd) {
  try {
    localStorage.setItem(`${PREFIX}${appDocumentId}_${dayYyyyMmDd}`, '1');
  } catch {
    /* private mode */
  }
}
