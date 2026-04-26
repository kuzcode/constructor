import { functions } from '../lib/appwriteClient';
import { config } from '../config';

/** Опционально: Cloud Function с API key и TELEGRAM_BOT_TOKEN (см. appwrite-functions/owner-notify). */
export async function tryNotifyOwnerTelegram(ownerId, text) {
  const fnId = config.fnOwnerNotifyId?.trim();
  if (!fnId || !ownerId || !String(text || '').trim()) return;
  try {
    await functions.createExecution(fnId, JSON.stringify({ ownerId, text: String(text).slice(0, 4000) }), false);
  } catch {
    /* не блокируем клиента */
  }
}
