import type { ConferenciaManutencao, ControleEquipamentoDiario, EventoControleEquipamentoDiario, OrdemServico } from '../types';
import { horasParadasDoDia, marcosDoRegistro, type ParadaDoDia } from './horasParadasDoDia';
import { isOrdemEncerrada } from './manutencao';

export const OBSERVACAO_LIMITE = 'Encerrada pelo limite de 10 h paradas no dia.';
export const OBSERVACAO_CONFERENCIA = 'Concluída na conferência.';
export const OBSERVACAO_ALEM_DO_LIMITE = 'Reaberta: segue além de 10 h; fecha quando a oficina concluir.';

const EM_MANUTENCAO = new Set(['Em manutenção', 'Aguardando manutenção']);

/**
 * Primeiro dia em que a regra das 10 h fecha OS e cria continuidade sozinha.
 * Os dias anteriores (as OS abertas antes da regra) esperam a lista aprovada
 * pelo Deivid; depois da aprovação, baixar esta data num commit só dela.
 */
export const LIMITE_10H_DESDE = '2026-10-29';

/**
 * Primeiro dia em que o equipamento em manutenção sem liberação passa sozinho
 * para o dia seguinte, sem decisão da conferência. Os dias antes dele só
 * continuam com "Continua amanhã": a regra nova não volta no tempo criando um
 * lançamento por dia desde LIMITE_10H_DESDE.
 */
export const CONTINUIDADE_AUTOMATICA_DESDE = '2026-11-04';

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

/** Segue contando além de 10 h: o dia fica sem teto e a OS não fecha sozinha até a liberação. */
export const continuarAlemDoLimite = (registro: ControleEquipamentoDiario, responsavel: string, agoraIso: string): ControleEquipamentoDiario => ({
  ...registro,
  continuaAlemDoLimite: { decididoEm: agoraIso, decididoPor: responsavel },
  atualizadoEm: agoraIso,
});

/** Desfaz "continuar além de 10 h": o teto volta e a OS pode fechar de novo no limite. */
export const voltarARegraDasDezHoras = (registro: ControleEquipamentoDiario, _responsavel: string, agoraIso: string): ControleEquipamentoDiario => {
  const { continuaAlemDoLimite: _decisao, ...resto } = registro;
  return { ...resto, atualizadoEm: agoraIso };
};

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

/** Horas da OS: soma dos dias dela, cada um limitado a 10 h salvo quem segue além; dia inconsistente não soma. */
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

/** Como horasDaOrdem, mas OS sem nenhum dia lançado fica sem número (ausência não vira zero). */
export const horasMedidasDaOrdem = (
  ordem: Pick<OrdemServico, 'id'>,
  registros: readonly ControleEquipamentoDiario[],
  agora: Date,
): number | undefined => (registros.some(item => item.ordemServicoId === ordem.id) ? horasDaOrdem(ordem, registros, agora) : undefined);

/**
 * Dias que terminaram com o equipamento em manutenção (ou decididos como
 * "continua parado amanhã") cujo dia seguinte já começou e ainda não tem
 * lançamento do equipamento: quem chama cria a entrada das 07:00. Fica de
 * fora só quem a conferência fechou ("Confirmado 10 h" ou "Liberação informada").
 */
export const pendentesDeContinuidade = (
  registros: readonly ControleEquipamentoDiario[],
  agora: Date,
): ControleEquipamentoDiario[] => {
  const hoje = dataLocal(agora);
  const ativos = registros.filter(item => !(item as { excluido?: unknown }).excluido);
  return ativos.filter(item => {
    if (item.data < LIMITE_10H_DESDE) return false;
    const decisao = item.conferenciaManutencao?.decisao;
    if (decisao !== 'CONTINUA_AMANHA' && (decisao || !EM_MANUTENCAO.has(item.status) || item.data < CONTINUIDADE_AUTOMATICA_DESDE)) return false;
    const seguinte = somarDias(item.data, 1);
    // Lançamento excluído do dia seguinte conta como existente: a continuidade nunca ressuscita o que alguém apagou.
    return seguinte <= hoje && !registros.some(outro => outro.equipamentoId === item.equipamentoId && outro.data === seguinte);
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
  // Decidiram continuar além de 10 h: a OS que fechou no limite volta a ficar aberta até a liberação.
  if (doDia?.continuaAlemDoLimite && isOrdemEncerrada(ordem.status)) {
    return {
      ...ordem,
      status: 'Em Andamento',
      dataConclusao: undefined,
      horaConclusao: undefined,
      horasParadas,
      observacao: ordem.observacao.replace(OBSERVACAO_LIMITE, OBSERVACAO_ALEM_DO_LIMITE),
    };
  }
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

/**
 * OS que fechou no limite num dia em que decidiram seguir além de 10 h volta a
 * ficar aberta. Roda junto do fechamento automático: se outro aparelho fechou a
 * OS antes de a decisão chegar, ela se corrige sozinha.
 */
export const reabrirOrdensAlemDoLimite = (
  registros: readonly ControleEquipamentoDiario[],
  ordens: readonly OrdemServico[],
  agora: Date,
): { ordens: OrdemServico[]; reabertas: OrdemServico[] } => {
  const reabertas: OrdemServico[] = [];
  const proximas = ordens.map(ordem => {
    if (!isOrdemEncerrada(ordem.status) || !(ordem.observacao || '').includes(OBSERVACAO_LIMITE)) return ordem;
    const doDia = registros.find(item => item.ordemServicoId === ordem.id && item.data === ordem.dataConclusao);
    if (!doDia?.continuaAlemDoLimite) return ordem;
    const reaberta = recalcularOrdemDoLimite(ordem, registros, agora);
    if (!reaberta) return ordem;
    reabertas.push(reaberta);
    return reaberta;
  });
  return { ordens: reabertas.length ? proximas : [...ordens], reabertas };
};

/**
 * Dia seguinte aberto sozinho pela continuidade e ainda intocado (só a entrada
 * das 07:00). Quando a conferência informa a liberação real ou confirma 10 h
 * depois que a continuidade já rodou, esse lançamento deve ser desfeito.
 */
export const continuacaoParaDesfazer = (
  registros: readonly ControleEquipamentoDiario[],
  decidido: ControleEquipamentoDiario,
): ControleEquipamentoDiario | undefined => {
  const seguinte = somarDias(decidido.data, 1);
  return registros.find(item => item.continuacaoDe === decidido.id
    && item.equipamentoId === decidido.equipamentoId
    && item.data === seguinte
    && !(item as { excluido?: unknown }).excluido
    && (item.eventos?.length ?? 0) <= 1
    && item.atualizadoEm === item.criadoEm);
};
