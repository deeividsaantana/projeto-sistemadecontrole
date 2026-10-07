import type { HistoryLog } from '../types';

/** Tela em que os lançamentos manuais de ordem de serviço são registrados. */
const TELA_MANUTENCAO = 'Manutenção';

/**
 * Reconhece o número da OS dentro do texto livre do log. O limite à direita
 * evita que a OS-0001 puxe o registro da OS-00012 — os dois começam igual.
 */
const mencionaOrdem = (texto: string, numero: string) => {
  const escapado = numero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escapado}(?!\\d)`, 'i').test(texto);
};

/**
 * Os registros de manutenção espalhados pelo histórico geral do sistema.
 *
 * Inclui dois caminhos porque a ordem pode nascer de dois lugares: o gestor
 * abre pela tela de Manutenção, ou o controle diário da frota abre sozinho ao
 * marcar a máquina como parada. Para a oficina as duas são a mesma coisa — a
 * segunda ficava invisível quando o filtro olhava só o nome da tela.
 */
export const historicoDaManutencao = (logs: HistoryLog[]): HistoryLog[] =>
  logs.filter(log => (
    log.tela === TELA_MANUTENCAO
    || /\bOS-\d+/i.test(log.descricao || '')
  ));

/**
 * O histórico de uma ordem específica. O id do registro é mais confiável que o
 * texto, então ele vence quando está preenchido; o número serve de reserva
 * para os logs antigos, gravados antes da auditoria por id existir.
 */
export const historicoDaOrdem = (
  logs: HistoryLog[],
  numero: string,
  ordemId?: string,
): HistoryLog[] =>
  logs.filter(log => {
    if (ordemId && log.registroId) return log.registroId === ordemId;
    if (ordemId && !log.registroId) return false;
    return mencionaOrdem(log.descricao || '', numero);
  });
