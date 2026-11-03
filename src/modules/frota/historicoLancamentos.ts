import type { ControleEquipamentoDiario } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { GRUPO_DO_STATUS, type GrupoStatus } from './quadroFrota';

export interface FiltrosHistorico {
  /** Dia inicial (AAAA-MM-DD), incluso. Vazio = sem limite. */
  de: string;
  /** Dia final (AAAA-MM-DD), incluso. Vazio = sem limite. */
  ate: string;
  /** Prefixo, nome do motorista ou matrícula. */
  busca: string;
  situacao: GrupoStatus | 'todas';
}

export const FILTROS_HISTORICO_VAZIOS: FiltrosHistorico = { de: '', ate: '', busca: '', situacao: 'todas' };

export const temFiltroNoHistorico = (filtros: FiltrosHistorico) =>
  Boolean(filtros.de || filtros.ate || filtros.busca.trim() || filtros.situacao !== 'todas');

export function filtrarHistorico(registros: readonly ControleEquipamentoDiario[], filtros: FiltrosHistorico): ControleEquipamentoDiario[] {
  const termo = normalizeComparable(filtros.busca.trim());
  return registros
    .filter(item => (!filtros.de || item.data >= filtros.de) && (!filtros.ate || item.data <= filtros.ate))
    .filter(item => filtros.situacao === 'todas' || (GRUPO_DO_STATUS[item.status] ?? 'parado') === filtros.situacao)
    .filter(item => !termo || [item.prefixo, item.nomeMotorista, item.codigoFuncionario].some(valor => normalizeComparable(valor).includes(termo)))
    .sort((a, b) => b.data.localeCompare(a.data) || a.prefixo.localeCompare(b.prefixo, 'pt-BR'));
}
