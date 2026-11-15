/**
 * Contas de engenharia do avanço físico da terraplanagem: estaca, produtividade
 * (média diária, desempenho), projeção de término, folga e avanço por serviço.
 * Tudo parte do resumo de cada atividade (src/utils/programacao.ts).
 */
import { diasDeTrabalho, ehDomingo, producaoDaAtividade, somarDias, type ResumoAtividade } from './programacao';
import type { RegistroProducao } from '../types';

/** Uma estaca tem 20 metros. */
export const ESTACA_M = 20;

/** "1401+10" ou "1401 + 10,5" ou "1401" viram metros (1401 × 20 + 10). */
export const estacaEmMetros = (texto?: string): number | undefined => {
  const achado = texto?.trim().match(/^(\d+)\s*(?:\+\s*(\d+(?:[.,]\d+)?))?$/);
  if (!achado) return undefined;
  const fracao = achado[2] ? Number(achado[2].replace(',', '.')) : 0;
  return Number(achado[1]) * ESTACA_M + fracao;
};

/** Metros de volta para estaca: 28030 → "1401+10". */
export const textoEstaca = (metros: number) => {
  const estaca = Math.floor(metros / ESTACA_M + 1e-9);
  const fracao = Math.round((metros - estaca * ESTACA_M) * 100) / 100;
  return `${estaca}+${fracao.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
};

/** O n-ésimo dia de trabalho contando a partir de `dia` (domingo não conta). */
export const diaUtilNumero = (dia: string, n: number) => {
  let atual = dia;
  let contados = 0;
  for (let guarda = 0; guarda < 3650; guarda += 1) {
    if (!ehDomingo(atual)) contados += 1;
    if (contados >= Math.max(1, n)) return atual;
    atual = somarDias(atual, 1);
  }
  return atual;
};

/** Dias de trabalho entre o término planejado e o projetado: positivo = adiantado, negativo = atrasado. */
export const folgaEmDias = (planejado: string, projetado: string) =>
  projetado <= planejado ? diasDeTrabalho(projetado, planejado) - 1 : -(diasDeTrabalho(planejado, projetado) - 1);

export interface Produtividade {
  /** Dias de trabalho desde o início até o último dia contado (hoje, se já lançou hoje; senão ontem). */
  diasTrabalhados: number;
  /** Produção média por dia de trabalho até agora (0 se ainda não começou). */
  mediaDiaria: number;
  /** Média ÷ meta, em %. Vazio antes de começar. */
  desempenho?: number;
  /** Término pelo ritmo de hoje. Vazio quando já começou e ainda não produziu nada. */
  termino?: string;
  /** Dias de trabalho de folga (+) ou de atraso (−) no término. */
  folga?: number;
  /** Extensão em metros pelas estacas, quando informadas. */
  extensao?: number;
  /** Início e fim do trecho em metros, quando as estacas foram informadas. */
  trecho?: { de: number; ate: number };
}

export const produtividade = (resumo: ResumoAtividade, producao: readonly RegistroProducao[], hoje: string): Produtividade => {
  const { item, realizado, saldo, meta, lancadoNoDia, situacao } = resumo;
  const de = estacaEmMetros(item.estacaInicial);
  const ate = estacaEmMetros(item.estacaFinal);
  const trecho = de !== undefined && ate !== undefined && ate >= de ? { de, ate } : undefined;
  const base = { extensao: trecho ? trecho.ate - trecho.de : undefined, trecho };

  if (situacao === 'cancelada') return { ...base, diasTrabalhados: 0, mediaDiaria: 0 };
  if (situacao === 'concluida') {
    const ultimo = producaoDaAtividade(item, producao).reduce((maior, registro) => (registro.data > maior ? registro.data : maior), '');
    const termino = ultimo || item.dataFim;
    const diasTrabalhados = diasDeTrabalho(item.dataInicio, termino);
    const mediaDiaria = realizado / diasTrabalhados;
    return { ...base, diasTrabalhados, mediaDiaria, desempenho: meta > 0 ? (mediaDiaria / meta) * 100 : undefined, termino, folga: folgaEmDias(item.dataFim, termino) };
  }
  if (hoje < item.dataInicio) return { ...base, diasTrabalhados: 0, mediaDiaria: 0, termino: item.dataFim, folga: 0 };

  const corte = lancadoNoDia > 0 ? hoje : somarDias(hoje, -1);
  const diasTrabalhados = corte < item.dataInicio ? 0 : diasDeTrabalho(item.dataInicio, corte);
  const mediaDiaria = diasTrabalhados > 0 ? realizado / diasTrabalhados : 0;
  const desempenho = diasTrabalhados > 0 && meta > 0 ? (mediaDiaria / meta) * 100 : undefined;
  // No primeiro dia ainda não há ritmo: vale a meta. Depois, só a média real.
  const ritmo = diasTrabalhados > 0 ? mediaDiaria : meta;
  if (!(ritmo > 0)) return { ...base, diasTrabalhados, mediaDiaria, desempenho };
  const termino = diaUtilNumero(lancadoNoDia > 0 ? somarDias(hoje, 1) : hoje, Math.ceil(saldo / ritmo));
  return { ...base, diasTrabalhados, mediaDiaria, desempenho, termino, folga: folgaEmDias(item.dataFim, termino) };
};

export interface AtividadeComRitmo extends ResumoAtividade { ritmo: Produtividade; }

export const comRitmo = (resumos: readonly ResumoAtividade[], producao: readonly RegistroProducao[], hoje: string): AtividadeComRitmo[] =>
  resumos.map(resumo => ({ ...resumo, ritmo: produtividade(resumo, producao, hoje) }));

export interface AvancoDoServico {
  chave: string;
  servico: string;
  unidade: string;
  frentes: string[];
  atividades: number;
  quantidade: number;
  executado: number;
  /** Quantidade que deveria estar pronta até ontem. */
  previsto: number;
  saldo: number;
  /** Executado ÷ quantidade, em %. */
  percentual: number;
  /** Previsto até ontem ÷ quantidade, em %. */
  percentualPrevisto: number;
  /** Soma da média diária das atividades em andamento. */
  mediaDiaria: number;
  /** Soma da meta das atividades em andamento. */
  meta: number;
  terminoPlanejado: string;
  /** O último término projetado; vazio se alguma atividade está parada sem produção. */
  termino?: string;
  folga?: number;
}

const ordemTexto = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });

/**
 * Avanço por serviço (camada), somando as frentes: é a conta que o engenheiro
 * faz para saber quantos metros de sub-base, BGS ou dreno faltam.
 */
export const avancoPorServico = (atividades: readonly AtividadeComRitmo[], hoje: string): AvancoDoServico[] => {
  const grupos = new Map<string, AtividadeComRitmo[]>();
  for (const atividade of atividades) {
    if (atividade.situacao === 'cancelada') continue;
    const chave = `${atividade.item.servicoDescricao.trim().toUpperCase()}|${atividade.item.unidade}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), atividade]);
  }
  return [...grupos.entries()].map(([chave, lista]) => {
    const soma = (valor: (atividade: AtividadeComRitmo) => number) => lista.reduce((total, atividade) => total + valor(atividade), 0);
    const quantidade = soma(a => Number(a.item.quantidadePlanejada) || 0);
    const executado = soma(a => a.realizado);
    const previsto = soma(a => a.previsto);
    const emAndamento = lista.filter(a => a.situacao !== 'concluida' && a.item.dataInicio <= hoje);
    const terminos = lista.map(a => a.ritmo.termino);
    const termino = terminos.every(Boolean) ? (terminos as string[]).reduce((maior, dia) => (dia > maior ? dia : maior)) : undefined;
    const terminoPlanejado = lista.reduce((maior, a) => (a.item.dataFim > maior ? a.item.dataFim : maior), lista[0].item.dataFim);
    return {
      chave,
      servico: lista[0].item.servicoDescricao.trim(),
      unidade: lista[0].item.unidade,
      frentes: [...new Set(lista.map(a => a.item.frente || 'Sem frente'))].sort(ordemTexto),
      atividades: lista.length,
      quantidade,
      executado,
      previsto,
      saldo: Math.max(0, quantidade - executado),
      percentual: quantidade > 0 ? (executado / quantidade) * 100 : 0,
      percentualPrevisto: quantidade > 0 ? (previsto / quantidade) * 100 : 0,
      mediaDiaria: emAndamento.reduce((total, a) => total + a.ritmo.mediaDiaria, 0),
      meta: emAndamento.reduce((total, a) => total + a.meta, 0),
      terminoPlanejado,
      termino,
      folga: termino ? folgaEmDias(terminoPlanejado, termino) : undefined,
    };
  }).sort((a, b) => ordemTexto(a.servico, b.servico));
};

