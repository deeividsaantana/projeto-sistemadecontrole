import { useMemo, useState } from 'react';
import { CalendarClock, Hammer, Pencil, Ruler, Target, TrendingUp } from 'lucide-react';
import type { CravacaoEstaca } from '../../types';
import {
  estaCravada,
  nomeDaEstaca,
  previsaoDeTermino,
  resumirEstacas,
  ritmoDosDias,
  type FrenteEstacas,
} from '../../modules/estacas/avancoEstacas';
import { formatarData, numero } from '../../utils/formato';
import { CountUp } from '../../shared/ui';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CARTAO, FOCO } from '../cadastros/estilos';
import CortinaEstacas from './CortinaEstacas';

interface Props {
  hoje: string;
  estacas: readonly CravacaoEstaca[];
  frentes: readonly FrenteEstacas[];
  frenteAtual: string;
  onFrente: (frente: string) => void;
  onCravar: (estaca?: CravacaoEstaca, frente?: string) => void;
  onEditar: (estaca: CravacaoEstaca) => void;
  onPlanejar: (frente?: string) => void;
}

/** Anel de porcentagem do concluído. */
function Anel({ valor }: { valor: number }) {
  const raio = 30;
  const volta = 2 * Math.PI * raio;
  const parte = Math.max(0, Math.min(100, valor));
  return (
    <svg viewBox="0 0 76 76" className="size-20 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="38" cy="38" r={raio} fill="none" strokeWidth="9" className="cortina-anel-fundo" />
      <circle cx="38" cy="38" r={raio} fill="none" strokeWidth="9" strokeLinecap="round" className="cortina-anel" strokeDasharray={volta} strokeDashoffset={volta * (1 - parte / 100)} />
    </svg>
  );
}

/**
 * Visão geral: os quatro números que a obra pergunta (quantas tem que cravar,
 * quantas já foram, quantas faltam e a porcentagem), a cortina desenhada da
 * frente escolhida e o ritmo dos últimos 14 dias.
 */
