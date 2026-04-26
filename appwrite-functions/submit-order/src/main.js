/**
 * Тело: { slug, lines: [{ productId, qty, colorHex?, sizeName? }], customer: { name, address, phone } }
 * Env: APPWRITE_*, APPWRITE_APPS_COLLECTION_ID, APPWRITE_ORDERS_COLLECTION_ID, APPWRITE_DATABASE_ID
 *      TELEGRAM_BOT_TOKEN (опционально) — для уведомления владельцу (chat_id из prefs telegramId)
 */
import { Client, Databases, Users, ID, Permission, Role, Query } from 'node-appwrite';

function parseJson(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async ({ req, res, log }) => {
  try {
    const raw = req.bodyJson ?? (req.bodyRaw ? JSON.parse(req.bodyRaw) : req.body ?? {});
    const { slug, lines, customer } = raw;
    if (!slug || !Array.isArray(lines) || !lines.length) {
      return res.json({ error: 'invalid payload' }, 400);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID);
    client.setKey(process.env.APPWRITE_API_KEY);

    const db = new Databases(client);
    const users = new Users(client);
    const databaseId = process.env.APPWRITE_DATABASE_ID;
    const appsCol = process.env.APPWRITE_APPS_COLLECTION_ID;
    const ordersCol = process.env.APPWRITE_ORDERS_COLLECTION_ID;

    const list = await db.listDocuments(databaseId, appsCol, [
      Query.equal('slug', slug),
      Query.equal('published', true),
      Query.limit(1),
    ]);
    if (!list.documents.length) {
      return res.json({ error: 'app not found' }, 404);
    }

    const appDoc = list.documents[0];
    if (appDoc.appType !== 'shop') {
      return res.json({ error: 'not a shop' }, 400);
    }

    const ownerId = appDoc.ownerId;
    const shop = parseJson(appDoc.shopPayload) || {};
    let products = Array.isArray(shop.products) ? [...shop.products] : [];
    const ch = {
      requireName: true,
      requireAddress: false,
      requirePhone: true,
      ...(shop.checkout || {}),
    };
    const cust = customer || {};
    if (ch.requireName && !String(cust.name || '').trim()) {
      return res.json({ error: 'Требуется имя' }, 400);
    }
    if (ch.requireAddress && !String(cust.address || '').trim()) {
      return res.json({ error: 'Требуется адрес' }, 400);
    }
    if (ch.requirePhone && !String(cust.phone || '').trim()) {
      return res.json({ error: 'Требуется телефон' }, 400);
    }

    const qtyByProduct = {};
    for (const line of lines) {
      const pid = line.productId;
      const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
      qtyByProduct[pid] = (qtyByProduct[pid] || 0) + qty;
    }
    for (const [pid, needQ] of Object.entries(qtyByProduct)) {
      const p = products.find((x) => x.id === pid);
      if (!p) return res.json({ error: `product ${pid} not found` }, 400);
      const stock = Math.max(0, Number(p.stock) || 0);
      if (stock < needQ) {
        return res.json({ error: `Недостаточно «${p.name}» на складе` }, 400);
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

    for (const line of lines) {
      const pid = line.productId;
      const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
      const idx = products.findIndex((x) => x.id === pid);
      if (idx < 0) continue;
      const p = { ...products[idx] };
      p.stock = Math.max(0, (Number(p.stock) || 0) - qty);
      if (p.stock <= 0 && p.outOfStockBehavior === 'remove') {
        products = products.filter((x) => x.id !== pid);
      } else {
        products[idx] = p;
      }
    }

    const nextShop = { ...shop, products };
    const perms = [
      Permission.read(Role.any()),
      Permission.read(Role.user(ownerId)),
      Permission.update(Role.user(ownerId)),
      Permission.delete(Role.user(ownerId)),
    ];

    await db.updateDocument(databaseId, appsCol, appDoc.$id, {
      shopPayload: JSON.stringify(nextShop),
    }, perms);

    const orderDay = new Date().toISOString().slice(0, 10);

    await db.createDocument(databaseId, ordersCol, ID.unique(), {
      appDocumentId: appDoc.$id,
      ownerId,
      orderDay,
      total,
      itemsJson: JSON.stringify(resolvedLines),
      customerJson: JSON.stringify(cust),
    }, [Permission.read(Role.user(ownerId))]);

    const bot = process.env.TELEGRAM_BOT_TOKEN;
    if (bot) {
      try {
        const u = await users.get(ownerId);
        const prefs = u.prefs || {};
        const chatId = prefs.telegramId || prefs.telegram_id;
        if (chatId) {
          const text = `Новый заказ ${slug}: ${total} ₽, позиций: ${resolvedLines.length}`;
          await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
          });
        }
      } catch (e) {
        log('telegram skip: ' + e.message);
      }
    }

    return res.json({ ok: true, total }, 200);
  } catch (e) {
    log(e.message);
    return res.json({ error: e.message }, 400);
  }
};
