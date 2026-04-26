import { createId } from '../lib/id';

export function normalizeProduct(p) {
  const base = {
    id: p.id || createId(),
    categoryId: p.categoryId ?? null,
    name: p.name ?? '',
    description: p.description ?? '',
    price: Number(p.price) || 0,
    imageFileIds: Array.isArray(p.imageFileIds) ? [...p.imageFileIds] : [],
    specs: Array.isArray(p.specs) ? p.specs.map(normalizeSpec) : [],
    colors: Array.isArray(p.colors) ? p.colors.map(normalizeColor) : [],
    sizes: Array.isArray(p.sizes) ? p.sizes.map(normalizeSize) : [],
    stock: Math.max(0, Number(p.stock) || 0),
    outOfStockBehavior: p.outOfStockBehavior === 'remove' ? 'remove' : 'mark',
  };
  return base;
}

function normalizeSpec(s) {
  return {
    id: s.id || createId(),
    name: (s.name || '').trim(),
    value: (s.value || '').trim(),
    filterable: !!s.filterable,
  };
}

function normalizeColor(c) {
  return { id: c.id || createId(), hex: c.hex || '#ffffff' };
}

function normalizeSize(s) {
  return { id: s.id || createId(), name: (s.name || '').trim() };
}

/** Вариативность активна: минимум 2 варианта суммарно (цвета и/или размеры). */
export function isVariabilityActive(p) {
  const nc = (p.colors || []).filter((c) => c.hex).length;
  const ns = (p.sizes || []).filter((s) => s.name).length;
  return nc + ns >= 2;
}

export function newSpec() {
  return { id: createId(), name: '', value: '', filterable: false };
}

export function newColor() {
  return { id: createId(), hex: '#3390ec' };
}

export function newSize() {
  return { id: createId(), name: '' };
}
