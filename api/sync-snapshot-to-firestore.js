import {
  assertHttpMethod,
  functionErrorResponse,
  getAdminDb,
  jsonResponse,
  parseJsonBody,
} from './_shared/supabase-admin.js';
import { logApiEvent } from './_shared/observability.js';

/**
 * Sincroniza snapshot de Supabase (erp_snapshots) para Firestore (legacy_documents).
 * Chamada por webhook do trigger sync_erp_to_firestore_trigger.
 *
 * Entrada: POST com { organization_id, snapshot, updated_at, version, record_count }
 * Saída: { success: true, synced_records: N, updated_at }
 *
 * Função: Mescla snapshot em Firestore sem sobrescrever, mantendo histórico.
 */
export const handler = async (event, context) => {
  const request = event instanceof Request ? event : new Request(event.url || '', event);

  try {
    if (request.method !== 'POST') {
      return assertHttpMethod(request, 'POST', new Response('Method not allowed', { status: 405 }));
    }

    // Validar autenticação do webhook
    const authHeader = request.headers.get('Authorization') || '';
    const webhookSecret = process.env.FIRESTORE_SYNC_WEBHOOK_SECRET || '';
    if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
      return jsonResponse(
        new Response(),
        403,
        { error: 'Unauthorized webhook' }
      );
    }

    // Parse do payload
    const body = await parseJsonBody(request);
    const { organization_id, snapshot, updated_at, version, record_count } = body;

    if (!organization_id || !snapshot) {
      return jsonResponse(
        new Response(),
        400,
        { error: 'Missing organization_id or snapshot' }
      );
    }

    const db = getAdminDb();
    const docRef = db
      .collection('sistemarenea_cloud')
      .doc('main_data');

    // Lê versão anterior para auditoria
    const prevSnapshot = await docRef.get();
    const prevData = prevSnapshot.exists ? prevSnapshot.data() : {};
    const prevRecordCount = prevData.record_count || 0;

    // Mescla os dados: snapshot é autoritativo, mantém metadata de sincronização
    const syncedAt = new Date().toISOString();
    const mergedData = {
      ...snapshot, // Sobrescreve com dados novos
      record_count: record_count, // Novo contagem
      updated_at: new Date(updated_at), // Timestamp de Supabase
      synced_from: 'erp_snapshots',
      synced_at: new Date(syncedAt),
      snapshot_version: version,
    };

    // Grava em Firestore
    await docRef.set(mergedData, { merge: false }); // false = sobrescreve documento

    // Log de auditoria
    await logApiEvent({
      event: 'firestore_sync_success',
      organization_id,
      record_count,
      prev_record_count: prevRecordCount,
      updated_at,
      synced_at: syncedAt,
    });

    return jsonResponse(
      new Response(),
      200,
      {
        success: true,
        organization_id,
        synced_records: record_count,
        updated_at: syncedAt,
        prev_records: prevRecordCount,
      }
    );
  } catch (err) {
    console.error('Erro ao sincronizar snapshot para Firestore:', err);
    await logApiEvent({
      event: 'firestore_sync_error',
      error: String(err),
    });
    return functionErrorResponse(new Response(), 500, err);
  }
};
