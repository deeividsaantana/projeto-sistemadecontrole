/**
 * Avanço das estacas prancha: quantas a obra precisa cravar, quantas já foram
 * e quantas faltam, por frente e no total.
 *
 * Não existe tabela nova de previsto. A estaca prevista é uma cravação com
 * profundidade cravada zero: fica "a cravar" até alguém lançar a cravação
 * nela. Assim o previsto viaja pela mesma sincronização das cravações, sem
 * mexer no que já está gravado no navegador e no Firebase.
 */
import type { CravacaoEstaca } from '../../types';

export const SEM_FRENTE = 'Sem frente';

export type SituacaoEstaca = 'cravada' | 'a-cravar';

const arred = (valor: number) => Math.round((Number(valor) || 0) * 1000) / 1000;

export const situacaoDaEstaca = (estaca: Pick<CravacaoEstaca, 'comprimentoCravadoM'>): SituacaoEstaca =>
  Number(estaca.comprimentoCravadoM) > 0 ? 'cravada' : 'a-cravar';

export const estaCravada = (estaca: Pick<CravacaoEstaca, 'comprimentoCravadoM'>) => situacaoDaEstaca(estaca) === 'cravada';

/** Na planilha da obra a frente vem em "identificação" (ex.: AP 12 ferradura). */
export const frenteDaEstaca = (estaca: Pick<CravacaoEstaca, 'identificacao'>) => String(estaca.identificacao || '').trim() || SEM_FRENTE;

/** E o nome da estaca vem em "perfil" (ex.: Estaca 3-B); sem ele, o número de ordem. */
export const nomeDaEstaca = (estaca: Pick<CravacaoEstaca, 'perfil' | 'item'>) =>
  String(estaca.perfil || '').trim() || (String(estaca.item || '').trim() ? `Nº ${String(estaca.item).trim()}` : 'Sem nome');

