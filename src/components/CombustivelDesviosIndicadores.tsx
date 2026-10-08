import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { DesvioAnalise, DesvioSeveridade } from '../modules/frota/fuelHistoryAdvanced';

interface DesviosBadgeProps {
  desvios: DesvioAnalise[];
  compact?: boolean;
}

const CORES_SEVERIDADE: Record<DesvioSeveridade, { bg: string; text: string; icon: string }> = {
  info: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
  aviso: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500' },
  alerta: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-500' },
};

const ICONES_SEVERIDADE: Record<DesvioSeveridade, React.ReactNode> = {
  info: <Info size={16} />,
  aviso: <AlertTriangle size={16} />,
  alerta: <AlertCircle size={16} />,
};

const RÓTULOS_TIPO: Record<string, string> = {
  consumo: 'Consumo',
  sequencia_bomba: 'Bomba',
  km: 'KM',
  horimetro: 'Horímetro',
};

export function DesviosBadge({ desvios, compact = false }: DesviosBadgeProps) {
  if (desvios.length === 0) return null;

  if (compact) {
    const contagem = desvios.length;
    const severidadeMax = desvios.reduce((max, d) => {
      const ordem = { info: 0, aviso: 1, alerta: 2 };
      return ordem[d.severidade] > ordem[max] ? d.severidade : max;
    }, 'info' as DesvioSeveridade);

    const cores = CORES_SEVERIDADE[severidadeMax];
    return (
      <div
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${cores.bg} ${cores.text}`}
        title={desvios.map(d => d.mensagem).join('\n')}
      >
        <span className={cores.icon}>{ICONES_SEVERIDADE[severidadeMax]}</span>
        <span>{contagem} desvio{contagem > 1 ? 's' : ''}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {desvios.map((desvio, idx) => {
        const cores = CORES_SEVERIDADE[desvio.severidade];
        return (
          <div
            key={idx}
            className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${cores.bg} ${cores.text}`}
          >
            <span className={`mt-0.5 flex-shrink-0 ${cores.icon}`}>{ICONES_SEVERIDADE[desvio.severidade]}</span>
            <div className="flex-1">
              <strong>{RÓTULOS_TIPO[desvio.tipo] || desvio.tipo}</strong>: {desvio.mensagem}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DesviosIndicadorLinha({ desvios }: { desvios: DesvioAnalise[] }) {
  if (desvios.length === 0) return null;

  const severidadeMax = desvios.reduce((max, d) => {
    const ordem = { info: 0, aviso: 1, alerta: 2 };
    return ordem[d.severidade] > ordem[max] ? d.severidade : max;
  }, 'info' as DesvioSeveridade);

  const cores = CORES_SEVERIDADE[severidadeMax];
  return (
    <div className={`flex h-1 w-full ${cores.bg}`}>
      <div className={`h-full w-full border-l-4 ${cores.text}`} />
    </div>
  );
}
