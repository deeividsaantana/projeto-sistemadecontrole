import type { PropsWithChildren } from 'react';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
// Importação padrão em vez de nomeada: o bundler resolve o build ESM do plugin,
// mas o tsx dos testes resolve o build CommonJS, onde o nome não existe — e a
// suíte inteira quebrava ao carregar este arquivo.
import ScrollTrigger from 'gsap/ScrollTrigger';

/**
 * Motion orchestration shared by every authenticated ERP route. It animates
 * only large semantic regions so fields and operational actions stay stable.
 */
export function RouteMotion({ children }: PropsWithChildren) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // O registro fica aqui, e não no topo do módulo: os testes carregam este
    // arquivo no Node, onde `gsap` chega como namespace CommonJS e não tem
    // registerPlugin. Dentro do efeito só roda no navegador.
    gsap.registerPlugin(ScrollTrigger);

    const candidates = Array.from(root.querySelectorAll<HTMLElement>(
      ':scope > header, :scope > section, :scope > article, :scope > main > header, :scope > main > section, :scope > main > article, :scope > div > header, :scope > div > section, :scope > div > article',
    )).filter((item, index, all) => all.indexOf(item) === index && !item.classList.contains('renea-page-header'));

    const aboveFold = candidates.slice(0, 5);
    gsap.fromTo(aboveFold,
      { autoAlpha: 0, y: 20 },
      { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.075, ease: 'power3.out', clearProps: 'transform,opacity,visibility' },
    );

    candidates.slice(5).forEach(item => {
      gsap.fromTo(item,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          clearProps: 'transform,opacity,visibility',
          scrollTrigger: { trigger: item, start: 'top 92%', once: true },
        },
      );
    });

    const interactive = root.querySelectorAll<HTMLElement>('.renea-card, .renea-stat, [data-fleet-enter], .dashboard-metric');
    interactive.forEach(item => {
      const moveY = gsap.quickTo(item, 'y', { duration: 0.28, ease: 'power2.out' });
      const onEnter = () => moveY(-3);
      const onLeave = () => moveY(0);
      item.addEventListener('pointerenter', onEnter);
      item.addEventListener('pointerleave', onLeave);
      item.addEventListener('pointercancel', onLeave);
    });

    return () => ScrollTrigger.getAll().forEach(trigger => {
      if (trigger.trigger && root.contains(trigger.trigger as Node)) trigger.kill();
    });
  }, { scope: rootRef });

  return <div ref={rootRef} className="renea-route-motion h-full w-full">{children}</div>;
}
