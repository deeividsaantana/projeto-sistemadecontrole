/**
 * Indicadores consolidados. Nenhum número é guardado: todos saem dos registros
 * dos módulos, então o indicador nunca diverge da operação. A comparação usa o
 * período anterior de mesmo tamanho, e sem base anterior não há variação
 * inventada.
 */
import { useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Gauge, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { calcularIndicadores, type ContextoIndicadores, type Indicador } from '../utils/indicadores';
import { CountUp, PageHeader, PeriodFilter, buildPeriod, type PeriodValue } from '../shared/ui';

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
  const [grupoAtivo, setGrupoAtivo] = useState('Todos');
  const [indicadorAtivo, setIndicadorAtivo] = useState<string>('disponibilidade-frota');

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

  const grupos = useMemo(() => ['Todos', ...porGrupo.map(([grupo]) => grupo)], [porGrupo]);
  const visiveis = useMemo(
    () => grupoAtivo === 'Todos' ? indicadores : indicadores.filter(item => item.grupo === grupoAtivo),
    [grupoAtivo, indicadores],
  );
  const selecionado = visiveis.find(item => item.id === indicadorAtivo) || visiveis[0] || indicadores[0];
  const percentuais = indicadores.filter(item => item.unidade === '%');
  const leituraSaudavel = percentuais.length
    ? Math.round(percentuais.reduce((total, item) => total + (item.maiorMelhor ? item.valor : 100 - item.valor), 0) / percentuais.length)
    : 0;
  const comComparacao = indicadores.filter(item => item.variacao !== undefined);
  const melhorando = comComparacao.filter(item => item.variacao !== undefined && (item.maiorMelhor ? item.variacao > 0 : item.variacao < 0)).length;
  const escala = (item: Indicador) => item.unidade === '%'
    ? Math.max(0, Math.min(100, item.valor))
    : Math.max(8, Math.min(100, (item.valor / Math.max(1, ...visiveis.map(value => value.valor))) * 100));

  return (
    <div id="indicadores-tab" className="min-h-full w-full bg-white px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Indicadores"
        description="KPIs calculados sobre os registros dos módulos, comparados com o período anterior."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <section className="mt-5 grid overflow-hidden border border-slate-200 bg-white xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.55fr)]">
        <div className="min-w-0 p-5 md:p-7">
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-700">Pulso da operação</span>
              <div className="mt-2 flex items-end gap-3">
                <strong className="text-5xl font-black leading-none tracking-[-.06em] text-slate-950 md:text-7xl"><CountUp value={leituraSaudavel} />%</strong>
                <span className="mb-1 max-w-36 text-xs font-semibold leading-snug text-slate-500">leitura consolidada dos indicadores percentuais</span>
              </div>
            </div>
            <div className="flex gap-7">
              <div><span className="block text-2xl font-black text-slate-950">{indicadores.length}</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">métricas reais</span></div>
              <div><span className="block text-2xl font-black text-emerald-700">{melhorando}/{comComparacao.length}</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">evoluindo</span></div>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Grupos de indicadores">
            {grupos.map(grupo => <button key={grupo} type="button" role="tab" aria-selected={grupoAtivo === grupo} onClick={() => setGrupoAtivo(grupo)} className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-black transition-all ${grupoAtivo === grupo ? 'border-emerald-900 bg-emerald-950 text-white shadow-[0_8px_24px_rgba(6,78,59,.18)]' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800'}`}>{grupo}</button>)}
          </div>

          <div className="mt-5 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2">
            {visiveis.map(indicador => {
                const Icone = indicador.tendencia === 'alta' ? TrendingUp : indicador.tendencia === 'baixa' ? TrendingDown : Minus;
                const bomSinal = indicador.variacao === undefined
                  ? false
                  : indicador.maiorMelhor ? indicador.variacao > 0 : indicador.variacao < 0;
                return (
                  <button key={indicador.id} type="button" onClick={() => setIndicadorAtivo(indicador.id)} aria-pressed={selecionado?.id === indicador.id} className={`group relative min-w-0 bg-white p-5 text-left transition-colors hover:bg-emerald-50/50 ${selecionado?.id === indicador.id ? 'z-10 shadow-[inset_3px_0_0_#0f8a62]' : ''}`}>
                    <div className="flex items-start justify-between gap-3"><p className="text-[10px] font-bold uppercase leading-tight tracking-[.12em] text-slate-500">{indicador.titulo}</p><ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-700" /></div>
                    <div className="mt-3 flex flex-wrap items-baseline gap-2">
                      <strong className={`text-3xl font-black tabular-nums tracking-[-.04em] ${corDoValor(indicador)}`}>{formatar(indicador)}</strong>
                      {indicador.variacao !== undefined && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${bomSinal ? 'text-emerald-700' : 'text-rose-700'}`}>
                          <Icone className="h-3.5 w-3.5" />
                          {indicador.variacao > 0 ? '+' : ''}{indicador.variacao}%
                        </span>
                      )}
                    </div>
                    {indicador.detalhe && <p className="mt-1 text-[11px] text-slate-500">{indicador.detalhe}</p>}
                    <div className="mt-4 h-1 overflow-hidden bg-slate-100"><span className="block h-full origin-left bg-emerald-600 transition-[width] duration-700 ease-out" style={{ width: `${escala(indicador)}%` }} /></div>
                  </button>
                );
              })}
          </div>
        </div>

        <aside className="relative flex min-h-[26rem] flex-col justify-between overflow-hidden border-t border-slate-200 bg-[#f4f7f4] p-6 xl:border-l xl:border-t-0 md:p-8">
          <div className="absolute -right-16 -top-16 size-56 rounded-full border-[38px] border-emerald-100/70" />
          <div className="relative">
            <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-800">Leitura em foco</span><Gauge className="h-5 w-5 text-emerald-700" /></div>
            <p className="mt-10 max-w-xs text-sm font-bold uppercase tracking-wide text-slate-500">{selecionado?.grupo}</p>
            <h2 className="mt-2 max-w-md text-3xl font-black leading-[1.02] tracking-[-.045em] text-slate-950">{selecionado?.titulo}</h2>
            <strong className={`mt-7 block text-6xl font-black tracking-[-.065em] ${selecionado ? corDoValor(selecionado) : 'text-slate-950'}`}>{selecionado ? formatar(selecionado) : '—'}</strong>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">{selecionado?.detalhe || 'Indicador calculado diretamente sobre os registros operacionais do período.'}</p>
          </div>
          <div className="relative mt-10">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800"><Activity className="h-4 w-4 text-emerald-700" /> Comparação com o período anterior</div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-300 pt-4">
              <span className="text-xs text-slate-500">Variação apurada</span>
              <strong className="text-xl font-black text-slate-950">{selecionado?.variacao === undefined ? 'Sem base' : `${selecionado.variacao > 0 ? '+' : ''}${selecionado.variacao}%`}</strong>
            </div>
          </div>
        </aside>
      </section>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Variação comparada com o período anterior de mesmo tamanho. Sem base anterior, o indicador mostra só o valor atual.
      </p>
    </div>
  );
}
