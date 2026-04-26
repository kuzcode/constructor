import { databases, Permission, Role } from '../lib/appwriteClient';
import { config } from '../config';

const DB = () => config.databaseId;
const COL = () => config.walletsCollectionId;

function perms(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
  ];
}

export async function getWalletDocument(userId) {
  if (!COL() || !userId) return null;
  try {
    return await databases.getDocument(DB(), COL(), userId);
  } catch {
    return null;
  }
}

export async function getOrCreateWallet(userId) {
  if (!COL() || !userId) {
    return { balanceStars: 0 };
  }
  const existing = await getWalletDocument(userId);
  if (existing) {
    return { balanceStars: Math.max(0, Number(existing.balanceStars) || 0), $id: existing.$id };
  }
  try {
    const doc = await databases.createDocument(DB(), COL(), userId, { userId, balanceStars: 0 }, perms(userId));
    return { balanceStars: 0, $id: doc.$id };
  } catch (e) {
    const again = await getWalletDocument(userId);
    if (again) return { balanceStars: Math.max(0, Number(again.balanceStars) || 0), $id: again.$id };
    throw e;
  }
}

export async function addStarsToWallet(userId, delta) {
  if (!COL() || !userId) return;
  const d = Math.floor(Number(delta) || 0);
  if (d <= 0) return;
  const w = await getOrCreateWallet(userId);
  const cur = w.balanceStars || 0;
  await databases.updateDocument(DB(), COL(), userId, {
    balanceStars: cur + d,
  });
}

export async function spendStarsFromWallet(userId, delta) {
  if (!COL() || !userId) throw new Error('Кошелёк не настроен');
  const d = Math.max(1, Math.floor(Number(delta) || 0));
  const w = await getOrCreateWallet(userId);
  const cur = Math.max(0, Number(w.balanceStars) || 0);
  if (cur < d) {
    throw new Error(`Недостаточно Stars на балансе (${cur} ⭐)`);
  }
  await databases.updateDocument(DB(), COL(), userId, {
    balanceStars: cur - d,
  });
  return { balanceStars: cur - d };
}
