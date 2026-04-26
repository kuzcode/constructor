#!/usr/bin/env node
/**
 * Устаревший polling только для answerPreCheckoutQuery.
 * Основной поток оплаты: Python-бот `telegram_bot/bot.py` (счёт в ЛС + Appwrite).
 * Этот скрипт можно не запускать, если работает Python-бот.
 */

const token = (process.env.local.REACT_APP_TELEGRAM_BOT_TOKEN || '').trim();
if (!token) {
  console.error('Укажите BOT_TOKEN или REACT_APP_TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}`;
let offset = 0;

async function answerPreCheckout(id) {
  const res = await fetch(`${api}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pre_checkout_query_id: id, ok: true }),
  });
  const j = await res.json();
  if (!j.ok) console.error('answerPreCheckoutQuery failed:', j);
  return j.ok;
}

async function poll() {
  try {
    const res = await fetch(`${api}/getUpdates?timeout=50&offset=${offset}`);
    const j = await res.json();
    if (!j.ok) {
      console.error('getUpdates:', j);
      await new Promise((r) => setTimeout(r, 3000));
      return poll();
    }
    for (const u of j.result || []) {
      offset = u.update_id + 1;
      const q = u.pre_checkout_query;
      if (q) {
        const ok = await answerPreCheckout(q.id);
        if (ok) console.log('pre_checkout_query ok', q.id, q.invoice_payload);
      }
    }
  } catch (e) {
    console.error(e);
    await new Promise((r) => setTimeout(r, 3000));
  }
  return poll();
}

console.log('Polling getUpdates — оставьте процесс запущенным при приёме оплат Stars.');
poll();
