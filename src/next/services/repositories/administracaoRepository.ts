import { STORAGE_KEYS } from '../../../data/storageKeys';
import { readStoredJson } from '../../../data/localStore';
import type { Empresa, EtapaServico, Funcionario } from '../../../types';
import { cloudProvider, isSupabaseCloudEnabled } from '../../../platform/cloudProvider';
import { getSupabaseClient } from '../../../supabase/client';

/**
 * Mesma estratégia do dashboardRepository: lê o cache local resiliente que
 * o app atual já usa. Quando os cadastros migrarem para o Supabase, só a
 * implementação destas funções muda — a assinatura fica igual.
 */
const readCollection = <T,>(storageKey: string): T[] => readStoredJson<T[]>(window.localStorage, storageKey, []);

export const getPessoas = (): Funcionario[] =>
  readCollection<Funcionario>(STORAGE_KEYS.funcionarios).filter(item => item.ativo);

export interface SupabaseEtapaServicoRow {
  id: string;
  nome: string;
}

export const normalizeSupabaseEtapas = (
  etapas: readonly SupabaseEtapaServicoRow[],
): EtapaServico[] => etapas
  .filter(etapa => Boolean(etapa.id && etapa.nome))
  .map(etapa => ({ id: etapa.id, nome: etapa.nome }));

const loadSupabaseEtapas = async (): Promise<EtapaServico[]> => {
  const { data, error } = await getSupabaseClient()
    .from('etapas_servico')
    .select('id, nome')
    .order('nome');
  if (error) throw error;
  return normalizeSupabaseEtapas((data || []) as SupabaseEtapaServicoRow[]);
};

export const getRamos = async (): Promise<EtapaServico[]> => {
  if (!isSupabaseCloudEnabled) return readCollection<EtapaServico>(STORAGE_KEYS.etapas);
  try {
    return await loadSupabaseEtapas();
  } catch (error) {
    if (cloudProvider === 'supabase') throw error;
    console.warn('Etapas Supabase indisponíveis; usando catálogo local de homologação.', error);
    return readCollection<EtapaServico>(STORAGE_KEYS.etapas);
  }
};

/**
 * Fornecedor = empresa cujo `tipos` inclui 'FORNECEDOR'. As subclasses
 * (LOCACAO_EQUIPAMENTOS, MATERIAIS) também vivem em `tipos` — uma empresa
 * pode acumular as duas. Sem nenhuma das duas, o fornecedor aparece em
 * "Não classificados": nunca vira uma categoria por suposição.
 */
export type CategoriaFornecedor = 'Locação de equipamentos' | 'Materiais' | 'Não classificado';

export interface FornecedorPorCategoria {
  categoria: CategoriaFornecedor;
  empresas: Empresa[];
}

export interface SupabaseParceiroRow {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  responsavel: string | null;
  tipos: string[] | null;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
  updated_at: string;
}

export const normalizeSupabaseParceiros = (
  parceiros: readonly SupabaseParceiroRow[],
): Empresa[] => parceiros
  .filter(parceiro => Boolean(parceiro.id && parceiro.nome))
  .map(parceiro => ({
    id: parceiro.id,
    nome: parceiro.nome,
    cnpj: parceiro.cnpj || '',
    telefone: parceiro.telefone || '',
    responsavel: parceiro.responsavel || '',
    tipos: (parceiro.tipos || []).filter(tipo => [
      'EMPRESA', 'FORNECEDOR', 'GERADOR', 'ACEITANTE', 'TRANSPORTADORA',
      'LOCACAO_EQUIPAMENTOS', 'MATERIAIS',
    ].includes(tipo)) as Empresa['tipos'],
    status: parceiro.status,
    criadoEm: parceiro.created_at,
    atualizadoEm: parceiro.updated_at,
  }));

const loadSupabaseParceiros = async (): Promise<Empresa[]> => {
  const { data, error } = await getSupabaseClient()
    .from('parceiros')
    .select('id, nome, cnpj, telefone, responsavel, tipos, status, created_at, updated_at')
    .contains('tipos', ['FORNECEDOR'])
    .order('nome');
  if (error) throw error;
  return normalizeSupabaseParceiros((data || []) as SupabaseParceiroRow[]);
};

const buildFornecedoresPorCategoria = (empresas: readonly Empresa[]): FornecedorPorCategoria[] => {
  const fornecedores = empresas.filter(item => item.tipos?.includes('FORNECEDOR'));

  const locacao = fornecedores.filter(item => item.tipos?.includes('LOCACAO_EQUIPAMENTOS'));
  const materiais = fornecedores.filter(item => item.tipos?.includes('MATERIAIS'));
  const naoClassificado = fornecedores.filter(item => !item.tipos?.includes('LOCACAO_EQUIPAMENTOS') && !item.tipos?.includes('MATERIAIS'));

  return [
    { categoria: 'Locação de equipamentos', empresas: locacao },
    { categoria: 'Materiais', empresas: materiais },
    { categoria: 'Não classificado', empresas: naoClassificado },
  ];
};

export const getFornecedoresPorCategoria = async (): Promise<FornecedorPorCategoria[]> => {
  if (!isSupabaseCloudEnabled) return buildFornecedoresPorCategoria(readCollection<Empresa>(STORAGE_KEYS.empresas));
  try {
    return buildFornecedoresPorCategoria(await loadSupabaseParceiros());
  } catch (error) {
    if (cloudProvider === 'supabase') throw error;
    console.warn('Parceiros Supabase indisponíveis; usando catálogo local de homologação.', error);
    return buildFornecedoresPorCategoria(readCollection<Empresa>(STORAGE_KEYS.empresas));
  }
};
