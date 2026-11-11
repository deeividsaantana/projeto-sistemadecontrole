/**
 * Espera antes de tentar de novo o envio que falhou.
 *
 * Em 10 e 11/11/2026 o banco ficou lento e cada aparelho com envio pendente
 * tentava de novo a cada 30 segundos (e a cada edição). Cada tentativa gasta
 * o banco por até 30 s, então as tentativas repetidas mantinham a lentidão. A
 * espera dobra a cada falha seguida (30 s, 1 min, 2 min, até 5 min), com um
 * acréscimo de até 20% para os aparelhos não voltarem todos juntos. Os dados
 * ficam guardados neste aparelho enquanto isso.
 */
export const ESPERA_REENVIO_BASE_MS = 30_000;
export const ESPERA_REENVIO_MAXIMA_MS = 300_000;
const ACRESCIMO_MAXIMO = 0.2;

export const esperaDoReenvio = (falhasSeguidas: number, sorteio = Math.random()): number => {
  if (!(falhasSeguidas > 0)) return 0;
  const base = Math.min(ESPERA_REENVIO_MAXIMA_MS, ESPERA_REENVIO_BASE_MS * 2 ** (falhasSeguidas - 1));
  const acrescimo = Math.min(1, Math.max(0, sorteio)) * ACRESCIMO_MAXIMO;
  return Math.round(base * (1 + acrescimo));
};

export const MENSAGEM_NUVEM_OCUPADA = 'A nuvem está ocupada neste momento. Seus dados estão guardados neste aparelho e sobem sozinhos em instantes.';

/** Banco ocupado: fila de salvamento cheia (lock timeout) ou consulta que passou do limite. */
export const ehBancoOcupado = (mensagem: string): boolean => /lock timeout|statement timeout|55P03|57014/i.test(mensagem);