export default function VisaoEstacas({ hoje, estacas, frentes, frenteAtual, onFrente, onCravar, onEditar, onPlanejar }: Props) {
  const [escolhidaId, setEscolhidaId] = useState<string | null>(null);
  const total = useMemo(() => resumirEstacas(estacas), [estacas]);
  const ritmo = useMemo(() => ritmoDosDias(estacas, hoje, 14), [estacas, hoje]);
  const previsao = useMemo(() => previsaoDeTermino(estacas, hoje), [estacas, hoje]);
  const frente = frentes.find(item => item.frente === frenteAtual) ?? frentes[0];
  const escolhida = frente?.estacas.find(item => item.id === escolhidaId) ?? null;
  const maiorDia = Math.max(1, ...ritmo.map(dia => dia.cravadas));

  if (!estacas.length) {
    return (
      <section data-estacas-reveal className={`${CARTAO} p-6 text-center sm:p-10`}>
        <Target className="mx-auto size-10 text-[#176b4d]" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Nenhuma estaca lançada ainda</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Comece dizendo quantas estacas a frente precisa. Depois é só marcar cada uma quando for cravada.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => onPlanejar()} className={BOTAO_PRIMARIO}><Target className="size-5" aria-hidden="true" /> Informar quantas estacas</button>
          <button type="button" onClick={() => onCravar()} className={BOTAO_SECUNDARIO}><Hammer className="size-5" aria-hidden="true" /> Lançar uma cravação</button>
        </div>
      </section>
    );
  }

  const cartoes = [
    { nome: 'Total a cravar', valor: total.previstas, ajuda: 'Estacas previstas em todas as frentes', Icone: Target, tom: 'text-slate-900' },
    { nome: 'Já cravadas', valor: total.cravadas, ajuda: `${numero(total.metrosCravados, 1)} m dentro da terra`, Icone: Hammer, tom: 'text-[#176b4d]' },
    { nome: 'Faltam', valor: total.faltam, ajuda: total.metrosACravar ? `${numero(total.metrosACravar, 1)} m de estaca` : 'Estacas ainda a cravar', Icone: Ruler, tom: total.faltam ? 'text-[#f26a2e]' : 'text-[#176b4d]' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div data-estacas-reveal className={`${CARTAO} estacas-vivo flex items-center gap-4 p-4 col-span-2 xl:col-span-1`}>
          <Anel valor={total.porcentagem} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-600">Concluído</p>
            <p className="text-3xl font-black tabular-nums text-slate-900"><CountUp value={total.porcentagem} format={valor => numero(valor, 1)} suffix="%" /></p>
            <p className="text-xs text-slate-500">{total.cravadas.toLocaleString('pt-BR')} de {total.previstas.toLocaleString('pt-BR')} estacas</p>
          </div>
        </div>
        {cartoes.map(({ nome, valor, ajuda, Icone, tom }) => (
          <div key={nome} data-estacas-reveal className={`${CARTAO} estacas-vivo p-4 ${nome === 'Faltam' ? 'max-sm:col-span-2' : ''}`}>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Icone className="size-4 text-[#718087]" aria-hidden="true" /> {nome}</p>
            <p className={`mt-1 text-3xl font-black tabular-nums ${tom}`}><CountUp value={valor} /></p>
            <p className="text-xs text-slate-500">{ajuda}</p>
          </div>
        ))}
      </div>

      {frente && (
        <section data-estacas-reveal className={`${CARTAO} p-4 sm:p-5`} aria-labelledby="estacas-cortina-titulo">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[#718087]">Cortina de estacas</p>
              <h2 id="estacas-cortina-titulo" className="text-xl font-bold text-slate-900">{frente.frente}</h2>
              <p className="text-sm text-slate-600">
                {frente.cravadas.toLocaleString('pt-BR')} de {frente.previstas.toLocaleString('pt-BR')} cravadas · faltam {frente.faltam.toLocaleString('pt-BR')} · {numero(frente.porcentagem, 1)}%
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onPlanejar(frente.frente)} className={BOTAO_SECUNDARIO}><Target className="size-5" aria-hidden="true" /> Total previsto</button>
              <button type="button" onClick={() => onCravar(frente.proxima, frente.frente)} className={BOTAO_PRIMARIO}><Hammer className="size-5" aria-hidden="true" /> {frente.proxima ? `Cravar ${nomeDaEstaca(frente.proxima)}` : 'Lançar cravação'}</button>
            </div>
          </div>

          {frentes.length > 1 && (
            <div role="group" aria-label="Escolher frente" className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {frentes.map(item => (
                <button
                  key={item.frente}
                  type="button"
                  aria-pressed={item.frente === frente.frente}
                  onClick={() => { onFrente(item.frente); setEscolhidaId(null); }}
                  className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition duration-200 ${FOCO} ${item.frente === frente.frente ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}
                >
                  {item.frente} <span className="tabular-nums opacity-80">{numero(item.porcentagem, 0)}%</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-full rounded-full bg-[#176b4d] transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${Math.min(100, frente.porcentagem)}%` }} />
          </div>

          <div className="mt-4">
            <CortinaEstacas frente={frente} escolhidaId={escolhidaId} onEscolher={estaca => setEscolhidaId(atual => (atual === estaca.id ? null : estaca.id))} />
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600" aria-label="Legenda">
            <li className="flex items-center gap-2"><span className="inline-block h-4 w-3 rounded-sm bg-[#176b4d]" aria-hidden="true" /> Cravada</li>
            <li className="flex items-center gap-2"><span className="inline-block h-4 w-3 rounded-sm bg-emerald-200" aria-hidden="true" /> Sobra acima do chão</li>
            <li className="flex items-center gap-2"><span className="inline-block h-4 w-3 rounded-sm border border-dashed border-[#f26a2e] bg-orange-50" aria-hidden="true" /> Próxima</li>
            <li className="flex items-center gap-2"><span className="inline-block h-4 w-3 rounded-sm border border-dashed border-[#718087] bg-slate-50" aria-hidden="true" /> A cravar</li>
          </ul>

          {frente.faltam === 0 && (
            <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              Todas as estacas lançadas nesta frente estão cravadas. Se ainda falta cravar, use <b>Total previsto</b> para dizer quantas a frente precisa.
            </p>
          )}

          {escolhida && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[#f7f8f6] p-4" aria-live="polite">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{nomeDaEstaca(escolhida)}</p>
                <p className="text-sm text-slate-600">
                  {estaCravada(escolhida)
                    ? `Cravada em ${formatarData(escolhida.data)} · ${numero(escolhida.comprimentoCravadoM, 2)} m de ${numero(escolhida.comprimentoM, 2)} m · sobra ${numero(escolhida.sobraM, 2)} m${escolhida.perdaM ? ` · perda ${numero(escolhida.perdaM, 2)} m` : ''}`
                    : `A cravar${Number(escolhida.comprimentoM) > 0 ? ` · estaca de ${numero(escolhida.comprimentoM, 2)} m` : ''}`}
                </p>
              </div>
              {estaCravada(escolhida)
                ? <button type="button" onClick={() => onEditar(escolhida)} className={BOTAO_SECUNDARIO}><Pencil className="size-5" aria-hidden="true" /> Corrigir</button>
                : <button type="button" onClick={() => onCravar(escolhida, frente.frente)} className={BOTAO_PRIMARIO}><Hammer className="size-5" aria-hidden="true" /> Lançar cravação</button>}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section data-estacas-reveal className={`${CARTAO} p-4 sm:p-5`} aria-labelledby="estacas-ritmo-titulo">
          <h2 id="estacas-ritmo-titulo" className="flex items-center gap-2 text-base font-bold text-slate-900"><TrendingUp className="size-5 text-[#176b4d]" aria-hidden="true" /> Estacas cravadas por dia</h2>
          <p className="text-sm text-slate-500">Últimos 14 dias</p>
          <ol className="mt-4 flex h-36 items-end gap-1.5" aria-label="Estacas cravadas em cada dia">
            {ritmo.map(dia => (
              <li key={dia.data} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${formatarData(dia.data)}: ${dia.cravadas} estaca(s), ${numero(dia.metros, 1)} m`}>
                <span className="text-xs font-bold tabular-nums text-slate-700">{dia.cravadas || ''}</span>
                <span
                  data-barra
                  className={`w-full max-w-8 rounded-t-md ${dia.data === hoje ? 'bg-[#f26a2e]' : 'bg-[#176b4d]'} ${dia.cravadas ? '' : 'opacity-15'}`}
                  style={{ height: `${Math.max(4, (dia.cravadas / maiorDia) * 100)}%` }}
                />
                <span className="text-[11px] tabular-nums text-slate-500">{dia.data.slice(8, 10)}</span>
                <span className="sr-only">{formatarData(dia.data)}: {dia.cravadas} estaca(s)</span>
              </li>
            ))}
          </ol>
        </section>

        <section data-estacas-reveal className={`${CARTAO} p-4 sm:p-5`} aria-labelledby="estacas-previsao-titulo">
          <h2 id="estacas-previsao-titulo" className="flex items-center gap-2 text-base font-bold text-slate-900"><CalendarClock className="size-5 text-[#176b4d]" aria-hidden="true" /> No ritmo atual</h2>
          {previsao.diasDeTrabalho === null ? (
            <p className="mt-2 text-sm text-slate-600">Sem cravação nos últimos 14 dias, então não dá para prever o término.</p>
          ) : previsao.diasDeTrabalho === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Não falta nenhuma estaca prevista.</p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{previsao.diasDeTrabalho.toLocaleString('pt-BR')} <span className="text-base font-semibold text-slate-600">dias de trabalho</span></p>
              <p className="text-sm text-slate-600">para cravar as {previsao.faltam.toLocaleString('pt-BR')} que faltam, a {numero(previsao.mediaPorDia, 1)} estacas por dia trabalhado.</p>
            </>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-[#f7f8f6] p-3"><dt className="text-slate-500">Aço cravado</dt><dd className="font-bold tabular-nums text-slate-900">{numero(total.metrosUsados, 1)} m</dd></div>
            <div className="rounded-xl bg-[#f7f8f6] p-3"><dt className="text-slate-500">Perda</dt><dd className="font-bold tabular-nums text-slate-900">{numero(total.perdaM, 1)} m</dd></div>
          </dl>
        </section>
      </div>

      {frentes.length > 1 && (
        <section data-estacas-reveal className={`${CARTAO} p-4 sm:p-5`} aria-labelledby="estacas-frentes-titulo">
          <h2 id="estacas-frentes-titulo" className="text-base font-bold text-slate-900">Por frente</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {frentes.map(item => (
              <li key={item.frente}>
                <button type="button" onClick={() => { onFrente(item.frente); setEscolhidaId(null); }} className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-2 py-3 text-left hover:bg-emerald-50 ${FOCO}`}>
                  <span className="min-w-0 flex-1 font-semibold text-slate-900">{item.frente}</span>
                  <span className="text-sm tabular-nums text-slate-600">{item.cravadas}/{item.previstas} · faltam {item.faltam}</span>
                  <span className="h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:w-40"><span className="block h-full rounded-full bg-[#176b4d]" style={{ width: `${Math.min(100, item.porcentagem)}%` }} /></span>
                  <span className="w-12 text-right text-sm font-bold tabular-nums text-slate-900">{numero(item.porcentagem, 0)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
