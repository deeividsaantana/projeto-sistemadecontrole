import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { CycleTimelineEntry, EquipmentCycle } from '../../fleet/cycleHistory';
import { extrairFasesCiclo, montarTimeline } from '../../fleet/cycleHistory';

interface Props {
  ciclo: EquipmentCycle;
  prefixo: string;
}

const ICONE_MAP: Record<string, string> = {
  play: '▶️',
  wrench: '🔧',
  check: '✓',
  clock: '⏱️',
};

const COR_STATUS: Record<string, string> = {
  'Em operação': 'bg-green-50 border-green-200',
  'Em manutenção': 'bg-orange-50 border-orange-200',
  'À disposição': 'bg-blue-50 border-blue-200',
  'Aguardando manutenção': 'bg-yellow-50 border-yellow-200',
};

const BOLA_COR: Record<string, string> = {
  'Em operação': 'bg-green-500',
  'Em manutenção': 'bg-orange-500',
  'À disposição': 'bg-blue-500',
  'Aguardando manutenção': 'bg-yellow-500',
};

export const CycleTimeline: React.FC<Props> = ({ ciclo, prefixo }) => {
  const fases = extrairFasesCiclo(ciclo);
  const timeline = montarTimeline(fases);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll('[data-timeline-item]');
    const conexoes = containerRef.current.querySelectorAll('[data-timeline-line]');

    // Respeitam prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      items.forEach(item => {
        gsap.set(item, { opacity: 1, y: 0 });
      });
      conexoes.forEach(linha => {
        gsap.set(linha, { scaleY: 1 });
      });
      return;
    }

    // Timeline de entrada: estilo Mercado Livre com stagger suave
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    items.forEach((item, i) => {
      const bola = item.querySelector('[data-bola]');
      const conteudo = item.querySelector('[data-conteudo]');
      const linha = item.querySelector('[data-timeline-line]');

      // Linha cresce de cima para baixo (antes da bola)
      if (linha) {
        tl.fromTo(
          linha,
          { scaleY: 0, transformOrigin: 'top', opacity: 0 },
          { scaleY: 1, opacity: 1, duration: 0.5, ease: 'power1.inOut' },
          i * 0.2
        );
      }

      // Bola com pop + glow effect
      if (bola) {
        tl.fromTo(
          bola,
          { scale: 0, opacity: 0, filter: 'drop-shadow(0 0 10px rgba(0,0,0,0))' },
          {
            scale: 1,
            opacity: 1,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
            duration: 0.4,
            ease: 'back.out'
          },
          i * 0.2 + 0.2
        );
      }

      // Conteúdo aparece com slide suave
      if (conteudo) {
        tl.fromTo(
          conteudo,
          { opacity: 0, x: -15, y: 5 },
          { opacity: 1, x: 0, y: 0, duration: 0.4 },
          i * 0.2 + 0.25
        );
      }
    });

    // Pequeno bounce no final
    tl.to(items, {
      y: -2,
      duration: 0.3,
      ease: 'sine.inOut',
      stagger: { each: 0.05, from: 'start' },
    }, '-=0.3');
  }, [ciclo]);

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>Nenhum registro de ciclo para {prefixo}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        Ciclo de {ciclo.dataInicio}
      </h3>

      {timeline.map((entrada, i) => {
        const isUltimo = i === timeline.length - 1;

        return (
          <div
            key={i}
            data-timeline-item
            className="relative flex gap-4"
          >
            {/* Linha conectora (exceto no último) */}
            {!isUltimo && (
              <div
                data-timeline-line
                className={`absolute left-[19px] top-12 w-0.5 h-16 ${BOLA_COR[entrada.status]}`}
                style={{ transformOrigin: 'top' }}
              />
            )}

            {/* Bola do status */}
            <div className="relative z-10 flex-shrink-0">
              <div
                data-bola
                className={`w-10 h-10 rounded-full ${BOLA_COR[entrada.status]} flex items-center justify-center text-white shadow-lg`}
              >
                <span className="text-lg">{ICONE_MAP[entrada.icone]}</span>
              </div>
            </div>

            {/* Conteúdo */}
            <div
              data-conteudo
              className={`flex-1 border rounded-lg p-3 ${COR_STATUS[entrada.status]}`}
            >
              <div data-header className="flex justify-between items-start mb-1">
                <span className="font-semibold text-slate-800">{entrada.status}</span>
                <span className="text-xs text-slate-600">{entrada.hora}</span>
              </div>

              {entrada.duracao && (
                <div className="text-xs text-slate-600 mb-1">
                  ⏱️ {entrada.duracao}
                </div>
              )}

              <div className="text-xs text-slate-700 space-y-1">
                <div>Por: <strong>{entrada.responsavel}</strong></div>
                {entrada.operador && (
                  <div className="text-slate-700">
                    🚗 Operador: <strong>{entrada.operador}</strong>
                  </div>
                )}
                {entrada.motivo && (
                  <div className="mt-1 text-slate-600">
                    📝 {entrada.motivo}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
