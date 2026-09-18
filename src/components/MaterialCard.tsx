import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { AlertTriangle } from 'lucide-react';

interface MaterialCardProps {
  label: string;
  valor: string;
  abaixoDoMinimo?: boolean;
}

export function MaterialCard({ label, valor, abaixoDoMinimo = false }: MaterialCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;

    gsap.fromTo(
      cardRef.current,
      { y: 10, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: cardRef.current,
          start: 'top bottom-=100',
          toggleActions: 'play none none none',
        },
      },
    );

    gsap.to(cardRef.current, {
      y: -5,
      duration: 0.3,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: cardRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  return (
    <div
      ref={cardRef}
      className={`rounded-lg border bg-white p-4 transition-all duration-300 hover:shadow-lg ${abaixoDoMinimo ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-bold uppercase leading-tight tracking-wide ${abaixoDoMinimo ? 'text-amber-700' : 'text-slate-500'}`}>{label}</p>
        {abaixoDoMinimo && <AlertTriangle className="h-4 w-4 text-amber-600" />}
      </div>
      <strong className={`mt-1.5 block text-2xl font-black tabular-nums ${abaixoDoMinimo ? 'text-amber-900' : 'text-slate-900'}`}>{valor}</strong>
    </div>
  );
}