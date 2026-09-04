import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface CountUpProps {
  value: number;
  className?: string;
  suffix?: string;
}

/** Número que sobe de 0 até o valor final ao entrar na tela. Sem animação se o usuário preferir movimento reduzido. */
export function CountUp({ value, className, suffix = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    if (!ref.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current.textContent = `${value.toLocaleString('pt-BR')}${suffix}`;
      return;
    }
    const counter = { current: 0 };
    gsap.to(counter, {
      current: value,
      duration: 0.7,
      ease: 'power2.out',
      onUpdate: () => { if (ref.current) ref.current.textContent = `${Math.round(counter.current).toLocaleString('pt-BR')}${suffix}`; },
    });
  }, { dependencies: [value, suffix] });

  return <span ref={ref} className={className}>0{suffix}</span>;
}
