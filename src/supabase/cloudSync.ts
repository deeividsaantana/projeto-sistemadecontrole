import { captureCloudBaseline, mergeCloudSnapshotsWithBaseline, resolvePublishPayload, type CloudBaseline } from '../cloudMerge';
import type { CloudData, CloudConnectionStatus, CloudDownloadResult, CloudUploadResult } from '../cloud/types';
import { protegerContraEncolhimento } from '../cloud/protecaoEncolhimento';
import { aplicarMudancasNasAssinaturas, calcularMudancas, capturarAssinaturas } from '../cloud/mudancasNuvem';
import { guardarAssinaturas, lerAssinaturas } from '../cloud/assinaturasGuardadas';
import { getSupabaseClient } from './client';
import { resolveSupabaseClientConfig } from './config';

const MAX_CONFLICT_ATTEMPTS = 4;

interface SnapshotRow {
  payload: CloudData;
  updated_at: string;
  record_count: number;
}

const countRecords = (data: CloudData) => Object.values(data).reduce<number>(
  (total, value) => total + (Array.isArray(value) ? value.length : 0),
  0,
);

const isVersionConflict = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('CLOUD_VERSION_CONFLICT');
};

const normalizeSupabaseError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String((error as { message?: unknown }).message || 'Falha no Supabase.'));
  }
  return new Error(String(error || 'Falha no Supabase.'));
};

export const getSupabaseConnectionStatus = async (): Promise<CloudConnectionStatus> => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { data, error } = await client
    .from('erp_snapshots')
    .select('updated_at')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error);
  return {
    connected: true,
    updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : '',
    schemaVersion: 1,
  };
};

export const downloadSupabaseBackup = async (): Promise<CloudDownloadResult> => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { data, error } = await client
    .from('erp_snapshots')
    .select('payload, updated_at, record_count')
    .eq('organization_id', organizationId)
    .maybeSingle<SnapshotRow>();

  if (error) throw normalizeSupabaseError(error);
  if (!data) return { data: null, source: 'none', updatedAt: '', totalRecords: 0 };
  // O próximo envio compara com esta versão e manda só o que mudou.
  void guardarAssinaturas(organizationId, capturarAssinaturas(data.payload, data.updated_at));
  return {
    data: data.payload,
    source: 'supabase',
    updatedAt: data.updated_at,
    totalRecords: data.record_count ?? countRecords(data.payload),
  };
};

const publishSnapshot = async (
  data: CloudData,
  knownCloudVersion: string,
): Promise<CloudUploadResult> => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { data: result, error } = await client.rpc('publish_erp_snapshot', {
    p_organization_id: organizationId,
    p_known_updated_at: knownCloudVersion || null,
    p_payload: data,
  });

  if (error) throw normalizeSupabaseError(error);
  const published = Array.isArray(result) ? result[0] : result;
  const updatedAt = String(published?.published_at || new Date().toISOString());
  void guardarAssinaturas(organizationId, capturarAssinaturas(data, updatedAt));
  return {
    updatedAt,
    totalRecords: Number(published?.total_records ?? countRecords(data)),
    writtenDocuments: 1,
    reusedDocuments: 0,
    publishedBaseline: captureCloudBaseline(data),
  };
};

// Fica falso na sessão se o banco ainda não tiver a função de envio por
// mudança: aí todo envio vai inteiro, como antes.
let envioPorMudancaDisponivel = true;

const funcaoAusente = (error: unknown) => {
  const texto = `${(error as { code?: unknown })?.code ?? ''} ${(error as { message?: unknown })?.message ?? ''}`;
  return texto.includes('PGRST202') || texto.includes('apply_erp_snapshot_changes') || texto.includes('CLOUD_SNAPSHOT_MISSING');
};

const mesmaVersao = (a: string, b: string) => Boolean(a) && Boolean(b) && (a === b || Date.parse(a) === Date.parse(b));

/**
 * Manda só o que mudou desde a versão que o aparelho conhece. Devolve null
 * quando não dá (sem assinaturas dessa versão, banco sem a função): aí quem
 * chama faz o envio inteiro.
 */
