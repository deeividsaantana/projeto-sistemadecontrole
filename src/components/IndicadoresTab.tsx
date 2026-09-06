/**
 * Indicadores consolidados. Nenhum número é guardado: todos saem dos registros
 * dos módulos, então o indicador nunca diverge da operação. A comparação usa o
 * período anterior de mesmo tamanho, e sem base anterior não há variação
 * inventada.
 */
import { useMemo, useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { calcularIndicadores, type ContextoIndicadores, type Indicador } from '../utils/indicadores';
import { PageHeader, PeriodFilter, buildPeriod, type PeriodValue } from '../shared/ui';

interface IndicadoresTabProps {
  dados: Omit<ContextoIndicadores, 'hoje' | 'inicio' | 'fim' | 'inicioAnterior' | 'fimAnterior'>;
}

const somarDias = (data: string, dias: number) => {
  const base = new Date(`${data}T00:00:00`);
  base.setDate(base.getDate() + dias);
  return base.toISOString().slice(0, 10);
};

const diasEntre = (inicio: string, fim: string) =>
  Math.round((new Date(`${fim}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) / 86_400_000) + 1;

const formatar = (indicador: Indicador) =>
  `${indicador.valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${indicador.unidade ? ` ${indicador.unidade}` : ''}`;

const corDoValor = (indicador: Indicador) => {
  if (indicador.unidade !== '%') return 'text-slate-900';
  if (indicador.maiorMelhor) return indicador.valor >= 80 ? 'text-emerald-700' : indicador.valor >= 50 ? 'text-amber-700' : 'text-rose-700';
  return indicador.valor <= 20 ? 'text-emerald-700' : indicador.valor <= 50 ? 'text-amber-700' : 'text-rose-700';
};

export default function IndicadoresTab({ dados }: IndicadoresTabProps) {
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('mes'));

  const indicadores = useMemo(() => {
    const dias = diasEntre(period.from, period.to);
    return calcularIndicadores({
      ...dados,
      hoje: new Date().toISOString().slice(0, 10),
      inicio: period.from,
      fim: period.to,
      inicioAnterior: somarDias(period.from, -dias),
      fimAnterior: somarDias(period.from, -1),
    });
  }, [dados, period.from, period.to]);

  const porGrupo = useMemo(() => {
    const mapa = new Map<string, Indicador[]>();
    indicadores.forEach(item => mapa.set(item.grupo, [...(mapa.get(item.grupo) || []), item]));
    return [...mapa.entries()];
  }, [indicadores]);

  return (
    <div id="indicadores-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Indicadores"
        description="KPIs calculados sobre os registros dos módulos, comparados com o período anterior."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <div className="mt-4 space-y-4">
        {porGrupo.map(([grupo, itens]) => (
          <section key={grupo}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{grupo}</h2>
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {itens.map(indicador => {
                const Icone = indicador.tendencia === 'alta' ? TrendingUp : indicador.tendencia === 'baixa' ? TrendingDown : Minus;
                const bomSinal = indicador.variacao === undefined
                  ? false
                  : indicador.maiorMelhor ? indicador.variacao > 0 : indicador.variacao < 0;
                return (
                  <article key={indicador.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{indicador.titulo}</p>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                      <strong className={`text-2xl font-black tabular-nums ${corDoValor(indicador)}`}>{formatar(indicador)}</strong>
                      {indicador.variacao !== undefined && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${bomSinal ? 'text-emerald-700' : 'text-rose-700'}`}>
                          <Icone className="h-3.5 w-3.5" />
                          {indicador.variacao > 0 ? '+' : ''}{indicador.variacao}%
                        </span>
                      )}
                    </div>
                    {indicador.detalhe && <p className="mt-1 text-[11px] text-slate-500">{indicador.detalhe}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-slate-500">
        Variação comparada com o período anterior de mesmo tamanho. Sem base anterior, o indicador mostra só o valor atual.
      </p>
    </div>
  );
}
