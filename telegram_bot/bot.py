import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

import requests
import telebot
from requests.exceptions import HTTPError
from telebot import types
from telebot.apihelper import ApiTelegramException

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
g = os.environ.get
T, E, P, K, D = g("TELEGRAM_BOT_TOKEN", "").strip(), g("APPWRITE_ENDPOINT", "").strip().rstrip("/"), g(
    "APPWRITE_PROJECT_ID", ""
).strip(), g("APPWRITE_API_KEY", "").strip(), g("APPWRITE_DATABASE_ID", "").strip()
CI, CA, CW = g("APPWRITE_COL_PAYMENT_INTENTS", "payment_intents"), g("APPWRITE_COL_APPS", "apps"), g(
    "APPWRITE_COL_WALLETS", "wallets"
)
if not E.endswith("/v1"):
    E = f"{E}/v1"
H = {"X-Appwrite-Key": K, "X-Appwrite-Project": P, "Content-Type": "application/json"}
if not all([T, E, P, K, D]):
    sys.exit("env: TELEGRAM_BOT_TOKEN, APPWRITE_ENDPOINT, PROJECT_ID, API_KEY, DATABASE_ID")
bot = telebot.TeleBot(T, parse_mode=None)
U = lambda c, i: f"{E}/databases/{D}/collections/{c}/documents/{i}"
COL_DOCS = lambda c: f"{E}/databases/{D}/collections/{c}/documents"


def _get_intent(iid):
    """Найти intent по id в основной/запасных коллекциях."""
    cols = [CI, "payment_intents", "paymentIntents"]
    seen = set()
    for col in cols:
        col = (col or "").strip()
        if not col or col in seen:
            continue
        seen.add(col)
        try:
            r = requests.get(U(col, iid), headers=H, timeout=60)
            r.raise_for_status()
            return aw(r.json()), col
        except HTTPError as e:
            if e.response is None or e.response.status_code != 404:
                raise
    return None, None


def aw(j):
    """Слить data в корень — на случай ответа Appwrite/прокси с вложенным data."""
    if not isinstance(j, dict):
        return {}
    d = j.get("data")
    return {**{k: v for k, v in j.items() if k != "data"}, **d} if isinstance(d, dict) else j


def _wallet_doc_for_user(uid):
    """Документ кошелька: $id обычно = userId; иначе ищем по атрибуту userId."""
    if not uid:
        return None, None
    try:
        wr = requests.get(U(CW, uid), headers=H, timeout=60)
        wr.raise_for_status()
        w = aw(wr.json())
        return w.get("$id") or uid, w
    except HTTPError as e:
        if e.response is None or e.response.status_code != 404:
            raise
    vals = json.dumps([uid])
    lr = requests.get(
        COL_DOCS(CW),
        headers=H,
        params={"queries[]": f'equal("userId", {vals})'},
        timeout=60,
    )
    lr.raise_for_status()
    docs = lr.json().get("documents") or []
    if not docs:
        return None, None
    w = aw(docs[0])
    return w.get("$id"), w


def fulfill(it):
    it = aw(it)
    iid, st, uid, kind = it.get("$id"), it.get("status"), it.get("userId"), it.get("type")
    stars = int(it.get("stars") or 0)
    if not iid:
        logging.warning("fulfill skip: no $id")
        return
    if st == "completed":
        return
    if st != "pending":
        logging.warning("fulfill skip id=%s status=%s", iid, st)
        return
    if kind == "topup" and stars > 0:
        wid, w = _wallet_doc_for_user(uid)
        if wid and w is not None:
            bal = int(w.get("balanceStars") or 0)
            requests.patch(
                U(CW, wid), headers=H, json={"data": {"balanceStars": bal + stars}}, timeout=60
            ).raise_for_status()
        else:
            requests.post(
                f"{E}/databases/{D}/collections/{CW}/documents",
                headers=H,
                json={
                    "documentId": uid,
                    "data": {"userId": uid, "balanceStars": stars},
                    "permissions": [f'read("user:{uid}")', f'update("user:{uid}")'],
                },
                timeout=60,
            ).raise_for_status()
    elif kind == "hosting":
        aid, plan, slug = it.get("appId"), it.get("plan"), it.get("slug") or ""
        need = 5000 if plan == "yearly" else 500
        if not aid or plan not in ("monthly", "yearly") or stars != need:
            raise ValueError("hosting")
        ar = requests.get(U(CA, aid), headers=H, timeout=60)
        ar.raise_for_status()
        app = aw(ar.json())
        if app.get("ownerId") != uid:
            raise PermissionError("owner")
        base = datetime.now(timezone.utc)
        if app.get("hostingPaidUntil"):
            try:
                base = max(base, datetime.fromisoformat(app["hostingPaidUntil"].replace("Z", "+00:00")))
            except ValueError:
                pass
        pu = (base + timedelta(days=365 if plan == "yearly" else 30)).isoformat().replace("+00:00", "Z")
        sp, fp = app.get("shopPayload"), app.get("freePayload")
        d = {
            "ownerId": uid,
            "appType": app.get("appType"),
            "title": app.get("title"),
            "slug": slug,
            "published": True,
            "shopPayload": sp if sp is None or isinstance(sp, str) else json.dumps(sp),
            "freePayload": fp if fp is None or isinstance(fp, str) else json.dumps(fp),
            "hostingPaidUntil": pu,
            "hostingPlan": plan,
        }
        url = U(CA, aid)
        pm = ['read("any")', f'read("user:{uid}")', f'update("user:{uid}")', f'delete("user:{uid}")']
        pr = requests.patch(url, headers=H, json={"data": d, "permissions": pm}, timeout=60)
        (requests.patch(url, headers=H, json={"data": d}, timeout=60) if not pr.ok else pr).raise_for_status()
    else:
        raise ValueError("type")
    requests.patch(U(CI, iid), headers=H, json={"data": {"status": "completed"}}, timeout=60).raise_for_status()


