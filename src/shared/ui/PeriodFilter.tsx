import { CalendarRange } from 'lucide-react';
import { cn } from './styles';

export type PeriodPreset = 'hoje' | 'ontem' | 'semana' | 'mes' | 'personalizado';

export interface PeriodValue {
  preset: PeriodPreset;
  /** Início do período, em YYYY-MM-DD. */
  from: string;
  /** Fim do período, inclusive, em YYYY-MM-DD. */
  to: string;
}

/**
 * Data local em YYYY-MM-DD. `toISOString` devolveria o dia seguinte à noite no
 * horário de Brasília, o que jogaria os lançamentos do fim do expediente para
 * fora do filtro "hoje".
 */
export const isoDay = (date: Date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const shiftDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

/** Converte um atalho de período nas datas de início e fim correspondentes. */
export const buildPeriod = (preset: PeriodPreset, from?: string, to?: string): PeriodValue => {
  const today = isoDay(new Date());
  if (preset === 'ontem') {
    const yesterday = isoDay(shiftDays(-1));
    return { preset, from: yesterday, to: yesterday };
  }
  if (preset === 'semana') return { preset, from: isoDay(shiftDays(-6)), to: today };
  if (preset === 'mes') return { preset, from: isoDay(shiftDays(-29)), to: today };
  if (preset === 'personalizado') return { preset, from: from || today, to: to || today };
  return { preset: 'hoje', from: today, to: today };
};

const PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: 'semana', label: '7 dias' },
  { id: 'mes', label: '30 dias' },
  { id: 'personalizado', label: 'Personalizado' },
];

interface PeriodFilterProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  className?: string;
}

/** Filtro de período usado nas telas analíticas. */
export function PeriodFilter({ value, onChange, className }: PeriodFilterProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {PRESETS.map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(buildPeriod(preset.id, value.from, value.to))}
            aria-pressed={value.preset === preset.id}
            className={cn(
              'min-h-9 rounded-md px-3 text-xs font-bold transition-colors',
              value.preset === preset.id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value.preset === 'personalizado' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
          <CalendarRange className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="date"
            value={value.from}
            max={value.to}
            onChange={event => onChange({ ...value, from: event.target.value })}
            aria-label="Início do período"
            className="min-h-8 rounded border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-emerald-500"
          />
          <span className="text-xs text-slate-400">até</span>
          <input
            type="date"
            value={value.to}
            min={value.from}
            onChange={event => onChange({ ...value, to: event.target.value })}
            aria-label="Fim do período"
            className="min-h-8 rounded border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-emerald-500"
          />
        </div>
      )}
    </div>
  );
}
