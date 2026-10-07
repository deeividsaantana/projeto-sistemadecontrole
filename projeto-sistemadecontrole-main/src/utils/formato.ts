/**
 * Formatação compartilhada. Estas três linhas estavam copiadas em dezesseis
 * telas; qualquer ajuste (moeda, casas decimais) precisava ser lembrado em
 * dezesseis lugares — e um deles sempre ficava para trás.
 */

/** Data ISO (YYYY-MM-DD) no formato do dia a dia da obra. */
export const formatarData = (valor: string) => String(valor || '').split('-').reverse().join('/');

/** Número com separador brasileiro, sem casas decimais inventadas. */
export const numero = (valor: number, casas = 3) =>
  Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });

export const moeda = (valor: number) =>
  Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
