/**
 * Gera um id estável e determinístico a partir de um valor de origem (ex.:
 * hash do arquivo + aba + linha). O mesmo valor sempre produz o mesmo id —
 * é isso que permite detectar "já importei esta linha antes" sem guardar
 * estado extra, e é o que impede reimportação de duplicar registros.
 */
export const stableId = (prefix: string, value: string) =>
  `${prefix}-${value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`;
