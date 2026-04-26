export function normalizeSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function isValidSlug(s) {
  if (!s || s.length < 2) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}