const numeroDoItem = (estaca: Pick<CravacaoEstaca, 'item'>) => {
  const n = Number.parseInt(String(estaca.item || ''), 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};

/** Ordem da frente: pelo número de ordem e, empatando, pelo nome. */
export const ordemDasEstacas = (a: CravacaoEstaca, b: CravacaoEstaca) =>
  frenteDaEstaca(a).localeCompare(frenteDaEstaca(b), 'pt-BR', { numeric: true })
  || numeroDoItem(a) - numeroDoItem(b)
  || nomeDaEstaca(a).localeCompare(nomeDaEstaca(b), 'pt-BR', { numeric: true });

export interface ResumoEstacas {
  previstas: number;
  cravadas: number;
  faltam: number;
  /** Estacas cravadas sobre as previstas, de 0 a 100. */
  porcentagem: number;
  metrosCravados: number;
  /** Comprimento das estacas já cravadas (o que entrou de aço). */
  metrosUsados: number;
  /** Comprimento de projeto das que faltam, quando foi informado. */
  metrosACravar: number;
  sobraM: number;
  perdaM: number;
}

export const resumirEstacas = (estacas: readonly CravacaoEstaca[]): ResumoEstacas => {
  const resumo = estacas.reduce((acc, estaca) => {
    acc.previstas += 1;
    if (estaCravada(estaca)) {
      acc.cravadas += 1;
      acc.metrosCravados += Number(estaca.comprimentoCravadoM) || 0;
      acc.metrosUsados += Number(estaca.comprimentoM) || 0;
      acc.sobraM += Number(estaca.sobraM) || 0;
      acc.perdaM += Number(estaca.perdaM) || 0;
    } else {
      acc.metrosACravar += Number(estaca.comprimentoM) || 0;
    }
    return acc;
  }, { previstas: 0, cravadas: 0, metrosCravados: 0, metrosUsados: 0, metrosACravar: 0, sobraM: 0, perdaM: 0 });
  return {
    previstas: resumo.previstas,
    cravadas: resumo.cravadas,
    faltam: resumo.previstas - resumo.cravadas,
    porcentagem: resumo.previstas ? arred((resumo.cravadas / resumo.previstas) * 100) : 0,
    metrosCravados: arred(resumo.metrosCravados),
    metrosUsados: arred(resumo.metrosUsados),
    metrosACravar: arred(resumo.metrosACravar),
    sobraM: arred(resumo.sobraM),
    perdaM: arred(resumo.perdaM),
  };
};

export interface FrenteEstacas extends ResumoEstacas {
  frente: string;
  estacas: CravacaoEstaca[];
  ultimaCravacao: string;
  /** Primeira estaca a cravar na ordem da frente. */
  proxima?: CravacaoEstaca;
}

export const estacasPorFrente = (estacas: readonly CravacaoEstaca[]): FrenteEstacas[] => {
  const grupos = new Map<string, CravacaoEstaca[]>();
  estacas.forEach(estaca => {
    const frente = frenteDaEstaca(estaca);
    grupos.set(frente, [...(grupos.get(frente) ?? []), estaca]);
  });
  return Array.from(grupos, ([frente, lista]) => {
    const ordenadas = [...lista].sort(ordemDasEstacas);
    const cravadas = ordenadas.filter(estaCravada);
    return {
      frente,
      estacas: ordenadas,
      ...resumirEstacas(ordenadas),
      ultimaCravacao: cravadas.reduce((maior, item) => (item.data > maior ? item.data : maior), ''),
      proxima: ordenadas.find(item => !estaCravada(item)),
    };
  }).sort((a, b) => a.frente.localeCompare(b.frente, 'pt-BR', { numeric: true }));
};

export interface DiaDeCravacao {
  data: string;
  cravadas: number;
  metros: number;
  perdaM: number;
  frentes: string[];
}

/** Só as estacas cravadas, dia a dia, do mais recente para o mais antigo. */
export const cravacoesPorDia = (estacas: readonly CravacaoEstaca[], de = '', ate = ''): DiaDeCravacao[] => {
  const dias = new Map<string, DiaDeCravacao>();
  estacas.filter(estaCravada).forEach(estaca => {
    const data = String(estaca.data || '').slice(0, 10);
    if (!data || (de && data < de) || (ate && data > ate)) return;
    const dia = dias.get(data) ?? { data, cravadas: 0, metros: 0, perdaM: 0, frentes: [] };
    dia.cravadas += 1;
    dia.metros = arred(dia.metros + (Number(estaca.comprimentoCravadoM) || 0));
    dia.perdaM = arred(dia.perdaM + (Number(estaca.perdaM) || 0));
    const frente = frenteDaEstaca(estaca);
    if (!dia.frentes.includes(frente)) dia.frentes.push(frente);
    dias.set(data, dia);
  });
  return Array.from(dias.values()).sort((a, b) => b.data.localeCompare(a.data));
};

const somarDias = (dia: string, dias: number) =>
  new Date(new Date(`${dia}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);

/** Últimos N dias até `hoje`, com zero nos dias sem cravação, do mais antigo ao mais novo. */
export const ritmoDosDias = (estacas: readonly CravacaoEstaca[], hoje: string, quantidade = 14) => {
  const inicio = somarDias(hoje, -(quantidade - 1));
  const porData = new Map(cravacoesPorDia(estacas, inicio, hoje).map(dia => [dia.data, dia]));
  return Array.from({ length: quantidade }, (_, indice) => {
    const data = somarDias(inicio, indice);
    return { data, cravadas: porData.get(data)?.cravadas ?? 0, metros: porData.get(data)?.metros ?? 0 };
  });
};

/**
 * Média de estacas por dia trabalhado nos últimos 14 dias e quantos dias de
 * trabalho faltam nesse ritmo. Sem cravação no período não há previsão.
 */
export const previsaoDeTermino = (estacas: readonly CravacaoEstaca[], hoje: string) => {
  const dias = ritmoDosDias(estacas, hoje, 14).filter(dia => dia.cravadas > 0);
  const faltam = resumirEstacas(estacas).faltam;
  if (!dias.length) return { mediaPorDia: 0, diasDeTrabalho: null as number | null, faltam };
  const mediaPorDia = arred(dias.reduce((soma, dia) => soma + dia.cravadas, 0) / dias.length);
  return { mediaPorDia, diasDeTrabalho: faltam ? Math.ceil(faltam / mediaPorDia) : 0, faltam };
};

export interface PlanoDaFrente {
  frente: string;
  /** Total de estacas que a frente precisa ter, contando as já cravadas. */
  total: number;
  prefixo?: string;
  comprimentoM?: number;
  data: string;
  responsavel: string;
  agora?: string;
}

export interface ResultadoDoPlano {
  novas: CravacaoEstaca[];
  /** Estacas a cravar que sobram quando o total diminui (saem pela inativação). */
  sobrando: string[];
  /** O total pedido não pode ficar abaixo do que já foi cravado. */
  minimo: number;
}

/**
 * Ajusta o total previsto de uma frente. Aumentar cria estacas "a cravar"
 * numeradas depois da última; diminuir devolve as últimas a cravar para a
 * tela inativar. As já cravadas nunca entram na conta de sobra.
 */
export const planejarFrente = (estacas: readonly CravacaoEstaca[], plano: PlanoDaFrente): ResultadoDoPlano => {
  const frente = plano.frente.trim();
  const daFrente = estacas.filter(item => frenteDaEstaca(item) === (frente || SEM_FRENTE)).sort(ordemDasEstacas);
  const cravadas = daFrente.filter(estaCravada).length;
  const total = Math.max(cravadas, Math.floor(Number(plano.total) || 0));
  if (total < daFrente.length) {
    const aCravar = daFrente.filter(item => !estaCravada(item));
    return { novas: [], sobrando: aCravar.slice(aCravar.length - (daFrente.length - total)).map(item => item.id), minimo: cravadas };
  }
  const ultimoNumero = daFrente.reduce((maior, item) => {
    const n = Number.parseInt(String(item.item || ''), 10);
    return Number.isFinite(n) && n > maior ? n : maior;
  }, 0);
  const prefixo = (plano.prefixo ?? 'Estaca').trim() || 'Estaca';
  const nomes = new Set(daFrente.map(item => nomeDaEstaca(item).toLocaleLowerCase('pt-BR')));
  const agora = plano.agora ?? new Date().toISOString();
  const novas: CravacaoEstaca[] = [];
  let numero = ultimoNumero;
  while (daFrente.length + novas.length < total) {
    numero += 1;
    const nome = `${prefixo} ${numero}`;
    if (nomes.has(nome.toLocaleLowerCase('pt-BR'))) continue;
    novas.push({
      id: `estaca-prevista-${agora.replace(/\D/g, '')}-${numero}-${Math.random().toString(36).slice(2, 7)}`,
      data: plano.data,
      item: String(numero),
      servico: 'Cravação de estaca prancha',
      identificacao: frente,
      perfil: nome,
      comprimentoM: Math.max(0, Number(plano.comprimentoM) || 0),
      comprimentoCravadoM: 0,
      sobraM: 0,
      perdaM: 0,
      responsavel: plano.responsavel,
      observacao: 'Estaca prevista, ainda a cravar.',
      origem: 'Manual',
      criadoEm: agora,
    });
  }
  return { novas, sobrando: [], minimo: cravadas };
};

/** Tabela em texto separado por ponto e vírgula, que o Excel abre em português. */
export const paraCsv = (linhas: ReadonlyArray<ReadonlyArray<string | number>>) =>
  `﻿${linhas.map(linha => linha.map(celula => {
    const texto = typeof celula === 'number' ? celula.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : String(celula ?? '');
    return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  }).join(';')).join('\r\n')}`;
