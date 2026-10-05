import { cloudProvider, isSupabaseCloudEnabled } from '../../../platform/cloudProvider';
import { getSupabaseClient } from '../../../supabase/client';

export type ServiceStatus = 'Ativo' | 'Suspenso' | 'Concluído';

export interface WorkService {
  id: string;
  projectId: string;
  code?: string;
  description: string;
  unit: string;
  plannedQuantity?: number;
  status: ServiceStatus;
  observation?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupabaseWorkServiceRow {
  id: string;
  project_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  quantidade_prevista: number | null;
  situacao: string;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const isServiceStatus = (value: string): value is ServiceStatus =>
  value === 'Ativo' || value === 'Suspenso' || value === 'Concluído';

export const normalizeSupabaseWorkServices = (
  rows: readonly SupabaseWorkServiceRow[],
  projectId: string,
): WorkService[] => rows
  .filter(row => Boolean(
    row.project_id === projectId
      && row.id
      && row.descricao
      && row.unidade
      && isServiceStatus(row.situacao),
  ))
  .map(row => ({
    id: row.id,
    projectId: row.project_id,
    code: row.codigo || undefined,
    description: row.descricao,
    unit: row.unidade,
    plannedQuantity: row.quantidade_prevista ?? undefined,
    status: row.situacao as ServiceStatus,
    observation: row.observacao || undefined,
    active: row.ativo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

const loadSupabaseWorkServices = async (projectId: string): Promise<WorkService[]> => {
  const { data, error } = await getSupabaseClient()
    .from('servicos_obra')
    .select('id, project_id, codigo, descricao, unidade, quantidade_prevista, situacao, observacao, ativo, created_at, updated_at')
    .eq('project_id', projectId)
    .order('descricao');
  if (error) throw error;
  return normalizeSupabaseWorkServices((data || []) as SupabaseWorkServiceRow[], projectId);
};

export const getWorkServicesByProject = async (projectId: string): Promise<WorkService[]> => {
  if (!isSupabaseCloudEnabled) return [];
  try {
    return await loadSupabaseWorkServices(projectId);
  } catch (error) {
    if (cloudProvider === 'supabase') throw error;
    console.warn('Serviços da obra Supabase indisponíveis; nenhum catálogo local foi aplicado.', error);
    return [];
  }
};