@bot.message_handler(content_types=["successful_payment"])
def paid(m):
    sp = m.successful_payment
    pid = (sp.invoice_payload or "").strip()
    if not pid:
        return
    try:
        it, _ = _get_intent(pid)
        if not it:
            raise ValueError("intent_not_found")
        if it.get("status") == "completed":
            bot.reply_to(m, "Готово: баланс или публикация обновлены. Вернитесь в мини-приложение.")
            return
        if it.get("status") != "pending":
            bot.reply_to(m, "Этот платёж уже обработан или отменён.")
            return
        if int(sp.total_amount or 0) != int(it.get("stars") or 0):
            logging.warning("paid amount mismatch intent=%s stars=%s paid=%s", pid, it.get("stars"), sp.total_amount)
            bot.reply_to(m, "Сумма платежа не совпадает с счётом.")
            return
        fulfill(it)
        bot.reply_to(m, "Готово: баланс или публикация обновлены. Вернитесь в мини-приложение.")
    except Exception:
        logging.exception("paid")
        try:
            requests.patch(U(CI, pid), headers=H, json={"data": {"status": "failed"}}, timeout=60)
        except Exception:
            pass
        bot.reply_to(m, "Ошибка зачисления — напишите в поддержку.")


@bot.message_handler(commands=["start"])
def start(m):
    a = (m.text or "").split(maxsplit=1)
    arg = (a[1].strip() if len(a) > 1 else "")[:64]
    if not arg:
        return bot.reply_to(m, "Откройте бота по ссылке из мини-приложения (там уже есть ID платежа).")
    try:
        it, found_col = _get_intent(arg)
        if not it:
            return bot.reply_to(
                m,
                f"Платёж не найден. Проверьте APPWRITE_COL_PAYMENT_INTENTS и endpoint (/v1). ID: {arg}",
            )
    except Exception:
        return bot.reply_to(m, "Платёж не найден.")
    logging.info("intent found id=%s collection=%s", arg, found_col)
    if it.get("status") != "pending":
        return bot.reply_to(m, "Этот платёж уже обработан.")
    te = (it.get("telegramUserId") or "").strip()
    if te and str(m.from_user.id) != te:
        return bot.reply_to(m, "Этот счёт выставлен другому Telegram-аккаунту.")
    stars, k = int(it.get("stars") or 0), it.get("type")
    if k == "topup":
        t, desc = "Пополнение баланса", f"{stars} ⭐ на баланс в конструкторе"
    elif k == "hosting":
        t, desc = "Публикация приложения", "Год размещения" if it.get("plan") == "yearly" else "Месяц размещения"
    else:
        return bot.reply_to(m, "Неизвестный тип платежа.")
    if not 1 <= stars <= 250000:
        return bot.reply_to(m, "Некорректная сумма.")
    bot.send_invoice(m.chat.id, t[:32], desc[:255], arg, "", "XTR", [types.LabeledPrice("Stars", stars)])


@bot.pre_checkout_query_handler(func=lambda q: True)
def pre(q):
    pid = (q.invoice_payload or "").strip()
    try:
        it, _ = _get_intent(pid)
        if not it:
            raise ValueError("intent_not_found")
    except Exception:
        return bot.answer_pre_checkout_query(q.id, ok=False, error_message="Платёж не найден.")
    te = (it.get("telegramUserId") or "").strip()
    if te and str(q.from_user.id) != te:
        return bot.answer_pre_checkout_query(q.id, ok=False, error_message="Другой аккаунт Telegram.")
    ok = it.get("status") == "pending" and int(q.total_amount) == int(it.get("stars") or 0)
    if ok:
        bot.answer_pre_checkout_query(q.id, ok=True)
    else:
        bot.answer_pre_checkout_query(q.id, ok=False, error_message="Сумма или статус не совпадают.")


if __name__ == "__main__":
    while True:
        try:
            bot.delete_webhook(drop_pending_updates=True)
            bot.infinity_polling(skip_pending=True, timeout=60)
        except ApiTelegramException as e:
            msg = str(e)
            if "Error code: 409" in msg or "terminated by other getUpdates request" in msg:
                logging.error("409 conflict: another bot instance/webhook is active. Retry in 10s...")
                time.sleep(10)
                continue
            raise
        except Exception:
            logging.exception("polling crashed; retry in 5s")
            time.sleep(5)
