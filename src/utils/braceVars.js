export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceBracedVariables(text, variables, valueMap) {
  if (text == null) return text;
  let out = String(text);
  for (const v of variables || []) {
    const name = (v.name || '').trim();
    if (!name) continue;
    const re = new RegExp(`\\{${escapeRegExp(name)}\\}`, 'g');
    out = out.replace(re, String(valueMap[v.id] ?? ''));
  }
  return out;
}
