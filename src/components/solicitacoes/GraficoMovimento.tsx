import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { DiaDeMovimento } from '../../utils/relatorioSolicitacoes';
import { CARTAO, FOCO, reduzMovimento } from '../cadastros/estilos';

const LARGURA = 640;
const ALTURA = 200;

const SERIES = [
  { chave: 'abertos', nome: 'Abertos', cor: '#2a78d6' },
  { chave: 'aprovados', nome: 'Aprovados', cor: '#eda100' },
  { chave: 'entregues', nome: 'Entregues', cor: '#1baf7a' },
] as const;
type Serie = typeof SERIES[number]['chave'];

const br = (valor: number) => valor.toLocaleString('pt-BR');

/**
 * Linhas por dia do período, no mesmo jeito do gráfico da Presença e
 * Controle: a legenda liga e desliga cada linha e passar o dedo ou o mouse
 * mostra os números do dia.
 */
export function GraficoMovimento({ pontos }: { pontos: readonly DiaDeMovimento[] }) {
  const raiz = useRef<HTMLElement>(null);
  const [destaque, setDestaque] = useState<number | null>(null);
  const [ocultas, setOcultas] = useState<Serie[]>([]);
  const visiveis = SERIES.filter(serie => !ocultas.includes(serie.chave));
  const maior = Math.max(1, ...pontos.flatMap(ponto => visiveis.map(serie => ponto[serie.chave])));
  const xDe = (indice: number) => (pontos.length > 1 ? (indice * LARGURA) / (pontos.length - 1) : LARGURA / 2);
  const yDe = (valor: number) => ALTURA - (valor / maior) * (ALTURA - 8);
  const assinatura = `${pontos.map(ponto => `${ponto.iso}:${ponto.abertos}:${ponto.entregues}`).join('|')}#${ocultas.join(',')}`;
  const vazio = pontos.every(ponto => !ponto.abertos && !ponto.aprovados && !ponto.entregues);

  useGSAP(() => {
    if (reduzMovimento() || !raiz.current) return;
    const cortina = raiz.current.querySelector('[data-cortina]');
    if (cortina) gsap.fromTo(cortina, { attr: { width: 0 } }, { attr: { width: LARGURA }, duration: 0.9, ease: 'power2.out' });
  }, { scope: raiz, dependencies: [assinatura] });

  const escolher = (evento: React.PointerEvent<HTMLDivElement>) => {
    const caixa = evento.currentTarget.getBoundingClientRect();
    if (!caixa.width || !pontos.length) return;
    const proporcao = Math.min(1, Math.max(0, (evento.clientX - caixa.left) / caixa.width));
    setDestaque(Math.round(proporcao * (pontos.length - 1)));
  };
  const ponto = destaque === null ? null : pontos[destaque];
  const quantosRotulos = Math.min(5, pontos.length);
  const comRotulo = new Set(Array.from({ length: quantosRotulos }, (_, parte) => (
    quantosRotulos > 1 ? Math.round((parte * (pontos.length - 1)) / (quantosRotulos - 1)) : 0
  )));

  return (
    <article ref={raiz} className={`${CARTAO} min-w-0 p-4`} aria-labelledby="sol-linhas">
      <h2 id="sol-linhas" className="text-base font-bold text-slate-900">Movimento dia a dia</h2>
      <p className="text-sm text-slate-500">Pedidos abertos, aprovados e entregues em cada dia</p>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Linhas do gráfico">
        {SERIES.map(serie => {
          const ligada = !ocultas.includes(serie.chave);
          return (
            <button
              key={serie.chave}
              type="button"
              aria-pressed={ligada}
              onClick={() => setOcultas(atual => (ligada
                ? (atual.length < SERIES.length - 1 ? [...atual, serie.chave] : atual)
                : atual.filter(item => item !== serie.chave)))}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition duration-200 ${ligada ? 'border-slate-200 bg-white text-slate-800' : 'border-dashed border-slate-200 bg-slate-50 text-slate-500'} ${FOCO}`}
            >
              <i className={`h-1 w-4 rounded-full ${ligada ? '' : 'opacity-30'}`} style={{ backgroundColor: serie.cor }} aria-hidden="true" />
              {serie.nome}
            </button>
          );
        })}
      </div>

      {vazio ? (
        <p className="grid h-52 place-items-center text-center text-sm text-slate-500">Nenhum movimento neste período.</p>
      ) : (
        <div className="mt-3">
          <div className="relative pl-8">
            <span className="absolute left-0 top-0 text-xs tabular-nums text-slate-500">{br(maior)}</span>
            <span className="absolute bottom-0 left-0 text-xs tabular-nums text-slate-500">0</span>
            <div className="relative h-52 touch-pan-y" onPointerMove={escolher} onPointerDown={escolher} onPointerLeave={() => setDestaque(null)}>
              <svg
                viewBox={`0 0 ${LARGURA} ${ALTURA}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
                role="img"
                aria-label={`Movimento por dia: ${pontos.filter(item => item.abertos || item.entregues).map(item => `${item.rotulo}, ${item.abertos} abertos e ${item.entregues} entregues`).join('; ')}`}
              >
                <defs>
                  <clipPath id="sol-cortina"><rect data-cortina x="0" y="-10" width={LARGURA} height={ALTURA + 20} /></clipPath>
                </defs>
                {[0, 0.5, 1].map(parte => (
                  <line key={parte} x1="0" x2={LARGURA} y1={ALTURA * parte} y2={ALTURA * parte} stroke="#e2e8f0" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                ))}
                <g clipPath="url(#sol-cortina)">
                  {visiveis.map(serie => (
                    <path
                      key={serie.chave}
                      d={pontos.map((item, indice) => `${indice ? 'L' : 'M'} ${xDe(indice).toFixed(1)} ${yDe(item[serie.chave]).toFixed(1)}`).join(' ')}
                      fill="none"
                      stroke={serie.cor}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              </svg>
              {ponto && (
                <div className="pointer-events-none absolute inset-y-0" style={{ left: `${(xDe(destaque ?? 0) / LARGURA) * 100}%` }} aria-hidden="true">
                  <div className="absolute inset-y-0 w-px -translate-x-1/2 bg-slate-300" />
                  {visiveis.map(serie => (
                    <span key={serie.chave} className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ top: `${(yDe(ponto[serie.chave]) / ALTURA) * 100}%`, backgroundColor: serie.cor }} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="relative ml-8 mt-1 h-4" aria-hidden="true">
            {pontos.map((item, indice) => comRotulo.has(indice) && (
              <span
                key={item.iso}
                className={`absolute whitespace-nowrap text-xs tabular-nums text-slate-500 ${indice === 0 ? '' : indice === pontos.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
                style={{ left: `${(xDe(indice) / LARGURA) * 100}%` }}
              >
                {item.rotulo}
              </span>
            ))}
          </div>
          <p className="mt-3 min-h-11 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-live="polite">
            {ponto
              ? <><strong className="text-slate-900">{ponto.rotulo}:</strong> {br(ponto.abertos)} {ponto.abertos === 1 ? 'aberto' : 'abertos'}, {br(ponto.aprovados)} {ponto.aprovados === 1 ? 'aprovado' : 'aprovados'} e {br(ponto.entregues)} {ponto.entregues === 1 ? 'entregue' : 'entregues'}.</>
              : 'Toque ou passe o mouse no gráfico para ver cada dia.'}
          </p>
        </div>
      )}
    </article>
  );
}
