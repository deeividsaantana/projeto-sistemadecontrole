import type { PropsWithChildren } from 'react';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * Motion orchestration shared by every authenticated ERP route. It animates
 * only large semantic regions so fields and operational actions stay stable.
 */
export function RouteMotion({ children }: PropsWithChildren) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(
      ':scope > header, :scope > section, :scope > article, :scope > main > header, :scope > main > section, :scope > main > article, :scope > div > header, :scope > div > section, :scope > div > article',
    )).filter((item, index, all) => all.indexOf(item) === index && !item.classList.contains('renea-page-header'));

    const aboveFold = candidates.slice(0, 5);
    gsap.fromTo(aboveFold,
      { autoAlpha: 0, y: 20 },
      { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.075, ease: 'power3.out', clearProps: 'transform,opacity,visibility' },
    );

    const interactive = root.querySelectorAll<HTMLElement>('.renea-card, .renea-stat, [data-fleet-enter], .dashboard-metric');
    interactive.forEach(item => {
      const moveY = gsap.quickTo(item, 'y', { duration: 0.28, ease: 'power2.out' });
      const onEnter = () => moveY(-3);
      const onLeave = () => moveY(0);
      item.addEventListener('pointerenter', onEnter);
      item.addEventListener('pointerleave', onLeave);
      item.addEventListener('pointercancel', onLeave);
    });

    return () => interactive.forEach(item => gsap.killTweensOf(item));
  }, { scope: rootRef });

  return <div ref={rootRef} className="renea-route-motion h-full w-full">{children}</div>;
}
