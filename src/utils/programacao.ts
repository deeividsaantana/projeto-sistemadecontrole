/**
 * Regras da aba Programação (terraplanagem): dias de trabalho, meta por dia,
 * produção de cada atividade e a cor de situação. Tudo puro, sem tela, para
 * o quadro, a lista, o Excel e o PDF contarem do mesmo jeito.
 *
 * Domingo não é dia de trabalho (mesma regra da planilha original).
 */
import type { PlanejamentoItem, RegistroProducao } from '../types';

export type SituacaoAtividade = 'programada' | 'em-dia' | 'atencao' | 'atrasada' | 'concluida' | 'cancelada';

export const SITUACOES: ReadonlyArray<{ id: SituacaoAtividade; rotulo: string }> = [
  { id: 'atrasada', rotulo: 'Atrasada' },
  { id: 'atencao', rotulo: 'Atenção' },
  { id: 'em-dia', rotulo: 'Em dia' },
  { id: 'programada', rotulo: 'Programada' },
  { id: 'concluida', rotulo: 'Concluída' },
  { id: 'cancelada', rotulo: 'Cancelada' },
];

export const ROTULO_SITUACAO = Object.fromEntries(SITUACOES.map(item => [item.id, item.rotulo])) as Record<SituacaoAtividade, string>;

const DIA_MS = 86_400_000;
const paraData = (dia: string) => new Date(`${dia}T12:00:00Z`);

/** Dia de hoje no relógio da pessoa (toISOString virava o dia seguinte depois das 21h). */
export const diaLocal = (data = new Date()) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;

export const somarDias = (dia: string, quantidade: number) =>
  new Date(paraData(dia).getTime() + quantidade * DIA_MS).toISOString().slice(0, 10);

export const ehDomingo = (dia: string) => paraData(dia).getUTCDay() === 0;

/** Segunda-feira da semana do dia (domingo conta como fim da semana anterior). */
export const inicioDaSemana = (dia: string) => {
  const semana = paraData(dia).getUTCDay();
  return somarDias(dia, semana === 0 ? -6 : 1 - semana);
};

/** Dias de trabalho entre início e fim, contando os dois e pulando domingos. Nunca menos de 1. */
export const diasDeTrabalho = (inicio: string, fim: string) => {
  if (!inicio || !fim || fim < inicio) return 1;
  const total = Math.round((paraData(fim).getTime() - paraData(inicio).getTime()) / DIA_MS) + 1;
  const primeiro = paraData(inicio).getUTCDay();
  // Quantos domingos caem no intervalo, sem andar dia a dia.
  const ateDomingo = (7 - primeiro) % 7;
  const domingos = ateDomingo >= total ? 0 : Math.floor((total - 1 - ateDomingo) / 7) + 1;
  return Math.max(1, total - domingos);
};

/** A carga original guardou a meta no texto ("Meta diária: 23 M."). */
const META_NO_TEXTO = /Meta diária:\s*([\d.,]+)\s*[^.;·]*[.;]?\s*(?:·\s*)?/i;

const metaDoTexto = (observacao?: string) => {
  const achado = observacao?.match(META_NO_TEXTO)?.[1];
  const valor = achado ? Number(achado.replace(',', '.')) : NaN;
  return Number.isFinite(valor) && valor > 0 ? valor : undefined;
};

/** Meta automática: quantidade ÷ dias de trabalho, arredondada para cima. */
export const metaAutomatica = (quantidade: number, inicio: string, fim: string) =>
  quantidade > 0 ? Math.ceil(quantidade / diasDeTrabalho(inicio, fim)) : 0;

/** Meta por dia: a informada, a da carga original ou a automática. */
export const metaDiariaDe = (item: PlanejamentoItem) =>
  item.metaDiaria && item.metaDiaria > 0
    ? item.metaDiaria
    : metaDoTexto(item.observacao) ?? metaAutomatica(item.quantidadePlanejada, item.dataInicio, item.dataFim);

/** Tira da observação o texto de meta e de estaca da carga original (viraram campos). */
export const observacaoSemCarga = (observacao?: string) =>
  (observacao || '').replace(META_NO_TEXTO, '').replace(/Estacas de 20 m\.?/i, '').replace(/^\s*[·;.]\s*/, '').trim();

/** O lançamento conta para esta atividade? */
export const producaoEhDaAtividade = (registro: RegistroProducao, item: PlanejamentoItem) => {
  if (registro.ativo === false) return false;
  if (registro.planejamentoId) return registro.planejamentoId === item.id;
  // Lançamento antigo, sem atividade: mesmo serviço, mesma frente e dentro do período.
  return registro.servicoId === item.servicoId
    && (!registro.frente || !item.frente || registro.frente === item.frente)
    && registro.data >= item.dataInicio
    && registro.data <= item.dataFim;
};

export const producaoDaAtividade = (item: PlanejamentoItem, producao: readonly RegistroProducao[]) =>
  producao.filter(registro => producaoEhDaAtividade(registro, item));

