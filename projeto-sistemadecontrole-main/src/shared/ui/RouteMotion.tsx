import type { PropsWithChildren } from 'react';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * Entrada das rotas autenticadas do ERP.
 *
 * A versão anterior custava caro em toda troca de aba: animava com
 * `autoAlpha: 0` (a tela ficava em branco até a tween rodar), criava um
 * ScrollTrigger por seção fora da primeira dobra e registrava três listeners
 * de ponteiro em cada cartão — em telas com centenas de linhas isso somava
 * milhares de handlers e segurava a abertura do módulo.
 *
 * Agora o conteúdo já nasce visível e só desliza alguns pixels. Sem
 * ScrollTrigger, sem listeners por elemento: o realce de hover passou a ser
 * CSS puro (`transform` em `:hover`), que o compositor resolve sozinho.
 */
export function RouteMotion({ children }: PropsWithChildren) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const candidates = Array.from(root.querySelectorAll<HTMLElement>(
      ':scope > header, :scope > section, :scope > article, :scope > main > header, :scope > main > section, :scope > main > article, :scope > div > header, :scope > div > section, :scope > div > article',
    )).filter((item, index, all) => all.indexOf(item) === index && !item.classList.contains('renea-page-header'));

    // Só a primeira dobra anima. O resto já está no lugar quando a pessoa
    // rola até lá, e não precisa de gatilho nenhum para aparecer.
    const aboveFold = candidates.slice(0, 3);
    if (aboveFold.length === 0) return;

    gsap.fromTo(aboveFold,
      { y: 12 },
      { y: 0, duration: 0.32, stagger: 0.04, ease: 'power2.out', clearProps: 'transform' },
    );
  }, { scope: rootRef });

  return <div ref={rootRef} className="renea-route-motion h-full w-full">{children}</div>;
}
