import { defaultFreePayload } from '../models/defaults';

export function normalizeFreePayload(raw) {
  const d = defaultFreePayload();
  const f = { ...d, ...(raw || {}) };
  f.blocks = Array.isArray(f.blocks) ? f.blocks.map(migrateBlock) : [];
  f.variables = Array.isArray(f.variables) ? f.variables : [];
  f.settings = {
    ...d.settings,
    ...(f.settings || {}),
    background: { ...d.settings.background, ...(f.settings?.background || {}) },
  };
  return f;
}

function migrateBlock(b) {
  if (!b || typeof b !== 'object') return b;
  let next = { ...b };
  if (next.type === 'button' && next.action?.kind === 'variable') {
    next = {
      ...next,
      action: {
        numberOp: 'add',
        numberValue: 1,
        textValue: '',
        ...next.action,
      },
    };
  }
  if (next.type === 'button' && next.action?.kind === 'notifyAdmin') {
    next = {
      ...next,
      action: {
        messageTemplate: '',
        ...next.action,
      },
    };
  }
  if (Array.isArray(next.children)) {
    next = { ...next, children: next.children.map(migrateBlock) };
  }
  return next;
}