export interface ResumoAtividade {
  item: PlanejamentoItem;
  realizado: number;
  /** Quanto deveria estar pronto até ontem. */
  previsto: number;
  /** 0 a 100 (pode passar de 100 quando a equipe fez mais). */
  percentual: number;
  saldo: number;
  meta: number;
  dias: number;
  /** Dias de trabalho que faltam a partir de hoje (0 depois do término). */
  diasRestantes: number;
  /** Quanto precisa fazer por dia, daqui para frente, para terminar no prazo. */
  precisaPorDia: number;
  situacao: SituacaoAtividade;
  lancadoNoDia: number;
}

export const resumirAtividade = (
  item: PlanejamentoItem,
  producao: readonly RegistroProducao[],
  hoje: string,
): ResumoAtividade => {
  const registros = producaoDaAtividade(item, producao);
  const realizado = registros.reduce((total, registro) => total + (Number(registro.quantidade) || 0), 0);
  const lancadoNoDia = registros.filter(registro => registro.data === hoje).reduce((total, registro) => total + (Number(registro.quantidade) || 0), 0);
  const quantidade = Number(item.quantidadePlanejada) || 0;
  const dias = diasDeTrabalho(item.dataInicio, item.dataFim);
  const ontem = somarDias(hoje, -1);
  const fimDoPrevisto = ontem < item.dataFim ? ontem : item.dataFim;
  const diasPassados = fimDoPrevisto < item.dataInicio ? 0 : diasDeTrabalho(item.dataInicio, fimDoPrevisto);
  const previsto = quantidade * Math.min(1, diasPassados / dias);
  const saldo = Math.max(0, quantidade - realizado);
  const diasRestantes = hoje > item.dataFim ? 0 : diasDeTrabalho(hoje < item.dataInicio ? item.dataInicio : hoje, item.dataFim);
  let situacao: SituacaoAtividade;
  if (item.situacao === 'Cancelado' || item.ativo === false) situacao = 'cancelada';
  else if (item.situacao === 'Concluído' || (quantidade > 0 && realizado >= quantidade)) situacao = 'concluida';
  else if (hoje < item.dataInicio) situacao = 'programada';
  else if (hoje > item.dataFim) situacao = 'atrasada';
  else if (previsto <= 0) situacao = 'em-dia';
  else {
    const ritmo = realizado / previsto;
    situacao = ritmo >= 0.95 ? 'em-dia' : ritmo >= 0.8 ? 'atencao' : 'atrasada';
  }
  return {
    item,
    realizado,
    previsto,
    percentual: quantidade > 0 ? (realizado / quantidade) * 100 : 0,
    saldo,
    meta: metaDiariaDe(item),
    dias,
    diasRestantes,
    precisaPorDia: diasRestantes > 0 ? Math.ceil(saldo / diasRestantes) : saldo,
    situacao,
    lancadoNoDia,
  };
};

/** A atividade está programada para trabalhar neste dia? */
export const trabalhaNoDia = (item: PlanejamentoItem, dia: string) =>
  item.dataInicio <= dia && item.dataFim >= dia && !ehDomingo(dia);

/** Avanço geral ponderado pelos dias de cada atividade (como a curva S da planilha). */
export const avancoGeral = (resumos: readonly ResumoAtividade[]) => {
  const validos = resumos.filter(resumo => resumo.situacao !== 'cancelada');
  const peso = validos.reduce((total, resumo) => total + resumo.dias, 0);
  if (!peso) return 0;
  return validos.reduce((total, resumo) => total + resumo.dias * Math.min(100, resumo.percentual), 0) / peso;
};

/** Quanto já deveria estar feito até ontem (%), com o mesmo peso por dias do avanço geral. */
export const previstoGeral = (resumos: readonly ResumoAtividade[]) => {
  const validos = resumos.filter(resumo => resumo.situacao !== 'cancelada');
  const peso = validos.reduce((total, resumo) => total + resumo.dias, 0);
  if (!peso) return 0;
  return validos.reduce((total, resumo) => {
    const quantidade = Number(resumo.item.quantidadePlanejada) || 0;
    return total + resumo.dias * (quantidade > 0 ? Math.min(1, resumo.previsto / quantidade) : 0);
  }, 0) / peso * 100;
};

const numeroCurto = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Texto pronto para mandar no WhatsApp da equipe: o que cada frente faz no dia. */
export const textoDoDia = (resumos: readonly ResumoAtividade[], dia: string) => {
  const doDia = resumos.filter(resumo => resumo.situacao !== 'cancelada' && trabalhaNoDia(resumo.item, dia));
  const titulo = `*Programação de ${SEMANA[paraData(dia).getUTCDay()]}, ${diaCurto(dia)}*`;
  if (!doDia.length) return `${titulo}\nNenhum serviço programado.`;
  const frentes = new Map<string, ResumoAtividade[]>();
  for (const resumo of doDia) {
    const frente = resumo.item.frente || 'Sem frente';
    frentes.set(frente, [...(frentes.get(frente) ?? []), resumo]);
  }
  const blocos = [...frentes.entries()].map(([frente, lista]) => [
    `\n*${frente}*`,
    ...lista.map(({ item, meta }) => {
      const estacas = item.estacaInicial ? ` · est. ${item.estacaInicial}${item.estacaFinal ? ` a ${item.estacaFinal}` : ''}` : '';
      return `• ${item.servicoDescricao} · ${item.responsavel || item.equipeNome || 'sem responsável'} · meta ${numeroCurto(meta)} ${item.unidade}${estacas}`;
    }),
  ].join('\n'));
  return [titulo, ...blocos].join('\n');
};

