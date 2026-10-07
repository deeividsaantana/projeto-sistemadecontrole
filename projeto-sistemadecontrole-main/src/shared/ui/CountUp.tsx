import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface CountUpProps {
  value: number;
  className?: string;
  suffix?: string;
  /** Como escrever o número (decimais, R$...). Sem ele, inteiro com ponto de milhar. */
  format?: (value: number) => string;
}

/** Número que sobe de 0 até o valor final ao entrar na tela. Sem animação se o usuário preferir movimento reduzido. */
export function CountUp({ value, className, suffix = '', format }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const anterior = useRef(0);
  const escrever = (numero: number) => `${format ? format(numero) : Math.round(numero).toLocaleString('pt-BR')}${suffix}`;

  useGSAP(() => {
    if (!ref.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current.textContent = escrever(value);
      anterior.current = value;
      return;
    }
    // Troca de filtro sai do número anterior, não do zero.
    const counter = { current: anterior.current };
    ref.current.textContent = escrever(counter.current);
    anterior.current = value;
    gsap.to(counter, {
      current: value,
      duration: 0.7,
      ease: 'power2.out',
      onUpdate: () => { if (ref.current) ref.current.textContent = escrever(counter.current); },
    });
  }, { dependencies: [value, suffix] });

  // Já nasce com o valor certo: leitor de tela, impressão e print sem JS não veem zero.
  return <span ref={ref} className={className}>{escrever(value)}</span>;
}
