/**
 * Timeline visual dos eventos de manutenção de um equipamento.
 * Mostra status progression (Parado → Manutenção → Liberado) com GSAP
 * animations suaves e histórico estruturado (quem/quando/antes/depois).
 */
import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CheckCircle2, Clock, Truck, Wrench, User, AlertCircle } from 'lucide-react';
import type { EventoControleEquipamentoDiario } from '../../types';
import { ROTULO } from '../cadastros/estilos';

export interface EventoTimeline {
  id: string;
  hora: string;
  status: 'parado' | 'manutencao' | 'liberado';
  descricao: string;
  responsavel?: string;
  motivo?: string;
  observacao?: string;
  /** "João assumiu às 14:10": quem pegou a máquina na saída ou na liberação. */
  assumiu?: string;
}

const ROTULO_STATUS = { parado: 'Parado', manutencao: 'Em manutenção', liberado: 'Liberado' } as const;

const ICONE_STATUS = {
  parado: AlertCircle,
  manutencao: Wrench,
  liberado: CheckCircle2,
};

const COR_STATUS = {
  parado: 'bg-rose-100 border-rose-300 text-rose-900',
  manutencao: 'bg-amber-100 border-amber-300 text-amber-900',
  liberado: 'bg-emerald-100 border-emerald-300 text-emerald-900',
};

const DOT_STATUS = {
  parado: 'bg-rose-500',
  manutencao: 'bg-amber-500',
  liberado: 'bg-emerald-500',
};

interface Props {
  eventos: EventoTimeline[];
  statusAtual: 'parado' | 'manutencao' | 'liberado';
}

export function TimelineManutencao({ eventos, statusAtual }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useGSAP(
    () => {
      if (!containerRef.current || itemsRef.current.length === 0) return;
      // Movimento reduzido: a linha do tempo aparece pronta, sem animar.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      // Fade in + slide para cada item da timeline
      itemsRef.current.forEach((item, index) => {
        if (item) {
          gsap.fromTo(
            item,
            { opacity: 0, x: -20 },
            {
              opacity: 1,
              x: 0,
              duration: 0.6,
              delay: index * 0.1,
              ease: 'cubic-bezier(0.32,0.72,0,1)',
            }
          );
        }
      });

      // Linha conectora entre eventos
      const dots = containerRef.current.querySelectorAll('[data-timeline-dot]');
      if (dots.length > 1) {
        const line = containerRef.current.querySelector('[data-timeline-line]');
        if (line) {
          gsap.fromTo(
            line,
            { scaleY: 0 },
            {
              scaleY: 1,
              duration: 1,
              ease: 'power2.out',
              transformOrigin: 'top',
            }
          );
        }
      }
    },
    { dependencies: [eventos.length] }
  );

  if (eventos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
        Nenhum evento registrado
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative space-y-0 rounded-2xl border border-slate-200 bg-white p-4 overflow-hidden"
    >
      {/* Linha conectora vertical */}
      {eventos.length > 1 && (
        <div
          data-timeline-line
          className="absolute left-7 top-6 w-0.5 bg-gradient-to-b from-slate-300 to-slate-200"
          style={{ height: `calc(100% - 5.5rem)` }}
        />
      )}

      {/* Eventos */}
      <div className="relative space-y-4">
        {eventos.map((evento, index) => {
          const Icon = ICONE_STATUS[evento.status];
          const corClasse = COR_STATUS[evento.status];
          const dotClasse = DOT_STATUS[evento.status];
          const isUltimo = index === eventos.length - 1;

          return (
            <div
              key={evento.id}
              ref={(el) => {
                itemsRef.current[index] = el;
              }}
              className="relative pl-9"
            >
              {/* Dot conectando à linha */}
              <div
                data-timeline-dot
                className={`absolute left-0 top-1 size-6 rounded-full border-2 border-white ${dotClasse} flex items-center justify-center shadow-md z-10`}
              >
                <Icon className="size-3 text-white" aria-hidden="true" />
              </div>

              {/* Card do evento */}
              <div className={`space-y-2 rounded-lg border px-3 py-2 ${corClasse}`}>
                {/* Hora e status */}
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-sm font-bold">{evento.hora}</span>
                  <span className="min-w-0 break-words text-xs font-bold opacity-75">
                    {evento.descricao}
                  </span>
                </div>

                {/* Motivo ou observação */}
                {evento.motivo && (
                  <p className="text-xs font-medium opacity-85">
                    <span className="font-semibold">Motivo:</span> {evento.motivo}
                  </p>
                )}

                {evento.assumiu && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold opacity-90">
                    <Truck className="size-3 shrink-0" aria-hidden="true" />
                    {evento.assumiu}
                  </p>
                )}

                {evento.observacao && (
                  <p className="text-xs font-medium opacity-85">
                    <span className="font-semibold">Obs:</span> {evento.observacao}
                  </p>
                )}

                {/* Responsável */}
                {evento.responsavel && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold opacity-75 mt-2">
                    <User className="size-3" aria-hidden="true" />
                    {evento.responsavel}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Badge do status atual */}
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2 border border-slate-200">
        <Clock className="size-4 text-slate-500" aria-hidden="true" />
        <span className="text-xs font-semibold text-slate-600">
          Status atual:{' '}
          <span className="font-bold">{ROTULO_STATUS[statusAtual]}</span>
        </span>
      </div>
    </div>
  );
}
