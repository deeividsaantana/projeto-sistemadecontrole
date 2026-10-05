import { cloudProvider, isSupabaseCloudEnabled } from '../../../platform/cloudProvider';
import { readStoredJson } from '../../../data/localStore';
import { STORAGE_KEYS } from '../../../data/storageKeys';
import type { Material } from '../../../types';
import { getSupabaseClient } from '../../../supabase/client';

export interface SupabaseMaterialRow {
  id: string;
  codigo: string | null;
  descricao: string;
  categoria: string | null;
  unidade: string;
  fornecedor_padrao_id: string | null;
  estoque_minimo: number | null;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const normalizeSupabaseMateriais = (
  materiais: readonly SupabaseMaterialRow[],
): Material[] => materiais
  .filter(material => Boolean(material.id && material.descricao && material.unidade))
  .map(material => ({
    id: material.id,
    codigo: material.codigo || '',
    descricao: material.descricao,
    categoria: material.categoria || '',
    unidade: material.unidade,
    fornecedorPadraoId: material.fornecedor_padrao_id || undefined,
    estoqueMinimo: material.estoque_minimo ?? undefined,
    observacao: material.observacao || undefined,
    ativo: material.ativo,
    criadoEm: material.created_at,
    atualizadoEm: material.updated_at,
  }));

const loadSupabaseMateriais = async (organizationId?: string): Promise<Material[]> => {
  let query = getSupabaseClient()
    .from('materiais')
    .select('id, codigo, descricao, categoria, unidade, fornecedor_padrao_id, estoque_minimo, observacao, ativo, created_at, updated_at')
    .order('descricao');
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return normalizeSupabaseMateriais((data || []) as SupabaseMaterialRow[]);
};

export const getMateriais = async (organizationId?: string): Promise<Material[]> => {
  if (!isSupabaseCloudEnabled) return readStoredJson<Material[]>(window.localStorage, STORAGE_KEYS.materiaisCadastro, []);
  try {
    return await loadSupabaseMateriais(organizationId);
  } catch (error) {
    if (cloudProvider === 'supabase') throw error;
    console.warn('Materiais Supabase indisponíveis; usando catálogo local de homologação.', error);
    return readStoredJson<Material[]>(window.localStorage, STORAGE_KEYS.materiaisCadastro, []);
  }
};
