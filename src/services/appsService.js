import { databases, ID, Query, Permission, Role, storage } from '../lib/appwriteClient';
import { guestDatabases, Query as GuestQuery } from '../lib/guestAppwrite';
import { config } from '../config';

const DB = () => config.databaseId;
const COL = () => config.appsCollectionId;

/**
 * @param {string} userId
 * @param {object} data
 */
export async function createAppDocument(userId, data) {
  const perms = [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
  return databases.createDocument(DB(), COL(), ID.unique(), serializeDoc(data), perms);
}

/**
 * @param {string} docId
 * @param {object} data
 * @param {string} userId
 * @param {boolean} published
 */
export async function updateAppDocument(docId, data, userId, published) {
  const perms = published
    ? [
        Permission.read(Role.any()),
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    : [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ];
  return databases.updateDocument(DB(), COL(), docId, serializeDoc(data), perms);
}

export async function deleteAppDocument(docId) {
  return databases.deleteDocument(DB(), COL(), docId);
}

export async function listMyApps(userId) {
  return databases.listDocuments(DB(), COL(), [Query.equal('ownerId', userId), Query.orderDesc('$createdAt')]);
}

export async function getAppById(docId) {
  const doc = await databases.getDocument(DB(), COL(), docId);
  return parseDoc(doc);
}

export async function getPublishedBySlug(slug) {
  const gdb = guestDatabases();
  const res = await gdb.listDocuments(DB(), COL(), [
    GuestQuery.equal('slug', slug),
    GuestQuery.equal('published', true),
    GuestQuery.limit(1),
  ]);
  if (!res.documents.length) return null;
  return parseDoc(res.documents[0]);
}

export async function isSlugTaken(slug, excludeDocId) {
  const res = await databases.listDocuments(DB(), COL(), [Query.equal('slug', slug), Query.limit(5)]);
  const others = res.documents.filter((d) => d.$id !== excludeDocId);
  return others.length > 0;
}

/**
 * @param {File} file
 */
export async function uploadImage(file) {
  if (!config.bucketImagesId) {
    throw new Error('Bucket не настроен (REACT_APP_APPWRITE_BUCKET_IMAGES_ID)');
  }
  return storage.createFile(config.bucketImagesId, ID.unique(), file);
}

export function getImagePreviewUrl(fileId) {
  if (!config.bucketImagesId || !fileId) return '';
  const base = config.appwriteEndpoint.replace(/\/$/, '');
  return `${base}/storage/buckets/${config.bucketImagesId}/files/${fileId}/view?project=${config.appwriteProjectId}`;
}

/** @param {string[]} fileIds */
export async function deleteStorageFiles(fileIds) {
  if (!config.bucketImagesId || !fileIds?.length) return;
  await Promise.all(
    fileIds.filter(Boolean).map((fid) => storage.deleteFile(config.bucketImagesId, fid).catch(() => {})),
  );
}

function serializeDoc(data) {
  return {
    ownerId: data.ownerId,
    appType: data.appType,
    title: data.title,
    slug: data.slug,
    published: !!data.published,
    shopPayload: data.shopPayload != null ? JSON.stringify(data.shopPayload) : null,
    freePayload: data.freePayload != null ? JSON.stringify(data.freePayload) : null,
    hostingPaidUntil: data.hostingPaidUntil ?? null,
    hostingPlan: data.hostingPlan ?? null,
  };
}

function parseDoc(doc) {
  return {
    $id: doc.$id,
    $createdAt: doc.$createdAt,
    $updatedAt: doc.$updatedAt,
    ownerId: doc.ownerId,
    appType: doc.appType,
    title: doc.title,
    slug: doc.slug,
    published: doc.published,
    shopPayload: parseJson(doc.shopPayload),
    freePayload: parseJson(doc.freePayload),
    hostingPaidUntil: doc.hostingPaidUntil || null,
    hostingPlan: doc.hostingPlan || null,
  };
}

function parseJson(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
