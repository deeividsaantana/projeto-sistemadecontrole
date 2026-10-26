import type { MouseEvent } from 'react';

/**
 * Primeiro item do Tab em toda tela logada: fica escondido até receber o
 * foco e leva direto à área da aba, sem passar pelo menu e pela barra do
 * topo (auditoria de front, B1).
 */
export function PularParaConteudo({ alvo = 'main-tab-viewport' }: { alvo?: string }) {
  const pular = (event: MouseEvent<HTMLAnchorElement>) => {
    const destino = document.getElementById(alvo);
    if (!destino) return;
    // Sem mexer no endereço: o hash não é rota no app.
    event.preventDefault();
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
    // preventScroll: o foco não pode empurrar a casca (menu e barra do topo)
    // para o lado; a área da aba já começa no alto da tela.
    destino.focus({ preventScroll: true });
  };

  return (
    <a
      href={`#${alvo}`}
      onClick={pular}
      className="pular-para-conteudo"
    >
      Pular para o conteúdo
    </a>
  );
}
