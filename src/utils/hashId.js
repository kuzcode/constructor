export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** ID для коллекции посещений: ≤36 символов, [a-zA-Z0-9._-] */
export async function visitorDocId(appDocumentId, visitorKey) {
  const hex = await sha256Hex(`${appDocumentId}:${visitorKey}`);
  return `v${hex.slice(0, 32)}`;
}

/** Один документ на браузер на календарный день (UTC): app + visitorKey + day */
export async function dailyVisitDocumentId(appDocumentId, visitorKey, dayYyyyMmDd) {
  const hex = await sha256Hex(`${appDocumentId}:${visitorKey}:${dayYyyyMmDd}`);
  return `v${hex.slice(0, 32)}`;
}
