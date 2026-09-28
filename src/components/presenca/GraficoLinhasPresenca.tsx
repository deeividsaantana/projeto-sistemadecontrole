import { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ChartLine, Table2 } from 'lucide-react';
import type { PontoDia } from '../../utils/relatorioPresenca';
import { CARTAO, FOCO, reduzMovimento } from '../cadastros/estilos';

const LARGURA = 640;
const ALTURA = 200;

const SERIES = [
  { chave: 'emCampo', nome: 'Em campo', cor: '#1baf7a' },
  { chave: 'faltas', nome: 'Faltas', cor: '#eb6834' },
  { chave: 'justificadas', nome: 'Justificadas', cor: '#2a78d6' },
] as const;
type Serie = typeof SERIES[number]['chave'];

const br = (valor: number) => valor.toLocaleString('pt-BR');

interface Props {
  pontos: readonly PontoDia[];
}

/**
 * Linhas por dia: quem esteve em campo, quem faltou e quem justificou.
 * Passar o dedo ou o mouse no gráfico mostra o dia; a legenda liga e desliga
 * cada linha; a tabela tem todos os números.
 */
export default function GraficoLinhasPresenca({ pontos }: Props) {
  const raiz = useRef<HTMLElement>(null);
  const [emTabela, setEmTabela] = useState(false);
  const [destaque, setDestaque] = useState<number | null>(null);
  const [ocultas, setOcultas] = useState<Serie[]>([]);
  const visiveis = SERIES.filter(serie => !ocultas.includes(serie.chave));
  const maior = Math.max(1, ...pontos.flatMap(ponto => visiveis.map(serie => ponto[serie.chave])));
  const passo = pontos.length > 1 ? LARGURA / (pontos.length - 1) : 0;
  const xDe = (indice: number) => (pontos.length > 1 ? indice * passo : LARGURA / 2);
  const yDe = (valor: number) => ALTURA - (valor / maior) * (ALTURA - 8);
  const assinatura = `${pontos.map(ponto => `${ponto.iso}:${ponto.emCampo}:${ponto.faltas}`).join('|')}#${ocultas.join(',')}`;

  // Dia sem envio não é zero: a linha para ali e recomeça no próximo dia com
  // envio, para o gráfico não inventar um dia em que ninguém veio.
  const trechos = useMemo(() => {
    const lista: number[][] = [];
    pontos.forEach((ponto, indice) => {
      if (!ponto.total) return;
      const ultimo = lista[lista.length - 1];
      if (ultimo && ultimo[ultimo.length - 1] === indice - 1) ultimo.push(indice);
      else lista.push([indice]);
    });
    return lista;
  }, [pontos]);
  const caminhos = useMemo(() => SERIES.map(serie => ({
    ...serie,
    linha: trechos.map(trecho => trecho
      .map((indice, posicao) => `${posicao ? 'L' : 'M'} ${xDe(indice).toFixed(1)} ${yDe(pontos[indice][serie.chave]).toFixed(1)}`)
      .join(' ')).join(' '),
  })), [assinatura, maior, trechos]);
  const areaEmCampo = trechos.map(trecho => {
    const linha = trecho.map((indice, posicao) => `${posicao ? 'L' : 'M'} ${xDe(indice).toFixed(1)} ${yDe(pontos[indice].emCampo).toFixed(1)}`).join(' ');
    return `${linha} L ${xDe(trecho[trecho.length - 1]).toFixed(1)} ${ALTURA} L ${xDe(trecho[0]).toFixed(1)} ${ALTURA} Z`;
  }).join(' ');

  // As linhas se desenham da esquerda para a direita, como o tempo passa.
  useGSAP(() => {
    if (reduzMovimento() || emTabela || !raiz.current) return;
    const cortina = raiz.current.querySelector('[data-cortina]');
    if (cortina) gsap.fromTo(cortina, { attr: { width: 0 } }, { attr: { width: LARGURA }, duration: 0.9, ease: 'power2.out' });
  }, { scope: raiz, dependencies: [assinatura, emTabela] });

  const escolherPeloPonteiro = (evento: React.PointerEvent<HTMLDivElement>) => {
    const caixa = evento.currentTarget.getBoundingClientRect();
    if (!caixa.width || !pontos.length) return;
    const proporcao = Math.min(1, Math.max(0, (evento.clientX - caixa.left) / caixa.width));
    setDestaque(Math.round(proporcao * (pontos.length - 1)));
  };
  const ponto = destaque === null ? null : pontos[destaque];
  // Rótulos do eixo: no máximo 5, espalhados por igual, para não encavalar no celular.
  const quantosRotulos = Math.min(5, pontos.length);
  const comRotulo = new Set(Array.from({ length: quantosRotulos }, (_, parte) => (
    quantosRotulos > 1 ? Math.round((parte * (pontos.length - 1)) / (quantosRotulos - 1)) : 0
  )));
  const semEnvio = pontos.every(item => item.total === 0);

  return (
    <article ref={raiz} data-presenca-reveal className={`${CARTAO} min-w-0 p-4 lg:col-span-8`} aria-labelledby="presenca-linhas">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="presenca-linhas" className="text-base font-bold text-slate-900">Presença dia a dia</h2>
          <p className="text-sm text-slate-500">Pessoas por dia. Dia sem envio fica em branco.</p>
        </div>
        <button
          type="button"
          onClick={() => setEmTabela(atual => !atual)}
          aria-pressed={emTabela}
          aria-label={emTabela ? 'Ver como gráfico' : 'Ver como tabela'}
          title={emTabela ? 'Ver como gráfico' : 'Ver como tabela'}
          className={`grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition duration-200 hover:border-emerald-500 hover:text-[#176b4d] ${FOCO}`}
        >
          {emTabela ? <ChartLine className="size-5" aria-hidden="true" /> : <Table2 className="size-5" aria-hidden="true" />}
        </button>
      </div>

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
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition duration-200 ${ligada ? 'border-slate-200 bg-white text-slate-800' : 'border-dashed border-slate-200 bg-slate-50 text-slate-400'} ${FOCO}`}
            >
              <i className={`h-1 w-4 rounded-full ${ligada ? '' : 'opacity-30'}`} style={{ backgroundColor: serie.cor }} aria-hidden="true" />
              {serie.nome}
            </button>
          );
        })}
      </div>

      {semEnvio ? (
        <p className="grid h-52 place-items-center text-center text-sm text-slate-500">Nenhum envio de presença neste período.</p>
      ) : emTabela ? (
        <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Presença por dia</caption>
            <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Dia</th>
                {SERIES.map(serie => <th key={serie.chave} className="px-3 py-2 text-right">{serie.nome}</th>)}
                <th className="px-3 py-2 text-right">Presença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...pontos].reverse().filter(item => item.total > 0).map(item => (
                <tr key={item.iso}>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{item.rotulo}</td>
                  {SERIES.map(serie => <td key={serie.chave} className="px-3 py-2 text-right tabular-nums text-slate-900">{br(item[serie.chave])}</td>)}
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">{item.taxa === null ? '—' : `${item.taxa}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3">
          <div className="relative pl-8">
            <span className="absolute left-0 top-0 text-xs tabular-nums text-slate-400">{br(maior)}</span>
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs tabular-nums text-slate-400">{br(Math.round(maior / 2))}</span>
            <span className="absolute bottom-0 left-0 text-xs tabular-nums text-slate-400">0</span>
            <div
              className="relative h-52 touch-pan-y"
              onPointerMove={escolherPeloPonteiro}
              onPointerDown={escolherPeloPonteiro}
              onPointerLeave={() => setDestaque(null)}
            >
              <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={`Presença por dia: ${pontos.filter(item => item.total).map(item => `${item.rotulo}, ${item.emCampo} em campo e ${item.faltas} faltas`).join('; ')}`}>
                <defs>
                  <clipPath id="presenca-cortina"><rect data-cortina x="0" y="-10" width={LARGURA} height={ALTURA + 20} /></clipPath>
                  <linearGradient id="presenca-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1baf7a" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#1baf7a" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 0.5, 1].map(parte => (
                  <line key={parte} x1="0" x2={LARGURA} y1={ALTURA * parte} y2={ALTURA * parte} stroke="#e2e8f0" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                ))}
                <g clipPath="url(#presenca-cortina)">
                  {!ocultas.includes('emCampo') && <path d={areaEmCampo} fill="url(#presenca-area)" />}
                  {trechos.filter(trecho => trecho.length === 1).flatMap(([indice]) => visiveis.map(serie => (
                    <line key={`${serie.chave}-${indice}`} x1={xDe(indice)} x2={xDe(indice)} y1={yDe(pontos[indice][serie.chave])} y2={yDe(pontos[indice][serie.chave])} stroke={serie.cor} strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  )))}
                  {caminhos.filter(serie => !ocultas.includes(serie.chave)).map(serie => (
                    <path key={serie.chave} d={serie.linha} fill="none" stroke={serie.cor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  ))}
                </g>
              </svg>
              {ponto && ponto.total > 0 && (
                <div className="pointer-events-none absolute inset-y-0" style={{ left: `${(xDe(destaque ?? 0) / LARGURA) * 100}%` }} aria-hidden="true">
                  <div className="absolute inset-y-0 w-px -translate-x-1/2 bg-slate-300" />
                  {visiveis.map(serie => (
                    <span
                      key={serie.chave}
                      className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                      style={{ top: `${(yDe(ponto[serie.chave]) / ALTURA) * 100}%`, backgroundColor: serie.cor }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="relative ml-8 mt-1 h-4" aria-hidden="true">
            {pontos.map((item, indice) => comRotulo.has(indice) && (
              <span
                key={item.iso}
                className={`absolute whitespace-nowrap text-[11px] tabular-nums text-slate-500 ${indice === 0 ? '' : indice === pontos.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
                style={{ left: `${(xDe(indice) / LARGURA) * 100}%` }}
              >
                {item.rotulo}
              </span>
            ))}
          </div>
          <p className="mt-3 min-h-11 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-live="polite">
            {ponto
              ? ponto.total
                ? <><strong className="text-slate-900">{ponto.rotulo}:</strong> {br(ponto.emCampo)} em campo, {br(ponto.faltas)} {ponto.faltas === 1 ? 'falta' : 'faltas'} e {br(ponto.justificadas)} {ponto.justificadas === 1 ? 'justificada' : 'justificadas'}{ponto.taxa !== null ? ` (${ponto.taxa}% de presença)` : ''}.</>
                : <><strong className="text-slate-900">{ponto.rotulo}:</strong> nenhuma equipe enviou presença.</>
              : 'Toque ou passe o mouse no gráfico para ver cada dia.'}
          </p>
        </div>
      )}
    </article>
  );
}
