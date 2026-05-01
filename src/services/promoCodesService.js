import { databases, Query } from '../lib/appwriteClient';
import { config } from '../config';

const DB = () => config.databaseId;
const COL = () => config.promoCodesCollectionId;

/**
 * Возвращает промокод и скидку value.
 * Ожидаемые поля документа: code (string), value (number), active (boolean, optional).
 */
export async function resolvePromoCode(rawCode) {
  const code = String(rawCode || '').trim();
  if (!code) throw new Error('Введите промокод');
  if (!COL()) {
    throw new Error('Не задана коллекция промокодов (REACT_APP_APPWRITE_COL_PROMOCODES_ID)');
  }
  const probe = async (probeCode) =>
    databases.listDocuments(DB(), COL(), [Query.equal('code', probeCode), Query.limit(1)]);

  const upper = code.toUpperCase();
  let res = await probe(code);
  if (!res.documents?.length && upper !== code) {
    res = await probe(upper);
  }
  const doc = res.documents?.[0];
  if (!doc) throw new Error('Промокод не найден');
  if (doc.active === false) throw new Error('Промокод неактивен');
  const value = Math.max(0, Math.floor(Number(doc.value) || 0));
  if (value <= 0) throw new Error('Промокод без скидки');
  return {
    code: String(doc.code || upper),
    value,
    $id: doc.$id,
  };
}
