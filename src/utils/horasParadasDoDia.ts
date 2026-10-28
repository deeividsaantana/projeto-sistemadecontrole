import type { ControleEquipamentoDiario, EventoControleEquipamentoDiario } from '../types';

export const LIMITE_HORAS_DIA = 10;
const LIMITE_MIN = LIMITE_HORAS_DIA * 60;
const INICIO_DO_DIA = '07:00';
const FIM_DO_DIA_MIN = 24 * 60;

export interface Pausa { codigo: string; nome: string; inicio: string; fim: string }

/** Pausas fixas da obra: só a parte que cai dentro do período parado é descontada. */
export const PAUSAS_DO_DIA: readonly Pausa[] = [
  { codigo: '15', nome: 'DDS', inicio: '07:00', fim: '07:15' },
  { codigo: '13', nome: 'Almoço', inicio: '12:00', fim: '13:00' },
];

export type SituacaoParada = 'LIBERADO' | 'PARADO' | 'LIMITE_ATINGIDO' | 'INCONSISTENTE';

export interface PeriodoParado {
  inicio: string;
  /** null enquanto não houve liberação. */
  fim: string | null;
  descontoMin: number;
  liquidoMin: number;
}

export interface ParadaDoDia {
  data: string;
  periodos: PeriodoParado[];
  /** Já com descontos e limite. */
  totalMin: number;
  /** Com descontos, antes do limite. */
  brutoMin: number;
  situacao: SituacaoParada;
  limiteAtingidoAs: string | null;
  motivoInconsistencia?: string;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const paraMin = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const paraHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const horaLocal = (iso: string): string => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(iso));

const dataLocal = (momento: Date): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(momento);

export const formatarMinutos = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
};

const descontoDoPeriodo = (inicio: number, fim: number) => PAUSAS_DO_DIA.reduce((total, pausa) => {
  const sobreposto = Math.min(fim, paraMin(pausa.fim)) - Math.max(inicio, paraMin(pausa.inicio));
  return total + Math.max(0, sobreposto);
}, 0);

/** Entrada ou liberação já com a hora resolvida; `eventoId` falta quando veio só dos campos do dia. */
export type Marco = { tipo: 'entrada' | 'liberacao'; hora: string; eventoId?: string };

/**
 * Resolve a hora de cada evento de manutenção, na ordem do histórico.
 * Evento com hora informada usa essa hora. Evento sem hora é lançamento antigo:
 * a primeira entrada sem hora usa horaEntradaManutencao e a última liberação sem hora
 * usa horaLiberacao (escritores antigos sobrescrevem o campo com a liberação mais recente).
 * Os demais eventos sem hora usam o horário em que foram registrados.
 * Sem nenhum evento de manutenção, usa só os campos do dia.
 * Evento marcado com `substituidoPor` (corrigido na conferência) fica no
 * histórico, mas não entra na conta.
 */
export const marcosDoRegistro = (registro: ControleEquipamentoDiario): Marco[] | string => {
  const relevantes = (registro.eventos || []).filter(evento => !evento.substituidoPor
    && (evento.tipo === 'ENTRADA_MANUTENCAO' || evento.tipo === 'LIBERACAO_MANUTENCAO'));
  const marcos: Marco[] = [];

  if (relevantes.length === 0) {
    if (registro.horaEntradaManutencao) marcos.push({ tipo: 'entrada', hora: registro.horaEntradaManutencao });
    if (registro.horaLiberacao) marcos.push({ tipo: 'liberacao', hora: registro.horaLiberacao });
  } else {
    const indiceUltimaLiberacaoSemHora = relevantes.reduce(
      (ultimo, evento, indice) => (evento.tipo === 'LIBERACAO_MANUTENCAO' && !evento.hora ? indice : ultimo), -1);
    let entradaSemHoraUsada = false;
    relevantes.forEach((evento, indice) => {
      const tipo = evento.tipo === 'ENTRADA_MANUTENCAO' ? 'entrada' as const : 'liberacao' as const;
      let hora = evento.hora;
      if (!hora) {
        if (tipo === 'entrada' && !entradaSemHoraUsada) {
          entradaSemHoraUsada = true;
          hora = registro.horaEntradaManutencao;
        } else if (tipo === 'liberacao' && indice === indiceUltimaLiberacaoSemHora) {
          hora = registro.horaLiberacao;
        }
        hora = hora || horaLocal(evento.ocorridoEm);
      }
      marcos.push({ tipo, hora, eventoId: evento.id });
    });
    // Registro antigo com liberação só no campo do dia, sem evento de liberação.
    if (registro.horaLiberacao && !relevantes.some(evento => evento.tipo === 'LIBERACAO_MANUTENCAO')) {
      marcos.push({ tipo: 'liberacao', hora: registro.horaLiberacao });
    }
  }

  const invalida = marcos.find(marco => !HORA.test(marco.hora));
  if (invalida) return `Hora inválida no lançamento: "${invalida.hora}".`;
  return marcos;
};

