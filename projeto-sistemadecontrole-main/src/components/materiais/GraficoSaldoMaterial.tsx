import { useMemo, useState } from 'react';
import { ChartColumn, Table2 } from 'lucide-react';
import type { MovimentoMaterial } from '../../types';
import { saldoPorSemana, type PontoSaldo } from '../../modules/materials/fichaMaterial';
import { FOCO } from '../cadastros/estilos';

const SEMANAS = 12;
const br = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

interface Props {
  materialId: string;
  unidade: string;
  hoje: string;
  movimentos: readonly MovimentoMaterial[];
}

/**
 * Saldo do material no fim de cada uma das últimas 12 semanas. Uma série só,
 * então uma cor basta; o valor de cada semana fica sempre legível ao lado,
 * sem precisar acertar o mouse na barra.
 */
export default function GraficoSaldoMaterial({ materialId, unidade, hoje, movimentos }: Props) {
  const [emTabela, setEmTabela] = useState(false);
  const [destaque, setDestaque] = useState<number | null>(null);
  const pontos = useMemo(() => saldoPorSemana(movimentos, materialId, hoje, SEMANAS), [materialId, hoje, movimentos]);
  const valores = pontos.map(ponto => ponto.saldo);
  const maior = Math.max(1, ...valores);
  const menor = Math.min(0, ...valores);
  const amplitude = maior - menor || 1;
  const ponto = destaque === null ? null : pontos[destaque];
  const resumoDe = (item: PontoSaldo) => `Semana de ${item.rotulo}: saldo de ${br(item.saldo)} ${unidade}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Saldo nas últimas 12 semanas</h3>
        <button
          type="button"
          onClick={() => setEmTabela(atual => !atual)}
          aria-pressed={emTabela}
          aria-label={emTabela ? 'Ver como gráfico' : 'Ver como tabela'}
          title={emTabela ? 'Ver como gráfico' : 'Ver como tabela'}
          className={`grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition duration-200 hover:border-emerald-500 hover:text-[#176b4d] ${FOCO}`}
        >
          {emTabela ? <ChartColumn className="size-4" aria-hidden="true" /> : <Table2 className="size-4" aria-hidden="true" />}
        </button>
      </div>

      {emTabela ? (
        <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Saldo por semana, em {unidade}</caption>
            <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Semana de</th><th className="px-3 py-2 text-right">Saldo</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...pontos].reverse().map(item => (
                <tr key={item.inicio}>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{item.rotulo}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${item.saldo < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{br(item.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3">
          <div className="grid h-32 items-end gap-1 border-b border-slate-200 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${SEMANAS}, minmax(0, 1fr))` }} onMouseLeave={() => setDestaque(null)}>
            {pontos.map((item, indice) => (
              <div
                key={item.inicio}
                role="img"
                tabIndex={0}
                aria-label={resumoDe(item)}
                onMouseEnter={() => setDestaque(indice)}
                onFocus={() => setDestaque(indice)}
                onBlur={() => setDestaque(null)}
                onClick={() => setDestaque(atual => (atual === indice ? null : indice))}
                className={`flex h-full min-w-0 cursor-default items-end justify-center rounded-t-lg outline-none transition-colors ${destaque === indice ? 'bg-slate-100' : ''} focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60`}
              >
                <span
                  className={`w-2 rounded-t-[3px] sm:w-3 ${item.saldo < 0 ? 'bg-rose-500' : 'bg-[#176b4d]'}`}
                  style={{ height: `max(2px, ${((item.saldo - menor) / amplitude) * 100}%)` }}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-1 pt-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${SEMANAS}, minmax(0, 1fr))` }} aria-hidden="true">
            {pontos.map((item, indice) => (
              <span key={item.inicio} className={`text-center text-[10px] tabular-nums text-slate-500 ${indice % 2 ? 'max-sm:invisible' : ''}`}>{item.rotulo}</span>
            ))}
          </div>
          <p className="mt-2 min-h-9 rounded-xl bg-slate-50 px-3 py-1.5 text-sm text-slate-700" aria-live="polite">
            {ponto
              ? <><strong className="text-slate-900">Semana de {ponto.rotulo}:</strong> saldo de {br(ponto.saldo)} {unidade}</>
              : 'Toque ou passe o mouse numa semana para ver o saldo.'}
          </p>
        </div>
      )}
    </div>
  );
}
