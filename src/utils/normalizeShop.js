import { defaultShopPayload } from '../models/defaults';
import { normalizeProduct } from './productModel';

export function normalizeShopPayload(raw) {
  const d = defaultShopPayload();
  const s = { ...d, ...(raw || {}) };
  s.contacts = { ...d.contacts, ...(s.contacts || {}) };
  s.checkout = {
    requireName: true,
    requireAddress: false,
    requirePhone: true,
    ...(s.checkout || {}),
  };
  s.categories = Array.isArray(s.categories) ? s.categories : [];
  s.products = Array.isArray(s.products) ? s.products.map((p) => normalizeProduct(p)) : [];
  return s;
}
