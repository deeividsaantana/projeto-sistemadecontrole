import { useId } from 'react';
import { cn } from './styles';

type ChartTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TRACO: Record<ChartTone, string> = {
  success: '#087353',
  warning: '#d97706',
  danger: '#e11d48',
  info: '#0284c7',
  neutral: '#64748b',
};

const BARRA: Record<ChartTone, string> = {
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  danger: 'bg-rose-600',
  info: 'bg-sky-600',
  neutral: 'bg-slate-400',
};

interface ProgressBarProps {
  /** 0 a 100. Acima de 100 a barra enche e o excedente aparece no rótulo. */
  valor: number;
  tone?: ChartTone;
  rotulo?: string;
  className?: string;
}

/**
 * Barra de avanço. Estava reescrita em produção, planejamento, orçamento e
 * custos, cada uma com uma altura e uma cor diferentes para a mesma ideia.
 */
export function ProgressBar({ valor, tone = 'success', rotulo, className }: ProgressBarProps) {
  const largura = Math.max(0, Math.min(100, Number(valor) || 0));
  return (
    <div className={cn('flex min-w-24 items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={Math.round(valor)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none', BARRA[tone])}
          style={{ width: `${largura}%` }}
        />
      </div>
      {rotulo !== undefined && <span className="shrink-0 font-mono text-[11px] font-bold text-slate-700">{rotulo}</span>}
    </div>
  );
}

interface SparklineProps {
  valores: number[];
  tone?: ChartTone;
  /** Rótulo acessível: o gráfico é decorativo sem uma frase que o descreva. */
  descricao: string;
  className?: string;
}

/** Linha de tendência sem biblioteca: SVG puro, alguns bytes, zero dependência. */
export function Sparkline({ valores, tone = 'success', descricao, className }: SparklineProps) {
  const id = useId();
  if (valores.length < 2) return null;
  const maior = Math.max(...valores);
  const menor = Math.min(...valores);
  const amplitude = maior - menor || 1;
  const pontos = valores.map((valor, indice) => {
    const x = (indice / (valores.length - 1)) * 100;
    const y = 28 - ((valor - menor) / amplitude) * 24 - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const cor = TRACO[tone];

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label={descricao} className={cn('h-8 w-full', className)}>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,28 ${pontos.join(' ')} 100,28`} fill={`url(#spark-${id})`} />
      <polyline points={pontos.join(' ')} fill="none" stroke={cor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface BarrasProps {
  dados: Array<{ rotulo: string; valor: number }>;
  tone?: ChartTone;
  formatar?: (valor: number) => string;
  className?: string;
}

/** Barras verticais para séries curtas (dias, tipos). Escala pelo maior valor. */
export function BarrasMini({ dados, tone = 'success', formatar, className }: BarrasProps) {
  const pico = dados.reduce((maior, item) => Math.max(maior, item.valor), 0);
  if (dados.length === 0) return null;
  return (
    <ul className={cn('flex items-end gap-1.5 overflow-x-auto', className)}>
      {dados.map(item => (
        <li key={item.rotulo} className="flex min-w-0 flex-1 shrink-0 basis-8 flex-col items-center gap-1">
          <span className="text-[10px] font-bold tabular-nums text-slate-500">
            {formatar ? formatar(item.valor) : item.valor.toLocaleString('pt-BR')}
          </span>
          <span
            className={cn('w-full rounded-t transition-[height] duration-500 ease-out motion-reduce:transition-none', BARRA[tone])}
            style={{ height: `${pico > 0 ? Math.max(6, (item.valor / pico) * 72) : 6}px` }}
            title={`${item.rotulo}: ${item.valor}`}
          />
          <span className="text-[9px] text-slate-400">{item.rotulo}</span>
        </li>
      ))}
    </ul>
  );
}
