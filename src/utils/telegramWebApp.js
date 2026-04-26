import { config } from '../config';

export function initTelegramWebApp() {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand?.();
    }
  } catch {
    /* ignore */
  }
}

/** Данные пользователя из Mini App (после initTelegramWebApp). */
export function readTelegramWebAppIdentity() {
  try {
    const tg = window.Telegram?.WebApp;
    const u = tg?.initDataUnsafe?.user;
    if (!u) return null;
    const username = u.username ? String(u.username).replace(/^@/, '').trim() : '';
    const id = u.id != null ? String(u.id) : '';
    if (!username && !id) return null;
    return {
      username,
      userId: id,
      firstName: u.first_name ? String(u.first_name) : '',
      lastName: u.last_name ? String(u.last_name) : '',
    };
  } catch {
    return null;
  }
}

function storageKey(slug) {
  return `miniapp_pub_tg_${slug}`;
}

export function persistPublicTelegramContext(slug, partial) {
  if (!slug) return;
  try {
    const prev = JSON.parse(sessionStorage.getItem(storageKey(slug)) || '{}');
    sessionStorage.setItem(storageKey(slug), JSON.stringify({ ...prev, ...partial }));
  } catch {
    /* ignore */
  }
}

export function loadPublicTelegramContext(slug) {
  if (!slug) return {};
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(slug)) || '{}');
  } catch {
    return {};
  }
}

/** Ссылка на Mini App в Telegram: клиент открывает внутри TG → доступен @username в WebApp. */
export function buildTelegramMiniAppOpenUrl(slug) {
  const s = String(slug || '').trim();
  const bot = (config.telegramBotUsername || '').replace(/^@/, '');
  const short = (config.telegramWebAppShortName || '').trim();
  if (!bot || !short || !s) return '';
  return `https://t.me/${bot}/${short}?startapp=${encodeURIComponent(s)}`;
}

export function getAdminTelegramUsernameFromPrefs(user) {
  const p = user?.prefs || {};
  const raw =
    p.telegramUsername ||
    p.telegram_username ||
    p.telegramLogin ||
    p.telegram_login ||
    '';
  return String(raw).replace(/^@/, '').trim();
}

/**
 * Запрос телефона через Telegram WebApp (если метод есть в версии клиента).
 * @returns {Promise<string|null>} нормализованный номер или null
 */
export function tryRequestTelegramContactPhone() {
  const tg = window.Telegram?.WebApp;
  if (!tg || typeof tg.requestContact !== 'function') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (phone) => {
      if (settled) return;
      settled = true;
      const p = String(phone || '').trim();
      resolve(p || null);
    };
    try {
      const ret = tg.requestContact((granted, data) => {
        if (!granted) return finish(null);
        const c = data?.contact ?? data?.response?.contact ?? data;
        const phone = c?.phone_number ?? c?.phoneNumber ?? '';
        finish(phone);
      });
      if (ret && typeof ret.then === 'function') {
        ret
          .then((data) => {
            const c = data?.contact ?? data;
            finish(c?.phone_number ?? c?.phoneNumber ?? '');
          })
          .catch(() => finish(null));
      }
    } catch {
      finish(null);
    }
  });
}
