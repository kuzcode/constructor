import { config } from '../config';

/** @param {string} intentDocumentId — $id документа в коллекции payment_intents (до 64 символов для deep link) */
export function buildPaymentBotDeepLink(intentDocumentId) {
  const username = (config.telegramBotUsername || 'miniapps_constructor_bot').replace(/^@/, '');
  const id = String(intentDocumentId || '').trim();
  if (!id) return '';
  return `https://t.me/${username}?start=${encodeURIComponent(id)}`;
}

export function getTelegramUserIdFromBrowser() {
  try {
    const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return id != null ? String(id) : '';
  } catch {
    return '';
  }
}
