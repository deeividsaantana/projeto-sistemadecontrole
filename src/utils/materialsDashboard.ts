import type { MovimentoMaterial } from '../types';

export interface MaterialsDashboardPosition {
  saldo: number;
  abaixoDoMinimo: boolean;
}

export interface MaterialsFlowPoint {
  date: string;
  label: string;
  entradas: number;
  saidas: number;
  transferencias: number;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function buildMaterialsFlow(
  movimentos: MovimentoMaterial[],
  referenceDate: string,
  days = 7,
): MaterialsFlowPoint[] {
  const reference = new Date(`${referenceDate}T12:00:00Z`);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(reference);
    date.setUTCDate(reference.getUTCDate() - (days - index - 1));
    const dateKey = isoDate(date);
    const dayMovements = movimentos.filter(item => item.data === dateKey);

    return {
      date: dateKey,
      label: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(date),
      entradas: dayMovements
        .filter(item => item.tipo === 'Entrada' || (item.tipo === 'Ajuste' && item.quantidade > 0))
        .reduce((total, item) => total + Math.abs(item.quantidade), 0),
      saidas: dayMovements
        .filter(item => item.tipo === 'Saída' || (item.tipo === 'Ajuste' && item.quantidade < 0))
        .reduce((total, item) => total + Math.abs(item.quantidade), 0),
      transferencias: dayMovements
        .filter(item => item.tipo === 'Transferência')
        .reduce((total, item) => total + Math.abs(item.quantidade), 0),
    };
  });
}

export function summarizeMaterialsStock(posicoes: MaterialsDashboardPosition[]) {
  const semSaldo = posicoes.filter(item => item.saldo <= 0).length;
  const abaixoDoMinimo = posicoes.filter(item => item.saldo > 0 && item.abaixoDoMinimo).length;
  const regulares = posicoes.filter(item => item.saldo > 0 && !item.abaixoDoMinimo).length;

  return {
    total: posicoes.length,
    regulares,
    abaixoDoMinimo,
    semSaldo,
    coberturaPercentual: posicoes.length > 0 ? Math.round((regulares / posicoes.length) * 100) : null,
  };
}
