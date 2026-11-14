import { porcentagensInteiras } from './pizza';
import { situacaoDe, situacaoDoItem, type Solicitacao } from './solicitacoes';

/**
 * Relatório do período das Solicitações (pedido do usuário em 14/11/2026):
 * números, porcentagens e o movimento dia a dia, usados na tela, no Excel e
 * no PDF, para os três dizerem a mesma coisa.
 */
export interface Periodo {
  from: string;
  to: string;
}

export interface Parte {
  nome: string;
  quantidade: number;
  /** Inteiro; as partes somam 100. */
  percentual: number;
}

export interface DiaDeMovimento {
  iso: string;
  rotulo: string;
  abertos: number;
  aprovados: number;
  entregues: number;
}

export interface ResumoDoPeriodo {
  pedidos: number;
  itens: number;
  entregues: number;
  emAtraso: number;
  cancelados: number;
  /** null quando não há pedido no período. */
  pctEntregues: number | null;
  pctEmAtraso: number | null;
  /** Itens com tudo recebido sobre o total de itens. */
  pctItensRecebidos: number | null;
  valorAprovado: number;
  /** Dias, em média, entre abrir o pedido e ele chegar (só os entregues). */
  diasAteEntrega: number | null;
  porSituacao: Parte[];
  porSolicitante: Parte[];
  porConferencia: Parte[];
  porFrente: Parte[];
}

const dia = (data?: string) => (data ? data.slice(0, 10) : '');

export const dentroDoPeriodo = (data: string | undefined, periodo: Periodo) => {
  const valor = dia(data);
  return Boolean(valor) && valor >= periodo.from && valor <= periodo.to;
};

/** Pedidos abertos entre o primeiro e o último dia do período (inclusive). */
export const pedidosDoPeriodo = (lista: readonly Solicitacao[], periodo: Periodo) =>
  lista.filter(sol => dentroDoPeriodo(sol.abertaEm, periodo));

const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : null);

const agrupar = <T>(lista: readonly T[], nome: (item: T) => string | undefined): Parte[] => {
  const contas = new Map<string, number>();
  for (const item of lista) {
    const chave = nome(item)?.trim() || 'Não informado';
    contas.set(chave, (contas.get(chave) ?? 0) + 1);
  }
  const ordenadas = [...contas].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  const percentuais = porcentagensInteiras(ordenadas.map(([, quantidade]) => quantidade));
  return ordenadas.map(([nomeParte, quantidade], indice) => ({ nome: nomeParte, quantidade, percentual: percentuais[indice] }));
};

const diasEntre = (inicio: string, fim: string) =>
  Math.max(0, Math.round((Date.parse(dia(fim)) - Date.parse(dia(inicio))) / 86_400_000));

export const resumoDoPeriodo = (lista: readonly Solicitacao[], hoje: string): ResumoDoPeriodo => {
  const itens = lista.flatMap(sol => sol.itens);
  const entregues = lista.filter(sol => sol.etapa === 'Entregue');
  const emAtraso = lista.filter(sol => situacaoDe(sol, hoje) === 'Em Atraso').length;
  const prazos = entregues.filter(sol => sol.chegadaEm).map(sol => diasEntre(sol.abertaEm, sol.chegadaEm as string));
  return {
    pedidos: lista.length,
    itens: itens.length,
    entregues: entregues.length,
    emAtraso,
    cancelados: lista.filter(sol => sol.etapa === 'Cancelado').length,
    pctEntregues: pct(entregues.length, lista.length),
    pctEmAtraso: pct(emAtraso, lista.length),
    pctItensRecebidos: pct(itens.filter(item => situacaoDoItem(item) === 'Chegou').length, itens.length),
    valorAprovado: lista.filter(sol => sol.statusAprovacao === 'Aprovado').reduce((soma, sol) => soma + (sol.valorTotal ?? 0), 0),
    diasAteEntrega: prazos.length ? Math.round((prazos.reduce((soma, valor) => soma + valor, 0) / prazos.length) * 10) / 10 : null,
    porSituacao: agrupar(lista, sol => situacaoDe(sol, hoje)),
    porSolicitante: agrupar(lista, sol => sol.solicitante),
    porConferencia: agrupar(itens, situacaoDoItem),
    porFrente: agrupar(lista, sol => sol.localDestino || sol.frente),
  };
};

/**
 * Um ponto por dia do período: quantos pedidos foram abertos, aprovados e
 * entregues naquele dia. Conta todos os pedidos, não só os abertos no período:
 * um pedido de outubro entregue hoje aparece em "entregues" hoje.
 */
export const movimentoPorDia = (lista: readonly Solicitacao[], periodo: Periodo): DiaDeMovimento[] => {
  const dias: DiaDeMovimento[] = [];
  const indice = new Map<string, DiaDeMovimento>();
  const fim = Date.parse(`${periodo.to}T12:00:00`);
  for (let atual = Date.parse(`${periodo.from}T12:00:00`); atual <= fim && dias.length < 400; atual += 86_400_000) {
    const iso = new Date(atual).toISOString().slice(0, 10);
    const ponto = { iso, rotulo: iso.slice(8, 10) + '/' + iso.slice(5, 7), abertos: 0, aprovados: 0, entregues: 0 };
    dias.push(ponto);
    indice.set(iso, ponto);
  }
  for (const sol of lista) {
    const aberto = indice.get(dia(sol.abertaEm));
    if (aberto) aberto.abertos += 1;
    const aprovado = sol.statusAprovacao === 'Aprovado' ? indice.get(dia(sol.decisaoEm)) : undefined;
    if (aprovado) aprovado.aprovados += 1;
    const entregue = sol.etapa === 'Entregue' ? indice.get(dia(sol.chegadaEm)) : undefined;
    if (entregue) entregue.entregues += 1;
  }
  return dias;
};

export const textoPct = (valor: number | null) => (valor === null ? '—' : `${valor}%`);
