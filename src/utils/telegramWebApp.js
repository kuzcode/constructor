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

function cleanProfile(raw = {}) {
  const userId = raw.userId != null ? String(raw.userId).trim() : '';
  if (!userId) return null;
  const username = String(raw.username || '').replace(/^@/, '').trim();
  const firstName = String(raw.firstName || '').trim();
  const lastName = String(raw.lastName || '').trim();
  const avatarUrl = String(raw.avatarUrl || '').trim();
  return { userId, username, firstName, lastName, avatarUrl };
}

export function readTelegramProfileFromRuntime() {
  try {
    const tg = window.Telegram?.WebApp;
    const u = tg?.initDataUnsafe?.user;
    const fromMiniApp = cleanProfile({
      userId: u?.id,
      username: u?.username,
      firstName: u?.first_name,
      lastName: u?.last_name,
      avatarUrl: u?.photo_url,
    });
    if (fromMiniApp) return fromMiniApp;
  } catch {
    /* ignore */
  }
  try {
    const q = new URLSearchParams(window.location.search || '');
    return cleanProfile({
      userId: q.get('tg_uid'),
      username: q.get('tg_un'),
      firstName: q.get('tg_fn'),
      lastName: q.get('tg_ln'),
      avatarUrl: q.get('tg_av'),
    });
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
  const shortRaw = (config.telegramWebAppShortName || '').trim();
  const short = shortRaw && shortRaw !== bot ? shortRaw : '';
  if (!bot || !s) return '';
  const path = short ? `/${short}` : '';
  return `https://t.me/${bot}${path}?startapp=${encodeURIComponent(s)}`;
}

export function buildTelegramMiniAppOpenUrlWithProfile(slug, profile) {
  const base = buildTelegramMiniAppOpenUrl(slug);
  if (!base) return '';
  const p = cleanProfile(profile);
  if (!p) return base;
  const u = new URL(base);
  u.searchParams.set('tg_uid', p.userId);
  if (p.username) u.searchParams.set('tg_un', p.username);
  if (p.firstName) u.searchParams.set('tg_fn', p.firstName);
  if (p.lastName) u.searchParams.set('tg_ln', p.lastName);
  if (p.avatarUrl) u.searchParams.set('tg_av', p.avatarUrl);
  return u.toString();
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