export const horasParadasDoDia = (
  registro: ControleEquipamentoDiario,
  agora: Date,
  opcoes: { vemParadoDeOntem?: boolean } = {},
): ParadaDoDia => {
  const base = { data: registro.data, periodos: [] as PeriodoParado[], totalMin: 0, brutoMin: 0, limiteAtingidoAs: null };
  const marcos = marcosDoRegistro(registro);
  if (typeof marcos === 'string') return { ...base, situacao: 'INCONSISTENTE', motivoInconsistencia: marcos };

  const hoje = dataLocal(agora);
  const ateMin = registro.data === hoje ? paraMin(horaLocal(agora.toISOString())) : FIM_DO_DIA_MIN;

  const periodos: Array<{ inicio: number; fim: number | null }> = [];
  let aberto: number | null = opcoes.vemParadoDeOntem ? paraMin(INICIO_DO_DIA) : null;
  for (const marco of marcos) {
    const minuto = paraMin(marco.hora);
    if (marco.tipo === 'entrada') {
      // Entrada repetida com o equipamento já parado não abre outro período.
      if (aberto === null) aberto = minuto;
      continue;
    }
    if (aberto === null) {
      return { ...base, situacao: 'INCONSISTENTE', motivoInconsistencia: `Liberação às ${marco.hora} sem entrada antes.` };
    }
    if (minuto < aberto) {
      return { ...base, situacao: 'INCONSISTENTE', motivoInconsistencia: `Liberação às ${marco.hora} antes da entrada às ${paraHora(aberto)}.` };
    }
    periodos.push({ inicio: aberto, fim: minuto });
    aberto = null;
  }
  if (aberto !== null) periodos.push({ inicio: aberto, fim: null });

  let acumulado = 0;
  let limiteAtingidoAs: string | null = null;
  const detalhados = periodos.map(periodo => {
    const fimEfetivo = Math.max(periodo.inicio, periodo.fim ?? ateMin);
    const descontoMin = descontoDoPeriodo(periodo.inicio, fimEfetivo);
    const liquidoMin = fimEfetivo - periodo.inicio - descontoMin;
    if (limiteAtingidoAs === null && acumulado + liquidoMin >= LIMITE_MIN) {
      // Caminha minuto a minuto só dentro do período que cruzou o limite.
      let falta = LIMITE_MIN - acumulado;
      let minuto = periodo.inicio;
      while (falta > 0 && minuto < fimEfetivo) {
        if (descontoDoPeriodo(minuto, minuto + 1) === 0) falta -= 1;
        minuto += 1;
      }
      limiteAtingidoAs = paraHora(minuto);
    }
    acumulado += liquidoMin;
    return {
      inicio: paraHora(periodo.inicio),
      fim: periodo.fim === null ? null : paraHora(periodo.fim),
      descontoMin,
      liquidoMin,
    };
  });

  const brutoMin = acumulado;
  const totalMin = Math.min(brutoMin, LIMITE_MIN);
  const situacao: SituacaoParada = brutoMin >= LIMITE_MIN
    ? 'LIMITE_ATINGIDO'
    : detalhados.some(periodo => periodo.fim === null) ? 'PARADO' : 'LIBERADO';
  return { data: registro.data, periodos: detalhados, totalMin, brutoMin, situacao, limiteAtingidoAs };
};
