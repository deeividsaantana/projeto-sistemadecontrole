import { cleanString, functionErrorResponse, getSupabaseAdmin, jsonResponse, requireSupabaseUser } from './_shared/supabase-admin.js';
import { assertHttpMethod, httpError } from './_shared/api-security.js';
import { assertProcurementPermission, procurementActorFromStaff } from './_shared/procurement-authorization.js';
import { sincronizarUmaVez } from '../server/procurementSpreadsheetSyncJob.js';
import { enviarParaPlanilha, envioLigado, linhasValidas } from '../server/procurementSheetWrite.js';

// Abrir a aba lê a planilha de novo se a última leitura tem mais que isto.
const LEITURA_VELHA_MS = 2 * 60 * 1000;

const ultimaLeitura = async organizationId => {
  const { data } = await getSupabaseAdmin().from('erp_procurement_sync_runs').select('status, error_message, finished_at').eq('organization_id', organizationId).order('started_at', { ascending: false }).limit(1);
  return data?.[0] || null;
};

const espelho = async (organizationId, { limit = 2000, sheet = '' } = {}) => {
  let query = getSupabaseAdmin().from('erp_procurement_sheet_rows').select('*').eq('organization_id', organizationId).order('request_date', { ascending: false }).limit(limit);
  if (sheet) query = query.eq('sheet_name', sheet);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Falha na leitura fica registrada em erp_procurement_sync_runs; a tela mostra o espelho que já existe.
const lerPlanilha = () => sincronizarUmaVez().catch(() => undefined);

export const handler = async event => {
  try {
    const method = assertHttpMethod(event, ['GET', 'POST']);
    const staff = await requireSupabaseUser(event);
    assertProcurementPermission(procurementActorFromStaff(staff), 'view');
    const configurada = Boolean(process.env.PROCUREMENT_SPREADSHEET_URL);

    if (method === 'POST') {
      let corpo;
      try { corpo = JSON.parse(event.body || '{}'); } catch { throw httpError('Corpo inválido.', 400); }
      const linhas = linhasValidas(corpo.linhas);
      if (!linhas.length) throw httpError('Nada para enviar à planilha.', 400);
      const resultado = await enviarParaPlanilha(linhas);
      // Lê de novo para o espelho já trazer o que acabou de entrar.
      if (configurada) await lerPlanilha();
      return jsonResponse(200, { success: true, ...resultado, data: await espelho(staff.organizationId), lastRun: await ultimaLeitura(staff.organizationId), escrita: true });
    }

    const limit = Math.min(Math.max(Number(event.queryStringParameters?.limit) || 500, 1), 2000);
    const sheet = cleanString(event.queryStringParameters?.sheet, 40);
    const anterior = await ultimaLeitura(staff.organizationId);
    const velha = !anterior?.finished_at || Date.now() - new Date(anterior.finished_at).getTime() > LEITURA_VELHA_MS;
    if (configurada && velha) await lerPlanilha();
    return jsonResponse(200, { success: true, data: await espelho(staff.organizationId, { limit, sheet }), lastRun: await ultimaLeitura(staff.organizationId), escrita: envioLigado() });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
