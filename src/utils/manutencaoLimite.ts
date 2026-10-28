import type { ConferenciaManutencao, ControleEquipamentoDiario, EventoControleEquipamentoDiario, OrdemServico } from '../types';
import { horasParadasDoDia, type ParadaDoDia } from './horasParadasDoDia';
import { isOrdemEncerrada } from './manutencao';

export const OBSERVACAO_LIMITE = 'Encerrada pelo limite de 10 h paradas no dia.';

export type ResultadoConferencia = { ok: true; registro: ControleEquipamentoDiario } | { ok: false; erro: string };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const diaAnterior = (data: string) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export const vemParadoDeOntem = (registros: readonly ControleEquipamentoDiario[], registro: ControleEquipamentoDiario): boolean => {
  const ontem = diaAnterior(registro.data);
  return registros.some(item => item.equipamentoId === registro.equipamentoId && item.data === ontem
    && item.conferenciaManutencao?.decisao === 'CONTINUA_AMANHA');
};

/**
 * Fecha OS aberta cujo dia bateu 10 h, na hora do limite. Quem chama grava no histórico
 * quem disparou o fechamento.
 */
export const encerrarOrdensNoLimite = (
  registros: readonly ControleEquipamentoDiario[],
  ordens: readonly OrdemServico[],
  agora: Date,
): { ordens: OrdemServico[]; encerradas: OrdemServico[] } => {
  const encerradas: OrdemServico[] = [];
  const proximas = ordens.map(ordem => {
    if (isOrdemEncerrada(ordem.status)) return ordem;
    // Mais de um dia da mesma OS pode bater o limite: vale o primeiro dia, independente da ordem do array.
    const limites = registros
      .filter(item => item.ordemServicoId === ordem.id)
      .map(item => ({ registro: item, parada: horasParadasDoDia(item, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, item) }) }))
      .filter(({ parada }) => parada.situacao === 'LIMITE_ATINGIDO')
      .sort((a, b) => a.registro.data.localeCompare(b.registro.data) || a.registro.id.localeCompare(b.registro.id));
    const primeiro = limites[0];
    if (!primeiro) return ordem;
    const { registro, parada } = primeiro;
    const fechada: OrdemServico = {
      ...ordem,
      status: 'Concluída',
      dataConclusao: registro.data,
      horaConclusao: parada.limiteAtingidoAs || undefined,
      horasParadas: parada.totalMin / 60,
      observacao: [ordem.observacao, OBSERVACAO_LIMITE].filter(Boolean).join(' '),
      atualizadoEm: new Date(`${registro.data}T${parada.limiteAtingidoAs}:00-03:00`).toISOString(),
    };
    encerradas.push(fechada);
    return fechada;
  });
  return { ordens: encerradas.length ? proximas : [...ordens], encerradas };
};

const decidir = (
  registro: ControleEquipamentoDiario,
  decisao: ConferenciaManutencao['decisao'],
  responsavel: string,
  agoraIso: string,
): ControleEquipamentoDiario => ({
  ...registro,
  conferenciaManutencao: { decisao, decididoEm: agoraIso, decididoPor: responsavel },
  atualizadoEm: agoraIso,
});

export const confirmarDezHoras = (registro: ControleEquipamentoDiario, responsavel: string, agoraIso: string) =>
  decidir(registro, 'CONFIRMADO_10H', responsavel, agoraIso);

export const continuaParadoAmanha = (registro: ControleEquipamentoDiario, responsavel: string, agoraIso: string) =>
  decidir(registro, 'CONTINUA_AMANHA', responsavel, agoraIso);

export const informarLiberacaoReal = (
  registro: ControleEquipamentoDiario,
  hora: string,
  responsavel: string,
  agoraIso: string,
): ResultadoConferencia => {
  if (!HORA.test(hora)) return { ok: false, erro: 'Informe a hora no formato HH:MM.' };
  const evento: EventoControleEquipamentoDiario = {
    id: `evt-${agoraIso}-${registro.equipamentoId}-conferencia`,
    ocorridoEm: agoraIso,
    hora,
    tipo: 'LIBERACAO_MANUTENCAO',
    statusAnterior: registro.status,
    statusNovo: 'Disponível',
    observacao: 'Liberação informada na conferência.',
    responsavel,
  };
  const candidato = decidir({
    ...registro,
    status: 'Disponível',
    horaLiberacao: hora,
    eventos: [...(registro.eventos || []), evento],
  }, 'LIBERACAO_INFORMADA', responsavel, agoraIso);
  const parada: ParadaDoDia = horasParadasDoDia(candidato, new Date(agoraIso));
  if (parada.situacao === 'INCONSISTENTE') return { ok: false, erro: parada.motivoInconsistencia || 'Horário inconsistente.' };
  return { ok: true, registro: candidato };
};
