/**
 * Тело: { "appDocumentId": "...", "visitorKey": "uuid" }
 * Создаёт документ посещения с read только у владельца приложения.
 * Env: APPWRITE_ENDPOINT, APPWRITE_FUNCTION_PROJECT_ID, APPWRITE_API_KEY,
 *      APPWRITE_DATABASE_ID, APPWRITE_VISITORS_COLLECTION_ID, APPWRITE_APPS_COLLECTION_ID
 */
import { Client, Databases, Permission, Role } from 'node-appwrite';
import crypto from 'crypto';

function docId(appDocumentId, visitorKey) {
  const hex = crypto.createHash('sha256').update(`${appDocumentId}:${visitorKey}`).digest('hex').slice(0, 32);
  return `v${hex}`;
}

export default async ({ req, res, log }) => {
  try {
    const raw = req.bodyJson ?? (req.bodyRaw ? JSON.parse(req.bodyRaw) : req.body ?? {});
    const appDocumentId = raw.appDocumentId;
    const visitorKey = raw.visitorKey;
    if (!appDocumentId || !visitorKey) {
      return res.json({ error: 'appDocumentId and visitorKey required' }, 400);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID);
    client.setKey(process.env.APPWRITE_API_KEY);

    const db = new Databases(client);
    const appsCol = process.env.APPWRITE_APPS_COLLECTION_ID;
    const visCol = process.env.APPWRITE_VISITORS_COLLECTION_ID;
    const databaseId = process.env.APPWRITE_DATABASE_ID;

    const app = await db.getDocument(databaseId, appsCol, appDocumentId);
    if (!app.published) {
      return res.json({ ok: true, skipped: true }, 200);
    }

    const ownerId = app.ownerId;
    const id = docId(appDocumentId, visitorKey);

    try {
      await db.createDocument(databaseId, visCol, id, { appDocumentId }, [
        Permission.read(Role.user(ownerId)),
      ]);
    } catch (e) {
      if (String(e.code) === '409' || e.message?.includes('already exists')) {
        return res.json({ ok: true, duplicate: true }, 200);
      }
      throw e;
    }

    return res.json({ ok: true }, 200);
  } catch (e) {
    log(e.message);
    return res.json({ error: e.message }, 400);
  }
};
