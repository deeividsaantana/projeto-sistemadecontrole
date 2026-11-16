/** Datas no jeito brasileiro, no fuso de quem vê. */
export const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : iso || '');

/** Com `exata`, mostra também os segundos (carimbo da assinatura). */
export const dataHoraBr = (iso: string, exata = false) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', ...(exata ? { second: '2-digit' } : {}) });
};
