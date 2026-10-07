import { AlertTriangle, Clock3, Gauge, PauseCircle, PlayCircle, Truck, Wrench, type LucideIcon } from 'lucide-react';
import type { FleetMetrics, FleetOperationalStatus } from '../../fleet/domain';
import { FLEET_OPERATIONAL_STATUS } from '../../fleet/domain';
import { CountUp } from '../../shared/ui';
import { CARTAO, FOCO } from '../cadastros/estilos';

interface Props {
  metrics: FleetMetrics;
  /** Situação filtrada agora; o cartão dela fica marcado. */
  status: FleetOperationalStatus | 'Todos';
  onPick: (status: FleetOperationalStatus | 'Todos') => void;
}

interface Indicador {
  id: string;
  titulo: string;
  valor: number;
  sufixo?: string;
  texto?: string;
  detalhe: string;
  Icone: LucideIcon;
  tom: string;
  status?: FleetOperationalStatus | 'Todos';
}

const indicadores = (metrics: FleetMetrics): Indicador[] => [
  { id: 'total', titulo: 'Frotas', valor: metrics.total, detalhe: 'lançadas no dia', Icone: Truck, tom: 'bg-slate-100 text-slate-700', status: 'Todos' },
  { id: 'operando', titulo: 'Em operação', valor: metrics.operating, detalhe: 'trabalhando', Icone: PlayCircle, tom: 'bg-emerald-50 text-[#176b4d]', status: FLEET_OPERATIONAL_STATUS.operating },
  { id: 'manutencao', titulo: 'Manutenção', valor: metrics.maintenance + metrics.waitingMaintenance, detalhe: 'em reparo ou na fila', Icone: Wrench, tom: 'bg-rose-50 text-rose-700', status: FLEET_OPERATIONAL_STATUS.maintenance },
  { id: 'disposicao', titulo: 'À disposição', valor: metrics.available, detalhe: 'liberadas, sem serviço', Icone: PauseCircle, tom: 'bg-amber-50 text-amber-700', status: FLEET_OPERATIONAL_STATUS.available },
  { id: 'confirmar', titulo: 'A confirmar', valor: metrics.pending, detalhe: 'falta informar', Icone: AlertTriangle, tom: 'bg-orange-50 text-[#f26a2e]', status: FLEET_OPERATIONAL_STATUS.pending },
  { id: 'disponibilidade', titulo: 'Disponível', valor: Math.round(metrics.availabilityRate), sufixo: '%', detalhe: 'fora da manutenção', Icone: Gauge, tom: 'bg-sky-50 text-sky-700' },
  { id: 'paradas', titulo: 'Horas paradas', valor: 0, texto: metrics.stoppedDurationLabel, detalhe: 'somadas no dia', Icone: Clock3, tom: 'bg-slate-100 text-slate-700' },
];

/** Resumo do dia no mesmo cartão do Quadro da Frota; tocar filtra a lista. */
export default function FleetKpiStrip({ metrics, status, onPick }: Props) {
  return (
    <section aria-label="Indicadores da frota" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
      {indicadores(metrics).map(item => {
        const ativo = item.status !== undefined && item.status !== 'Todos' && item.status === status;
        const conteudo = (
          <>
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 [overflow-wrap:anywhere] sm:tracking-[0.12em]">{item.titulo}</span>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${item.tom}`}><item.Icone className="size-4" aria-hidden="true" /></span>
            </span>
            {item.texto !== undefined
              ? <span className="mt-1 block text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{item.texto}</span>
              : <CountUp value={item.valor} suffix={item.sufixo} className="mt-1 block text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl" />}
            <span className="block text-xs text-slate-500">{item.detalhe}</span>
          </>
        );
        const classe = `${CARTAO} flex min-h-24 flex-col p-3 text-left transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:min-h-28 sm:p-3.5 ${ativo ? 'border-[#176b4d] ring-2 ring-[#176b4d]/15' : ''}`;
        return item.status !== undefined ? (
          <button
            key={item.id}
            type="button"
            data-fleet-enter
            data-testid={`frota-indicador-${item.id}`}
            aria-pressed={ativo || undefined}
            onClick={() => onPick(ativo ? 'Todos' : item.status!)}
            className={`${classe} hover:-translate-y-0.5 hover:border-emerald-300 active:scale-[0.98] ${FOCO}`}
          >
            {conteudo}
          </button>
        ) : (
          <div key={item.id} data-fleet-enter data-testid={`frota-indicador-${item.id}`} className={classe}>{conteudo}</div>
        );
      })}
    </section>
  );
}