export interface PontoCurva {
  dia: string;
  /** Percentual previsto acumulado (0 a 100). */
  previsto: number;
  /** Percentual realizado acumulado; ausente nos dias depois de hoje. */
  realizado?: number;
}

/**
 * Curva S do avanço físico, como na planilha: cada atividade pesa pelos dias
 * de trabalho dela. O previsto anda dia a dia pelo cronograma; o realizado
 * soma a produção lançada até o dia (só até hoje: o futuro não tem realizado).
 */
export const curvaS = (
  resumos: readonly ResumoAtividade[],
  producao: readonly RegistroProducao[],
  hoje: string,
): PontoCurva[] => {
  const validos = resumos.filter(resumo => resumo.situacao !== 'cancelada' && resumo.item.quantidadePlanejada > 0);
  if (!validos.length) return [];
  const inicio = validos.reduce((menor, { item }) => (item.dataInicio < menor ? item.dataInicio : menor), validos[0].item.dataInicio);
  const fim = validos.reduce((maior, { item }) => (item.dataFim > maior ? item.dataFim : maior), validos[0].item.dataFim);
  const peso = validos.reduce((total, resumo) => total + resumo.dias, 0);
  const porAtividade = validos.map(resumo => ({
    resumo,
    registros: producaoDaAtividade(resumo.item, producao).map(registro => ({ data: registro.data, quantidade: Number(registro.quantidade) || 0 })),
  }));
  const pontos: PontoCurva[] = [];
  for (let dia = inicio; dia <= fim && pontos.length < 400; dia = somarDias(dia, 1)) {
    let previsto = 0;
    let realizado = 0;
    for (const { resumo, registros } of porAtividade) {
      const { item, dias } = resumo;
      const ate = dia < item.dataFim ? dia : item.dataFim;
      const feitosNoPlano = ate < item.dataInicio ? 0 : diasDeTrabalho(item.dataInicio, ate);
      previsto += dias * Math.min(1, feitosNoPlano / dias);
      const feito = registros.filter(registro => registro.data <= dia).reduce((total, registro) => total + registro.quantidade, 0);
      realizado += dias * Math.min(1, feito / item.quantidadePlanejada);
    }
    pontos.push({ dia, previsto: (previsto / peso) * 100, realizado: dia <= hoje ? (realizado / peso) * 100 : undefined });
  }
  return pontos;
};

export interface AvancoDaFrente {
  frente: string;
  atividades: number;
  atrasadas: number;
  concluidas: number;
  /** Percentual previsto até ontem e realizado, ponderados pelos dias. */
  previsto: number;
  realizado: number;
}

/** Avanço de cada frente, para o gráfico de barras e o relatório por avanço. */
export const avancoPorFrente = (resumos: readonly ResumoAtividade[]): AvancoDaFrente[] => {
  const grupos = new Map<string, ResumoAtividade[]>();
  for (const resumo of resumos) {
    if (resumo.situacao === 'cancelada') continue;
    const frente = resumo.item.frente || 'Sem frente';
    grupos.set(frente, [...(grupos.get(frente) ?? []), resumo]);
  }
  return [...grupos.entries()]
    .map(([frente, lista]) => ({
      frente,
      atividades: lista.length,
      atrasadas: lista.filter(resumo => resumo.situacao === 'atrasada').length,
      concluidas: lista.filter(resumo => resumo.situacao === 'concluida').length,
      previsto: previstoGeral(lista),
      realizado: avancoGeral(lista),
    }))
    .sort((a, b) => a.frente.localeCompare(b.frente, 'pt-BR', { numeric: true }));
};

/** Produção lançada por dia, em uma unidade (metros por padrão), nos últimos `dias` dias até hoje. */
export const producaoPorDia = (
  resumos: readonly ResumoAtividade[],
  producao: readonly RegistroProducao[],
  hoje: string,
  dias = 14,
  unidade = 'M',
) => {
  const ids = new Set(resumos.filter(resumo => resumo.item.unidade === unidade).map(resumo => resumo.item.id));
  const doGrupo = resumos.filter(resumo => ids.has(resumo.item.id));
  return Array.from({ length: dias }, (_, indice) => somarDias(hoje, indice - dias + 1)).map(dia => ({
    dia,
    feito: doGrupo.reduce((total, resumo) => total + producaoDaAtividade(resumo.item, producao)
      .filter(registro => registro.data === dia)
      .reduce((soma, registro) => soma + (Number(registro.quantidade) || 0), 0), 0),
    meta: ehDomingo(dia) ? 0 : doGrupo.filter(resumo => trabalhaNoDia(resumo.item, dia)).reduce((total, resumo) => total + resumo.meta, 0),
  }));
};
