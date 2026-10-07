import { cloudProvider, isSupabaseCloudEnabled } from '../../../platform/cloudProvider';
import { readStoredJson } from '../../../data/localStore';
import { STORAGE_KEYS } from '../../../data/storageKeys';
import type { Funcionario } from '../../../types';
import { getSupabaseClient } from '../../../supabase/client';

export interface SupabaseFuncionarioRow {
  id: string;
  matricula: string | null;
  nome: string;
  cargo: string;
  telefone: string;
  empresa_id: string | null;
  ativo: boolean;
  lider_matricula: string | null;
  lider_nome: string | null;
  area: string | null;
  responsavel_area: string | null;
  divisao: string | null;
  secao: string | null;
  status: string | null;
  data_mobilizacao: string | null;
  data_desmobilizacao: string | null;
  situacao_rh: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_FUNCIONARIO: Funcionario['status'][] = [
  'ATIVO', 'INATIVO', 'FÉRIAS', 'AFASTADO', 'DESMOBILIZADO',
];

const normalizeStatus = (status: string | null): Funcionario['status'] =>
  STATUS_FUNCIONARIO.includes(status as Funcionario['status'])
    ? status as Funcionario['status']
    : undefined;

export const normalizeSupabaseFuncionarios = (
  rows: readonly SupabaseFuncionarioRow[],
): Funcionario[] => rows
  .filter(row => Boolean(row.id && row.nome))
  .map(row => {
    const funcionario: Funcionario = {
      id: row.id,
      nome: row.nome,
      cargo: row.cargo,
      telefone: row.telefone,
      empresaId: row.empresa_id || '',
      ativo: row.ativo,
      criadoEm: row.created_at,
      atualizadoEm: row.updated_at,
    };

    if (row.matricula) funcionario.matricula = row.matricula;
    if (row.lider_matricula) funcionario.liderMatricula = row.lider_matricula;
    if (row.lider_nome) funcionario.liderNome = row.lider_nome;
    if (row.area) funcionario.area = row.area;
    if (row.responsavel_area) funcionario.responsavelArea = row.responsavel_area;
    if (row.divisao) funcionario.divisao = row.divisao;
    if (row.secao) funcionario.secao = row.secao;
    const status = normalizeStatus(row.status);
    if (status) funcionario.status = status;
    if (row.data_mobilizacao) funcionario.dataMobilizacao = row.data_mobilizacao;
    if (row.data_desmobilizacao) funcionario.dataDesmobilizacao = row.data_desmobilizacao;
    if (row.situacao_rh) funcionario.situacaoRh = row.situacao_rh;
    if (row.observacao) funcionario.observacao = row.observacao;

    return funcionario;
  });

const loadSupabaseFuncionarios = async (organizationId: string): Promise<Funcionario[]> => {
  const { data, error } = await getSupabaseClient()
    .from('funcionarios')
    .select('id, matricula, nome, cargo, telefone, empresa_id, ativo, lider_matricula, lider_nome, area, responsavel_area, divisao, secao, status, data_mobilizacao, data_desmobilizacao, situacao_rh, observacao, created_at, updated_at')
    .eq('organization_id', organizationId)
    .order('nome');
  if (error) throw error;
  return normalizeSupabaseFuncionarios((data || []) as SupabaseFuncionarioRow[]);
};

export const getFuncionariosByOrganization = async (organizationId: string): Promise<Funcionario[]> => {
  if (!isSupabaseCloudEnabled) {
    return readStoredJson<Funcionario[]>(window.localStorage, STORAGE_KEYS.funcionarios, []);
  }
  try {
    return await loadSupabaseFuncionarios(organizationId);
  } catch (error) {
    if (cloudProvider === 'supabase') throw error;
    console.warn('Funcionários Supabase indisponíveis; usando cache local de homologação.', error);
    return readStoredJson<Funcionario[]>(window.localStorage, STORAGE_KEYS.funcionarios, []);
  }
};
