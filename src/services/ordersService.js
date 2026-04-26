import { databases, ID, Query, Permission, Role } from '../lib/appwriteClient';
import { guestDatabases } from '../lib/guestAppwrite';
import { getPublishedBySlug } from './appsService';
import { config } from '../config';

const DB = () => config.databaseId;
const COL = () => config.ordersCollectionId;
const APPS = () => config.appsCollectionId;

export async function listOrdersForApp(appDocumentId) {
  if (!COL()) return { documents: [] };
  return databases.listDocuments(DB(), COL(), [
    Query.equal('appDocumentId', appDocumentId),
    Query.orderDesc('$createdAt'),
    Query.limit(500),
  ]);
}

export async function listOrdersInRange(appDocumentId, fromIso) {
  if (!COL()) return { documents: [], series: [] };
  const byDay = {};
  let cursor = null;
  const all = [];
  for (;;) {
    const batchQ = [
      Query.equal('appDocumentId', appDocumentId),
      ...(fromIso ? [Query.greaterThanEqual('$createdAt', fromIso)] : []),
      Query.orderAsc('$createdAt'),
      Query.limit(500),
    ];
    if (cursor) {
      batchQ.push(Query.cursorAfter(cursor));
    }
    const res = await databases.listDocuments(DB(), COL(), batchQ);
    all.push(...res.documents);
    for (const d of res.documents) {
      const day = d.orderDay || (d.$createdAt || '').slice(0, 10);
      if (day) byDay[day] = (byDay[day] || 0) + Number(d.total || 0);
    }
    if (res.documents.length < 500) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  const series = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, sum]) => ({ day, sum }));
  return { documents: all, series };
}

/**
 * Оформление заказа с клиента: сначала guest update опубликованного apps.shopPayload (остатки),
 * затем create в orders. Нужно право Update на коллекцию apps для guests (или отдельная политика).
 * В Appwrite: orders и apps — Create/Update для guests по вашей модели безопасности.
 *
 * @param {{ slug: string, lines: { productId: string, qty: number, colorHex?: string, sizeName?: string }[], customer: object }} payload
 */
export async function submitShopOrder(payload) {
  const { slug, lines, customer } = payload;
  if (!COL()) {
    throw new Error('Не задана коллекция заказов (REACT_APP_APPWRITE_COL_ORDERS_ID)');
  }
  if (!slug || !Array.isArray(lines) || !lines.length) {
    throw new Error('Некорректный заказ');
  }

  const appDoc = await getPublishedBySlug(slug);
  if (!appDoc) {
    throw new Error('Магазин не найден');
  }
  if (appDoc.appType !== 'shop') {
    throw new Error('Не магазин');
  }

  const ownerId = appDoc.ownerId;
  const shop = appDoc.shopPayload || {};
  const products = Array.isArray(shop.products) ? shop.products : [];
  const ch = {
    requireName: true,
    requireAddress: false,
    requirePhone: true,
    ...(shop.checkout || {}),
  };
  const cust = customer || {};
  const tgUsername = String(cust.telegramUsername || '').replace(/^@/, '').trim();
  const phone = String(cust.phone || '').trim();
  if (ch.requireName && !String(cust.name || '').trim()) {
    throw new Error('Требуется имя');
  }
  if (ch.requireAddress && !String(cust.address || '').trim()) {
    throw new Error('Требуется адрес');
  }
  if (tgUsername) {
    /* @username из Telegram Mini App — телефон не обязателен */
  } else if (!phone) {
    throw new Error('Требуется телефон');
  }

  const qtyByProduct = {};
  for (const line of lines) {
    const pid = line.productId;
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    qtyByProduct[pid] = (qtyByProduct[pid] || 0) + qty;
  }
  for (const [pid, needQ] of Object.entries(qtyByProduct)) {
    const p = products.find((x) => x.id === pid);
    if (!p) throw new Error('Товар не найден');
    const stock = Math.max(0, Number(p.stock) || 0);
    if (stock < needQ) {
      throw new Error(`Недостаточно «${p.name}» на складе`);
    }
  }

  const resolvedLines = [];
  let total = 0;
  for (const line of lines) {
    const pid = line.productId;
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    const p = products.find((x) => x.id === pid);
    const price = Number(p.price) || 0;
    total += price * qty;
    resolvedLines.push({
      productId: pid,
      name: p.name,
      qty,
      price,
      colorHex: line.colorHex || null,
      sizeName: line.sizeName || null,
    });
  }

  let productsNext = products.map((p) => ({ ...p }));
  for (const line of lines) {
    const pid = line.productId;
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    const idx = productsNext.findIndex((x) => x.id === pid);
    if (idx < 0) continue;
    const p = { ...productsNext[idx] };
    p.stock = Math.max(0, (Number(p.stock) || 0) - qty);
    if (p.stock <= 0 && p.outOfStockBehavior === 'remove') {
      productsNext = productsNext.filter((x) => x.id !== pid);
    } else {
      productsNext[idx] = p;
    }
  }

  const gdb = guestDatabases();
  const appsCol = APPS();
  if (!appsCol) {
    throw new Error('Не задана коллекция приложений (REACT_APP_APPWRITE_COL_APPS_ID)');
  }
  try {
    await gdb.updateDocument(DB(), appsCol, appDoc.$id, {
      shopPayload: JSON.stringify({ ...shop, products: productsNext }),
    });
  } catch (e) {
    const code = String(e?.code ?? '');
    const msg = String(e?.message || '');
    if (code === '401' || msg.includes('401') || msg.includes('missing scope')) {
      throw new Error(
        'Не удалось списать остатки: в коллекции apps для роли guests нужно разрешение Update (см. консоль Appwrite).',
      );
    }
    throw new Error(msg || 'Не удалось обновить каталог после заказа');
  }

  const orderDay = new Date().toISOString().slice(0, 10);
  await gdb.createDocument(DB(), COL(), ID.unique(), {
    appDocumentId: appDoc.$id,
    ownerId,
    orderDay,
    total,
    itemsJson: JSON.stringify(resolvedLines),
    customerJson: JSON.stringify(cust),
  }, [Permission.read(Role.user(ownerId))]);

  return { ok: true, total };
}
