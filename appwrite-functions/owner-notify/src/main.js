/**
 * Тело: { ownerId: string, text: string }
 * Env: APPWRITE_ENDPOINT, APPWRITE_FUNCTION_PROJECT_ID, APPWRITE_API_KEY, TELEGRAM_BOT_TOKEN
 */
import { Client, Users } from 'node-appwrite';

export default async ({ req, res, log }) => {
  try {
    const raw = req.bodyJson ?? (req.bodyRaw ? JSON.parse(req.bodyRaw) : req.body ?? {});
    const { ownerId, text } = raw;
    if (!ownerId || !String(text || '').trim()) {
      return res.json({ error: 'invalid payload' }, 400);
    }

    const bot = process.env.TELEGRAM_BOT_TOKEN;
    if (!bot) {
      return res.json({ ok: true, skipped: true }, 200);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID);
    client.setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(client);
    const u = await users.get(ownerId);
    const prefs = u.prefs || {};
    const chatId = prefs.telegramId || prefs.telegram_id;
    if (!chatId) {
      return res.json({ ok: true, skipped: true }, 200);
    }

    await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4000) }),
    });

    return res.json({ ok: true }, 200);
  } catch (e) {
    log(e.message);
    return res.json({ error: e.message }, 400);
  }
};
