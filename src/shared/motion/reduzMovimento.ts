/** Consulta do aparelho que pede menos movimento (acessibilidade do sistema). */
export const CONSULTA_MOVIMENTO_REDUZIDO = '(prefers-reduced-motion: reduce)';

/** true quando o aparelho pede menos movimento. Fora do navegador, false. */
export const reduzMovimento = () => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(CONSULTA_MOVIMENTO_REDUZIDO).matches;
