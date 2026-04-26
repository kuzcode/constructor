import { databases, ID, Permission, Query, Role } from '../lib/appwriteClient';
import { guestDatabases } from '../lib/guestAppwrite';
import { getPublishedBySlug } from './appsService';
import { config } from '../config';

const DB = () => config.databaseId;
const COL = () => config.freeFeedbackCollectionId;

export async function listFreeFeedbackForApp(appDocumentId) {
  if (!COL()) return { documents: [] };
  return databases.listDocuments(DB(), COL(), [
    Query.equal('appDocumentId', appDocumentId),
    Query.orderDesc('$createdAt'),
    Query.limit(500),
  ]);
}

/**
 * Публичная отправка: опросы, «оповестить админа», кнопки.
 * Коллекция: appDocumentId, ownerId, kind, blockId?, payloadJson. Create — Guests; Read — owner.
 */
export async function submitFreeFeedback({ slug, kind, blockId, payload }) {
  if (!COL()) {
    throw new Error('Не задана коллекция free_feedback (REACT_APP_APPWRITE_COL_FREE_FEEDBACK_ID)');
  }
  if (!slug || !kind) throw new Error('Некорректный запрос');

  const appDoc = await getPublishedBySlug(slug);
  if (!appDoc) throw new Error('Страница не найдена');
  if (appDoc.appType !== 'free') throw new Error('Не свободная страница');

  const ownerId = appDoc.ownerId;
  const gdb = guestDatabases();
  await gdb.createDocument(
    DB(),
    COL(),
    ID.unique(),
    {
      appDocumentId: appDoc.$id,
      ownerId,
      kind: String(kind),
      blockId: blockId || '',
      payloadJson: JSON.stringify(payload ?? {}),
    },
    [Permission.read(Role.user(ownerId))],
  );
  return { ok: true };
}
