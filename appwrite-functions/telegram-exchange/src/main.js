/**
 * Appwrite Function: обмен Telegram OIDC id_token на сессию Appwrite.
 *
 * Переменные окружения функции (консоль Appwrite → Functions → Settings):
 * - APPWRITE_FUNCTION_PROJECT_ID (обычно подставляется самим Appwrite)
 * - APPWRITE_ENDPOINT — URL API, напр. https://fra.cloud.appwrite.io/v1
 * - APPWRITE_API_KEY — ключ с правами users.read, users.write, sessions.write
 * - TELEGRAM_CLIENT_ID — Client ID из @BotFather → Bot Settings → Web Login
 *
 * Тело запроса (JSON): { "id_token": "...", "link_user_id": "<optional appwrite user id>" }
 * Ответ: { "secret": "<session secret>" } или { "error": "..." }
 *
 * Разрешите выполнение функции для гостей (если вход только через Telegram) или
 * оставьте JWT — тогда для «привязки» передавайте сессию пользователя отдельно
 * (в продакшене лучше проверять link_user_id через Users.get с API key).
 */

import { Client, Users, ID, Query } from 'node-appwrite';
import * as jose from 'jose';

const JWKS = jose.createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'));

export default async ({ req, res, log }) => {
  try {
    const raw = req.bodyJson ?? (req.bodyRaw ? JSON.parse(req.bodyRaw) : req.body);
    const id_token = raw?.id_token;
    const link_user_id = raw?.link_user_id || null;
    if (!id_token) {
      return res.json({ error: 'missing id_token' }, 400);
    }

    const clientId = process.env.TELEGRAM_CLIENT_ID || process.env.REACT_APP_TELEGRAM_CLIENT_ID;
    if (!clientId) {
      return res.json({ error: 'TELEGRAM_CLIENT_ID not set on function' }, 500);
    }

    const { payload } = await jose.jwtVerify(id_token, JWKS, {
      issuer: 'https://oauth.telegram.org',
      audience: String(clientId),
    });

    const sub = String(payload.sub);
    const email = `tg_${sub}@telegram.miniapp`;

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_DEV_PROJECT_ID);
    client.setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(client);

    if (link_user_id) {
      await users.updatePrefs(link_user_id, {
        telegramId: sub,
        telegram_linked: 'true',
      });
      const session = await users.createSession(link_user_id);
      return res.json({ secret: session.secret });
    }

    const list = await users.list([Query.equal('email', email)]);
    let userId;
    if (list.users?.length) {
      userId = list.users[0].$id;
    } else {
      const password = ID.unique() + ID.unique();
      const created = await users.create(ID.unique(), email, undefined, password, payload.name || payload.preferred_username || 'Telegram');
      userId = created.$id;
    }

    await users.updatePrefs(userId, {
      telegramId: sub,
      telegram_linked: 'true',
    });

    const session = await users.createSession(userId);
    return res.json({ secret: session.secret });
  } catch (e) {
    log(e.message);
    return res.json({ error: e.message || 'telegram_exchange_failed' }, 400);
  }
};
