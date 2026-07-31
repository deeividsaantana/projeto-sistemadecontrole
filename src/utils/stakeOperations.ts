import type { ControleEstacas, CravacaoEstaca, LoteEstaca } from '../types';

export type StakeBalance = {
  loteId: string;
  notaFiscal: string;
  materialCodigo: string;
  descricao: string;
  recebidoM: number;
  cravadoM: number;
  sobraDeclaradaM: number;
  perdaM: number;
  saldoConfirmadoM: number;
  status: 'Disponível' | 'Consumido' | 'Divergente';
};

const round = (value: number) => Math.round((Number(value) || 0) * 1000) / 1000;

export const normalizeStakeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

export const calculateStakeBalance = (
  lote: LoteEstaca,
  cravacoes: CravacaoEstaca[]
): StakeBalance => {
  const vinculadas = cravacoes.filter(item => item.loteId === lote.id);
  const recebidoM = round(
    lote.quantidadeFisica > 0
      ? lote.quantidadeFisica * lote.comprimentoM
      : lote.comprimentoM
  );
  const cravadoM = round(vinculadas.reduce((total, item) => total + item.comprimentoCravadoM, 0));
  const sobraDeclaradaM = round(vinculadas.reduce((total, item) => total + item.sobraM, 0));
  const perdaM = round(vinculadas.reduce((total, item) => total + item.perdaM, 0));
  const saldoConfirmadoM = round(recebidoM - cravadoM - perdaM);
  const status = saldoConfirmadoM < 0
    ? 'Divergente'
    : saldoConfirmadoM === 0
      ? 'Consumido'
      : 'Disponível';

  return {
    loteId: lote.id,
    notaFiscal: lote.notaFiscal,
    materialCodigo: lote.materialCodigo,
    descricao: lote.descricao,
    recebidoM,
    cravadoM,
    sobraDeclaradaM,
    perdaM,
    saldoConfirmadoM,
    status,
  };
};

export const buildStakeBalances = (controle: ControleEstacas) =>
  controle.lotes.map(lote => calculateStakeBalance(lote, controle.cravacoes));

export const suggestStakeLot = (
  draft: Pick<CravacaoEstaca, 'perfil' | 'comprimentoM'>,
  controle: ControleEstacas
): LoteEstaca | undefined => {
  const wanted = normalizeStakeText(draft.perfil);
  const balances = new Map(buildStakeBalances(controle).map(item => [item.loteId, item]));
  const best = controle.lotes
    .filter(lote => lote.status !== 'Cancelado')
    .map(lote => {
      const text = normalizeStakeText(`${lote.perfilModelo} ${lote.descricao}`);
      const balance = balances.get(lote.id);
      const profileScore = wanted && text.includes(wanted) ? 100 : wanted && wanted.includes(text) ? 80 : 0;
      const lengthScore = Math.max(0, 30 - Math.abs(lote.comprimentoM - draft.comprimentoM) * 10);
      const availableScore = balance && balance.saldoConfirmadoM >= draft.comprimentoM ? 20 : -100;
      return { lote, score: profileScore + lengthScore + availableScore };
    })
    .sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 ? best.lote : undefined;
};

export const reconcileStakeInvoice = (lotes: LoteEstaca[], notaFiscal: string) => {
  const invoiceKey = (value: string) => value.replace(/\D/g, '').replace(/^0+/, '') || normalizeStakeText(value);
  const normalized = invoiceKey(notaFiscal);
  const items = lotes.filter(lote => invoiceKey(lote.notaFiscal) === normalized);
  return {
    notaFiscal,
    itens: items.length,
    pesoKg: round(items.reduce((total, item) => total + item.pesoKg, 0)),
    valorTotal: round(items.reduce((total, item) => total + item.valorTotal, 0)),
    conferidos: items.filter(item => item.nfConferida).length,
    divergencias: items.filter(item => Boolean(item.divergenciaNF.trim())).length,
    status: items.length > 0 && items.every(item => item.nfConferida && !item.divergenciaNF.trim())
      ? 'Conforme'
      : 'Pendente',
  } as const;
};

export const buildStakeSummary = (controle: ControleEstacas) => {
  const balances = buildStakeBalances(controle);
  const notas = Array.from(new Set(controle.lotes.map(item => item.notaFiscal).filter(Boolean)));
  return {
    lotes: controle.lotes.length,
    cravacoes: controle.cravacoes.length,
    pesoKg: round(controle.lotes.reduce((total, item) => total + item.pesoKg, 0)),
    valorTotal: round(controle.lotes.reduce((total, item) => total + item.valorTotal, 0)),
    recebidoM: round(balances.reduce((total, item) => total + item.recebidoM, 0)),
    cravadoM: round(balances.reduce((total, item) => total + item.cravadoM, 0)),
    sobraM: round(balances.reduce((total, item) => total + item.saldoConfirmadoM, 0)),
    perdaM: round(balances.reduce((total, item) => total + item.perdaM, 0)),
    notasPendentes: notas.filter(nota => reconcileStakeInvoice(controle.lotes, nota).status !== 'Conforme').length,
    saldosDivergentes: balances.filter(item => item.status === 'Divergente').length,
  };
};
