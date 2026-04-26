import { databases, Query } from '../lib/appwriteClient';
import { guestDatabases } from '../lib/guestAppwrite';
import { config } from '../config';
import { dailyVisitDocumentId } from '../utils/hashId';
import { getOrCreateVisitorKey } from '../utils/visitorKey';
import { utcCalendarDay, wasVisitSentToday, markVisitSentToday } from '../utils/visitLocal';

const DB = () => config.databaseId;
const COL = () => config.visitorsCollectionId;

/**
 * Одно сохранение в БД на браузер за календарный день (UTC): сначала localStorage,
 * затем create с полем `day` — по графику видно, сколько таких «дневных визитов» в каждый день.
 * Коллекция: appDocumentId (string), day (string YYYY-MM-DD). Права: Create для guests.
 */
export async function recordDailyVisit(appDocumentId) {
  if (!COL()) return;
  const day = utcCalendarDay();
  if (wasVisitSentToday(appDocumentId, day)) {
    return;
  }

  const visitorKey = getOrCreateVisitorKey();
  const id = await dailyVisitDocumentId(appDocumentId, visitorKey, day);

  try {
    const gdb = guestDatabases();
    await gdb.createDocument(DB(), COL(), id, { appDocumentId, day });
  } catch (e) {
    const dup =
      String(e?.code) === '409' ||
      e?.type === 'document_already_exists' ||
      String(e?.message || '').includes('409');
    if (!dup) {
      return;
    }
  }

  markVisitSentToday(appDocumentId, day);
}

/** Гистограмма: число записей с данным полем `day` (посещения по дням). */
export async function fetchVisitorHistogram(appDocumentId, fromIso) {
  if (!COL()) return [];
  const fromDay = fromIso ? fromIso.slice(0, 10) : null;
  const byDay = {};
  let cursor = null;

  for (;;) {
    const q = [
      Query.equal('appDocumentId', appDocumentId),
      ...(fromDay ? [Query.greaterThanEqual('day', fromDay)] : []),
      Query.orderAsc('day'),
      Query.limit(500),
    ];
    if (cursor) {
      q.push(Query.cursorAfter(cursor));
    }

    const res = await databases.listDocuments(DB(), COL(), q);
    for (const d of res.documents) {
      const day = d.day || (d.$createdAt || '').slice(0, 10);
      if (day) byDay[day] = (byDay[day] || 0) + 1;
    }
    if (res.documents.length < 500) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}
