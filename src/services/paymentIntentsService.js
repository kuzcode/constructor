import { databases, ID, Permission, Role } from '../lib/appwriteClient';
import { config } from '../config';

const DB = () => config.databaseId;
const COL = () => config.paymentIntentsCollectionId;

function assertCol() {
  if (!COL()) {
    throw new Error('Задайте REACT_APP_APPWRITE_COL_PAYMENT_INTENTS_ID (коллекция payment_intents)');
  }
}

/**
 * @param {{ userId: string, stars: number, telegramUserId?: string }} p
 */
export async function createTopUpIntent({ userId, stars, telegramUserId }) {
  assertCol();
  const n = Math.max(1, Math.floor(Number(stars) || 0));
  return databases.createDocument(
    DB(),
    COL(),
    ID.unique(),
    {
      userId,
      type: 'topup',
      stars: n,
      status: 'pending',
      telegramUserId: telegramUserId || '',
    },
    [Permission.read(Role.user(userId))],
  );
}

/**
 * @param {{ userId: string, appId: string, plan: 'monthly'|'yearly', slug: string, stars: number, appType: string, telegramUserId?: string, baseStars?: number, discountStars?: number, promoCode?: string }} p
 */
export async function createHostingIntent({
  userId,
  appId,
  plan,
  slug,
  stars,
  appType,
  telegramUserId,
  baseStars,
  discountStars,
  promoCode,
}) {
  assertCol();
  const n = Math.max(1, Math.floor(Number(stars) || 0));
  return databases.createDocument(
    DB(),
    COL(),
    ID.unique(),
    {
      userId,
      type: 'hosting',
      stars: n,
      baseStars: Math.max(1, Math.floor(Number(baseStars) || n)),
      discountStars: Math.max(0, Math.floor(Number(discountStars) || 0)),
      promoCode: String(promoCode || ''),
      status: 'pending',
      appId,
      plan,
      slug,
      appType,
      telegramUserId: telegramUserId || '',
    },
    [Permission.read(Role.user(userId))],
  );
}

export async function getPaymentIntentById(intentId) {
  assertCol();
  return databases.getDocument(DB(), COL(), intentId);
}
