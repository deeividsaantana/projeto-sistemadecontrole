import { getAdminDb, serverTimestamp } from './_shared/firebase-admin.js';

const CLOUD_COLLECTION = 'sistemarenea_cloud';
const RATE_LIMIT_COLLECTION = 'sistemarenea_rate_limits';
const MANIFEST_ID = 'main_data_v2';
const MINIMUM_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

const deleteInBatches = async (database, snapshots) => {
  let deleted = 0;
  for (let index = 0; index < snapshots.length; index += 400) {
    const batch = database.batch();
    const selection = snapshots.slice(index, index + 400);
    selection.forEach(snapshot => batch.delete(snapshot.ref));
    await batch.commit();
    deleted += selection.length;
  }
  return deleted;
};

export const handler = async () => {
  const database = getAdminDb();
  const manifestSnapshot = await database.collection(CLOUD_COLLECTION).doc(MANIFEST_ID).get();
  const activeChunkIds = new Set(
    Object.values(manifestSnapshot.data()?.chunks || {}).flatMap(ids => Array.isArray(ids) ? ids : []),
  );
  const cutoff = Date.now() - MINIMUM_ORPHAN_AGE_MS;

  const chunkSnapshot = await database.collection(CLOUD_COLLECTION).where('kind', '==', 'chunk').get();
  const orphanChunks = chunkSnapshot.docs.filter(snapshot => {
    if (activeChunkIds.has(snapshot.id)) return false;
    const updatedAt = Date.parse(String(snapshot.data()?.updatedAt || ''));
    return Number.isFinite(updatedAt) && updatedAt < cutoff;
  });

  const rateLimitSnapshot = await database.collection(RATE_LIMIT_COLLECTION).get();
  const expiredRateLimits = rateLimitSnapshot.docs.filter(snapshot => {
    const expiresAt = Date.parse(String(snapshot.data()?.expiresAtIso || ''));
    return Number.isFinite(expiresAt) && expiresAt < Date.now();
  });

  const [deletedChunks, deletedRateLimits] = await Promise.all([
    deleteInBatches(database, orphanChunks),
    deleteInBatches(database, expiredRateLimits),
  ]);

  await database.collection(CLOUD_COLLECTION).doc('cleanup_status').set({
    kind: 'maintenance',
    activeChunks: activeChunkIds.size,
    deletedChunks,
    deletedRateLimits,
    updatedAt: serverTimestamp(),
    updatedAtIso: new Date().toISOString(),
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, deletedChunks, deletedRateLimits }),
  };
};