const enviarSoMudancas = async (data: CloudData, knownCloudVersion: string): Promise<CloudUploadResult | null> => {
  if (!envioPorMudancaDisponivel || !knownCloudVersion) return null;
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const assinaturas = await lerAssinaturas(organizationId);
  if (!assinaturas || !mesmaVersao(assinaturas.versao, knownCloudVersion)) return null;
  const calculo = calcularMudancas(data, assinaturas);
  // Saída em massa sem marca (navegador que perdeu a cópia) segue pelo envio
  // inteiro, que já sabe segurar a nuvem e trazer os registros de volta.
  if (!calculo || calculo.protegidas.length > 0) return null;
  const { mudancas, total } = calculo;

  if (total === 0) {
    return {
      updatedAt: knownCloudVersion,
      totalRecords: countRecords(data),
      writtenDocuments: 0,
      reusedDocuments: 1,
      publishedBaseline: captureCloudBaseline(data),
    };
  }

  const { data: result, error } = await getSupabaseClient().rpc('apply_erp_snapshot_changes', {
    p_organization_id: organizationId,
    p_changes: mudancas,
  });
  if (error) {
    if (funcaoAusente(error)) {
      envioPorMudancaDisponivel = false;
      return null;
    }
    throw normalizeSupabaseError(error);
  }
  const publicado = Array.isArray(result) ? result[0] : result;
  const updatedAt = String(publicado?.published_at || new Date().toISOString());
  const anterior = String(publicado?.previous_updated_at || '');
  const nuvemTinhaNovidades = !mesmaVersao(anterior, knownCloudVersion);
  // Se outro aparelho publicou no meio, a nuvem tem o que este não viu: as
  // assinaturas deixam de valer até o próximo download.
  void guardarAssinaturas(
    organizationId,
    nuvemTinhaNovidades ? null : aplicarMudancasNasAssinaturas(assinaturas, mudancas, updatedAt),
  );
  return {
    updatedAt,
    totalRecords: Number(publicado?.total_records ?? countRecords(data)),
    writtenDocuments: total,
    reusedDocuments: 0,
    publishedBaseline: captureCloudBaseline(data),
    ...(nuvemTinhaNovidades ? { nuvemTinhaNovidades } : {}),
  };
};

export const uploadSupabaseBackup = async (
  data: CloudData,
  knownCloudVersion = '',
  baseline?: CloudBaseline,
): Promise<CloudUploadResult> => {
  const soMudancas = await enviarSoMudancas(data, knownCloudVersion);
  if (soMudancas) return soMudancas;

  let payload = data;
  let expectedVersion = knownCloudVersion;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CONFLICT_ATTEMPTS; attempt += 1) {
    try {
      const remote = await downloadSupabaseBackup();
      if (remote.updatedAt && remote.updatedAt !== expectedVersion) {
        payload = resolvePublishPayload({
          localPayload: payload,
          remoteSnapshot: remote.data,
          remoteUpdatedAt: remote.updatedAt,
          knownCloudVersion: expectedVersion,
          baseline,
        }) as CloudData;
        expectedVersion = remote.updatedAt;
      }
      // Nunca publica por cima da nuvem uma tabela vazia ou muito menor sem
      // marca de exclusão: é o navegador que perdeu a cópia, não o usuário
      // que apagou. A base sai do retrato sem os devolvidos, para que o
      // próximo download os traga de volta para este aparelho.
      const { retrato, protegidas } = protegerContraEncolhimento(remote.data, payload);
      const result = await publishSnapshot(retrato as CloudData, expectedVersion);
      if (protegidas.length === 0) return result;
      console.warn('Envio teria apagado registros da nuvem; eles foram mantidos:', protegidas);
      return { ...result, publishedBaseline: captureCloudBaseline(payload), tabelasProtegidas: protegidas };
    } catch (error) {
      if (!isVersionConflict(error) || attempt === MAX_CONFLICT_ATTEMPTS) throw error;
      lastError = error;
      const remote = await downloadSupabaseBackup();
      payload = mergeCloudSnapshotsWithBaseline(remote.data, payload, baseline) as CloudData;
      expectedVersion = remote.updatedAt;
    }
  }

  throw normalizeSupabaseError(lastError);
};

