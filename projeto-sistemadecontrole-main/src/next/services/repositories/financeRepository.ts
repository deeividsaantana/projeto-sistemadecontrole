import { cloudProvider, isSupabaseCloudEnabled } from '../../../platform/cloudProvider';
import { readStoredJson } from '../../../data/localStore';
import { STORAGE_KEYS } from '../../../data/storageKeys';
import type { CategoriaCusto, LancamentoCusto, OrcamentoItem } from '../../../types';
import { getSupabaseClient } from '../../../supabase/client';

const CATEGORIAS_CUSTO: CategoriaCusto[] = [
  'Combustível',
  'Manutenção',
  'Material',
  'Locação',
  'Serviço de terceiro',
  'Mão de obra',
  'Outro',
];

const isCategoriaCusto = (value: string): value is CategoriaCusto => CATEGORIAS_CUSTO.includes(value as CategoriaCusto);

export interface SupabaseOrcamentoRow {
  id: string;
  project_id: string | null;
  competencia: string;
  categoria: string;
  valor_orcado: number;
  responsavel: string;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupabaseLancamentoCustoRow {
  id: string;
  project_id: string | null;
  fornecedor_id: string | null;
  data: string;
  categoria: string;
  descricao: string;
  valor: number;
  frente: string | null;
  documento: string | null;
  responsavel: string;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const normalizeSupabaseOrcamentos = (
  rows: readonly SupabaseOrcamentoRow[],
): OrcamentoItem[] => rows
  .filter(row => Boolean(row.id && row.competencia && isCategoriaCusto(row.categoria) && row.responsavel))
  .map(row => ({
    id: row.id,
    competencia: row.competencia,
    categoria: row.categoria as CategoriaCusto,
    valorOrcado: Number(row.valor_orcado),
    obraId: row.project_id || undefined,
    observacao: row.observacao || undefined,
    responsavel: row.responsavel,
    ativo: row.ativo,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  }));

export const normalizeSupabaseLancamentos = (
  rows: readonly SupabaseLancamentoCustoRow[],
): LancamentoCusto[] => rows
  .filter(row => Boolean(row.id && row.data && row.descricao && isCategoriaCusto(row.categoria) && row.responsavel))
  .map(row => ({
    id: row.id,
    data: row.data,
    categoria: row.categoria as CategoriaCusto,
    descricao: row.descricao,
    valor: Number(row.valor),
    obraId: row.project_id || undefined,
    frente: row.frente || undefined,
    fornecedorId: row.fornecedor_id || undefined,
    documento: row.documento || undefined,
    responsavel: row.responsavel,
    observacao: row.observacao || undefined,
    ativo: row.ativo,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  }));

const loadSupabaseFinance = async (organizationId: string) => {
  const client = getSupabaseClient();
  const [{ data: orcamentos, error: orcamentosError }, { data: lancamentos, error: lancamentosError }] = await Promise.all([
    client.from('orcamento_itens').select('id, project_id, competencia, categoria, valor_orcado, responsavel, observacao, ativo, created_at, updated_at').eq('organization_id', organizationId),
    client.from('lancamentos_custo').select('id, project_id, fornecedor_id, data, categoria, descricao, valor, frente, documento, responsavel, observacao, ativo, created_at, updated_at').eq('organization_id', organizationId),
  ]);
  if (orcamentosError) throw orcamentosError;
  if (lancamentosError) throw lancamentosError;
  return {
    orcamentos: normalizeSupabaseOrcamentos((orcamentos || []) as SupabaseOrcamentoRow[]),
    lancamentos: normalizeSupabaseLancamentos((lancamentos || []) as SupabaseLancamentoCustoRow[]),
  };
};

export const getFinanceByOrganization = async (organizationId: string) => {
  if (!isSupabaseCloudEnabled) {
    return {
      orcamentos: readStoredJson<OrcamentoItem[]>(window.localStorage, STORAGE_KEYS.orcamentoItens, []),
      lancamentos: readStoredJson<LancamentoCusto[]>(window.localStorage, STORAGE_KEYS.lancamentosCusto, []),
    };
  }
  try {
    return await loadSupabaseFinance(organizationId);
  } catch (error) {
    if (cloudProvider === 'supabase') throw error;
    console.warn('Orçamento e custos Supabase indisponíveis; usando cache local de homologação.', error);
    return {
      orcamentos: readStoredJson<OrcamentoItem[]>(window.localStorage, STORAGE_KEYS.orcamentoItens, []),
      lancamentos: readStoredJson<LancamentoCusto[]>(window.localStorage, STORAGE_KEYS.lancamentosCusto, []),
    };
  }
};
