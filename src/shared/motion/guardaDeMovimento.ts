import gsap from 'gsap';
import { CONSULTA_MOVIMENTO_REDUZIDO } from './reduzMovimento';

/**
 * Leva cada animação GSAP em andamento direto ao estado final. A que repete
 * sem fim (martelo das estacas, seta do efetivo) volta ao começo e para, em
 * vez de piscar. Animação pausada fica como está: se alguém der play nela, o
 * próximo quadro a encerra.
 */
export const encerrarAnimacoes = (raiz: gsap.core.Timeline = gsap.globalTimeline) => {
  for (const animacao of raiz.getChildren(false, true, true)) {
    if (animacao.paused()) continue;
    if (animacao.repeat() === -1) {
      animacao.progress(0).kill();
      continue;
    }
    animacao.totalProgress(1);
  }
};

const aoQuadro = () => encerrarAnimacoes();

/**
 * Guarda global: quando o aparelho pede menos movimento, nenhuma animação
 * GSAP chega a se mexer, mesmo numa tela que esqueceu a guarda local. Ouve a
 * mudança da preferência sem recarregar a página. As telas continuam com a
 * guarda local (reduzMovimento), que nem cria a animação.
 */
export const instalarGuardaDeMovimento = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const consulta = window.matchMedia(CONSULTA_MOVIMENTO_REDUZIDO);
  const aplicar = () => {
    gsap.ticker.remove(aoQuadro);
    if (!consulta.matches) return;
    encerrarAnimacoes();
    gsap.ticker.add(aoQuadro);
  };
  aplicar();
  consulta.addEventListener('change', aplicar);
  return () => {
    consulta.removeEventListener('change', aplicar);
    gsap.ticker.remove(aoQuadro);
  };
};