export interface TrechoDaFrente {
  frente: string;
  /** Primeira e última estaca (em metros) das atividades com estaca. */
  de: number;
  ate: number;
  atividades: AtividadeComRitmo[];
  semEstaca: AtividadeComRitmo[];
}

/** Atividades de cada frente posicionadas pelas estacas, para o diagrama linear. */
export const trechosPorFrente = (atividades: readonly AtividadeComRitmo[]): TrechoDaFrente[] => {
  const grupos = new Map<string, AtividadeComRitmo[]>();
  for (const atividade of atividades) {
    if (atividade.situacao === 'cancelada') continue;
    const frente = atividade.item.frente || 'Sem frente';
    grupos.set(frente, [...(grupos.get(frente) ?? []), atividade]);
  }
  return [...grupos.entries()].map(([frente, lista]) => {
    // Na ordem de execução (escavação, subleito, sub-base, base, pavimento): pelo início programado.
    const comEstaca = lista.filter(a => a.ritmo.trecho).sort((a, b) => a.item.dataInicio.localeCompare(b.item.dataInicio) || a.ritmo.trecho!.de - b.ritmo.trecho!.de || ordemTexto(a.item.servicoDescricao, b.item.servicoDescricao));
    return {
      frente,
      de: comEstaca.length ? Math.min(...comEstaca.map(a => a.ritmo.trecho!.de)) : 0,
      ate: comEstaca.length ? Math.max(...comEstaca.map(a => a.ritmo.trecho!.ate)) : 0,
      atividades: comEstaca,
      semEstaca: lista.filter(a => !a.ritmo.trecho),
    };
  }).sort((a, b) => ordemTexto(a.frente, b.frente));
};

/** O término mais tardio entre as atividades (planejado e projetado). */
export const terminoDaObra = (atividades: readonly AtividadeComRitmo[]) => {
  const validas = atividades.filter(a => a.situacao !== 'cancelada');
  if (!validas.length) return undefined;
  const planejado = validas.reduce((maior, a) => (a.item.dataFim > maior ? a.item.dataFim : maior), validas[0].item.dataFim);
  const terminos = validas.map(a => a.ritmo.termino);
  const projetado = terminos.every(Boolean) ? (terminos as string[]).reduce((maior, dia) => (dia > maior ? dia : maior)) : undefined;
  return { planejado, projetado, folga: projetado ? folgaEmDias(planejado, projetado) : undefined, semRitmo: terminos.filter(dia => !dia).length };
};
