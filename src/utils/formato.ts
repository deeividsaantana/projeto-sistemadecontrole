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

/**
 * O carimbo de data do histórico é gravado com `toLocaleString('pt-BR')`
 * ("08/09/2026, 11:42:00"), nunca em ISO. Quem trata esse campo como ISO
 * ordena por dia do mês e filtra período nenhum — e `new Date()` no formato
 * brasileiro devolve data inválida. Esta função entende os dois formatos e
 * devolve o instante em milissegundos, ou NaN quando não dá para datar.
 */
export const instanteDoHistorico = (valor: string | undefined): number => {
  const texto = String(valor || '').trim();
  if (!texto) return Number.NaN;
  const brasileiro = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brasileiro) {
    const [, dia, mes, ano, hora = '0', minuto = '0', segundo = '0'] = brasileiro;
    return new Date(
      Number(ano), Number(mes) - 1, Number(dia),
      Number(hora), Number(minuto), Number(segundo),
    ).getTime();
  }
  const parsed = Date.parse(texto);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

/** Dia (YYYY-MM-DD) de um carimbo do histórico, ou '' quando não dá para datar. */
export const diaDoHistorico = (valor: string | undefined): string => {
  const instante = instanteDoHistorico(valor);
  if (!Number.isFinite(instante)) return '';
  const data = new Date(instante);
  const doisDigitos = (numeroDoDia: number) => String(numeroDoDia).padStart(2, '0');
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
};
