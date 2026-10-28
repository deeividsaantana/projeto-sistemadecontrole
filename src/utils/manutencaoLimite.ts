import type { ConferenciaManutencao, ControleEquipamentoDiario, EventoControleEquipamentoDiario, OrdemServico } from '../types';
import { horasParadasDoDia, marcosDoRegistro, type ParadaDoDia } from './horasParadasDoDia';
import { isOrdemEncerrada } from './manutencao';

export const OBSERVACAO_LIMITE = 'Encerrada pelo limite de 10 h paradas no dia.';
export const OBSERVACAO_CONFERENCIA = 'Concluída na conferência.';

/**
 * Primeiro dia em que a regra das 10 h fecha OS e cria continuidade sozinha.
 * Os dias anteriores (as OS abertas antes da regra) esperam a lista aprovada
 * pelo Deivid; depois da aprovação, baixar esta data num commit só dela.
 */
export const LIMITE_10H_DESDE = '2026-10-29';

const dataLocal = (momento: Date): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(momento);

export type ResultadoConferencia = { ok: true; registro: ControleEquipamentoDiario } | { ok: false; erro: string };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const somarDias = (data: string, dias: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const diaAnterior = (data: string) => somarDias(data, -1);

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
      .filter(item => item.ordemServicoId === ordem.id && item.data >= LIMITE_10H_DESDE)
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
  const idNovo = `evt-${agoraIso}-${registro.equipamentoId}-conferencia`;
  // Liberação lançada antes da primeira entrada do dia é o erro mais comum:
  // fica no histórico, marcada como substituída pela liberação informada.
  const marcos = marcosDoRegistro(registro);
  const primeiraEntrada = Array.isArray(marcos) ? marcos.find(marco => marco.tipo === 'entrada') : undefined;
  const substituidos = new Set(Array.isArray(marcos) && primeiraEntrada
    ? marcos.filter(marco => marco.tipo === 'liberacao' && marco.eventoId && marco.hora < primeiraEntrada.hora).map(marco => marco.eventoId)
    : []);
  const eventosAnteriores = (registro.eventos || []).map(item => (substituidos.has(item.id) ? { ...item, substituidoPor: idNovo } : item));
  const evento: EventoControleEquipamentoDiario = {
    id: idNovo,
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
    eventos: [...eventosAnteriores, evento],
  }, 'LIBERACAO_INFORMADA', responsavel, agoraIso);
  const parada: ParadaDoDia = horasParadasDoDia(candidato, new Date(agoraIso));
  if (parada.situacao === 'INCONSISTENTE') return { ok: false, erro: parada.motivoInconsistencia || 'Horário inconsistente.' };
  return { ok: true, registro: candidato };
};

/** Horas da OS: soma dos dias dela, cada um já limitado a 10 h; dia inconsistente não soma. */
export const horasDaOrdem = (
  ordem: Pick<OrdemServico, 'id'>,
  registros: readonly ControleEquipamentoDiario[],
  agora: Date,
): number => {
  const minutos = registros
    .filter(item => item.ordemServicoId === ordem.id)
    .reduce((total, item) => total + horasParadasDoDia(item, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, item) }).totalMin, 0);
  return Number((minutos / 60).toFixed(2));
};

/**
 * Dias decididos como "continua parado amanhã" cujo dia seguinte já começou
 * e ainda não tem lançamento do equipamento: quem chama cria a entrada das
 * 07:00, e a OS nova abre pelo caminho de sempre.
 */
export const pendentesDeContinuidade = (
  registros: readonly ControleEquipamentoDiario[],
  agora: Date,
): ControleEquipamentoDiario[] => {
  const hoje = dataLocal(agora);
  const ativos = registros.filter(item => !(item as { excluido?: unknown }).excluido);
  return ativos.filter(item => {
    if (item.conferenciaManutencao?.decisao !== 'CONTINUA_AMANHA' || item.data < LIMITE_10H_DESDE) return false;
    const seguinte = somarDias(item.data, 1);
    return seguinte <= hoje && !ativos.some(outro => outro.equipamentoId === item.equipamentoId && outro.data === seguinte);
  });
};

/**
 * Depois de uma decisão da conferência, refaz a OS que fechou pelo limite:
 * horas pela soma dos dias e, se o dia do fechamento deixou de bater 10 h,
 * a conclusão passa para a liberação informada. Devolve null quando nada muda.
 */
export const recalcularOrdemDoLimite = (
  ordem: OrdemServico,
  registros: readonly ControleEquipamentoDiario[],
  agora: Date,
): OrdemServico | null => {
  if (!(ordem.observacao || '').includes(OBSERVACAO_LIMITE)) return null;
  const horasParadas = horasDaOrdem(ordem, registros, agora);
  const doDia = registros.find(item => item.ordemServicoId === ordem.id && item.data === ordem.dataConclusao);
  const parada = doDia ? horasParadasDoDia(doDia, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, doDia) }) : undefined;
  const saiuDoLimite = parada && parada.situacao !== 'LIMITE_ATINGIDO' && parada.situacao !== 'INCONSISTENTE';
  const fim = saiuDoLimite ? parada.periodos.at(-1)?.fim : null;
  const proxima: OrdemServico = {
    ...ordem,
    horasParadas,
    ...(saiuDoLimite && fim ? {
      horaConclusao: fim,
      observacao: ordem.observacao.replace(OBSERVACAO_LIMITE, OBSERVACAO_CONFERENCIA),
    } : {}),
  };
  const mudou = proxima.horasParadas !== ordem.horasParadas || proxima.horaConclusao !== ordem.horaConclusao || proxima.observacao !== ordem.observacao;
  return mudou ? proxima : null;
};
