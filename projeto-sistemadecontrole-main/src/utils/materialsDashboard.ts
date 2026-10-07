export interface MaterialsDashboardPosition {
  saldo: number;
  abaixoDoMinimo: boolean;
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
