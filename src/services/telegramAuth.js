import { client, account, functions } from '../lib/appwriteClient';
import { config } from '../config';

/**
 * @param {string} idToken
 * @param {string|null} linkUserId — если пользователь уже вошёл (привязка Telegram)
 * @returns {Promise<{ user: import('appwrite').Models.User; secret: string }>}
 */
export async function exchangeTelegramIdToken(idToken, linkUserId = null) {
  const fnId = config.fnTelegramExchangeId?.trim();
  if (!fnId) {
    throw new Error(
      'Не настроена функция Appwrite: задайте REACT_APP_APPWRITE_FN_TELEGRAM_EXCHANGE_ID и задеплойте обработчик Telegram.',
    );
  }
  const payload = JSON.stringify({
    id_token: idToken,
    link_user_id: linkUserId,
  });
  const execution = await functions.createExecution(fnId, payload, false);
  const raw = execution.responseBody || '';
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(raw || 'Пустой ответ функции Telegram');
  }
  if (json.error) {
    throw new Error(json.error);
  }
  if (!json.secret) {
    throw new Error('Функция не вернула session secret');
  }
  client.setSession(json.secret);
  const user = await account.get();
  return { user, secret: json.secret };
}
