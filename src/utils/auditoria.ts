import type { HistoryLog } from '../types';
import { normalizeComparable } from './canonicalIdentity';

/** Telas onde uma alteração muda dinheiro, contrato ou permissão. */
export const TELAS_SENSIVEIS = ['Medições', 'Custos', 'Orçamento', 'FVS', 'Usuários', 'Configurações', 'Não Conformidades'];

/** Ações que apagam ou tiram do ar um registro. */
export const ACOES_SENSIVEIS: HistoryLog['acao'][] = ['Excluiu', 'Inativou', 'Desmobilizou'];

const dataDoLog = (log: HistoryLog) => (log.timestamp || '').slice(0, 10);

export interface FiltrosAuditoria {
  inicio?: string;
  fim?: string;
  usuario?: string;
  tela?: string;
  acao?: HistoryLog['acao'] | '';
  busca?: string;
  somenteSensiveis?: boolean;
}

export const ehSensivel = (log: HistoryLog) =>
  ACOES_SENSIVEIS.includes(log.acao) || TELAS_SENSIVEIS.includes(log.tela);

export const filtrarLogs = (logs: HistoryLog[], filtros: FiltrosAuditoria) => {
  const termo = normalizeComparable(filtros.busca || '').trim();
  return logs
    .filter(log => {
      const data = dataDoLog(log);
      if (filtros.inicio && data && data < filtros.inicio) return false;
      if (filtros.fim && data && data > filtros.fim) return false;
      if (filtros.usuario && log.usuario !== filtros.usuario) return false;
      if (filtros.tela && log.tela !== filtros.tela) return false;
      if (filtros.acao && log.acao !== filtros.acao) return false;
      if (filtros.somenteSensiveis && !ehSensivel(log)) return false;
      if (!termo) return true;
      return normalizeComparable([log.acao, log.tela, log.usuario, log.descricao].join(' ')).includes(termo);
    })
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
};

export const contarPor = (logs: HistoryLog[], chave: (log: HistoryLog) => string) => {
  const mapa = new Map<string, number>();
  logs.forEach(log => {
    const grupo = chave(log) || '—';
    mapa.set(grupo, (mapa.get(grupo) || 0) + 1);
  });
  return [...mapa.entries()]
    .map(([grupo, quantidade]) => ({ grupo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
};

/**
 * Resumo do período. O log é a fonte: não existe contador salvo de "quantas
 * exclusões houve", que poderia divergir do histórico real.
 */
export const resumoAuditoria = (logs: HistoryLog[]) => ({
  total: logs.length,
  sensiveis: logs.filter(ehSensivel).length,
  exclusoes: logs.filter(log => log.acao === 'Excluiu').length,
  usuarios: new Set(logs.map(log => log.usuario)).size,
  telas: new Set(logs.map(log => log.tela)).size,
});

export const usuariosDosLogs = (logs: HistoryLog[]) =>
  [...new Set(logs.map(log => log.usuario).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const telasDosLogs = (logs: HistoryLog[]) =>
  [...new Set(logs.map(log => log.tela).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
