const KEY = 'miniapp_visitor_key';

export function getOrCreateVisitorKey() {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `vk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return `anon_${Date.now()}`;
  }
}
