import type { ConferenciaManutencao, ControleEquipamentoDiario, EventoControleEquipamentoDiario, OrdemServico } from '../types';
import { horasParadasDoDia } from './horasParadasDoDia';
import { isOrdemEncerrada } from './manutencao';

export const OBSERVACAO_LIMITE = 'Encerrada pelo limite de 10 h paradas no dia.';

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
 * OS aberta cujo dia bateu 10 h fecha na hora do limite. O cálculo é o mesmo em
 * qualquer aparelho, então quem chegar primeiro grava e o resultado não muda.
 */
export const encerrarOrdensNoLimite = (
  registros: readonly ControleEquipamentoDiario[],
  ordens: readonly OrdemServico[],
  agora: Date,
  responsavel: string,
): { ordens: OrdemServico[]; encerradas: OrdemServico[] } => {
  const encerradas: OrdemServico[] = [];
  const proximas = ordens.map(ordem => {
    if (isOrdemEncerrada(ordem.status)) return ordem;
    const registro = registros.find(item => item.ordemServicoId === ordem.id
      && horasParadasDoDia(item, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, item) }).situacao === 'LIMITE_ATINGIDO');
    if (!registro) return ordem;
    const parada = horasParadasDoDia(registro, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, registro) });
    const fechada: OrdemServico = {
      ...ordem,
      status: 'Concluída',
      dataConclusao: registro.data,
      horaConclusao: parada.limiteAtingidoAs || undefined,
      horasParadas: parada.totalMin / 60,
      observacao: [ordem.observacao, OBSERVACAO_LIMITE].filter(Boolean).join(' '),
      atualizadoEm: agora.toISOString(),
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
): ControleEquipamentoDiario => {
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
  return decidir({
    ...registro,
    status: 'Disponível',
    horaLiberacao: hora,
    eventos: [...(registro.eventos || []), evento],
  }, 'LIBERACAO_INFORMADA', responsavel, agoraIso);
};
